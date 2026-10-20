/**
 * Mission and task state machines. Every status change in the engine goes
 * through `assertMissionTransition` / `assertTaskTransition`, so the tables
 * below are the single source of truth for what is allowed.
 */

export const MISSION_STATUSES = [
  "draft",
  "planning",
  "awaiting_approval",
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const TASK_STATUSES = [
  "pending",
  "ready",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
  "verification_failed",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const MISSION_TRANSITIONS: Record<MissionStatus, readonly MissionStatus[]> = {
  // draft -> awaiting_approval happens when a plan is attached (AI or manual)
  // and must be reviewed before it is queued.
  draft: ["planning", "awaiting_approval", "cancelled"],
  planning: ["awaiting_approval", "draft", "failed", "cancelled"],
  // awaiting_approval covers both "plan review" and "a task waits for approval".
  awaiting_approval: ["queued", "running", "draft", "paused", "failed", "cancelled", "completed"],
  queued: ["running", "paused", "cancelled"],
  running: ["awaiting_approval", "paused", "completed", "failed", "cancelled", "queued"],
  paused: ["queued", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ["ready", "skipped", "cancelled"],
  ready: ["running", "awaiting_approval", "skipped", "cancelled", "failed"],
  running: ["succeeded", "failed", "verification_failed", "ready", "cancelled"],
  awaiting_approval: ["ready", "skipped", "cancelled", "failed"],
  succeeded: [],
  failed: [],
  skipped: [],
  cancelled: [],
  verification_failed: [],
};

export const TERMINAL_MISSION_STATUSES: readonly MissionStatus[] = ["completed", "failed", "cancelled"];
export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = [
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
  "verification_failed",
];

export class InvalidTransitionError extends Error {
  constructor(
    readonly entity: "mission" | "task",
    readonly from: string,
    readonly to: string,
  ) {
    super(`Invalid ${entity} transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_TRANSITIONS[from].includes(to);
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}

export function assertMissionTransition(from: MissionStatus, to: MissionStatus): void {
  if (!canTransitionMission(from, to)) throw new InvalidTransitionError("mission", from, to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTask(from, to)) throw new InvalidTransitionError("task", from, to);
}

export function isTerminalTask(status: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.includes(status);
}

export function isTerminalMission(status: MissionStatus): boolean {
  return TERMINAL_MISSION_STATUSES.includes(status);
}

/** Task outcomes that let dependent tasks proceed. */
export function satisfiesDependency(status: TaskStatus): boolean {
  return status === "succeeded";
}

/** pt-BR labels for UI. */
export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  draft: "Rascunho",
  planning: "Planejando",
  awaiting_approval: "Aguardando aprovação",
  queued: "Na fila",
  running: "Executando",
  paused: "Pausada",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pendente",
  ready: "Pronta",
  running: "Executando",
  awaiting_approval: "Aguardando aprovação",
  succeeded: "Concluída",
  failed: "Falhou",
  skipped: "Ignorada",
  cancelled: "Cancelada",
  verification_failed: "Verificação falhou",
};
