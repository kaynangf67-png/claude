import { CHALLENGE_DAYS, MISSIONS } from "./missions";
import type { Achievement, Level, MissionCompletion, SavedStrategy, UnlockedAchievement } from "./types";

// ---------- Datas (sempre no fuso local da pessoa) ----------

/** AAAA-MM-DD no fuso local. */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateKeyToUtcMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((dateKeyToUtcMs(toKey) - dateKeyToUtcMs(fromKey)) / 86_400_000);
}

export function addDays(key: string, days: number): string {
  const d = new Date(dateKeyToUtcMs(key) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// ---------- Dia do desafio ----------

/**
 * Um dia novo é liberado a cada dia do calendário desde o início.
 * Dias perdidos não bloqueiam nada: qualquer missão já liberada pode ser feita depois.
 */
export function unlockedDay(startedOn: string | null, todayKey: string): number {
  if (!startedOn) return 0;
  const elapsed = daysBetween(startedOn, todayKey);
  return Math.max(1, Math.min(CHALLENGE_DAYS, elapsed + 1));
}

/** Dia do calendário do desafio (pode passar de 21 quando o período já acabou). */
export function calendarDay(startedOn: string | null, todayKey: string): number {
  if (!startedOn) return 0;
  return Math.max(1, daysBetween(startedOn, todayKey) + 1);
}

export function completedDays(completions: MissionCompletion[]): Set<number> {
  return new Set(completions.map((c) => c.day));
}

/** Próxima missão a fazer: a primeira liberada e ainda não concluída. */
export function nextMissionDay(completions: MissionCompletion[], unlocked: number): number | null {
  const done = completedDays(completions);
  for (let d = 1; d <= unlocked; d++) if (!done.has(d)) return d;
  return null;
}

export type DayStatus = "concluida" | "disponivel" | "bloqueada";

export function dayStatus(day: number, completions: MissionCompletion[], unlocked: number): DayStatus {
  if (completedDays(completions).has(day)) return "concluida";
  return day <= unlocked ? "disponivel" : "bloqueada";
}

export function progressPercent(completions: MissionCompletion[]): number {
  return Math.round((completedDays(completions).size / CHALLENGE_DAYS) * 100);
}

// ---------- XP e níveis ----------

export const XP_RULES = {
  mission: 100,
  reflection: 20,
  strategy: 10,
  /** Limite de estratégias que contam XP, para salvar ter sentido e não virar "farm". */
  strategyCap: 10,
} as const;

export const LEVELS: Level[] = [
  { level: 1, name: "Semente", minXp: 0 },
  { level: 2, name: "Broto", minXp: 300 },
  { level: 3, name: "Raiz", minXp: 700 },
  { level: 4, name: "Folha", minXp: 1200 },
  { level: 5, name: "Árvore", minXp: 1800 },
  { level: 6, name: "Floresta", minXp: 2400 },
];

export function xpForCompletion(c: Pick<MissionCompletion, "reflection">): number {
  return XP_RULES.mission + (c.reflection && c.reflection.trim().length > 0 ? XP_RULES.reflection : 0);
}

/** XP é sempre derivado dos registros — nunca armazenado — para não haver duas fontes da verdade. */
export function totalXp(completions: MissionCompletion[], strategies: SavedStrategy[]): number {
  const unique = new Map<number, MissionCompletion>();
  for (const c of completions) if (!unique.has(c.day)) unique.set(c.day, c);
  let xp = 0;
  for (const c of unique.values()) xp += xpForCompletion(c);
  xp += Math.min(strategies.length, XP_RULES.strategyCap) * XP_RULES.strategy;
  return xp;
}

export interface LevelInfo {
  current: Level;
  next: Level | null;
  /** 0–100, progresso dentro do nível atual. */
  percentToNext: number;
  xpToNext: number;
}

export function levelFor(xp: number): LevelInfo {
  let current = LEVELS[0]!;
  for (const l of LEVELS) if (xp >= l.minXp) current = l;
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null;
  if (!next) return { current, next: null, percentToNext: 100, xpToNext: 0 };
  const span = next.minXp - current.minXp;
  return {
    current,
    next,
    percentToNext: Math.round(((xp - current.minXp) / span) * 100),
    xpToNext: next.minXp - xp,
  };
}

// ---------- Conquistas ----------

export const ACHIEVEMENTS: Achievement[] = [
  { id: "primeiro-passo", title: "Primeiro passo", description: "Concluiu a primeira missão." },
  { id: "primeira-reflexao", title: "Olhar para dentro", description: "Escreveu a primeira reflexão." },
  { id: "tres-missoes", title: "Ganhando ritmo", description: "Concluiu 3 missões." },
  { id: "colecionador", title: "Caixa de ferramentas", description: "Salvou 3 estratégias." },
  { id: "semana-1", title: "Semana de perceber", description: "Concluiu as 7 missões da primeira semana." },
  { id: "retomada", title: "De volta ao caminho", description: "Retomou o desafio depois de uma pausa de 2 dias ou mais." },
  { id: "metade", title: "Metade do caminho", description: "Concluiu 11 missões." },
  { id: "reflexivo", title: "Diário em dia", description: "Escreveu 7 reflexões." },
  { id: "caminho-completo", title: "21 dias", description: "Concluiu as 21 missões do desafio." },
];

export function evaluateAchievements(completions: MissionCompletion[], strategies: SavedStrategy[]): UnlockedAchievement[] {
  const byTime = [...completions].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const withReflection = byTime.filter((c) => c.reflection && c.reflection.trim().length > 0);
  const stratByTime = [...strategies].sort((a, b) => a.savedAt.localeCompare(b.savedAt));

  const nth = <T extends { completedAt: string }>(list: T[], n: number) => list[n - 1]?.completedAt ?? null;

  const week1Days = MISSIONS.filter((m) => m.week === 1).map((m) => m.day);
  let week1At: string | null = null;
  const seen = new Set<number>();
  for (const c of byTime) {
    seen.add(c.day);
    if (!week1At && week1Days.every((d) => seen.has(d))) week1At = c.completedAt;
  }

  let comebackAt: string | null = null;
  for (let i = 1; i < byTime.length; i++) {
    const prev = toLocalDateKey(new Date(byTime[i - 1]!.completedAt));
    const cur = toLocalDateKey(new Date(byTime[i]!.completedAt));
    if (daysBetween(prev, cur) >= 3) {
      comebackAt = byTime[i]!.completedAt;
      break;
    }
  }

  const unlockedAt: Record<string, string | null> = {
    "primeiro-passo": nth(byTime, 1),
    "primeira-reflexao": nth(withReflection, 1),
    "tres-missoes": nth(byTime, 3),
    colecionador: stratByTime[2]?.savedAt ?? null,
    "semana-1": week1At,
    retomada: comebackAt,
    metade: nth(byTime, 11),
    reflexivo: nth(withReflection, 7),
    "caminho-completo": nth(byTime, CHALLENGE_DAYS),
  };

  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlockedAt: unlockedAt[a.id] ?? null,
    unlocked: Boolean(unlockedAt[a.id]),
  }));
}
