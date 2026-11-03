import { sourceFor } from './demo';
import type { Candle, DataSourceInfo, IntrabarInfo } from './types';

/**
 * Adaptador da API pública da Binance (candles/klines). Parte pura: a rede
 * fica na interface. Dados de mercado de CRIPTO; não são os preços da Quotex.
 */

export const BINANCE_BASES = ['https://api.binance.com', 'https://data-api.binance.vision'] as const;

export function isValidSymbol(s: string): boolean {
  return /^[A-Z0-9]{5,20}$/.test(s);
}

/** Resposta de /api/v3/klines → candles (instantes em segundos). Linhas inválidas são descartadas. */
export function parseKlines(raw: unknown): Candle[] {
  if (!Array.isArray(raw)) return [];
  const out: Candle[] = [];
  for (const k of raw) {
    if (!Array.isArray(k) || k.length < 6) continue;
    const c: Candle = {
      t: Math.floor(Number(k[0]) / 1000), o: Number(k[1]), h: Number(k[2]), l: Number(k[3]), c: Number(k[4]), v: Number(k[5]),
    };
    if ([c.t, c.o, c.h, c.l, c.c].every(Number.isFinite) && c.h >= c.l && c.o > 0) out.push(c);
  }
  return out;
}

export interface LiveSplit {
  /** Candles M5 já fechados. */
  closed: Candle[];
  /** Abertura do candle M5 em formação (instante em segundos). */
  formingOpenT: number;
  /** OHLC do candle em formação até agora; null se a corretora ainda não devolveu o candle novo. */
  forming: { o: number; h: number; l: number; c: number } | null;
}

/** Separa candles fechados do candle em formação, usando o relógio (já corrigido) em segundos. */
export function splitForming(c5: Candle[], nowSec: number): LiveSplit | null {
  if (c5.length < 2) return null;
  const last = c5[c5.length - 1]!;
  if (last.t + 300 > nowSec) {
    return { closed: c5.slice(0, -1), formingOpenT: last.t, forming: { o: last.o, h: last.h, l: last.l, c: last.c } };
  }
  return { closed: c5, formingOpenT: last.t + 300, forming: null };
}

/** Monta a informação do candle em formação a partir dos dados ao vivo. */
export function buildIntrabar(split: LiveSplit, m1: Candle[], nowSec: number): IntrabarInfo {
  const lastClose = split.closed[split.closed.length - 1]!.c;
  const remainingSeconds = Math.min(300, Math.max(0, split.formingOpenT + 300 - nowSec));
  const forming = split.forming ?? { o: lastClose, h: lastClose, l: lastClose, c: lastClose };
  return {
    remainingSeconds,
    forming,
    m1: m1.filter((c) => c.t >= split.formingOpenT && c.t + 60 <= nowSec).sort((a, b) => a.t - b.t),
  };
}

export function liveSource(
  symbol: string, closed: Candle[], displayTimezone: string, now: number, fonte: 'binance' | 'mt5' = 'binance',
): DataSourceInfo {
  const mt5 = fonte === 'mt5';
  return sourceFor(closed, {
    kind: mt5 ? 'mt5_arquivo' : 'binance_live',
    name: mt5 ? `MT5 ${symbol} · M5 ao vivo` : `Binance ${symbol} · M5 ao vivo`,
    origin: mt5
      ? 'MetaTrader 5 (arquivo exportado pelo script). Preço da corretora do MT5, não é o da Quotex.'
      : 'API pública da Binance (cripto). Não são os preços da Quotex.',
    synthetic: false,
    asset: symbol,
    otc: false,
    timezone: 'UTC',
    displayTimezone,
  }, now);
}
