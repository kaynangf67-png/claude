import { NextResponse, type NextRequest } from "next/server";
import { createUserClient } from "@/lib/db/clients";
import { supabaseConfigured } from "@/lib/env";

/** Exchanges the PKCE code from confirmation / password-reset emails for a session. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextParam = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  if (!supabaseConfigured() || !code) return NextResponse.redirect(new URL("/login?error=link", request.url));
  const db = await createUserClient();
  const { error } = await db.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/login?error=link" : next, request.url));
}
