import type {
  Approval,
  ApprovalStatus,
  Mission,
  MissionStatus,
  OrgPolicy,
  Task,
  TaskStatus,
  ToolExecution,
} from "@/lib/domain";
import type { AgentRole, MemberRole } from "@/lib/domain/types";

/**
 * Storage port used by the mission engine. Every method takes `orgId` and
 * implementations MUST scope every query by it; this is the server-side half
 * of tenant isolation (RLS is the database-side half).
 *
 * `update*If` methods are compare-and-set: they apply the patch only when the
 * row is currently in one of `expected` statuses and return the updated row,
 * or null when nothing matched. The engine relies on this to prevent
 * duplicate execution.
 */
export interface EngineRepository {
  getMembershipRole(orgId: string, userId: string): Promise<MemberRole | null>;
  getPolicy(orgId: string): Promise<OrgPolicy>;

  insertMission(m: NewMission): Promise<Mission>;
  getMission(orgId: string, id: string): Promise<Mission | null>;
  updateMissionIf(orgId: string, id: string, expected: MissionStatus[], patch: Partial<Mission>): Promise<Mission | null>;
  /** Acquire the per-mission run lock if free or expired. */
  acquireMissionLock(orgId: string, id: string, token: string, ttlMs: number): Promise<boolean>;
  releaseMissionLock(orgId: string, id: string, token: string): Promise<void>;
  incrementActionCount(orgId: string, id: string): Promise<number>;
  countMissionsCreatedSince(orgId: string, sinceIso: string): Promise<number>;
  /** Missions that a background tick should pick up. */
  listRunnableMissions(limit: number): Promise<Pick<Mission, "id" | "org_id" | "created_by">[]>;

  insertTasks(tasks: NewTask[]): Promise<Task[]>;
  listTasks(orgId: string, missionId: string): Promise<Task[]>;
  getTask(orgId: string, id: string): Promise<Task | null>;
  updateTaskIf(orgId: string, id: string, expected: TaskStatus[], patch: Partial<Task>): Promise<Task | null>;

  insertApproval(a: NewApproval): Promise<Approval>;
  getApproval(orgId: string, id: string): Promise<Approval | null>;
  updateApprovalIf(orgId: string, id: string, expected: ApprovalStatus[], patch: Partial<Approval>): Promise<Approval | null>;
  listApprovalsForMission(orgId: string, missionId: string): Promise<Approval[]>;

  findToolExecution(orgId: string, idempotencyKey: string): Promise<ToolExecution | null>;
  insertToolExecution(e: NewToolExecution): Promise<ToolExecution>;
  updateToolExecution(orgId: string, id: string, patch: Partial<ToolExecution>): Promise<void>;
  listToolExecutions(orgId: string, missionId: string): Promise<ToolExecution[]>;

  insertAgentRun(r: NewAgentRun): Promise<{ id: string }>;
  finishAgentRun(orgId: string, id: string, patch: AgentRunResult): Promise<void>;

  insertAudit(e: AuditEvent): Promise<void>;

  insertUsage(u: UsageRecord): Promise<void>;
  sumUsageCostSince(orgId: string, sinceIso: string): Promise<number>;
  sumUsageForMission(orgId: string, missionId: string): Promise<{ cost: number | null; count: number }>;
}

export type NewMission = Pick<Mission, "org_id" | "created_by" | "name" | "objective"> & Partial<Pick<Mission, "plan" | "plan_source" | "plan_review" | "status">>;

export type NewTask = Pick<
  Task,
  | "org_id"
  | "mission_id"
  | "key"
  | "title"
  | "description"
  | "agent_role"
  | "tool_id"
  | "params"
  | "depends_on"
  | "expected_outcome"
  | "status"
  | "risk"
  | "requires_approval"
  | "max_attempts"
>;

export type NewApproval = Omit<Approval, "id" | "created_at" | "decided_by" | "decided_at" | "decision_note" | "status"> & {
  status?: ApprovalStatus;
};

export type NewToolExecution = Omit<ToolExecution, "id" | "finished_at" | "started_at"> & { started_at?: string };

export interface NewAgentRun {
  org_id: string;
  mission_id: string | null;
  task_id: string | null;
  role: AgentRole;
  kind: "plan" | "execute" | "verify" | "optimize";
  input_summary: string;
}

export interface AgentRunResult {
  status: "succeeded" | "failed";
  output: unknown;
  error: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

export interface AuditEvent {
  org_id: string;
  actor_type: "user" | "agent" | "system";
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  outcome: "success" | "failure" | "denied" | "info";
  details: Record<string, unknown>;
}

export interface UsageRecord {
  org_id: string;
  mission_id: string | null;
  agent_run_id: string | null;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  /** null when the price of `model` is unknown; never guessed. */
  cost_usd: number | null;
}
