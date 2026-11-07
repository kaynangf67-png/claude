// Backtest walk-forward SEM antecipação: no índice i o motor só enxerga
// candles[0..i] (fechados). O resultado é medido no candle i+1
// (entrada na abertura, saída no fechamento = expiração de 1 minuto).
import { computeIndicators, analyzeAt, DEFAULT_ENGINE_CONFIG, REQUIRED_CANDLES } from './engine.js';
import { DAILY_GREEN_TARGET, DAILY_LOSS_LIMIT } from './risk.js';
import { dayKey } from './time.js';
import { computeStats } from './stats.js';

export function outcomeOf(direction, entryCandle) {
  const { open, close } = entryCandle;
  if (close === open) return 'DRAW';
  const up = close > open;
  return (direction === 'CALL') === up ? 'GREEN' : 'LOSS';
}

/**
 * @param candles série M1 contínua
 * @param opts { config, symbol, payout, tz, applyDailyLimits }
 */
export function runBacktest(candles, opts = {}) {
  const cfg = { ...DEFAULT_ENGINE_CONFIG, ...(opts.config || {}) };
  const tz = opts.tz || 'UTC';
  const symbol = opts.symbol || 'UNK';
  const applyLimits = opts.applyDailyLimits !== false;
  // Indicadores são causais (cada valor em i depende só de 0..i), então
  // calculá-los uma vez sobre a série toda NÃO introduz antecipação.
  const ind = computeIndicators(candles);
  const trades = [];
  const days = new Map();
  let lockedDays = 0;
  for (let i = REQUIRED_CANDLES - 1; i < candles.length - 1; i++) {
    // Lacuna: o candle de entrada precisa ser exatamente o minuto seguinte.
    if (candles[i + 1].time - candles[i].time !== 60_000) continue;
    const k = dayKey(candles[i + 1].time, tz);
    const d = days.get(k) || { g: 0, l: 0 };
    if (applyLimits && (d.g >= DAILY_GREEN_TARGET || d.l >= DAILY_LOSS_LIMIT)) continue;
    const r = analyzeAt(candles, ind, i, cfg, { symbol });
    if (r.status !== 'signal') continue;
    const result = outcomeOf(r.signal.direction, candles[i + 1]);
    trades.push({ time: candles[i + 1].time, symbol, direction: r.signal.direction, score: r.signal.score, result, patterns: r.signal.patterns });
    if (result === 'GREEN') d.g++; else if (result === 'LOSS') d.l++;
    if (applyLimits && (d.g === DAILY_GREEN_TARGET || d.l === DAILY_LOSS_LIMIT) && result !== 'DRAW') lockedDays++;
    days.set(k, d);
    i++; // sem entradas simultâneas: pula o candle da operação
  }
  return { trades, stats: computeStats(trades, opts.payout ?? 0.85, tz), lockedDays, candles: candles.length };
}
