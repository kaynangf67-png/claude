import type { Candle } from './types';

/**
 * Média móvel exponencial (EMA) e alinhamento de tendência com o lado da zona.
 * HIPÓTESE a testar: não vem das aulas; os períodos 9 e 21 são só valores comuns.
 * Usa apenas candles FECHADOS e recentes (janela fixa), então ao vivo e no teste
 * histórico o resultado é o mesmo.
 */

/** Candles usados no cálculo; a semente da EMA já perdeu o peso muito antes disso. */
export const MA_WINDOW = 200;

/** EMA com semente na média simples dos primeiros `period` fechamentos. Vazio se faltam dados. */
export function ema(closes: number[], period: number): number[] {
  if (period < 1 || closes.length < period) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < closes.length; i++) {
    prev = closes[i]! * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export interface MaReading {
  fast: number;
  slow: number;
  /** true = a tendência indicada pelas médias vai no sentido do lado da zona. */
  aligned: boolean;
  trend: 'alta' | 'baixa' | 'neutra';
}

/**
 * Lado da zona → sentido esperado da retração: suporte = compra (alinhada se a
 * média rápida está acima da lenta); resistência = venda (rápida abaixo da lenta).
 * Devolve null se faltam candles (menos de 3× o período lento).
 */
export function maReading(candles: Candle[], side: 'resistencia' | 'suporte', fast: number, slow: number): MaReading | null {
  if (!(fast >= 1 && slow > fast)) return null;
  const w = candles.slice(-MA_WINDOW);
  if (w.length < slow * 3) return null;
  const closes = w.map((c) => c.c);
  const f = ema(closes, fast).at(-1);
  const s = ema(closes, slow).at(-1);
  if (f === undefined || s === undefined) return null;
  const trend = f > s ? 'alta' : f < s ? 'baixa' : 'neutra';
  return { fast: f, slow: s, trend, aligned: side === 'suporte' ? trend === 'alta' : trend === 'baixa' };
}
