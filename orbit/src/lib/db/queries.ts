import "server-only";
import { createUserClient } from "./clients";
import type { Approval, Mission, Task, ToolExecution } from "@/lib/domain/types";

/** Read helpers. All run with the user's JWT, so RLS enforces tenancy. */
export async function db() {
  return createUserClient();
}

export async function getMissionBundle(orgId: string, id: string) {
  const c = await createUserClient();
  const [m, t, a, e, runs] = await Promise.all([
    c.from("missions").select("*").eq("org_id", orgId).eq("id", id).maybeSingle().throwOnError(),
    c.from("tasks").select("*").eq("org_id", orgId).eq("mission_id", id).order("created_at").order("key").throwOnError(),
    c.from("approvals").select("*").eq("org_id", orgId).eq("mission_id", id).order("created_at", { ascending: false }).throwOnError(),
    c.from("tool_executions").select("*").eq("org_id", orgId).eq("mission_id", id).order("started_at").throwOnError(),
    c.from("agent_runs").select("id, role, kind, status, model, input_tokens, output_tokens, error, started_at, finished_at, task_id").eq("org_id", orgId).eq("mission_id", id).order("started_at").throwOnError(),
  ]);
  const entityIds = [id, ...(t.data ?? []).map((x) => x.id as string), ...(a.data ?? []).map((x) => x.id as string)];
  const audit = await c
    .from("audit_logs")
    .select("id, action, outcome, actor_type, entity_type, entity_id, details, created_at")
    .eq("org_id", orgId)
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false })
    .limit(100)
    .throwOnError();
  return {
    mission: m.data as Mission | null,
    tasks: (t.data ?? []) as Task[],
    approvals: (a.data ?? []) as Approval[],
    executions: (e.data ?? []) as ToolExecution[],
    runs: runs.data ?? [],
    audit: audit.data ?? [],
  };
}
