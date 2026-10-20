import type { z } from "zod";
import type { EvidenceRef, RiskLevel, ToolMode, VerificationCheck, VerificationStatus } from "@/lib/domain/types";
import type { Permission } from "@/lib/domain/permissions";
import type { AiProvider } from "@/lib/ai/provider";

export interface BusinessRecord {
  id: string;
  org_id: string;
  kind: "customer_message" | "note" | "contact" | "order";
  title: string;
  body: string;
  sender: string | null;
  status: "open" | "in_progress" | "closed";
  classification: RecordClassification | null;
  created_at: string;
}

export interface RecordClassification {
  category: string;
  urgency: "low" | "normal" | "high";
  rationale: string;
  model: string;
  task_id: string;
  classified_at: string;
}

export interface WorkItem {
  id: string;
  org_id: string;
  title: string;
  description: string;
  priority: "low" | "normal" | "high";
  due_date: string | null;
  related_record_id: string | null;
  status: "open" | "done";
  idempotency_key: string;
  created_by_task_id: string | null;
  created_at: string;
}

export interface StoredReport {
  id: string;
  org_id: string;
  title: string;
  scope: string;
  content: Record<string, unknown>;
  checksum: string;
  idempotency_key: string;
  created_by_task_id: string | null;
  created_at: string;
}

/** Org-scoped business data access used by tools. */
export interface DataPort {
  searchRecords(orgId: string, q: { kind?: string; status?: string; text?: string; unclassifiedOnly?: boolean; limit: number }): Promise<BusinessRecord[]>;
  getRecord(orgId: string, id: string): Promise<BusinessRecord | null>;
  setRecordClassification(orgId: string, id: string, c: RecordClassification): Promise<void>;
  countRecords(orgId: string, sinceIso: string): Promise<{ total: number; byKind: Record<string, number>; byStatus: Record<string, number>; byCategory: Record<string, number> }>;

  findWorkItemByKey(orgId: string, key: string): Promise<WorkItem | null>;
  insertWorkItem(w: Omit<WorkItem, "id" | "created_at" | "status">): Promise<WorkItem>;
  getWorkItem(orgId: string, id: string): Promise<WorkItem | null>;
  countWorkItems(orgId: string, sinceIso: string): Promise<{ total: number; byPriority: Record<string, number>; byStatus: Record<string, number> }>;

  countMissions(orgId: string, sinceIso: string): Promise<{ total: number; byStatus: Record<string, number> }>;

  findReportByKey(orgId: string, key: string): Promise<StoredReport | null>;
  insertReport(r: Omit<StoredReport, "id" | "created_at">): Promise<StoredReport>;
  getReport(orgId: string, id: string): Promise<StoredReport | null>;
}

export interface GmailPort {
  /** Throws IntegrationUnavailableError when not connected/configured. */
  createDraft(orgId: string, msg: { to: string[]; subject: string; body: string }): Promise<{ draftId: string; messageId: string }>;
  getDraft(orgId: string, draftId: string): Promise<{ draftId: string; subject: string | null; to: string | null } | null>;
  sendMessage(orgId: string, msg: { to: string[]; subject: string; body: string }): Promise<{ messageId: string; threadId: string }>;
  getMessageLabels(orgId: string, messageId: string): Promise<string[] | null>;
}

export interface ToolContext {
  orgId: string;
  missionId: string;
  taskId: string;
  actorUserId: string;
  idempotencyKey: string;
  signal: AbortSignal;
  data: DataPort;
  gmail: GmailPort;
  ai: AiProvider | null;
  policy: { email_allowed_domains: string[] };
}

export interface ToolResult<O = unknown> {
  output: O;
  evidence: EvidenceRef[];
  usage?: { provider: string; model: string; input_tokens: number; output_tokens: number }[];
}

export interface VerificationResult {
  status: VerificationStatus;
  checks: VerificationCheck[];
}

export type VerificationStrategy = "none" | "read_back" | "external_read_back";

/** Machine-readable failure. `retryable` drives the engine's retry policy. */
export class ToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export class IntegrationUnavailableError extends ToolError {
  constructor(integration: string, detail: string) {
    super("INTEGRATION_UNAVAILABLE", `${integration}: ${detail}`, false);
  }
}

export interface ToolDefinition<I = Record<string, unknown>, O = unknown> {
  id: string;
  name: string;
  description: string;
  /** Zod schema used for runtime validation of AI-proposed params. */
  input: z.ZodType<I>;
  /** JSON schema shown to the model. Kept hand-written so it stays simple. */
  inputJsonSchema: Record<string, unknown>;
  permission: Permission;
  risk: RiskLevel;
  mutating: boolean;
  external: boolean;
  /** Safe to re-execute with the same idempotency key after interruption. */
  idempotent: boolean;
  defaultMode: ToolMode;
  /** The least restrictive mode an org can configure ("approval" means it can never be auto). */
  minimumMode: ToolMode;
  requiresIntegration: "gmail" | null;
  requiresAi: boolean;
  allowedRoles: readonly ("operator" | "auditor")[];
  verification: VerificationStrategy;
  timeoutMs: number;
  retry: { maxAttempts: number; backoffMs: number };
  /** Parameter-dependent risk escalation (server-side; the AI's hint is ignored). */
  assessRisk?(input: I, ctx: Pick<ToolContext, "policy">): { risk: RiskLevel; deny?: string; requireApproval?: string };
  describeTarget(input: I): string;
  describeImpact(input: I): string;
  execute(ctx: ToolContext, input: I): Promise<ToolResult<O>>;
  verify(ctx: ToolContext, input: I, result: ToolResult<O>): Promise<VerificationResult>;
}
