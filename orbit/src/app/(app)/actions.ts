"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorFrom, getOrgContext, requireOrg, ORG_COOKIE } from "@/lib/auth/session";
import { getEngine } from "@/lib/engine/factory";
import { createServiceClient } from "@/lib/db/clients";
import { hasPermission, requirePermission } from "@/lib/domain/permissions";
import { MEMBER_ROLES, TOOL_MODES } from "@/lib/domain/types";
import { listTools } from "@/lib/tools/registry";
import { toActionState } from "@/lib/server/errors";
import { writeAudit } from "@/lib/server/audit";
import { disconnectGmail } from "@/lib/integrations/gmail";
import { runOptimizer } from "@/lib/engine/optimizer";
import type { ActionState } from "@/components/ui/client";

const uuid = z.uuid();

/** Redirect back with a message shown by <PageMessage>. */
function back(path: string, result: { ok: boolean; message?: string }): never {
  const qs = new URLSearchParams(result.message ? { [result.ok ? "msg" : "err"]: result.message } : {});
  redirect(qs.size ? `${path}?${qs}` : path);
}

/** Continue executing a mission after the response is sent. */
function runInBackground(orgId: string, missionId: string) {
  after(async () => {
    try {
      await getEngine().runMission(orgId, missionId, { timeBudgetMs: 45_000 });
    } catch (e) {
      console.error("[orbit] background run failed", missionId, e);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Organization                                                         */
/* ------------------------------------------------------------------ */

export async function switchOrgAction(fd: FormData) {
  const ctx = await getOrgContext();
  const target = String(fd.get("org_id") ?? "");
  if (ctx?.orgs.some((o) => o.id === target)) {
    (await cookies()).set(ORG_COOKIE, target, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  }
  redirect("/dashboard");
}

/* ------------------------------------------------------------------ */
/* Missions                                                             */
/* ------------------------------------------------------------------ */

const missionInput = z.object({
  name: z.string().trim().min(2, "Mínimo de 2 caracteres").max(120),
  objective: z.string().trim().min(10, "Descreva o objetivo com pelo menos 10 caracteres").max(4000),
  planning: z.enum(["ai", "manual"]),
});

export async function createMissionAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrg();
  const parsed = missionInput.safeParse({ name: fd.get("name"), objective: fd.get("objective"), planning: fd.get("planning") });
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const engine = getEngine();
  let id: string;
  try {
    const mission = await engine.createMission(actorFrom(ctx), parsed.data);
    id = mission.id;
  } catch (e) {
    return toActionState(e);
  }
  if (parsed.data.planning === "ai") {
    try {
      await engine.generatePlan(actorFrom(ctx), id);
    } catch (e) {
      back(`/missions/${id}`, toActionState(e));
    }
  }
  redirect(`/missions/${id}`);
}

export async function generatePlanAction(fd: FormData) {
  const ctx = await requireOrg();
  const id = uuid.parse(fd.get("mission_id"));
  try {
    await getEngine().generatePlan(actorFrom(ctx), id);
  } catch (e) {
    back(`/missions/${id}`, toActionState(e));
  }
  back(`/missions/${id}`, { ok: true, message: "Plano gerado. Revise antes de aprovar." });
}

export async function savePlanAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrg();
  const id = uuid.safeParse(fd.get("mission_id"));
  if (!id.success) return { ok: false, message: "Missão inválida" };
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("plan") ?? ""));
  } catch {
    return { ok: false, message: "O plano não é um JSON válido." };
  }
  try {
    const m = await getEngine().savePlan(actorFrom(ctx), id.data, raw);
    revalidatePath(`/missions/${id.data}`);
    return m.plan_review?.valid
      ? { ok: true, message: "Plano salvo e validado." }
      : { ok: false, message: "Plano salvo, mas há tarefas bloqueadas pela política. Veja a revisão do plano acima." };
  } catch (e) {
    return toActionState(e);
  }
}

export async function approvePlanAction(fd: FormData) {
  const ctx = await requireOrg();
  const id = uuid.parse(fd.get("mission_id"));
  try {
    await getEngine().approvePlan(actorFrom(ctx), id);
  } catch (e) {
    back(`/missions/${id}`, toActionState(e));
  }
  runInBackground(ctx.orgId, id);
  back(`/missions/${id}`, { ok: true, message: "Plano aprovado. A execução começou." });
}

export async function missionControlAction(fd: FormData) {
  const ctx = await requireOrg();
  const id = uuid.parse(fd.get("mission_id"));
  const op = z.enum(["pause", "resume", "cancel", "run"]).parse(fd.get("op"));
  const engine = getEngine();
  const actor = actorFrom(ctx);
  try {
    if (op === "pause") await engine.pauseMission(actor, id);
    if (op === "cancel") await engine.cancelMission(actor, id);
    if (op === "resume") {
      await engine.resumeMission(actor, id);
      runInBackground(ctx.orgId, id);
    }
    if (op === "run") {
      requirePermission(ctx.role, "missions:execute");
      const m = await createServiceClient().from("missions").select("status").eq("org_id", ctx.orgId).eq("id", id).maybeSingle();
      if (!m.data || !["queued", "running"].includes(m.data.status)) back(`/missions/${id}`, { ok: false, message: "A missão não está em execução." });
      runInBackground(ctx.orgId, id);
    }
  } catch (e) {
    back(`/missions/${id}`, toActionState(e));
  }
  const labels = { pause: "Missão pausada.", resume: "Missão retomada.", cancel: "Missão cancelada.", run: "Execução retomada." };
  back(`/missions/${id}`, { ok: true, message: labels[op] });
}

/* ------------------------------------------------------------------ */
/* Approvals                                                            */
/* ------------------------------------------------------------------ */

export async function decideApprovalAction(fd: FormData) {
  const ctx = await requireOrg();
  const id = uuid.parse(fd.get("approval_id"));
  const decision = z.enum(["approved", "rejected"]).parse(fd.get("decision"));
  const note = z.string().trim().max(1000).parse(fd.get("note") ?? "") || null;
  const returnTo = String(fd.get("return_to") ?? "/approvals").startsWith("/") ? String(fd.get("return_to") ?? "/approvals") : "/approvals";
  try {
    const a = await getEngine().decideApproval(actorFrom(ctx), id, decision, note);
    runInBackground(ctx.orgId, a.mission_id);
  } catch (e) {
    back(returnTo, toActionState(e));
  }
  back(returnTo, { ok: true, message: decision === "approved" ? "Ação aprovada. A missão continuará." : "Ação rejeitada." });
}

/* ------------------------------------------------------------------ */
/* Business records                                                     */
/* ------------------------------------------------------------------ */

const recordInput = z.object({
  kind: z.enum(["customer_message", "note", "contact", "order"]),
  title: z.string().trim().min(1, "Informe um título").max(200),
  body: z.string().max(20000).default(""),
  sender: z.string().trim().max(200).optional(),
});

export async function createRecordAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrg();
  if (!hasPermission(ctx.role, "records:write")) return { ok: false, message: "Você não tem permissão para cadastrar registros." };
  const parsed = recordInput.safeParse({ kind: fd.get("kind"), title: fd.get("title"), body: fd.get("body") ?? "", sender: fd.get("sender") || undefined });
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { data, error } = await createServiceClient()
    .from("records")
    .insert({ ...parsed.data, sender: parsed.data.sender ?? null, org_id: ctx.orgId, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error) return { ok: false, message: "Não foi possível salvar o registro." };
  await writeAudit({ org_id: ctx.orgId, actor_id: ctx.user.id, action: "record.created", entity_type: "record", entity_id: data.id, outcome: "success", details: { kind: parsed.data.kind } });
  revalidatePath("/data");
  return { ok: true, message: "Registro salvo." };
}

export async function updateRecordStatusAction(fd: FormData) {
  const ctx = await requireOrg();
  const id = uuid.parse(fd.get("record_id"));
  const status = z.enum(["open", "in_progress", "closed"]).parse(fd.get("status"));
  if (!hasPermission(ctx.role, "records:write")) back("/data", { ok: false, message: "Você não tem permissão para alterar registros." });
  await createServiceClient().from("records").update({ status }).eq("org_id", ctx.orgId).eq("id", id);
  await writeAudit({ org_id: ctx.orgId, actor_id: ctx.user.id, action: "record.status_changed", entity_type: "record", entity_id: id, outcome: "success", details: { status } });
  back("/data", { ok: true, message: "Status atualizado." });
}

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */

const domainRe = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export async function updatePolicyAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrg();
  if (!hasPermission(ctx.role, "policies:manage")) return { ok: false, message: "Somente administradores alteram políticas." };
  const toolIds = listTools().map((t) => t.id);
  const toolModes: Record<string, string> = {};
  for (const id of toolIds) {
    const v = fd.get(`mode:${id}`);
    if (typeof v === "string" && v !== "default") toolModes[id] = v;
  }
  const domains = String(fd.get("email_allowed_domains") ?? "")
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  const parsed = z
    .object({
      require_plan_review: z.boolean(),
      require_distinct_approver: z.boolean(),
      max_actions_per_mission: z.coerce.number().int().min(1).max(200),
      max_task_duration_ms: z.coerce.number().int().min(1000).max(300000),
      monthly_ai_budget_usd: z.coerce.number().min(0).max(100000),
      missions_per_hour: z.coerce.number().int().min(1).max(1000),
      approval_ttl_hours: z.coerce.number().int().min(1).max(720),
      tool_modes: z.partialRecord(z.enum(toolIds as [string, ...string[]]), z.enum(TOOL_MODES)),
      email_allowed_domains: z.array(z.string().regex(domainRe, "Domínio inválido")).max(50),
    })
    .safeParse({
      require_plan_review: fd.get("require_plan_review") === "on",
      require_distinct_approver: fd.get("require_distinct_approver") === "on",
      max_actions_per_mission: fd.get("max_actions_per_mission"),
      max_task_duration_ms: Number(fd.get("max_task_duration_s")) * 1000,
      monthly_ai_budget_usd: fd.get("monthly_ai_budget_usd"),
      missions_per_hour: fd.get("missions_per_hour"),
      approval_ttl_hours: fd.get("approval_ttl_hours"),
      tool_modes: toolModes,
      email_allowed_domains: domains,
    });
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const db = createServiceClient();
  const { data: current } = await db.from("org_policies").select("version").eq("org_id", ctx.orgId).single();
  // Bumping the version invalidates every outstanding approval bound to the old policy.
  const { error } = await db
    .from("org_policies")
    .update({ ...parsed.data, version: (current?.version ?? 1) + 1, updated_by: ctx.user.id })
    .eq("org_id", ctx.orgId)
    .eq("version", current?.version ?? 1);
  if (error) return { ok: false, message: "Não foi possível salvar as políticas." };
  await writeAudit({ org_id: ctx.orgId, actor_id: ctx.user.id, action: "policy.updated", entity_type: "organization", entity_id: ctx.orgId, outcome: "success", details: { ...parsed.data, version: (current?.version ?? 1) + 1 } });
  revalidatePath("/settings");
  return { ok: true, message: "Políticas salvas. Aprovações pendentes vinculadas à versão anterior deixarão de valer." };
}

export async function emergencyStopAction(fd: FormData) {
  const ctx = await requireOrg();
  if (!hasPermission(ctx.role, "policies:manage")) back("/settings", { ok: false, message: "Somente administradores usam a parada de emergência." });
  const paused = fd.get("paused") === "true";
  const db = createServiceClient();
  const { data: current } = await db.from("org_policies").select("version").eq("org_id", ctx.orgId).single();
  await db.from("org_policies").update({ execution_paused: paused, version: (current?.version ?? 1) + 1, updated_by: ctx.user.id }).eq("org_id", ctx.orgId);
  await writeAudit({ org_id: ctx.orgId, actor_id: ctx.user.id, action: paused ? "policy.emergency_stop" : "policy.emergency_resume", entity_type: "organization", entity_id: ctx.orgId, outcome: "success", details: {} });
  back("/settings", { ok: true, message: paused ? "Parada de emergência ativada." : "Execuções liberadas novamente." });
}

export async function updateOrgAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrg();
  if (!hasPermission(ctx.role, "org:manage")) return { ok: false, message: "Somente o proprietário altera a organização." };
  const name = z.string().trim().min(2).max(120).safeParse(fd.get("name"));
  if (!name.success) return { ok: false, fieldErrors: { name: ["Entre 2 e 120 caracteres"] } };
  await createServiceClient().from("organizations").update({ name: name.data }).eq("id", ctx.orgId);
  await writeAudit({ org_id: ctx.orgId, actor_id: ctx.user.id, action: "organization.updated", entity_type: "organization", entity_id: ctx.orgId, outcome: "success", details: { name: name.data } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Organização atualizada." };
}

export async function updateProfileAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrg();
  const parsed = z
    .object({ full_name: z.string().trim().min(2).max(120), notify_approvals: z.boolean(), notify_failures: z.boolean() })
    .safeParse({ full_name: fd.get("full_name"), notify_approvals: fd.get("notify_approvals") === "on", notify_failures: fd.get("notify_failures") === "on" });
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  await createServiceClient().from("profiles").update(parsed.data).eq("id", ctx.user.id);
  revalidatePath("/settings");
  return { ok: true, message: "Perfil atualizado." };
}

export async function addMemberAction(_: ActionState | null, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrg();
  if (!hasPermission(ctx.role, "org:manage") && ctx.role !== "admin") return { ok: false, message: "Sem permissão para gerenciar membros." };
  const parsed = z.object({ email: z.email().max(200), role: z.enum(MEMBER_ROLES) }).safeParse({ email: fd.get("email"), role: fd.get("role") });
  if (!parsed.success) return { ok: false, message: "Informe um e-mail e um papel válidos." };
  if (parsed.data.role === "owner" && ctx.role !== "owner") return { ok: false, message: "Somente proprietários adicionam outros proprietários." };
  const db = createServiceClient();
  const email = parsed.data.email.toLowerCase();
  let userId: string | undefined = (await db.from("profiles").select("id").ilike("email", email).maybeSingle()).data?.id;
  let invited = false;
  if (!userId) {
    const inv = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback?next=/reset-password` });
    if (inv.error || !inv.data.user) return { ok: false, message: `Não foi possível convidar: ${inv.error?.message ?? "erro"}` };
    userId = inv.data.user.id;
    invited = true;
  }
  const { error } = await db.from("memberships").upsert({ org_id: ctx.orgId, user_id: userId, role: parsed.data.role }, { onConflict: "org_id,user_id", ignoreDuplicates: true });
  if (error) return { ok: false, message: "Não foi possível adicionar o membro." };
  await writeAudit({ org_id: ctx.orgId, actor_id: ctx.user.id, action: "member.added", entity_type: "user", entity_id: userId, outcome: "success", details: { role: parsed.data.role, invited } });
  revalidatePath("/settings");
  return { ok: true, message: invited ? "Convite enviado por e-mail." : "Membro adicionado." };
}

export async function changeMemberAction(fd: FormData) {
  const ctx = await requireOrg();
  const userId = uuid.parse(fd.get("user_id"));
  const op = z.enum(["remove", "role"]).parse(fd.get("op"));
  if (ctx.role !== "owner" && ctx.role !== "admin") back("/settings", { ok: false, message: "Sem permissão para gerenciar membros." });
  const db = createServiceClient();
  const { data: members } = await db.from("memberships").select("user_id, role").eq("org_id", ctx.orgId);
  const target = members?.find((m) => m.user_id === userId);
  if (!target) back("/settings", { ok: false, message: "Membro não encontrado." });
  if (target!.role === "owner" && ctx.role !== "owner") back("/settings", { ok: false, message: "Somente proprietários alteram outros proprietários." });
  const owners = members!.filter((m) => m.role === "owner").length;
  const newRole = op === "role" ? z.enum(MEMBER_ROLES).parse(fd.get("role")) : null;
  if (newRole === "owner" && ctx.role !== "owner") back("/settings", { ok: false, message: "Somente proprietários promovem a proprietário." });
  if (target!.role === "owner" && owners <= 1 && (op === "remove" || newRole !== "owner")) back("/settings", { ok: false, message: "A organização precisa de pelo menos um proprietário." });
  if (op === "remove") await db.from("memberships").delete().eq("org_id", ctx.orgId).eq("user_id", userId);
  else await db.from("memberships").update({ role: newRole }).eq("org_id", ctx.orgId).eq("user_id", userId);
  await writeAudit({ org_id: ctx.orgId, actor_id: ctx.user.id, action: op === "remove" ? "member.removed" : "member.role_changed", entity_type: "user", entity_id: userId, outcome: "success", details: { role: newRole, previous: target!.role } });
  back("/settings", { ok: true, message: op === "remove" ? "Membro removido." : "Papel atualizado." });
}

/* ------------------------------------------------------------------ */
/* Integrations & agents                                                */
/* ------------------------------------------------------------------ */

export async function disconnectGmailAction() {
  const ctx = await requireOrg();
  if (!hasPermission(ctx.role, "integrations:manage")) back("/integrations", { ok: false, message: "Sem permissão para gerenciar integrações." });
  await disconnectGmail(createServiceClient(), ctx.orgId);
  await writeAudit({ org_id: ctx.orgId, actor_id: ctx.user.id, action: "integration.disconnected", entity_type: "integration", entity_id: null, outcome: "success", details: { provider: "gmail" } });
  back("/integrations", { ok: true, message: "Gmail desconectado e credenciais apagadas." });
}

export async function runOptimizerAction() {
  const ctx = await requireOrg();
  try {
    requirePermission(ctx.role, "missions:execute");
    await runOptimizer(ctx.orgId, ctx.user.id);
  } catch (e) {
    back("/agents/optimizer", toActionState(e));
  }
  back("/agents/optimizer", { ok: true, message: "Análise concluída." });
}
