import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, gmailConfigured } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { IntegrationUnavailableError, ToolError, type GmailPort } from "@/lib/tools/types";

export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.compose"];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

interface StoredTokens {
  refresh_token: string;
  access_token: string;
  expires_at: number;
}

export function redirectUri(): string {
  return `${env().NEXT_PUBLIC_APP_URL}/api/integrations/gmail/callback`;
}

export function newPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomBytes(24).toString("base64url") };
}

export function buildAuthUrl(state: string, challenge: string): string {
  const p = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env().GOOGLE_CLIENT_ID!, client_secret: env().GOOGLE_CLIENT_SECRET!, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ToolError("OAUTH_ERROR", `Google recusou a troca de token (${res.status}: ${String(json.error ?? "erro")})`);
  return json as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
}

/** Completes the OAuth flow and stores encrypted tokens. Returns the account email. */
export async function completeGmailConnection(db: SupabaseClient, orgId: string, userId: string, code: string, verifier: string) {
  const tok = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri() });
  if (!tok.refresh_token) throw new ToolError("OAUTH_ERROR", "O Google não retornou refresh token");
  const granted = (tok.scope ?? "").split(" ");
  if (!granted.includes("https://www.googleapis.com/auth/gmail.compose")) {
    throw new ToolError("OAUTH_SCOPE", "A permissão de rascunhos/envio do Gmail não foi concedida");
  }
  const info = await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${tok.access_token}` } });
  const email = info.ok ? (((await info.json()) as { email?: string }).email ?? null) : null;

  const { data: integ, error } = await db
    .from("integrations")
    .upsert(
      { org_id: orgId, provider: "gmail", status: "connected", account_email: email, scopes: granted, connected_by: userId, connected_at: new Date().toISOString(), last_error: null },
      { onConflict: "org_id,provider" },
    )
    .select("id")
    .single();
  if (error || !integ) throw new Error(`Falha ao salvar integração: ${error?.message}`);
  const secret: StoredTokens = { refresh_token: tok.refresh_token, access_token: tok.access_token, expires_at: Date.now() + tok.expires_in * 1000 };
  const { error: sErr } = await db
    .from("integration_secrets")
    .upsert({ integration_id: integ.id, org_id: orgId, ciphertext: encryptSecret(JSON.stringify(secret), integ.id), updated_at: new Date().toISOString() });
  if (sErr) throw new Error(`Falha ao salvar credenciais: ${sErr.message}`);
  return email;
}

export async function disconnectGmail(db: SupabaseClient, orgId: string) {
  const { data: integ } = await db.from("integrations").select("id").eq("org_id", orgId).eq("provider", "gmail").maybeSingle();
  if (!integ) return;
  const { data: sec } = await db.from("integration_secrets").select("ciphertext").eq("integration_id", integ.id).eq("org_id", orgId).maybeSingle();
  if (sec && gmailConfigured()) {
    try {
      const t = JSON.parse(decryptSecret(sec.ciphertext, integ.id)) as StoredTokens;
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(t.refresh_token)}`, { method: "POST" });
    } catch {
      // Revocation is best-effort; local credentials are deleted regardless.
    }
  }
  await db.from("integration_secrets").delete().eq("integration_id", integ.id).eq("org_id", orgId);
  await db.from("integrations").update({ status: "disconnected", last_error: null }).eq("id", integ.id).eq("org_id", orgId);
}

export async function isGmailConnected(db: SupabaseClient, orgId: string): Promise<boolean> {
  if (!gmailConfigured()) return false;
  const { data } = await db.from("integrations").select("status").eq("org_id", orgId).eq("provider", "gmail").maybeSingle();
  return data?.status === "connected";
}

function headerSafe(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

export function buildRawMessage(m: { to: string[]; subject: string; body: string }): string {
  const subject = `=?UTF-8?B?${Buffer.from(headerSafe(m.subject)).toString("base64")}?=`;
  const lines = [
    `To: ${m.to.map(headerSafe).join(", ")}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(m.body).toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

/** GmailPort backed by the Gmail REST API with per-org encrypted tokens. */
export class GmailAdapter implements GmailPort {
  constructor(private readonly db: SupabaseClient) {}

  private async loadTokens(orgId: string) {
    if (!gmailConfigured()) throw new IntegrationUnavailableError("gmail", "credenciais OAuth do Google não configuradas no servidor");
    const { data: integ } = await this.db.from("integrations").select("id, status").eq("org_id", orgId).eq("provider", "gmail").maybeSingle();
    if (!integ || integ.status !== "connected") throw new IntegrationUnavailableError("gmail", "não conectado nesta organização");
    const { data: sec } = await this.db.from("integration_secrets").select("ciphertext").eq("integration_id", integ.id).eq("org_id", orgId).maybeSingle();
    if (!sec) throw new IntegrationUnavailableError("gmail", "credenciais ausentes; reconecte a integração");
    return { integrationId: integ.id as string, tokens: JSON.parse(decryptSecret(sec.ciphertext, integ.id)) as StoredTokens };
  }

  private async accessToken(orgId: string, forceRefresh = false): Promise<{ token: string; integrationId: string }> {
    const { integrationId, tokens } = await this.loadTokens(orgId);
    if (!forceRefresh && tokens.expires_at - 60_000 > Date.now()) return { token: tokens.access_token, integrationId };
    let fresh;
    try {
      fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
    } catch (e) {
      await this.db.from("integrations").update({ status: "error", last_error: "Falha ao renovar o token; reconecte o Gmail" }).eq("id", integrationId).eq("org_id", orgId);
      throw e;
    }
    const next: StoredTokens = { refresh_token: fresh.refresh_token ?? tokens.refresh_token, access_token: fresh.access_token, expires_at: Date.now() + fresh.expires_in * 1000 };
    await this.db.from("integration_secrets").update({ ciphertext: encryptSecret(JSON.stringify(next), integrationId), updated_at: new Date().toISOString() }).eq("integration_id", integrationId).eq("org_id", orgId);
    return { token: next.access_token, integrationId };
  }

  private async call<T>(orgId: string, path: string, init: RequestInit = {}, allow404 = false): Promise<T | null> {
    let { token, integrationId } = await this.accessToken(orgId);
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${API}${path}`, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}`, "content-type": "application/json" } });
      if (res.status === 401 && attempt === 0) {
        ({ token, integrationId } = await this.accessToken(orgId, true));
        continue;
      }
      if (allow404 && res.status === 404) return null;
      if (!res.ok) {
        // Do not echo response bodies: they may contain message content.
        throw new ToolError("GMAIL_API_ERROR", `Gmail respondeu ${res.status}`, false);
      }
      await this.db.from("integrations").update({ last_success_at: new Date().toISOString(), last_error: null }).eq("id", integrationId).eq("org_id", orgId);
      return (await res.json()) as T;
    }
    throw new ToolError("GMAIL_AUTH", "Não foi possível autenticar no Gmail");
  }

  async createDraft(orgId: string, msg: { to: string[]; subject: string; body: string }) {
    const r = await this.call<{ id: string; message: { id: string } }>(orgId, "/drafts", { method: "POST", body: JSON.stringify({ message: { raw: buildRawMessage(msg) } }) });
    return { draftId: r!.id, messageId: r!.message.id };
  }

  async getDraft(orgId: string, draftId: string) {
    const r = await this.call<{ id: string; message: { payload?: { headers?: { name: string; value: string }[] } } }>(
      orgId,
      `/drafts/${encodeURIComponent(draftId)}?format=metadata`,
      {},
      true,
    );
    if (!r) return null;
    const h = (n: string) => r.message.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? null;
    return { draftId: r.id, subject: decodeMimeWord(h("subject")), to: h("to") };
  }

  async sendMessage(orgId: string, msg: { to: string[]; subject: string; body: string }) {
    const r = await this.call<{ id: string; threadId: string }>(orgId, "/messages/send", { method: "POST", body: JSON.stringify({ raw: buildRawMessage(msg) }) });
    return { messageId: r!.id, threadId: r!.threadId };
  }

  async getMessageLabels(orgId: string, messageId: string) {
    const r = await this.call<{ labelIds?: string[] }>(orgId, `/messages/${encodeURIComponent(messageId)}?format=minimal`, {}, true);
    return r ? (r.labelIds ?? []) : null;
  }
}

/** Gmail may return the subject still MIME-encoded or already decoded. */
export function decodeMimeWord(v: string | null): string | null {
  if (!v) return v;
  return v.replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_, b64: string) => Buffer.from(b64, "base64").toString("utf8"));
}
