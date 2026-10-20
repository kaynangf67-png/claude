import { randomUUID } from "node:crypto";
import {
  assertMissionTransition,
  isTerminalTask,
  satisfiesDependency,
  type MissionStatus,
  type TaskStatus,
} from "@/lib/domain/states";
import { requirePermission, hasPermission } from "@/lib/domain/permissions";
import {
  MissionPlanSchema,
  type Actor,
  type Approval,
  type Mission,
  type MissionPlan,
  type OrgPolicy,
  type PlanReview,
  type Task,
} from "@/lib/domain/types";
import { AiOutputError, estimateCostUsd, type AiProvider, type AiUsage } from "@/lib/ai/provider";
import { evaluatePolicy } from "@/lib/policy/engine";
import { approvalBindingHash, checkApprovalUsable } from "@/lib/policy/approvals";
import { getTool, type AnyTool } from "@/lib/tools/registry";
import { ToolError, type DataPort, type GmailPort, type ToolResult, type VerificationResult } from "@/lib/tools/types";
import type { AuditEvent, EngineRepository } from "./ports";
import { formatZodError, requestPlan } from "./planner";
import { buildMissionReport } from "./report";

export class EngineError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_STATE"
      | "INVALID_INPUT"
      | "RATE_LIMITED"
      | "AI_UNAVAILABLE"
      | "BUDGET_EXCEEDED"
      | "PLAN_INVALID"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export interface EngineDeps {
  repo: EngineRepository;
  data: DataPort;
  gmail: GmailPort;
  ai: AiProvider | null;
  isIntegrationConnected(orgId: string, id: "gmail"): Promise<boolean>;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface RunOptions {
  /** Wall-clock budget for this invocation; remaining work resumes on the next tick. */
  timeBudgetMs?: number;
}

export type RunOutcome = { status: "locked" } | { status: MissionStatus; executed: number };

const MAX_INLINE_BACKOFF_MS = 3_000;

export class MissionEngine {
  private readonly repo: EngineRepository;
  private readonly now: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly deps: EngineDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => new Date());
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /* ---------------------------------------------------------------- */
  /* Mission lifecycle (user-initiated)                                 */
  /* ---------------------------------------------------------------- */

  async createMission(actor: Actor, input: { name: string; objective: string }): Promise<Mission> {
    requirePermission(actor.role, "missions:write");
    const policy = await this.repo.getPolicy(actor.orgId);
    const since = new Date(this.now().getTime() - 3_600_000).toISOString();
    const recent = await this.repo.countMissionsCreatedSince(actor.orgId, since);
    if (recent >= policy.missions_per_hour) {
      await this.audit(actor, "mission.rate_limited", "mission", null, "denied", { limit: policy.missions_per_hour });
      throw new EngineError("RATE_LIMITED", `Limite de ${policy.missions_per_hour} missões por hora atingido`);
    }
    const mission = await this.repo.insertMission({
      org_id: actor.orgId,
      created_by: actor.userId,
      name: input.name,
      objective: input.objective,
    });
    await this.audit(actor, "mission.created", "mission", mission.id, "success", { name: input.name });
    return mission;
  }

  /** Strategist: generate a plan with the AI provider. */
  async generatePlan(actor: Actor, missionId: string): Promise<Mission> {
    requirePermission(actor.role, "missions:write");
    const mission = await this.mustGetMission(actor.orgId, missionId);
    await this.assertNoTasks(mission);
    if (!this.deps.ai) throw new EngineError("AI_UNAVAILABLE", "Nenhum provedor de IA está configurado. Monte o plano manualmente ou configure ANTHROPIC_API_KEY.");
    const policy = await this.repo.getPolicy(actor.orgId);
    await this.assertAiBudget(actor.orgId, policy);

    let current = mission;
    if (current.status === "awaiting_approval") current = await this.transitionMission(current, "draft");
    const planning = await this.transitionMission(current, "planning");

    const run = await this.repo.insertAgentRun({
      org_id: actor.orgId,
      mission_id: missionId,
      task_id: null,
      role: "strategist",
      kind: "plan",
      input_summary: mission.objective.slice(0, 500),
    });
    let attempt;
    try {
      attempt = await requestPlan(this.deps.ai, mission.objective, policy);
    } catch (e) {
      await this.repo.finishAgentRun(actor.orgId, run.id, { status: "failed", output: null, error: safeMessage(e), model: this.deps.ai.model, input_tokens: null, output_tokens: null });
      await this.transitionMission(planning, "draft");
      await this.audit(actor, "mission.plan_failed", "mission", missionId, "failure", { error: safeMessage(e) });
      throw new EngineError("PLAN_INVALID", "O provedor de IA falhou ao gerar o plano. Tente novamente.");
    }
    await this.recordUsage(actor.orgId, missionId, run.id, attempt.usage);
    const totals = sumUsage(attempt.usage);
    if (!attempt.plan) {
      await this.repo.finishAgentRun(actor.orgId, run.id, { status: "failed", output: { errors: attempt.errors }, error: "invalid_plan", model: totals.model, input_tokens: totals.input, output_tokens: totals.output });
      await this.transitionMission(planning, "draft");
      await this.audit(actor, "mission.plan_failed", "mission", missionId, "failure", { errors: attempt.errors });
      throw new EngineError("PLAN_INVALID", `A IA retornou um plano inválido após ${attempt.errors.length} tentativa(s).`);
    }
    await this.repo.finishAgentRun(actor.orgId, run.id, { status: "succeeded", output: attempt.plan, error: null, model: totals.model, input_tokens: totals.input, output_tokens: totals.output });
    const review = await this.reviewPlan(actor.orgId, attempt.plan, policy, mission.created_by);
    const updated = await this.casMission(planning, ["planning"], "awaiting_approval", { plan: attempt.plan, plan_source: "ai", plan_review: review });
    await this.audit(actor, "mission.plan_generated", "mission", missionId, "success", { tasks: attempt.plan.tasks.length, valid: review.valid, retries: attempt.errors.length });
    if (!policy.require_plan_review && review.valid) return this.approvePlan(actor, missionId);
    return updated;
  }

  /** Save a manually written or edited plan. The plan is re-validated from scratch. */
  async savePlan(actor: Actor, missionId: string, rawPlan: unknown): Promise<Mission> {
    requirePermission(actor.role, "missions:write");
    const mission = await this.mustGetMission(actor.orgId, missionId);
    await this.assertNoTasks(mission);
    if (mission.status !== "draft" && mission.status !== "awaiting_approval") {
      throw new EngineError("INVALID_STATE", "O plano só pode ser editado antes da execução");
    }
    const parsed = MissionPlanSchema.safeParse(rawPlan);
    if (!parsed.success) throw new EngineError("INVALID_INPUT", formatZodError(parsed.error));
    const policy = await this.repo.getPolicy(actor.orgId);
    const review = await this.reviewPlan(actor.orgId, parsed.data, policy, mission.created_by);
    const source = mission.plan_source === "ai" || mission.plan_source === "edited" ? "edited" : "manual";
    const updated = await this.casMission(mission, ["draft", "awaiting_approval"], "awaiting_approval", {
      plan: parsed.data,
      plan_source: source,
      plan_review: review,
    });
    await this.audit(actor, "mission.plan_saved", "mission", missionId, "success", { source, tasks: parsed.data.tasks.length, valid: review.valid });
    return updated;
  }

  /** Validate every proposed task against the registry and policy. */
  async reviewPlan(orgId: string, plan: MissionPlan, policy: OrgPolicy, runAsUserId: string): Promise<PlanReview> {
    const memberRole = (await this.repo.getMembershipRole(orgId, runAsUserId)) ?? "viewer";
    const gmail = await this.deps.isIntegrationConnected(orgId, "gmail");
    const spend = await this.repo.sumUsageCostSince(orgId, monthStart(this.now()));
    const errors: string[] = [];
    if (plan.tasks.length > policy.max_actions_per_mission) {
      errors.push(`O plano tem ${plan.tasks.length} tarefas; o limite da organização é ${policy.max_actions_per_mission}`);
    }
    const tasks = plan.tasks.map((t) => {
      const tool = getTool(t.tool);
      const r = evaluatePolicy({
        tool,
        toolId: t.tool,
        params: t.params,
        agentRole: t.agent_role,
        memberRole,
        policy,
        missionActionCount: 0,
        aiAvailable: Boolean(this.deps.ai),
        integrationConnected: () => gmail,
        aiSpendThisMonthUsd: spend,
      });
      return { key: t.key, supported: Boolean(tool), decision: r.decision, risk: r.risk, reasons: r.reasons, param_errors: r.paramErrors };
    });
    for (const t of tasks) if (t.decision === "deny") errors.push(`Tarefa ${t.key}: ${[...t.reasons, ...t.param_errors].join("; ")}`);
    return { valid: errors.length === 0, errors, tasks, policy_version: policy.version };
  }

  /** Human approves the plan: tasks are persisted and the mission is queued. */
  async approvePlan(actor: Actor, missionId: string): Promise<Mission> {
    requirePermission(actor.role, "missions:execute");
    const mission = await this.mustGetMission(actor.orgId, missionId);
    await this.assertNoTasks(mission);
    if (mission.status !== "awaiting_approval" || !mission.plan) throw new EngineError("INVALID_STATE", "Não há plano aguardando aprovação");
    const policy = await this.repo.getPolicy(actor.orgId);
    // Policy may have changed since the plan was reviewed.
    const review = await this.reviewPlan(actor.orgId, mission.plan, policy, mission.created_by);
    if (!review.valid) {
      await this.repo.updateMissionIf(actor.orgId, missionId, ["awaiting_approval"], { plan_review: review });
      throw new EngineError("PLAN_INVALID", `O plano não pode ser aprovado: ${review.errors.join(" | ")}`);
    }
    const queued = await this.casMission(mission, ["awaiting_approval"], "queued", { plan_review: review, started_at: this.now().toISOString() });
    const byKey = new Map(review.tasks.map((t) => [t.key, t]));
    const created = await this.repo.insertTasks(
      mission.plan.tasks.map((t) => {
        const tool = getTool(t.tool) as AnyTool;
        const r = byKey.get(t.key);
        return {
          org_id: actor.orgId,
          mission_id: missionId,
          key: t.key,
          title: t.title,
          description: t.description,
          agent_role: t.agent_role,
          tool_id: t.tool,
          params: tool.input.parse(t.params) as Record<string, unknown>,
          depends_on: t.depends_on,
          expected_outcome: t.expected_outcome,
          status: "pending" as const,
          risk: r?.risk ?? tool.risk,
          requires_approval: r?.decision === "require_approval",
          max_attempts: tool.retry.maxAttempts,
        };
      }),
    );
    await this.audit(actor, "mission.plan_approved", "mission", missionId, "success", { tasks: created.length, policy_version: policy.version });
    for (const t of created) await this.audit(actor, "task.created", "task", t.id, "info", { mission_id: missionId, tool: t.tool_id, requires_approval: t.requires_approval });
    return queued;
  }

  async pauseMission(actor: Actor, missionId: string): Promise<Mission> {
    requirePermission(actor.role, "missions:execute");
    const m = await this.mustGetMission(actor.orgId, missionId);
    const updated = await this.casMission(m, ["queued", "running", "awaiting_approval"], "paused", {});
    await this.audit(actor, "mission.paused", "mission", missionId, "success", { from: m.status });
    return updated;
  }

  async resumeMission(actor: Actor, missionId: string): Promise<Mission> {
    requirePermission(actor.role, "missions:execute");
    const m = await this.mustGetMission(actor.orgId, missionId);
    const updated = await this.casMission(m, ["paused"], "queued", {});
    await this.audit(actor, "mission.resumed", "mission", missionId, "success", {});
    return updated;
  }

  async cancelMission(actor: Actor, missionId: string, reason = "Cancelada pelo usuário"): Promise<Mission> {
    requirePermission(actor.role, "missions:execute");
    const m = await this.mustGetMission(actor.orgId, missionId);
    const cancelled = await this.casMission(m, ["draft", "planning", "awaiting_approval", "queued", "running", "paused"], "cancelled", {
      finished_at: this.now().toISOString(),
    });
    const tasks = await this.repo.listTasks(actor.orgId, missionId);
    for (const t of tasks) {
      if (isTerminalTask(t.status)) continue;
      // A running task may still finish its external call; its tool_execution
      // record keeps the real outcome even though the task is now cancelled.
      await this.repo.updateTaskIf(actor.orgId, t.id, [t.status], { status: "cancelled", error_code: "MISSION_CANCELLED", error_message: reason, finished_at: this.now().toISOString() });
      await this.audit(actor, "task.cancelled", "task", t.id, "info", { from: t.status });
    }
    for (const a of await this.repo.listApprovalsForMission(actor.orgId, missionId)) {
      if (a.status === "pending" || a.status === "approved") {
        await this.repo.updateApprovalIf(actor.orgId, a.id, [a.status], { status: "cancelled" });
      }
    }
    await this.audit(actor, "mission.cancelled", "mission", missionId, "success", { reason });
    return this.finalizeReport(cancelled);
  }

  /* ---------------------------------------------------------------- */
  /* Approvals                                                          */
  /* ---------------------------------------------------------------- */

  async decideApproval(actor: Actor, approvalId: string, decision: "approved" | "rejected", note: string | null): Promise<Approval> {
    requirePermission(actor.role, "approvals:decide");
    const approval = await this.repo.getApproval(actor.orgId, approvalId);
    if (!approval) throw new EngineError("NOT_FOUND", "Aprovação não encontrada");
    if (approval.status !== "pending") throw new EngineError("INVALID_STATE", `Esta aprovação já está ${approval.status}`);
    const tool = getTool(approval.tool_id);
    if (tool && decision === "approved" && !hasPermission(actor.role, tool.permission)) {
      await this.audit(actor, "approval.denied", "approval", approvalId, "denied", { missing: tool.permission });
      throw new EngineError("FORBIDDEN", `Você precisa da permissão ${tool.permission} para aprovar esta ação`);
    }
    if (new Date(approval.expires_at).getTime() <= this.now().getTime()) {
      await this.repo.updateApprovalIf(actor.orgId, approvalId, ["pending"], { status: "expired" });
      await this.audit(actor, "approval.expired", "approval", approvalId, "info", {});
      throw new EngineError("INVALID_STATE", "Esta aprovação expirou");
    }
    const policy = await this.repo.getPolicy(actor.orgId);
    if (policy.require_distinct_approver && approval.requested_by === actor.userId) {
      await this.audit(actor, "approval.denied", "approval", approvalId, "denied", { reason: "self_approval" });
      throw new EngineError("FORBIDDEN", "A política exige que outra pessoa aprove ações solicitadas por você");
    }
    const decided = await this.repo.updateApprovalIf(actor.orgId, approvalId, ["pending"], {
      status: decision,
      decided_by: actor.userId,
      decided_at: this.now().toISOString(),
      decision_note: note,
    });
    if (!decided) throw new EngineError("CONFLICT", "A aprovação foi alterada por outra pessoa");

    if (decision === "approved") {
      await this.repo.updateTaskIf(actor.orgId, approval.task_id, ["awaiting_approval"], { status: "ready" });
    } else {
      await this.repo.updateTaskIf(actor.orgId, approval.task_id, ["awaiting_approval"], {
        status: "skipped",
        error_code: "APPROVAL_REJECTED",
        error_message: note ? `Rejeitada: ${note}` : "Rejeitada pelo aprovador",
        finished_at: this.now().toISOString(),
      });
    }
    await this.repo.updateMissionIf(actor.orgId, approval.mission_id, ["awaiting_approval"], { status: "queued" });
    await this.audit(actor, `approval.${decision}`, "approval", approvalId, "success", {
      task_id: approval.task_id,
      tool: approval.tool_id,
      binding_hash: approval.binding_hash,
      note,
    });
    return decided;
  }

  /* ---------------------------------------------------------------- */
  /* Execution                                                          */
  /* ---------------------------------------------------------------- */

  async runMission(orgId: string, missionId: string, opts: RunOptions = {}): Promise<RunOutcome> {
    const budget = opts.timeBudgetMs ?? 20_000;
    const startedAt = this.now().getTime();
    const policy0 = await this.repo.getPolicy(orgId);
    const token = randomUUID();
    const ttl = budget + policy0.max_task_duration_ms + 30_000;
    if (!(await this.repo.acquireMissionLock(orgId, missionId, token, ttl))) return { status: "locked" };

    let executed = 0;
    try {
      let recovered = false;
      for (;;) {
        let mission = await this.mustGetMission(orgId, missionId);
        if (mission.status === "queued") {
          mission = await this.casMission(mission, ["queued"], "running", { started_at: mission.started_at ?? this.now().toISOString() });
          await this.systemAudit(orgId, "mission.running", "mission", missionId, "info", {});
        }
        if (mission.status !== "running") return { status: mission.status, executed };

        const policy = await this.repo.getPolicy(orgId);
        if (policy.execution_paused) {
          await this.casMission(mission, ["running"], "paused", {});
          await this.systemAudit(orgId, "mission.emergency_paused", "mission", missionId, "denied", {});
          return { status: "paused", executed };
        }

        let tasks = await this.repo.listTasks(orgId, missionId);
        if (!recovered) {
          await this.recoverInterrupted(mission, tasks);
          recovered = true;
          tasks = await this.repo.listTasks(orgId, missionId);
        }
        await this.expireApprovals(mission, tasks);
        tasks = await this.promote(orgId, await this.repo.listTasks(orgId, missionId));

        const nowMs = this.now().getTime();
        const ready = tasks.filter((t) => t.status === "ready");
        const due = ready.find((t) => !t.next_attempt_at || new Date(t.next_attempt_at).getTime() <= nowMs);

        if (!due) {
          if (ready.length > 0) {
            const wait = Math.min(...ready.map((t) => new Date(t.next_attempt_at!).getTime() - nowMs));
            if (wait <= MAX_INLINE_BACKOFF_MS && nowMs + wait - startedAt < budget) {
              await this.sleep(wait);
              continue;
            }
            return { status: "running", executed };
          }
          if (tasks.some((t) => t.status === "awaiting_approval")) {
            await this.casMission(mission, ["running"], "awaiting_approval", {});
            return { status: "awaiting_approval", executed };
          }
          if (tasks.every((t) => isTerminalTask(t.status))) {
            const final = tasks.some((t) => t.status === "failed" || t.status === "verification_failed") ? "failed" : "completed";
            const done = await this.casMission(mission, ["running"], final, { finished_at: this.now().toISOString() });
            await this.systemAudit(orgId, `mission.${final}`, "mission", missionId, final === "completed" ? "success" : "failure", {});
            await this.finalizeReport(done);
            return { status: final, executed };
          }
          return { status: "running", executed };
        }

        if (this.now().getTime() - startedAt >= budget) return { status: "running", executed };
        await this.executeTask(mission, due, policy);
        executed++;
      }
    } finally {
      await this.repo.releaseMissionLock(orgId, missionId, token);
    }
  }

  /** Promote pending tasks whose dependencies resolved; skip ones that can never run. */
  private async promote(orgId: string, tasks: Task[]): Promise<Task[]> {
    let changed = true;
    const byKey = new Map(tasks.map((t) => [t.key, t]));
    while (changed) {
      changed = false;
      for (const t of byKey.values()) {
        if (t.status !== "pending") continue;
        const deps = t.depends_on.map((k) => byKey.get(k));
        if (deps.some((d) => !d || (isTerminalTask(d.status) && !satisfiesDependency(d.status)))) {
          const u = await this.repo.updateTaskIf(orgId, t.id, ["pending"], {
            status: "skipped",
            error_code: "DEPENDENCY_NOT_MET",
            error_message: "Uma tarefa da qual esta depende não foi concluída",
            finished_at: this.now().toISOString(),
          });
          if (u) {
            byKey.set(t.key, u);
            changed = true;
            await this.systemAudit(orgId, "task.skipped", "task", t.id, "info", { reason: "dependency_not_met" });
          }
        } else if (deps.every((d) => d && satisfiesDependency(d.status))) {
          const u = await this.repo.updateTaskIf(orgId, t.id, ["pending"], { status: "ready" });
          if (u) {
            byKey.set(t.key, u);
            changed = true;
          }
        }
      }
    }
    return [...byKey.values()];
  }

  private async expireApprovals(mission: Mission, tasks: Task[]): Promise<void> {
    const now = this.now();
    for (const t of tasks) {
      if (t.status !== "awaiting_approval" || !t.approval_id) continue;
      const a = await this.repo.getApproval(mission.org_id, t.approval_id);
      if (a && a.status === "pending" && new Date(a.expires_at).getTime() <= now.getTime()) {
        await this.repo.updateApprovalIf(mission.org_id, a.id, ["pending"], { status: "expired" });
        await this.repo.updateTaskIf(mission.org_id, t.id, ["awaiting_approval"], {
          status: "skipped",
          error_code: "APPROVAL_EXPIRED",
          error_message: "A aprovação expirou sem decisão",
          finished_at: now.toISOString(),
        });
        await this.systemAudit(mission.org_id, "approval.expired", "approval", a.id, "info", { task_id: t.id });
      }
    }
  }

  /**
   * A task left in `running` means a previous runner died mid-execution
   * (we hold the mission lock, so nobody else is running it).
   */
  private async recoverInterrupted(mission: Mission, tasks: Task[]): Promise<void> {
    for (const t of tasks.filter((x) => x.status === "running")) {
      const exec = await this.repo.findToolExecution(mission.org_id, execKey(t.id, t.attempts));
      const tool = getTool(t.tool_id);
      if (exec?.status === "succeeded") {
        const verificationFailed = exec.verification_status === "failed";
        await this.repo.updateTaskIf(mission.org_id, t.id, ["running"], {
          status: verificationFailed ? "verification_failed" : "succeeded",
          output: exec.output,
          verification_status: exec.verification_status,
          verification_detail: exec.verification_checks,
          finished_at: this.now().toISOString(),
        });
      } else if (tool?.idempotent || !exec || exec.status === "failed") {
        await this.repo.updateTaskIf(mission.org_id, t.id, ["running"], { status: "ready" });
        await this.systemAudit(mission.org_id, "task.recovered", "task", t.id, "info", { action: "requeued" });
      } else {
        await this.repo.updateTaskIf(mission.org_id, t.id, ["running"], {
          status: "failed",
          error_code: "UNKNOWN_OUTCOME",
          error_message: "A execução foi interrompida durante uma ação externa não idempotente. Verifique manualmente no serviço externo antes de repetir.",
          finished_at: this.now().toISOString(),
        });
        await this.systemAudit(mission.org_id, "task.recovered", "task", t.id, "failure", { action: "unknown_outcome" });
      }
    }
  }

  private async executeTask(mission: Mission, task: Task, policy: OrgPolicy): Promise<void> {
    const orgId = mission.org_id;
    const tool = getTool(task.tool_id);
    const memberRole = await this.repo.getMembershipRole(orgId, mission.created_by);
    if (!memberRole) {
      await this.failTask(task, ["ready"], "ACTOR_NOT_MEMBER", "O criador da missão não pertence mais à organização");
      return;
    }
    const connected = tool?.requiresIntegration ? await this.deps.isIntegrationConnected(orgId, tool.requiresIntegration) : false;
    const decision = evaluatePolicy({
      tool,
      toolId: task.tool_id,
      params: task.params,
      agentRole: task.agent_role,
      memberRole,
      policy,
      missionActionCount: mission.action_count,
      aiAvailable: Boolean(this.deps.ai),
      integrationConnected: () => connected,
      aiSpendThisMonthUsd: tool?.requiresAi ? await this.repo.sumUsageCostSince(orgId, monthStart(this.now())) : 0,
    });

    if (decision.decision === "deny" || !tool || !decision.params) {
      await this.failTask(task, ["ready"], "POLICY_DENIED", [...decision.reasons, ...decision.paramErrors].join("; "));
      await this.systemAudit(orgId, "tool.denied", "task", task.id, "denied", { tool: task.tool_id, reasons: decision.reasons, param_errors: decision.paramErrors });
      return;
    }
    const params = decision.params;
    const binding = {
      orgId,
      missionId: mission.id,
      taskId: task.id,
      toolId: tool.id,
      params,
      requestedBy: mission.created_by,
      policyVersion: policy.version,
    };

    if (decision.decision === "require_approval") {
      const existing = task.approval_id ? await this.repo.getApproval(orgId, task.approval_id) : null;
      const check = existing ? checkApprovalUsable(existing, binding, this.now()) : null;
      if (!existing || !check?.ok) {
        if (existing && check && !check.ok && existing.status === "approved") {
          await this.repo.updateApprovalIf(orgId, existing.id, ["approved"], { status: check.reason === "expired" ? "expired" : "invalidated" });
          await this.systemAudit(orgId, "approval.invalidated", "approval", existing.id, "info", { reason: check.reason });
        }
        await this.requestApproval(mission, task, tool, params, decision.risk, decision.reasons, policy);
        return;
      }
      // Single use: consume before executing so it can never authorize a second run.
      const consumed = await this.repo.updateApprovalIf(orgId, existing.id, ["approved"], { status: "consumed" });
      if (!consumed) return;
    }

    const claimed = await this.repo.updateTaskIf(orgId, task.id, ["ready"], {
      status: "running",
      attempts: task.attempts + 1,
      started_at: task.started_at ?? this.now().toISOString(),
      next_attempt_at: null,
    });
    if (!claimed) return;
    await this.repo.incrementActionCount(orgId, mission.id);

    const attempt = claimed.attempts;
    const exec = await this.repo.insertToolExecution({
      org_id: orgId,
      mission_id: mission.id,
      task_id: task.id,
      tool_id: tool.id,
      idempotency_key: execKey(task.id, attempt),
      attempt,
      status: "started",
      input: params,
      output: null,
      evidence: [],
      error_code: null,
      error_message: null,
      verification_status: "pending",
      verification_checks: [],
    });
    await this.systemAudit(orgId, "tool.attempted", "task", task.id, "info", { tool: tool.id, attempt, execution_id: exec.id });

    const operatorRun = await this.repo.insertAgentRun({ org_id: orgId, mission_id: mission.id, task_id: task.id, role: "operator", kind: "execute", input_summary: `${tool.id} tentativa ${attempt}` });
    const controller = new AbortController();
    const timeoutMs = Math.min(tool.timeoutMs, policy.max_task_duration_ms);
    const ctx = {
      orgId,
      missionId: mission.id,
      taskId: task.id,
      actorUserId: mission.created_by,
      idempotencyKey: `task:${task.id}`,
      signal: controller.signal,
      data: this.deps.data,
      gmail: this.deps.gmail,
      ai: this.deps.ai,
      policy: { email_allowed_domains: policy.email_allowed_domains },
    };

    let result: ToolResult;
    try {
      result = await withTimeout(tool.execute(ctx, params), timeoutMs, controller);
    } catch (e) {
      const err = classifyError(e, tool);
      await this.repo.updateToolExecution(orgId, exec.id, { status: "failed", error_code: err.code, error_message: err.message, finished_at: this.now().toISOString(), verification_status: "not_applicable" });
      if (e instanceof AiOutputError && e.usage) await this.recordUsage(orgId, mission.id, operatorRun.id, [e.usage]);
      await this.repo.finishAgentRun(orgId, operatorRun.id, { status: "failed", output: null, error: `${err.code}: ${err.message}`, model: null, input_tokens: null, output_tokens: null });
      const maxAttempts = Math.min(tool.retry.maxAttempts, task.max_attempts);
      if (err.retryable && attempt < maxAttempts) {
        const delay = tool.retry.backoffMs * 2 ** (attempt - 1);
        await this.repo.updateTaskIf(orgId, task.id, ["running"], {
          status: "ready",
          error_code: err.code,
          error_message: err.message,
          next_attempt_at: new Date(this.now().getTime() + delay).toISOString(),
        });
        await this.systemAudit(orgId, "tool.retry_scheduled", "task", task.id, "failure", { tool: tool.id, attempt, code: err.code, delay_ms: delay });
      } else {
        await this.failTask(claimed, ["running"], err.code, err.message);
        await this.systemAudit(orgId, "tool.failed", "task", task.id, "failure", { tool: tool.id, attempt, code: err.code, message: err.message });
      }
      return;
    }

    if (result.usage?.length) await this.recordUsage(orgId, mission.id, operatorRun.id, result.usage);
    const u = sumUsage(result.usage ?? []);
    await this.repo.finishAgentRun(orgId, operatorRun.id, { status: "succeeded", output: result.output, error: null, model: u.model, input_tokens: u.input || null, output_tokens: u.output || null });

    // Auditor: independent verification of the claimed outcome.
    const auditorRun = await this.repo.insertAgentRun({ org_id: orgId, mission_id: mission.id, task_id: task.id, role: "auditor", kind: "verify", input_summary: `${tool.id}: ${tool.verification}` });
    let verification: VerificationResult;
    try {
      verification = await withTimeout(tool.verify(ctx, params, result), timeoutMs, new AbortController());
    } catch (e) {
      verification = { status: "unverified", checks: [{ name: "verification_error", passed: false, detail: safeMessage(e) }] };
    }
    await this.repo.finishAgentRun(orgId, auditorRun.id, { status: "succeeded", output: verification, error: null, model: null, input_tokens: null, output_tokens: null });

    const finishedAt = this.now().toISOString();
    await this.repo.updateToolExecution(orgId, exec.id, {
      status: "succeeded",
      output: result.output,
      evidence: result.evidence,
      verification_status: verification.status,
      verification_checks: verification.checks,
      finished_at: finishedAt,
    });
    const finalStatus: TaskStatus = verification.status === "failed" ? "verification_failed" : "succeeded";
    const updated = await this.repo.updateTaskIf(orgId, task.id, ["running"], {
      status: finalStatus,
      output: result.output,
      error_code: finalStatus === "verification_failed" ? "VERIFICATION_FAILED" : null,
      error_message: finalStatus === "verification_failed" ? "A ferramenta relatou sucesso, mas o resultado não foi confirmado" : null,
      verification_status: verification.status,
      verification_detail: verification.checks,
      finished_at: finishedAt,
    });
    await this.systemAudit(orgId, finalStatus === "succeeded" ? "tool.succeeded" : "task.verification_failed", "task", task.id, finalStatus === "succeeded" ? "success" : "failure", {
      tool: tool.id,
      attempt,
      verification: verification.status,
      evidence: result.evidence,
      // Cancelled while running: the action happened, but the task stays cancelled.
      discarded: updated ? undefined : "task_no_longer_running",
    });
  }

  private async requestApproval(mission: Mission, task: Task, tool: AnyTool, params: Record<string, unknown>, risk: Approval["risk"], reasons: string[], policy: OrgPolicy) {
    const orgId = mission.org_id;
    const approval = await this.repo.insertApproval({
      org_id: orgId,
      mission_id: mission.id,
      task_id: task.id,
      tool_id: tool.id,
      params,
      binding_hash: approvalBindingHash({ orgId, missionId: mission.id, taskId: task.id, toolId: tool.id, params, requestedBy: mission.created_by, policyVersion: policy.version }),
      policy_version: policy.version,
      requested_by: mission.created_by,
      risk,
      reason: reasons.join("; "),
      impact: tool.describeImpact(params),
      target: tool.describeTarget(params),
      evidence: { mission_objective: mission.objective, task_title: task.title, expected_outcome: task.expected_outcome },
      expires_at: new Date(this.now().getTime() + policy.approval_ttl_hours * 3_600_000).toISOString(),
    });
    const moved = await this.repo.updateTaskIf(orgId, task.id, ["ready"], { status: "awaiting_approval", approval_id: approval.id, risk, requires_approval: true });
    if (!moved) {
      await this.repo.updateApprovalIf(orgId, approval.id, ["pending"], { status: "cancelled" });
      return;
    }
    await this.systemAudit(orgId, "approval.requested", "approval", approval.id, "info", { task_id: task.id, tool: tool.id, risk, reasons });
  }

  private async failTask(task: Task, from: TaskStatus[], code: string, message: string) {
    await this.repo.updateTaskIf(task.org_id, task.id, from, { status: "failed", error_code: code, error_message: message, finished_at: this.now().toISOString() });
  }

  private async finalizeReport(mission: Mission): Promise<Mission> {
    const tasks = await this.repo.listTasks(mission.org_id, mission.id);
    const approvals = await this.repo.listApprovalsForMission(mission.org_id, mission.id);
    const usage = await this.repo.sumUsageForMission(mission.org_id, mission.id);
    const report = buildMissionReport(mission, tasks, approvals, usage, this.now());
    return (await this.repo.updateMissionIf(mission.org_id, mission.id, [mission.status], { report })) ?? mission;
  }

  /* ---------------------------------------------------------------- */
  /* helpers                                                            */
  /* ---------------------------------------------------------------- */

  private async mustGetMission(orgId: string, id: string): Promise<Mission> {
    const m = await this.repo.getMission(orgId, id);
    if (!m) throw new EngineError("NOT_FOUND", "Missão não encontrada");
    return m;
  }

  private async assertNoTasks(m: Mission) {
    const tasks = await this.repo.listTasks(m.org_id, m.id);
    if (tasks.length > 0) throw new EngineError("INVALID_STATE", "O plano já foi aprovado e está em execução");
  }

  private async assertAiBudget(orgId: string, policy: OrgPolicy) {
    const spend = await this.repo.sumUsageCostSince(orgId, monthStart(this.now()));
    if (spend >= policy.monthly_ai_budget_usd) {
      throw new EngineError("BUDGET_EXCEEDED", `Orçamento mensal de IA (US$ ${policy.monthly_ai_budget_usd.toFixed(2)}) esgotado`);
    }
  }

  private async transitionMission(m: Mission, to: MissionStatus): Promise<Mission> {
    return this.casMission(m, [m.status], to, {});
  }

  private async casMission(m: Mission, from: MissionStatus[], to: MissionStatus, patch: Partial<Mission>): Promise<Mission> {
    if (!from.includes(m.status)) throw new EngineError("INVALID_STATE", `Ação indisponível com a missão em "${m.status}"`);
    // Same-status updates (e.g. re-saving a plan under review) are not transitions.
    if (m.status !== to) assertMissionTransition(m.status, to);
    const updated = await this.repo.updateMissionIf(m.org_id, m.id, [m.status], { ...patch, status: to });
    if (!updated) throw new EngineError("CONFLICT", "A missão foi alterada por outro processo. Recarregue a página.");
    return updated;
  }

  private async recordUsage(orgId: string, missionId: string | null, runId: string | null, usage: AiUsage[]) {
    for (const u of usage) {
      await this.repo.insertUsage({ org_id: orgId, mission_id: missionId, agent_run_id: runId, provider: u.provider, model: u.model, input_tokens: u.input_tokens, output_tokens: u.output_tokens, cost_usd: estimateCostUsd(u) });
    }
  }

  private audit(actor: Actor, action: string, entity: string, id: string | null, outcome: AuditEvent["outcome"], details: Record<string, unknown>) {
    return this.repo.insertAudit({ org_id: actor.orgId, actor_type: actor.kind === "user" ? "user" : "system", actor_id: actor.userId, action, entity_type: entity, entity_id: id, outcome, details });
  }

  private systemAudit(orgId: string, action: string, entity: string, id: string | null, outcome: AuditEvent["outcome"], details: Record<string, unknown>) {
    return this.repo.insertAudit({ org_id: orgId, actor_type: "agent", actor_id: null, action, entity_type: entity, entity_id: id, outcome, details });
  }
}

export function execKey(taskId: string, attempt: number) {
  return `${taskId}:${attempt}`;
}

function monthStart(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function sumUsage(usage: AiUsage[]) {
  return {
    model: usage.at(-1)?.model ?? null,
    input: usage.reduce((s, u) => s + u.input_tokens, 0),
    output: usage.reduce((s, u) => s + u.output_tokens, 0),
  };
}

class TimeoutError extends Error {}

async function withTimeout<T>(p: Promise<T>, ms: number, controller: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(`Tempo limite de ${ms} ms excedido`));
    }, ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function classifyError(e: unknown, tool: AnyTool): { code: string; message: string; retryable: boolean } {
  if (e instanceof ToolError) return { code: e.code, message: e.message, retryable: e.retryable };
  if (e instanceof TimeoutError) return { code: "TIMEOUT", message: e.message, retryable: tool.idempotent };
  if (e instanceof AiOutputError) return { code: "AI_OUTPUT_INVALID", message: e.message, retryable: true };
  if (e && typeof e === "object" && "issues" in e) return { code: "AI_OUTPUT_INVALID", message: formatZodError(e), retryable: true };
  return { code: "INTERNAL_ERROR", message: "Erro interno ao executar a ferramenta", retryable: false };
}

function safeMessage(e: unknown): string {
  return e instanceof Error ? e.message.slice(0, 500) : "erro desconhecido";
}
