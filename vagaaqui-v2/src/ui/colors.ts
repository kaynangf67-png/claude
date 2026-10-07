import type { ChanceLevel } from '../model/types';

export const LEVEL_COLOR: Record<ChanceLevel, string> = {
  high: '#22c55e',
  medium: '#f5b400',
  low: '#ef4444',
  unknown: '#8a94a6',
};

export const LEVEL_LABEL: Record<ChanceLevel, string> = {
  high: 'ALTA',
  medium: 'MÉDIA',
  low: 'BAIXA',
  unknown: 'SEM DADOS',
};

export const pct = (p: number) => `${Math.round(p * 100)}%`;
export const range = (lo: number, hi: number) => (Math.round(lo * 100) === Math.round(hi * 100) ? pct(lo) : `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`);
