import { z } from "zod";
import { MISSION_STATUSES, TASK_STATUSES } from "./states";

export const AGENT_ROLES = ["strategist", "operator", "auditor", "optimizer"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

export const MEMBER_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const TOOL_MODES = ["auto", "approval", "blocked"] as const;
export type ToolMode = (typeof TOOL_MODES)[number];

export const VERIFICATION_STATUSES = ["verified", "unverified", "failed", "not_applicable", "pending"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "invalidated",
  "cancelled",
  "consumed",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* AI-facing schemas (untrusted until validated)                        */
/* ------------------------------------------------------------------ */

export const MAX_PLAN_TASKS = 12;

const jsonObject = z.record(z.string(), z.unknown());

export const PlanTaskSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9_-]{1,32}$/i, "key deve conter apenas letras, números, - ou _"),
  title: z.string().min(3).max(140),
  description: z.string().max(2000).default(""),
  agent_role: z.enum(AGENT_ROLES),
  tool: z.string().min(1).max(64),
  params: jsonObject.default({}),
  depends_on: z.array(z.string()).max(MAX_PLAN_TASKS).default([]),
  expected_outcome: z.string().max(1000).default(""),
  /** The model's opinion. Never used for authorization. */
  risk_hint: z.enum(RISK_LEVELS).default("low"),
  approval_hint: z.boolean().default(false),
});
export type PlanTask = z.infer<typeof PlanTaskSchema>;

export const MissionPlanSchema = z
  .object({
    objective: z.string().min(3).max(2000),
    summary: z.string().max(4000),
    tasks: z.array(PlanTaskSchema).min(1).max(MAX_PLAN_TASKS),
    required_integrations: z.array(z.string().max(64)).max(10).default([]),
    assumptions: z.array(z.string().max(500)).max(20).default([]),
    risks: z.array(z.string().max(500)).max(20).default([]),
    success_criteria: z.array(z.string().max(500)).max(20).default([]),
  })
  .superRefine((plan, ctx) => {
    const keys = new Set<string>();
    plan.tasks.forEach((t, i) => {
      if (keys.has(t.key)) {
        ctx.addIssue({ code: "custom", path: ["tasks", i, "key"], message: `Chave duplicada: ${t.key}` });
      }
      keys.add(t.key);
    });
    plan.tasks.forEach((t, i) => {
      for (const dep of t.depends_on) {
        if (!keys.has(dep)) {
          ctx.addIssue({ code: "custom", path: ["tasks", i, "depends_on"], message: `Dependência desconhecida: ${dep}` });
        }
        if (dep === t.key) {
          ctx.addIssue({ code: "custom", path: ["tasks", i, "depends_on"], message: "Tarefa não pode depender de si mesma" });
        }
      }
    });
    if (hasCycle(plan.tasks)) {
      ctx.addIssue({ code: "custom", path: ["tasks"], message: "O plano contém dependências circulares" });
    }
  });
export type MissionPlan = z.infer<typeof MissionPlanSchema>;

function hasCycle(tasks: Pick<PlanTask, "key" | "depends_on">[]): boolean {
  const graph = new Map(tasks.map((t) => [t.key, t.depends_on]));
  const state = new Map<string, 1 | 2>();
  const visit = (k: string): boolean => {
    const s = state.get(k);
    if (s === 1) return true;
    if (s === 2) return false;
    state.set(k, 1);
    for (const d of graph.get(k) ?? []) if (graph.has(d) && visit(d)) return true;
    state.set(k, 2);
    return false;
  };
  return tasks.some((t) => visit(t.key));
}

/* ------------------------------------------------------------------ */
/* Persisted entities                                                   */
/* ------------------------------------------------------------------ */

export const PlanTaskReviewSchema = z.object({
  key: z.string(),
  supported: z.boolean(),
  decision: z.enum(["allow", "require_approval", "deny"]),
  risk: z.enum(RISK_LEVELS),
  reasons: z.array(z.string()),
  param_errors: z.array(z.string()),
});
export type PlanTaskReview = z.infer<typeof PlanTaskReviewSchema>;

export const PlanReviewSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  tasks: z.array(PlanTaskReviewSchema),
  policy_version: z.number().int(),
});
export type PlanReview = z.infer<typeof PlanReviewSchema>;

export interface Mission {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  objective: string;
  status: (typeof MISSION_STATUSES)[number];
  plan: MissionPlan | null;
  plan_source: "ai" | "manual" | "edited" | null;
  plan_review: PlanReview | null;
  report: MissionReport | null;
  action_count: number;
  lock_token: string | null;
  locked_until: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  org_id: string;
  mission_id: string;
  key: string;
  title: string;
  description: string;
  agent_role: AgentRole;
  tool_id: string;
  params: Record<string, unknown>;
  depends_on: string[];
  expected_outcome: string;
  status: (typeof TASK_STATUSES)[number];
  risk: RiskLevel;
  requires_approval: boolean;
  approval_id: string | null;
  attempts: number;
  max_attempts: number;
  output: unknown;
  error_code: string | null;
  error_message: string | null;
  verification_status: VerificationStatus;
  verification_detail: unknown;
  next_attempt_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Approval {
  id: string;
  org_id: string;
  mission_id: string;
  task_id: string;
  tool_id: string;
  params: Record<string, unknown>;
  binding_hash: string;
  policy_version: number;
  requested_by: string;
  risk: RiskLevel;
  reason: string;
  impact: string;
  target: string;
  evidence: unknown;
  status: ApprovalStatus;
  expires_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface ToolExecution {
  id: string;
  org_id: string;
  mission_id: string;
  task_id: string;
  tool_id: string;
  idempotency_key: string;
  attempt: number;
  status: "started" | "succeeded" | "failed";
  input: Record<string, unknown>;
  output: unknown;
  evidence: EvidenceRef[];
  error_code: string | null;
  error_message: string | null;
  verification_status: VerificationStatus;
  verification_checks: VerificationCheck[];
  started_at: string;
  finished_at: string | null;
}

export interface EvidenceRef {
  kind: string; // e.g. "work_item", "report", "gmail_draft", "records_query"
  id: string;
  label: string;
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface MissionReport {
  generated_at: string;
  duration_ms: number | null;
  totals: Record<string, number>;
  completed: ReportTaskLine[];
  failed: ReportTaskLine[];
  pending_approvals: ReportTaskLine[];
  skipped: ReportTaskLine[];
  verified: ReportTaskLine[];
  unverified: ReportTaskLine[];
  ai_cost_usd: number | null;
  ai_usage_records: number;
  notes: string[];
}

export interface ReportTaskLine {
  task_id: string;
  title: string;
  tool_id: string;
  status: string;
  detail?: string;
}

export interface OrgPolicy {
  org_id: string;
  version: number;
  execution_paused: boolean;
  require_plan_review: boolean;
  require_distinct_approver: boolean;
  max_actions_per_mission: number;
  max_task_duration_ms: number;
  monthly_ai_budget_usd: number;
  missions_per_hour: number;
  approval_ttl_hours: number;
  tool_modes: Record<string, ToolMode>;
  email_allowed_domains: string[];
}

export const DEFAULT_POLICY: Omit<OrgPolicy, "org_id"> = {
  version: 1,
  execution_paused: false,
  require_plan_review: true,
  require_distinct_approver: false,
  max_actions_per_mission: 20,
  max_task_duration_ms: 30_000,
  monthly_ai_budget_usd: 10,
  missions_per_hour: 20,
  approval_ttl_hours: 72,
  tool_modes: {},
  email_allowed_domains: [],
};

export interface Actor {
  /** auth user id; for scheduled/system runs the user who owns the mission. */
  userId: string;
  orgId: string;
  role: MemberRole;
  kind: "user" | "system";
}
