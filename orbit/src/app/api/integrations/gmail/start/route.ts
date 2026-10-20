import { NextResponse, type NextRequest } from "next/server";
import { getOrgContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/db/clients";
import { hasPermission } from "@/lib/domain/permissions";
import { gmailConfigured } from "@/lib/env";
import { buildAuthUrl, newPkce } from "@/lib/integrations/gmail";

function back(req: NextRequest, err: string) {
  return NextResponse.redirect(new URL(`/integrations?err=${encodeURIComponent(err)}`, req.url));
}

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (!hasPermission(ctx.role, "integrations:manage")) return back(req, "Sem permissão para conectar integrações.");
  if (!gmailConfigured()) return back(req, "O OAuth do Google não está configurado neste servidor.");
  const { verifier, challenge, state } = newPkce();
  const { error } = await createServiceClient()
    .from("oauth_states")
    .insert({ state, org_id: ctx.orgId, user_id: ctx.user.id, provider: "gmail", code_verifier: verifier, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
  if (error) return back(req, "Não foi possível iniciar a conexão.");
  return NextResponse.redirect(buildAuthUrl(state, challenge), 303);
}
