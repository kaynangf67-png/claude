import { getGuideItem, type GuideItem } from "./guide";
import { CHALLENGE_DAYS, MISSIONS, getMission } from "./missions";
import {
  calendarDay,
  evaluateAchievements,
  levelFor,
  nextMissionDay,
  progressPercent,
  totalXp,
  unlockedDay,
  xpForCompletion,
  type LevelInfo,
} from "./progress";
import type { Mission, MissionCompletion, UnlockedAchievement, UserData } from "./types";

export type ActivityItem =
  | { kind: "mission"; at: string; mission: Mission; xp: number; hasReflection: boolean }
  | { kind: "strategy"; at: string; item: GuideItem };

export interface ChallengeView {
  started: boolean;
  calendarDay: number;
  unlockedDay: number;
  completedCount: number;
  percent: number;
  nextDay: number | null;
  nextMission: Mission | null;
  /** Concluiu a missão liberada hoje e a próxima só abre amanhã. */
  waitingForTomorrow: boolean;
  finished: boolean;
  xp: number;
  level: LevelInfo;
  achievements: UnlockedAchievement[];
  activity: ActivityItem[];
  completionByDay: Map<number, MissionCompletion>;
}

/** Monta tudo que as telas precisam a partir dos registros. Pura e testável. */
export function buildChallengeView(data: UserData, todayKey: string): ChallengeView {
  const start = data.profile.challengeStartedOn;
  const unlocked = unlockedDay(start, todayKey);
  const completionByDay = new Map(data.completions.map((c) => [c.day, c]));
  const nextDay = nextMissionDay(data.completions, unlocked);
  const xp = totalXp(data.completions, data.strategies);
  const finished = completionByDay.size >= CHALLENGE_DAYS;

  const activity: ActivityItem[] = [
    ...data.completions.flatMap((c): ActivityItem[] => {
      const mission = getMission(c.day);
      return mission ? [{ kind: "mission", at: c.completedAt, mission, xp: xpForCompletion(c), hasReflection: Boolean(c.reflection) }] : [];
    }),
    ...data.strategies.flatMap((s): ActivityItem[] => {
      const item = getGuideItem(s.strategyId);
      return item ? [{ kind: "strategy", at: s.savedAt, item }] : [];
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    started: Boolean(start),
    calendarDay: calendarDay(start, todayKey),
    unlockedDay: unlocked,
    completedCount: completionByDay.size,
    percent: progressPercent(data.completions),
    nextDay,
    nextMission: nextDay ? (getMission(nextDay) ?? null) : null,
    waitingForTomorrow: Boolean(start) && nextDay === null && !finished && unlocked < CHALLENGE_DAYS,
    finished,
    xp,
    level: levelFor(xp),
    achievements: evaluateAchievements(data.completions, data.strategies),
    activity,
    completionByDay,
  };
}

export { MISSIONS };
