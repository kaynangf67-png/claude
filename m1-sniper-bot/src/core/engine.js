// Motor de análise M1. Recebe APENAS candles fechados e decide se há sinal
// no fechamento do último candle. Não acessa o futuro: a entrada sugerida é
// na abertura do próximo candle, com expiração de 1 minuto.

import { ema, rsi, adx, bollinger } from './indicators.js';
import { detectPatterns, avgBody, candleHelpers as H } from './priceAction.js';
import { validateSeries } from './validate.js';

export const DEFAULT_ENGINE_CONFIG = Object.freeze({
  minScore: 80,
  rsiCallMin: 50, rsiCallMax: 70,   // faixa favorável para CALL
  rsiPutMin: 30, rsiPutMax: 50,     // faixa favorável para PUT
  rsiSoftMargin: 5,                  // zona "neutra aceitável" (pontos parciais)
  adxMin: 20,                        // abaixo disso: mercado sem direção → sem sinal
  adxStrong: 25,
  minBandWidth: 0.0004,              // bandas muito estreitas (0,04%) = mercado parado
});

// EMA200 precisa de 200 candles; usamos folga para estabilizar EMA/ADX.
export const REQUIRED_CANDLES = 260;

const fmt = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));

/** Calcula todos os indicadores para a série (uma vez). */
export function computeIndicators(candles) {
  const closes = candles.map((c) => c.close);
  return {
    ema9: ema(closes, 9),
    ema21: ema(closes, 21),
    ema200: ema(closes, 200),
    rsi: rsi(closes, 14),
    adx: adx(candles, 14),
    bb: bollinger(closes, 20, 2),
  };
}

/**
 * Pontua uma direção no índice i. Retorna { score, vetoes[], reasons[], breakdown }.
 * Vetos = condição contraditória/perigosa que impede o sinal independentemente da nota.
 */
export function scoreDirection(candles, ind, i, dir, cfg) {
  const x = candles[i];
  const call = dir === 'CALL';
  const e9 = ind.ema9[i], e21 = ind.ema21[i], e200 = ind.ema200[i];
  const e9prev = ind.ema9[i - 3];
  const r = ind.rsi[i];
  const a = ind.adx.adx[i], pdi = ind.adx.plusDI[i], mdi = ind.adx.minusDI[i];
  const mid = ind.bb.middle[i], up = ind.bb.upper[i], lo = ind.bb.lower[i], bw = ind.bb.width[i];

  const vetoes = [], reasons = [], confirmed = [];
  const bd = { trend: 0, rsi: 0, adx: 0, bollinger: 0, priceAction: 0, candle: 0 };

  // --- Tendência (25)
  const emaAligned = call ? e9 > e21 : e9 < e21;
  const longTrend = call ? x.close > e200 && e21 > e200 : x.close < e200 && e21 < e200;
  const slope = call ? e9 > e9prev : e9 < e9prev;
  if (!emaAligned) vetoes.push(`EMA 9 ${call ? 'abaixo' : 'acima'} da EMA 21`);
  if (!longTrend) vetoes.push(`Preço/EMA 21 do lado errado da EMA 200`);
  if (emaAligned) { bd.trend += 10; confirmed.push('EMA 9/21'); }
  if (longTrend) { bd.trend += 10; confirmed.push('EMA 200'); }
  if (slope) bd.trend += 5;
  if (emaAligned && longTrend) reasons.push(`Tendência de ${call ? 'alta' : 'baixa'} confirmada (EMA9 ${fmt(e9, 5)} ${call ? '>' : '<'} EMA21 ${fmt(e21, 5)}, preço ${call ? 'acima' : 'abaixo'} da EMA200)`);

  // --- RSI (15)
  const [rMin, rMax] = call ? [cfg.rsiCallMin, cfg.rsiCallMax] : [cfg.rsiPutMin, cfg.rsiPutMax];
  if (call ? r >= cfg.rsiCallMax : r <= cfg.rsiPutMin) {
    vetoes.push(`RSI ${fmt(r, 1)} em exaustão`);
  } else if (r > rMin && r < rMax) {
    bd.rsi = 15; confirmed.push('RSI');
    reasons.push(`RSI ${fmt(r, 1)} com força ${call ? 'compradora' : 'vendedora'} sem exaustão`);
  } else if (call ? r > rMin - cfg.rsiSoftMargin : r < rMax + cfg.rsiSoftMargin) {
    bd.rsi = 7;
  } else {
    vetoes.push(`RSI ${fmt(r, 1)} contra a direção`);
  }

  // --- ADX (15)
  const diOk = call ? pdi > mdi : mdi > pdi;
  if (a < cfg.adxMin) vetoes.push(`ADX ${fmt(a, 1)} < ${cfg.adxMin}: mercado sem direção`);
  if (!diOk) vetoes.push(`DI contraditório (+DI ${fmt(pdi, 1)} / -DI ${fmt(mdi, 1)})`);
  if (a >= cfg.adxMin && diOk) {
    bd.adx = a >= cfg.adxStrong ? 15 : 8;
    confirmed.push('ADX');
    reasons.push(`ADX ${fmt(a, 1)} indica tendência ${a >= cfg.adxStrong ? 'forte' : 'moderada'}`);
  }

  // --- Bollinger (15)
  if (bw < cfg.minBandWidth) {
    vetoes.push('Bandas de Bollinger comprimidas (volatilidade muito baixa)');
  } else if (call ? x.close > up : x.close < lo) {
    vetoes.push(`Fechamento fora da banda ${call ? 'superior' : 'inferior'} (esticado)`);
  } else {
    const sideOk = call ? x.close > mid : x.close < mid;
    const midReject = call ? x.low <= mid && x.close > mid : x.high >= mid && x.close < mid;
    const bandReject = call ? x.low <= lo && x.close > lo : x.high >= up && x.close < up;
    if (sideOk) bd.bollinger += 10;
    if (midReject || bandReject) bd.bollinger += 5;
    if (sideOk) {
      confirmed.push('Bollinger');
      reasons.push(midReject || bandReject
        ? `Rejeição na banda ${bandReject ? (call ? 'inferior' : 'superior') : 'central'} de Bollinger`
        : `Preço ${call ? 'acima' : 'abaixo'} da média de Bollinger com espaço até a banda`);
    }
  }

  // --- Price Action (20)
  const levels = call ? [e21, lo, mid] : [e21, up, mid];
  const patterns = detectPatterns(candles, i, dir, levels);
  if (patterns.length === 0) vetoes.push('Sem confirmação de Price Action');
  else {
    bd.priceAction = Math.min(20, Math.max(...patterns.map((p) => p.pts)) + (patterns.length > 1 ? 4 : 0));
    confirmed.push('Price Action');
    reasons.push(`Price Action: ${patterns.map((p) => p.label).join(', ')}`);
  }

  // --- Candle de confirmação (10). Sempre o último candle FECHADO.
  const dirCandle = call ? H.isBull(x) : H.isBear(x);
  if (!dirCandle) vetoes.push(`Candle de confirmação ${call ? 'não é de alta' : 'não é de baixa'}`);
  else {
    bd.candle += 5;
    if (H.range(x) > 0 && H.body(x) >= 0.5 * H.range(x)) bd.candle += 3;
    if (H.body(x) >= avgBody(candles, i)) bd.candle += 2;
    confirmed.push('Candle fechado');
  }

  const score = bd.trend + bd.rsi + bd.adx + bd.bollinger + bd.priceAction + bd.candle;
  return {
    dir, score, vetoes, reasons, confirmed, breakdown: bd,
    patterns: patterns.map((p) => p.id),
    snapshot: { ema9: e9, ema21: e21, ema200: e200, rsi: r, adx: a, plusDI: pdi, minusDI: mdi, bbUpper: up, bbMiddle: mid, bbLower: lo },
  };
}

/**
 * Analisa a série de candles fechados.
 * @returns {{status:'invalid'|'no_signal'|'signal', reason?:string, signal?:object, best?:object}}
 */
export function analyze(candles, config = {}, meta = {}) {
  const cfg = { ...DEFAULT_ENGINE_CONFIG, ...config };
  const v = validateSeries(candles, REQUIRED_CANDLES);
  if (!v.ok) return { status: 'invalid', reason: v.reason };

  const ind = computeIndicators(candles);
  return analyzeAt(candles, ind, candles.length - 1, cfg, meta);
}

/** Versão usada pelo backtest: indicadores pré-calculados, índice explícito. */
export function analyzeAt(candles, ind, i, cfg, meta = {}) {
  const needed = [ind.ema200[i], ind.ema9[i - 3], ind.rsi[i], ind.adx.adx[i], ind.bb.width[i]];
  if (needed.some((v) => v == null || !Number.isFinite(v))) {
    return { status: 'invalid', reason: 'Indicadores ainda em aquecimento' };
  }
  const call = scoreDirection(candles, ind, i, 'CALL', cfg);
  const put = scoreDirection(candles, ind, i, 'PUT', cfg);
  const best = call.score >= put.score ? call : put;

  const qualifies = (s) => s.vetoes.length === 0 && s.score >= cfg.minScore;
  const qc = qualifies(call), qp = qualifies(put);
  if (qc && qp) return { status: 'no_signal', reason: 'Indicadores contraditórios', best };
  const chosen = qc ? call : qp ? put : null;
  if (!chosen) {
    const why = best.vetoes.length ? best.vetoes[0] : `Pontuação ${best.score} < ${cfg.minScore}`;
    return { status: 'no_signal', reason: why, best };
  }

  const c = candles[i];
  return {
    status: 'signal',
    best,
    signal: {
      id: `${meta.symbol ?? 'UNK'}-${c.time}`,
      symbol: meta.symbol ?? 'UNK',
      source: meta.source ?? 'unknown',
      direction: chosen.dir,
      score: chosen.score,
      breakdown: chosen.breakdown,
      reasons: chosen.reasons,
      confirmed: chosen.confirmed,
      patterns: chosen.patterns,
      snapshot: chosen.snapshot,
      confirmCandleTime: c.time,            // abertura do candle de confirmação (fechado)
      entryTime: c.time + 60_000,           // entrada na abertura do próximo candle
      expiryTime: c.time + 120_000,         // expiração de 1 minuto
      refPrice: c.close,
    },
  };
}
