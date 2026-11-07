/*
 * M1 SNIPER BOT — Price Action.
 * Cada detector olha somente o candle i (já fechado) e os anteriores.
 * Retorna { name, label, direction: 'CALL'|'PUT', strength: 0..1 }.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.M1 = root.M1 || {};
  root.M1.Patterns = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  function anatomy(c) {
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    const upper = c.high - Math.max(c.open, c.close);
    const lower = Math.min(c.open, c.close) - c.low;
    return { body, range, upper, lower, bull: c.close > c.open, bear: c.close < c.open };
  }

  function engulfing(candles, i, atrV) {
    if (i < 1 || !atrV) return [];
    const p = candles[i - 1], c = candles[i];
    const a = anatomy(c), b = anatomy(p);
    const out = [];
    if (a.body < 0.3 * atrV || a.body <= b.body) return out;
    const s = clamp01(0.4 + 0.3 * (a.body / Math.max(b.body, 1e-12) - 1) / 2 + 0.3 * (a.body / a.range));
    if (b.bear && a.bull && c.open <= p.close && c.close >= p.open) {
      out.push({ name: 'bullishEngulfing', label: 'Engolfo de alta', direction: 'CALL', strength: s });
    }
    if (b.bull && a.bear && c.open >= p.close && c.close <= p.open) {
      out.push({ name: 'bearishEngulfing', label: 'Engolfo de baixa', direction: 'PUT', strength: s });
    }
    return out;
  }

  function pinBar(candles, i, atrV) {
    if (!atrV) return [];
    const c = candles[i];
    const a = anatomy(c);
    if (a.range < 0.5 * atrV || a.range === 0) return [];
    const body = Math.max(a.body, a.range * 0.02);
    const out = [];
    const pos = (c.close - c.low) / a.range; // 0 = fecha na mínima, 1 = na máxima
    if (a.lower >= 2 * body && a.lower >= 0.6 * a.range && pos >= 0.66 && !a.bear) {
      out.push({ name: 'bullishPinBar', label: 'Pin bar de alta (martelo)', direction: 'CALL',
        strength: clamp01(0.45 + 0.55 * (a.lower / a.range - 0.6) / 0.4) });
    }
    if (a.upper >= 2 * body && a.upper >= 0.6 * a.range && pos <= 0.34 && !a.bull) {
      out.push({ name: 'bearishPinBar', label: 'Pin bar de baixa (estrela cadente)', direction: 'PUT',
        strength: clamp01(0.45 + 0.55 * (a.upper / a.range - 0.6) / 0.4) });
    }
    return out;
  }

  function swingLevels(candles, i, lookback) {
    let hi = -Infinity, lo = Infinity;
    for (let j = Math.max(0, i - lookback); j < i; j++) {
      if (candles[j].high > hi) hi = candles[j].high;
      if (candles[j].low < lo) lo = candles[j].low;
    }
    return { resistance: hi, support: lo };
  }

  /**
   * Rejeição de suporte/resistência: o pavio toca um nível (mínima/máxima recente,
   * banda de Bollinger ou EMA 21) e o candle fecha afastado dele, a favor da direção.
   */
  function rejection(candles, i, atrV, ctx) {
    if (!atrV || i < 2) return [];
    const c = candles[i];
    const a = anatomy(c);
    if (a.range === 0) return [];
    const { support, resistance } = swingLevels(candles, i, ctx.lookback || 20);
    const tol = 0.15 * atrV;
    const out = [];

    const supLevels = [
      { v: support, n: 'suporte recente' },
      { v: ctx.bbLower, n: 'banda inferior' },
      { v: ctx.ema21, n: 'EMA 21' },
    ].filter((l) => Number.isFinite(l.v));
    const resLevels = [
      { v: resistance, n: 'resistência recente' },
      { v: ctx.bbUpper, n: 'banda superior' },
      { v: ctx.ema21, n: 'EMA 21' },
    ].filter((l) => Number.isFinite(l.v));

    if (a.bull && a.lower >= 0.4 * a.range) {
      const hit = supLevels.find((l) => c.low <= l.v + tol && c.close >= l.v + 0.25 * atrV);
      if (hit) out.push({ name: 'supportRejection', label: `Rejeição em ${hit.n}`, direction: 'CALL',
        strength: clamp01(0.4 + 0.6 * (a.lower / a.range - 0.4) / 0.6) });
    }
    if (a.bear && a.upper >= 0.4 * a.range) {
      const hit = resLevels.find((l) => c.high >= l.v - tol && c.close <= l.v - 0.25 * atrV);
      if (hit) out.push({ name: 'resistanceRejection', label: `Rejeição em ${hit.n}`, direction: 'PUT',
        strength: clamp01(0.4 + 0.6 * (a.upper / a.range - 0.4) / 0.6) });
    }
    return out;
  }

  /** Rompimento confirmado pelo fechamento, com corpo forte. */
  function breakout(candles, i, atrV, ctx) {
    if (!atrV || i < 2) return [];
    const c = candles[i];
    const a = anatomy(c);
    if (a.range === 0 || a.body < 0.5 * a.range || a.body < 0.5 * atrV) return [];
    const { support, resistance } = swingLevels(candles, i, ctx.lookback || 20);
    const out = [];
    const margin = 0.05 * atrV;
    if (a.bull && c.close > resistance + margin && c.close - resistance <= 1.5 * atrV) {
      out.push({ name: 'bullishBreakout', label: 'Rompimento de resistência confirmado', direction: 'CALL',
        strength: clamp01(0.4 + 0.6 * (a.body / a.range - 0.5) / 0.5) });
    }
    if (a.bear && c.close < support - margin && support - c.close <= 1.5 * atrV) {
      out.push({ name: 'bearishBreakout', label: 'Rompimento de suporte confirmado', direction: 'PUT',
        strength: clamp01(0.4 + 0.6 * (a.body / a.range - 0.5) / 0.5) });
    }
    return out;
  }

  function detectAll(candles, i, atrV, ctx = {}) {
    return [
      ...engulfing(candles, i, atrV),
      ...pinBar(candles, i, atrV),
      ...rejection(candles, i, atrV, ctx),
      ...breakout(candles, i, atrV, ctx),
    ];
  }

  return { anatomy, engulfing, pinBar, rejection, breakout, detectAll, swingLevels };
});
