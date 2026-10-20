import type { Approval, Mission, MissionReport, ReportTaskLine, Task } from "@/lib/domain/types";

export function buildMissionReport(
  mission: Pick<Mission, "started_at">,
  tasks: Task[],
  approvals: Approval[],
  usage: { cost: number | null; count: number },
  now = new Date(),
): MissionReport {
  const line = (t: Task, detail?: string): ReportTaskLine => ({ task_id: t.id, title: t.title, tool_id: t.tool_id, status: t.status, detail });
  const totals: Record<string, number> = {};
  for (const t of tasks) totals[t.status] = (totals[t.status] ?? 0) + 1;

  const pendingApprovalTaskIds = new Set(approvals.filter((a) => a.status === "pending").map((a) => a.task_id));
  const notes: string[] = [];
  if (usage.count > 0 && usage.cost === null) {
    notes.push("Há uso de IA registrado com modelo sem preço conhecido; o custo total não foi estimado.");
  }
  if (tasks.some((t) => t.status === "succeeded" && t.verification_status === "unverified")) {
    notes.push("Algumas tarefas foram executadas, mas o resultado não pôde ser confirmado de forma independente.");
  }
  notes.push("Este relatório descreve ações executadas e verificadas pelo sistema; não comprova resultados de negócio.");

  return {
    generated_at: now.toISOString(),
    duration_ms: mission.started_at ? now.getTime() - new Date(mission.started_at).getTime() : null,
    totals,
    completed: tasks.filter((t) => t.status === "succeeded").map((t) => line(t)),
    failed: tasks
      .filter((t) => t.status === "failed" || t.status === "verification_failed")
      .map((t) => line(t, [t.error_code, t.error_message].filter(Boolean).join(": ") || undefined)),
    pending_approvals: tasks.filter((t) => t.status === "awaiting_approval" || pendingApprovalTaskIds.has(t.id)).map((t) => line(t)),
    skipped: tasks.filter((t) => t.status === "skipped" || t.status === "cancelled").map((t) => line(t, t.error_message ?? undefined)),
    verified: tasks.filter((t) => t.verification_status === "verified").map((t) => line(t)),
    unverified: tasks
      .filter((t) => t.status === "succeeded" && (t.verification_status === "unverified" || t.verification_status === "pending"))
      .map((t) => line(t)),
    ai_cost_usd: usage.cost,
    ai_usage_records: usage.count,
    notes,
  };
}
