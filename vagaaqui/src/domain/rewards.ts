import { LEVELS, REWARD_LABELS, REWARD_POINTS } from '../config/constants';
import { uid } from '../lib/random';
import type { RewardAction, RewardEvent, UserProfile } from '../types';

export function levelFor(points: number) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i].min) index = i;
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  const progress = next ? (points - current.min) / (next.min - current.min) : 1;
  return { current, next, progress: Math.max(0, Math.min(1, progress)), toNext: next ? next.min - points : 0 };
}

export function accuracy(profile: UserProfile) {
  return profile.confirmations ? profile.accurateConfirmations / profile.confirmations : 0;
}

/** Aplica uma recompensa. `accurate` vem da validação cruzada com outras fontes. */
export function applyReward(
  profile: UserProfile,
  action: RewardAction,
  spotId: string,
  accurate: boolean,
  now = Date.now(),
): { profile: UserProfile; event: RewardEvent; levelUp: boolean } {
  const points = REWARD_POINTS[action];
  const event: RewardEvent = { id: uid('rw'), action, points, label: REWARD_LABELS[action], timestamp: now, spotId };
  const before = levelFor(profile.points).current.name;
  const next: UserProfile = {
    ...profile,
    points: profile.points + points,
    confirmations: profile.confirmations + 1,
    accurateConfirmations: profile.accurateConfirmations + (accurate ? 1 : 0),
    parkedCount: profile.parkedCount + (action === 'parked' ? 1 : 0),
    history: [event, ...profile.history].slice(0, 30),
  };
  return { profile: next, event, levelUp: levelFor(next.points).current.name !== before };
}

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Motorista',
  points: 1240,
  confirmations: 87,
  accurateConfirmations: 80,
  parkedCount: 23,
  history: [],
};

/** Confiança atribuída às confirmações deste usuário, derivada da precisão histórica. */
export function trustFor(profile: UserProfile) {
  if (profile.confirmations < 5) return 0.6;
  return Math.max(0.4, Math.min(1, accuracy(profile)));
}
