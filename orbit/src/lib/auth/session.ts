import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/db/clients";
import { supabaseConfigured } from "@/lib/env";
import type { Actor, MemberRole } from "@/lib/domain/types";

export const ORG_COOKIE = "orbit_org";

export interface OrgContext {
  user: User;
  orgId: string;
  orgName: string;
  role: MemberRole;
  orgs: { id: string; name: string; role: MemberRole }[];
}

export const getUser = cache(async (): Promise<User | null> => {
  if (!supabaseConfigured()) return null;
  const db = await createUserClient();
  const { data } = await db.auth.getUser();
  return data.user ?? null;
});

/** Membership is read through RLS with the user's own JWT. */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getUser();
  if (!user) return null;
  const db = await createUserClient();
  const { data, error } = await db.from("memberships").select("org_id, role, organizations(name)").eq("user_id", user.id);
  if (error) throw new Error(`Falha ao carregar organizações: ${error.message}`);
  const orgs = (data ?? []).map((m) => ({
    id: m.org_id as string,
    role: m.role as MemberRole,
    name: ((m.organizations as unknown as { name: string } | null)?.name ?? "Organização") as string,
  }));
  if (orgs.length === 0) return null;
  const preferred = (await cookies()).get(ORG_COOKIE)?.value;
  const active = orgs.find((o) => o.id === preferred) ?? orgs[0]!;
  return { user, orgId: active.id, orgName: active.name, role: active.role, orgs };
});

export async function requireUser(): Promise<User> {
  if (!supabaseConfigured()) redirect("/setup");
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOrg(): Promise<OrgContext> {
  await requireUser();
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

export function actorFrom(ctx: OrgContext): Actor {
  return { userId: ctx.user.id, orgId: ctx.orgId, role: ctx.role, kind: "user" };
}
