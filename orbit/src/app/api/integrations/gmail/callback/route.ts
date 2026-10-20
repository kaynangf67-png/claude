import { NextResponse, type NextRequest } from "next/server";
import { getOrgContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/db/clients";
import { completeGmailConnection } from "@/lib/integrations/gmail";
import { writeAudit } from "@/lib/server/audit";
import { ToolError } from "@/lib/tools/types";

function back(req: NextRequest, key: "msg" | "err", text: string) {
  return NextResponse.redirect(new URL(`/integrations?${key}=${encodeURIComponent(text)}`, req.url));
}

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", req.url));
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  if (req.nextUrl.searchParams.get("error")) return back(req, "err", "A autorização foi cancelada no Google.");
  if (!state || !code) return back(req, "err", "Resposta de autorização incompleta.");

  const db = createServiceClient();
  // Single-use state, bound to the user and org that started the flow.
  const { data: row } = await db.from("oauth_states").delete().eq("state", state).select("*").maybeSingle();
  if (!row || row.user_id !== ctx.user.id || row.org_id !== ctx.orgId || new Date(row.expires_at).getTime() < Date.now()) {
    return back(req, "err", "Sessão de autorização inválida ou expirada. Tente novamente.");
  }
  try {
    const email = await completeGmailConnection(db, ctx.orgId, ctx.user.id, code, row.code_verifier);
    await writeAudit({ org_id: ctx.orgId, actor_id: ctx.user.id, action: "integration.connected", entity_type: "integration", entity_id: null, outcome: "success", details: { provider: "gmail", account: email } });
    return back(req, "msg", `Gmail conectado${email ? ` (${email})` : ""}.`);
  } catch (e) {
    const message = e instanceof ToolError ? e.message : "Falha ao concluir a conexão.";
    await writeAudit({ org_id: ctx.orgId, actor_id: ctx.user.id, action: "integration.failed", entity_type: "integration", entity_id: null, outcome: "failure", details: { provider: "gmail", error: message } });
    return back(req, "err", message);
  }
}
