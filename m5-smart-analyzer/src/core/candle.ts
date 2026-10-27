import type { Candle, CandleMetrics, Direction } from './types';

export function candleDirection(c: Candle): Direction {
  if (c.c > c.o) return 'alta';
  if (c.c < c.o) return 'baixa';
  return 'doji';
}

/** Corpo, pavios e amplitude de um candle (Regra 1). */
export function candleMetrics(c: Candle): CandleMetrics {
  const top = Math.max(c.o, c.c);
  const bottom = Math.min(c.o, c.c);
  const range = c.h - c.l;
  const body = Math.abs(c.c - c.o);
  const upperWick = c.h - top;
  const lowerWick = bottom - c.l;
  const ratio = (x: number) => (range > 0 ? x / range : null);
  return {
    direction: candleDirection(c),
    body,
    upperWick,
    lowerWick,
    range,
    bodyRatio: ratio(body),
    upperWickRatio: ratio(upperWick),
    lowerWickRatio: ratio(lowerWick),
  };
}

export type CandleIssueCode =
  | 'NAO_FINITO'
  | 'PRECO_NAO_POSITIVO'
  | 'HIGH_MENOR_QUE_LOW'
  | 'HIGH_MENOR_QUE_CORPO'
  | 'LOW_MAIOR_QUE_CORPO'
  | 'VOLUME_INVALIDO';

/** Verifica as invariantes OHLC. Retorna o código do primeiro problema ou null. */
export function candleIssue(c: Candle): CandleIssueCode | null {
  const vals = [c.t, c.o, c.h, c.l, c.c];
  if (!vals.every(Number.isFinite)) return 'NAO_FINITO';
  if (c.o <= 0 || c.h <= 0 || c.l <= 0 || c.c <= 0) return 'PRECO_NAO_POSITIVO';
  if (c.h < c.l) return 'HIGH_MENOR_QUE_LOW';
  if (c.h < Math.max(c.o, c.c)) return 'HIGH_MENOR_QUE_CORPO';
  if (c.l > Math.min(c.o, c.c)) return 'LOW_MAIOR_QUE_CORPO';
  if (c.v !== undefined && (!Number.isFinite(c.v) || c.v < 0)) return 'VOLUME_INVALIDO';
  return null;
}

export const CANDLE_ISSUE_MESSAGES: Record<CandleIssueCode, string> = {
  NAO_FINITO: 'contém valor numérico inválido',
  PRECO_NAO_POSITIVO: 'preço menor ou igual a zero',
  HIGH_MENOR_QUE_LOW: 'máxima (high) menor que a mínima (low)',
  HIGH_MENOR_QUE_CORPO: 'máxima (high) menor que a abertura ou o fechamento',
  LOW_MAIOR_QUE_CORPO: 'mínima (low) maior que a abertura ou o fechamento',
  VOLUME_INVALIDO: 'volume negativo ou inválido',
};

export interface Run {
  direction: Direction;
  startIndex: number;
  endIndex: number;
  length: number;
}

/**
 * Sequências consecutivas da mesma direção (Regra 2). Dojis quebram a
 * sequência e formam o próprio grupo (não contam como alta nem baixa).
 */
export function directionRuns(candles: Candle[], from = 0, to = candles.length - 1): Run[] {
  const runs: Run[] = [];
  for (let i = Math.max(0, from); i <= Math.min(to, candles.length - 1); i++) {
    const d = candleDirection(candles[i]!);
    const last = runs[runs.length - 1];
    if (last && last.direction === d) {
      last.endIndex = i;
      last.length++;
    } else {
      runs.push({ direction: d, startIndex: i, endIndex: i, length: 1 });
    }
  }
  return runs;
}

/** Média das amplitudes (high - low). Escala de referência para múltiplos. */
export function meanRange(candles: Candle[], from: number, to: number): number | null {
  let sum = 0;
  let n = 0;
  for (let i = Math.max(0, from); i <= Math.min(to, candles.length - 1); i++) {
    const c = candles[i]!;
    sum += c.h - c.l;
    n++;
  }
  if (n === 0) return null;
  const m = sum / n;
  return m > 0 ? m : null;
}

/**
 * ATR simples (média do true range) dos últimos `n` candles até `last`.
 * Escala de referência para distâncias do gatilho (aproximação, reversão...).
 */
export function atr(candles: Candle[], last: number, n = 14): number | null {
  const from = Math.max(1, last - n + 1);
  let sum = 0;
  let k = 0;
  for (let i = from; i <= last; i++) {
    const c = candles[i]!;
    const pc = candles[i - 1]!.c;
    sum += Math.max(c.h - c.l, Math.abs(c.h - pc), Math.abs(c.l - pc));
    k++;
  }
  return k > 0 && sum > 0 ? sum / k : null;
}
