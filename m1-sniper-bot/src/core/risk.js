// Gerenciamento de risco obrigatório. Constantes FIXAS (não configuráveis).
import { dayKey } from './time.js';

export const DAILY_GREEN_TARGET = 10;
export const DAILY_LOSS_LIMIT = 3;
export const MIN_SCORE_FLOOR = 80;       // a nota mínima só pode subir, nunca descer de 80
export const MAX_AMOUNT = 100_000;

export const LOCK_MESSAGES = {
  GOAL: 'META DIÁRIA ATINGIDA',
  LOSS: 'LIMITE DE LOSS ATINGIDO',
};

export function newDay(key) {
  return { key, greens: 0, losses: 0, draws: 0, locked: null, lockedAt: null, amountCap: null };
}

/**
 * Virada do dia: só reinicia quando a data local AVANÇA. Se o relógio voltar,
 * nada é reiniciado (evita desbloqueio por mudança de relógio).
 */
export function rollDay(day, now, tz) {
  const key = dayKey(now, tz);
  if (!day || key > day.key) return { day: newDay(key), rolled: true };
  return { day, rolled: false };
}

export function lockFor(day) {
  if (day.greens >= DAILY_GREEN_TARGET) return 'GOAL';
  if (day.losses >= DAILY_LOSS_LIMIT) return 'LOSS';
  return null;
}

/** Valida o valor da operação. Sem Martingale: após um LOSS, o valor não pode subir no mesmo dia. */
export function checkAmount(amount, day) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Valor inválido';
  if (amount <= 0) return 'O valor deve ser maior que zero';
  if (amount > MAX_AMOUNT) return `Valor acima do máximo permitido (${MAX_AMOUNT})`;
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return 'Use no máximo 2 casas decimais';
  if (day?.amountCap != null && amount > day.amountCap) {
    return `Sem Martingale: após um LOSS hoje o valor não pode passar de ${day.amountCap.toFixed(2)}`;
  }
  return null;
}
