/*
 * M1 SNIPER BOT — Indicadores técnicos (puros, sem DOM, sem chrome.*).
 * Todos os indicadores são causais: o valor no índice i usa apenas candles 0..i.
 * Isso garante ausência de repintura quando a análise usa somente candles fechados.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.M1 = root.M1 || {};
  root.M1.Indicators = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function sma(values, period) {
    const out = new Array(values.length).fill(null);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= period) sum -= values[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  }

  /** EMA semeada com a SMA dos primeiros `period` valores. */
  function ema(values, period) {
    const out = new Array(values.length).fill(null);
    if (values.length < period) return out;
    const k = 2 / (period + 1);
    let seed = 0;
    for (let i = 0; i < period; i++) seed += values[i];
    let prev = seed / period;
    out[period - 1] = prev;
    for (let i = period; i < values.length; i++) {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  /** RSI de Wilder. */
  function rsi(closes, period = 14) {
    const out = new Array(closes.length).fill(null);
    if (closes.length <= period) return out;
    let gain = 0;
    let loss = 0;
    for (let i = 1; i <= period; i++) {
      const d = closes[i] - closes[i - 1];
      if (d >= 0) gain += d; else loss -= d;
    }
    let avgG = gain / period;
    let avgL = loss / period;
    const val = () => (avgL === 0 ? (avgG === 0 ? 50 : 100) : 100 - 100 / (1 + avgG / avgL));
    out[period] = val();
    for (let i = period + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      avgG = (avgG * (period - 1) + (d > 0 ? d : 0)) / period;
      avgL = (avgL * (period - 1) + (d < 0 ? -d : 0)) / period;
      out[i] = val();
    }
    return out;
  }

  function trueRange(c, i) {
    if (i === 0) return c[0].high - c[0].low;
    const pc = c[i - 1].close;
    return Math.max(c[i].high - c[i].low, Math.abs(c[i].high - pc), Math.abs(c[i].low - pc));
  }

  /** ATR de Wilder. */
  function atr(candles, period = 14) {
    const out = new Array(candles.length).fill(null);
    if (candles.length <= period) return out;
    let sum = 0;
    for (let i = 1; i <= period; i++) sum += trueRange(candles, i);
    let prev = sum / period;
    out[period] = prev;
    for (let i = period + 1; i < candles.length; i++) {
      prev = (prev * (period - 1) + trueRange(candles, i)) / period;
      out[i] = prev;
    }
    return out;
  }

  /** ADX de Wilder com +DI e -DI. ADX disponível a partir do índice 2*period-1. */
  function adx(candles, period = 14) {
    const n = candles.length;
    const plusDI = new Array(n).fill(null);
    const minusDI = new Array(n).fill(null);
    const adxOut = new Array(n).fill(null);
    if (n <= period * 2) return { adx: adxOut, plusDI, minusDI };

    let sTR = 0, sP = 0, sM = 0;
    const dm = (i) => {
      const up = candles[i].high - candles[i - 1].high;
      const down = candles[i - 1].low - candles[i].low;
      return {
        p: up > down && up > 0 ? up : 0,
        m: down > up && down > 0 ? down : 0,
      };
    };
    for (let i = 1; i <= period; i++) {
      const d = dm(i);
      sTR += trueRange(candles, i);
      sP += d.p;
      sM += d.m;
    }
    const dxs = [];
    const step = (i) => {
      const pdi = sTR === 0 ? 0 : (100 * sP) / sTR;
      const mdi = sTR === 0 ? 0 : (100 * sM) / sTR;
      plusDI[i] = pdi;
      minusDI[i] = mdi;
      const s = pdi + mdi;
      return s === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / s;
    };
    dxs.push(step(period));
    let prevAdx = null;
    for (let i = period + 1; i < n; i++) {
      const d = dm(i);
      sTR = sTR - sTR / period + trueRange(candles, i);
      sP = sP - sP / period + d.p;
      sM = sM - sM / period + d.m;
      const dx = step(i);
      if (prevAdx === null) {
        dxs.push(dx);
        if (dxs.length === period) {
          prevAdx = dxs.reduce((a, b) => a + b, 0) / period;
          adxOut[i] = prevAdx;
        }
      } else {
        prevAdx = (prevAdx * (period - 1) + dx) / period;
        adxOut[i] = prevAdx;
      }
    }
    return { adx: adxOut, plusDI, minusDI };
  }

  /** Bandas de Bollinger (desvio padrão populacional, como na maioria das plataformas). */
  function bollinger(closes, period = 20, mult = 2) {
    const n = closes.length;
    const middle = sma(closes, period);
    const upper = new Array(n).fill(null);
    const lower = new Array(n).fill(null);
    const width = new Array(n).fill(null);
    for (let i = period - 1; i < n; i++) {
      const m = middle[i];
      let v = 0;
      for (let j = i - period + 1; j <= i; j++) v += (closes[j] - m) ** 2;
      const sd = Math.sqrt(v / period);
      upper[i] = m + mult * sd;
      lower[i] = m - mult * sd;
      width[i] = m === 0 ? 0 : (upper[i] - lower[i]) / m;
    }
    return { middle, upper, lower, width };
  }

  return { sma, ema, rsi, atr, adx, bollinger, trueRange };
});
