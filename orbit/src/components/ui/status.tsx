import { MISSION_STATUS_LABEL, TASK_STATUS_LABEL, type MissionStatus, type TaskStatus } from "@/lib/domain/states";
import type { ApprovalStatus, RiskLevel, VerificationStatus } from "@/lib/domain/types";
import { Badge, type Tone } from "./primitives";

const missionTone: Record<MissionStatus, Tone> = {
  draft: "neutral", planning: "info", awaiting_approval: "warning", queued: "info", running: "accent", paused: "warning", completed: "success", failed: "danger", cancelled: "neutral",
};
const taskTone: Record<TaskStatus, Tone> = {
  pending: "neutral", ready: "info", running: "accent", awaiting_approval: "warning", succeeded: "success", failed: "danger", skipped: "neutral", cancelled: "neutral", verification_failed: "danger",
};

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return <Badge tone={missionTone[status]}>{MISSION_STATUS_LABEL[status]}</Badge>;
}
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={taskTone[status]}>{TASK_STATUS_LABEL[status]}</Badge>;
}

export const RISK_LABEL: Record<RiskLevel, string> = { low: "Baixo", medium: "Médio", high: "Alto", critical: "Crítico" };
const riskTone: Record<RiskLevel, Tone> = { low: "neutral", medium: "info", high: "warning", critical: "danger" };
export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <Badge tone={riskTone[risk]}>Risco {RISK_LABEL[risk].toLowerCase()}</Badge>;
}

const verLabel: Record<VerificationStatus, [string, Tone]> = {
  verified: ["Verificado", "success"],
  unverified: ["Não verificado", "warning"],
  failed: ["Verificação falhou", "danger"],
  not_applicable: ["Não se aplica", "neutral"],
  pending: ["Pendente", "neutral"],
};
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const [label, tone] = verLabel[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada", expired: "Expirada", invalidated: "Invalidada", cancelled: "Cancelada", consumed: "Utilizada",
};
const approvalTone: Record<ApprovalStatus, Tone> = { pending: "warning", approved: "success", rejected: "danger", expired: "neutral", invalidated: "neutral", cancelled: "neutral", consumed: "success" };
export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return <Badge tone={approvalTone[status]}>{APPROVAL_STATUS_LABEL[status]}</Badge>;
}

export const AGENT_LABEL = { strategist: "Estrategista", operator: "Operador", auditor: "Auditor", optimizer: "Otimizador" } as const;
