import type { LevelName, RewardAction } from '../types';

export const BRAND = {
  name: 'VagaAqui',
  slogan: 'Encontre sua vaga antes de chegar.',
};

export const STATUS_COLORS = {
  likely_available: '#2bea8a',
  uncertain: '#ffc93c',
  likely_occupied: '#ff4d5e',
  stale: '#8a93a6',
} as const;

export const STATUS_LABELS = {
  likely_available: 'Alta chance de estar livre',
  uncertain: 'Chance moderada',
  likely_occupied: 'Provavelmente ocupada',
  stale: 'Informação antiga',
} as const;

/** Limites da probabilidade exibida: o app nunca afirma 0% ou 100%. */
export const PROBABILITY_MIN = 0.03;
export const PROBABILITY_MAX = 0.95;

export const REWARD_POINTS: Record<RewardAction, number> = {
  confirm_available: 10,
  confirm_occupied: 15,
  parked: 20,
};

export const REWARD_LABELS: Record<RewardAction, string> = {
  confirm_available: 'Confirmou uma vaga',
  confirm_occupied: 'Confirmou que uma vaga estava ocupada',
  parked: 'Confirmou que estacionou',
};

export const LEVELS: { name: LevelName; min: number; color: string }[] = [
  { name: 'Bronze', min: 0, color: '#d08a52' },
  { name: 'Prata', min: 1000, color: '#c7d0de' },
  { name: 'Ouro', min: 2500, color: '#ffcf4a' },
  { name: 'Platina', min: 5000, color: '#7fe7ff' },
  { name: 'Diamante', min: 10000, color: '#b98cff' },
];

/** Velocidade média urbana usada nas estimativas de tempo (25 km/h). */
export const CITY_SPEED_MS = 25 / 3.6;
/** Penalidade por conversão/cruzamento nas estimativas de tempo. */
export const TURN_PENALTY_S = 8;
/** Velocidade de caminhada (m/s). */
export const WALK_SPEED_MS = 1.3;
/** Custo esperado (s) de chegar e não encontrar a vaga: procurar outra. */
export const MISS_PENALTY_S = 180;
