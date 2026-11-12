import { describe, expect, it } from "vitest";
import { applyMode, type Result } from "./analyze.js";

const base = { symbol: "USD/EGP (OTC)", decision: "PUT", stop_price: 53.02, target_price: 52.9955, warnings: ["Stop e alvo derivados dos suportes e resistências lidos no print."] } as unknown as Result;

describe("modo do print", () => {
  it("binárias: sem stop e alvo", () => {
    const r = applyMode(base, "binarias");
    expect(r.stop_price).toBeNull(); expect(r.target_price).toBeNull(); expect(r.mode).toBe("binarias");
    expect(r.warnings.some((w) => /stop e alvo/i.test(w))).toBe(false);
  });
  it("forex: mantém stop e alvo", () => {
    const r = applyMode(base, "forex");
    expect(r.stop_price).toBe(53.02); expect(r.target_price).toBe(52.9955);
  });
  it("OTC avisa que não é mercado real", () => {
    expect(applyMode(base, "binarias").warnings.some((w) => w.includes("OTC"))).toBe(true);
    expect(applyMode({ ...base, symbol: "EUR/USD" }, "forex").warnings.some((w) => w.includes("OTC"))).toBe(false);
  });
});
