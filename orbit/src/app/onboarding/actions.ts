"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/clients";
import { requireUser, ORG_COOKIE } from "@/lib/auth/session";
import { writeAudit } from "@/lib/server/audit";
import type { ActionState } from "@/components/ui/client";

export async function createOrganizationAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.string().trim().min(2, "Mínimo de 2 caracteres").max(120).safeParse(fd.get("name"));
  if (!parsed.success) return { ok: false, fieldErrors: { name: [parsed.error.issues[0]!.message] } };
  const db = createServiceClient();
  const { count } = await db.from("memberships").select("org_id", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "owner");
  if ((count ?? 0) >= 5) return { ok: false, message: "Limite de 5 organizações próprias por usuário." };
  const { data, error } = await db.rpc("orbit_create_organization", { p_user: user.id, p_name: parsed.data });
  if (error || !data) return { ok: false, message: "Não foi possível criar a organização." };
  await writeAudit({ org_id: data as string, actor_id: user.id, action: "organization.created", entity_type: "organization", entity_id: data as string, outcome: "success", details: { name: parsed.data } });
  (await cookies()).set(ORG_COOKIE, data as string, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect("/dashboard");
}
