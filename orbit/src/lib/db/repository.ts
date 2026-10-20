import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_POLICY, type Approval, type MemberRole, type Mission, type OrgPolicy, type Task, type ToolExecution } from "@/lib/domain/types";
import type { AgentRunResult, AuditEvent, EngineRepository, NewAgentRun, NewApproval, NewMission, NewTask, NewToolExecution, UsageRecord } from "@/lib/engine/ports";

export class DatabaseError extends Error {
  constructor(op: string, detail: string) {
    super(`Database error in ${op}: ${detail}`);
    this.name = "DatabaseError";
  }
}

type Res<T> = { data: T; error: { message: string } | null };
function must<T>(op: string, res: Res<T>): T {
  if (res.error) throw new DatabaseError(op, res.error.message);
  return res.data;
}

export function toPolicy(row: Record<string, unknown> | null, orgId: string): OrgPolicy {
  if (!row) return { ...DEFAULT_POLICY, org_id: orgId };
  return {
    org_id: orgId,
    version: Number(row.version),
    execution_paused: Boolean(row.execution_paused),
    require_plan_review: Boolean(row.require_plan_review),
    require_distinct_approver: Boolean(row.require_distinct_approver),
    max_actions_per_mission: Number(row.max_actions_per_mission),
    max_task_duration_ms: Number(row.max_task_duration_ms),
    monthly_ai_budget_usd: Number(row.monthly_ai_budget_usd),
    missions_per_hour: Number(row.missions_per_hour),
    approval_ttl_hours: Number(row.approval_ttl_hours),
    tool_modes: (row.tool_modes ?? {}) as OrgPolicy["tool_modes"],
    email_allowed_domains: (row.email_allowed_domains ?? []) as string[],
  };
}

/** Engine storage on Supabase (service role). Every query is filtered by org_id. */
export class SupabaseEngineRepository implements EngineRepository {
  constructor(private readonly db: SupabaseClient) {}

  async getMembershipRole(orgId: string, userId: string): Promise<MemberRole | null> {
    const row = must("getMembershipRole", await this.db.from("memberships").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle());
    return (row?.role as MemberRole) ?? null;
  }

  async getPolicy(orgId: string): Promise<OrgPolicy> {
    const row = must("getPolicy", await this.db.from("org_policies").select("*").eq("org_id", orgId).maybeSingle());
    return toPolicy(row, orgId);
  }

  async insertMission(m: NewMission): Promise<Mission> {
    return must("insertMission", await this.db.from("missions").insert(m).select("*").single()) as Mission;
  }

  async getMission(orgId: string, id: string): Promise<Mission | null> {
    return must("getMission", await this.db.from("missions").select("*").eq("org_id", orgId).eq("id", id).maybeSingle()) as Mission | null;
  }

  async updateMissionIf(orgId: string, id: string, expected: Mission["status"][], patch: Partial<Mission>): Promise<Mission | null> {
    return must(
      "updateMissionIf",
      await this.db.from("missions").update(patch).eq("org_id", orgId).eq("id", id).in("status", expected).select("*").maybeSingle(),
    ) as Mission | null;
  }

  async acquireMissionLock(orgId: string, id: string, token: string, ttlMs: number): Promise<boolean> {
    return Boolean(must("acquireMissionLock", await this.db.rpc("orbit_acquire_mission_lock", { p_org: orgId, p_mission: id, p_token: token, p_ttl_ms: ttlMs })));
  }

  async releaseMissionLock(orgId: string, id: string, token: string): Promise<void> {
    must("releaseMissionLock", await this.db.rpc("orbit_release_mission_lock", { p_org: orgId, p_mission: id, p_token: token }));
  }

  async incrementActionCount(orgId: string, id: string): Promise<number> {
    return Number(must("incrementActionCount", await this.db.rpc("orbit_increment_action_count", { p_org: orgId, p_mission: id })));
  }

  async countMissionsCreatedSince(orgId: string, sinceIso: string): Promise<number> {
    const res = await this.db.from("missions").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", sinceIso);
    if (res.error) throw new DatabaseError("countMissionsCreatedSince", res.error.message);
    return res.count ?? 0;
  }

  async listRunnableMissions(limit: number) {
    const now = new Date().toISOString();
    return must(
      "listRunnableMissions",
      await this.db
        .from("missions")
        .select("id, org_id, created_by")
        .in("status", ["queued", "running"])
        .or(`locked_until.is.null,locked_until.lt.${now}`)
        .order("updated_at", { ascending: true })
        .limit(limit),
    ) as Pick<Mission, "id" | "org_id" | "created_by">[];
  }

  async insertTasks(tasks: NewTask[]): Promise<Task[]> {
    return must("insertTasks", await this.db.from("tasks").insert(tasks).select("*")) as Task[];
  }

  async listTasks(orgId: string, missionId: string): Promise<Task[]> {
    return must("listTasks", await this.db.from("tasks").select("*").eq("org_id", orgId).eq("mission_id", missionId).order("created_at").order("key")) as Task[];
  }

  async getTask(orgId: string, id: string): Promise<Task | null> {
    return must("getTask", await this.db.from("tasks").select("*").eq("org_id", orgId).eq("id", id).maybeSingle()) as Task | null;
  }

  async updateTaskIf(orgId: string, id: string, expected: Task["status"][], patch: Partial<Task>): Promise<Task | null> {
    return must("updateTaskIf", await this.db.from("tasks").update(patch).eq("org_id", orgId).eq("id", id).in("status", expected).select("*").maybeSingle()) as Task | null;
  }

  async insertApproval(a: NewApproval): Promise<Approval> {
    return must("insertApproval", await this.db.from("approvals").insert(a).select("*").single()) as Approval;
  }

  async getApproval(orgId: string, id: string): Promise<Approval | null> {
    return must("getApproval", await this.db.from("approvals").select("*").eq("org_id", orgId).eq("id", id).maybeSingle()) as Approval | null;
  }

  async updateApprovalIf(orgId: string, id: string, expected: Approval["status"][], patch: Partial<Approval>): Promise<Approval | null> {
    return must("updateApprovalIf", await this.db.from("approvals").update(patch).eq("org_id", orgId).eq("id", id).in("status", expected).select("*").maybeSingle()) as Approval | null;
  }

  async listApprovalsForMission(orgId: string, missionId: string): Promise<Approval[]> {
    return must("listApprovalsForMission", await this.db.from("approvals").select("*").eq("org_id", orgId).eq("mission_id", missionId)) as Approval[];
  }

  async findToolExecution(orgId: string, key: string): Promise<ToolExecution | null> {
    return must("findToolExecution", await this.db.from("tool_executions").select("*").eq("org_id", orgId).eq("idempotency_key", key).maybeSingle()) as ToolExecution | null;
  }

  async insertToolExecution(e: NewToolExecution): Promise<ToolExecution> {
    return must("insertToolExecution", await this.db.from("tool_executions").insert(e).select("*").single()) as ToolExecution;
  }

  async updateToolExecution(orgId: string, id: string, patch: Partial<ToolExecution>): Promise<void> {
    must("updateToolExecution", await this.db.from("tool_executions").update(patch).eq("org_id", orgId).eq("id", id));
  }

  async listToolExecutions(orgId: string, missionId: string): Promise<ToolExecution[]> {
    return must("listToolExecutions", await this.db.from("tool_executions").select("*").eq("org_id", orgId).eq("mission_id", missionId).order("started_at")) as ToolExecution[];
  }

  async insertAgentRun(r: NewAgentRun): Promise<{ id: string }> {
    return must("insertAgentRun", await this.db.from("agent_runs").insert(r).select("id").single()) as { id: string };
  }

  async finishAgentRun(orgId: string, id: string, patch: AgentRunResult): Promise<void> {
    must("finishAgentRun", await this.db.from("agent_runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("org_id", orgId).eq("id", id));
  }

  async insertAudit(e: AuditEvent): Promise<void> {
    must("insertAudit", await this.db.from("audit_logs").insert(e));
  }

  async insertUsage(u: UsageRecord): Promise<void> {
    must("insertUsage", await this.db.from("usage_records").insert(u));
  }

  async sumUsageCostSince(orgId: string, sinceIso: string): Promise<number> {
    return Number(must("sumUsageCostSince", await this.db.rpc("orbit_usage_cost_since", { p_org: orgId, p_since: sinceIso })) ?? 0);
  }

  async sumUsageForMission(orgId: string, missionId: string) {
    const rows = must("sumUsageForMission", await this.db.rpc("orbit_mission_usage", { p_org: orgId, p_mission: missionId })) as { record_count: number; unknown_cost: number; cost: string | number }[];
    const r = rows[0];
    if (!r) return { cost: 0, count: 0 };
    return { count: Number(r.record_count), cost: Number(r.unknown_cost) > 0 ? null : Number(r.cost) };
  }
}
