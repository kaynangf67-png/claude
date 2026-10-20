import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.ORBIT_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("secret encryption", () => {
  it("round-trips and is bound to its AAD", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto/secrets");
    const ct = encryptSecret('{"refresh_token":"abc"}', "integration-1");
    expect(ct).not.toContain("abc");
    expect(decryptSecret(ct, "integration-1")).toBe('{"refresh_token":"abc"}');
    expect(() => decryptSecret(ct, "integration-2")).toThrow();
    const tampered = ct.slice(0, -4) + (ct.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decryptSecret(tampered, "integration-1")).toThrow();
  });
});

describe("gmail MIME builder", () => {
  it("encodes UTF-8 subjects and strips header injection", async () => {
    const { buildRawMessage, decodeMimeWord } = await import("@/lib/integrations/gmail");
    const raw = buildRawMessage({ to: ["a@b.com"], subject: "Olá\r\nBcc: evil@x.com", body: "Corpo com acentuação" });
    const text = Buffer.from(raw, "base64url").toString("utf8");
    const headers = text.split("\r\n\r\n")[0]!;
    expect(headers).not.toMatch(/^Bcc:/m);
    const subject = headers.match(/^Subject: (.*)$/m)![1]!;
    expect(decodeMimeWord(subject)).toBe("Olá Bcc: evil@x.com");
    const body = Buffer.from(text.split("\r\n\r\n")[1]!.replace(/\r\n/g, ""), "base64").toString("utf8");
    expect(body).toBe("Corpo com acentuação");
  });
});
