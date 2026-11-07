// Indicadores técnicos puros (sem dependências). Todas as funções recebem
// arrays em ordem cronológica e devolvem arrays do mesmo tamanho, com
// `null` nas posições onde ainda não há dados suficientes (warm-up).

/** EMA clássica, semeada com a SMA dos primeiros `period` valores. */
export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** RSI de Wilder. */
export function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgG = gain / period, avgL = loss / period;
  out[period] = toRsi(avgG, avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = toRsi(avgG, avgL);
  }
  return out;
}
function toRsi(g, l) {
  if (l === 0) return g === 0 ? 50 : 100;
  return 100 - 100 / (1 + g / l);
}

/**
 * ADX de Wilder com +DI e -DI.
 * Primeiro valor de ADX aparece no índice 2*period - 1.
 */
export function adx(candles, period = 14) {
  const n = candles.length;
  const adxOut = new Array(n).fill(null);
  const pdiOut = new Array(n).fill(null);
  const mdiOut = new Array(n).fill(null);
  if (n < 2 * period) return { adx: adxOut, plusDI: pdiOut, minusDI: mdiOut };

  const tr = [0], pdm = [0], mdm = [0];
  for (let i = 1; i < n; i++) {
    const c = candles[i], p = candles[i - 1];
    const up = c.high - p.high;
    const down = p.low - c.low;
    pdm.push(up > down && up > 0 ? up : 0);
    mdm.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  let sTR = 0, sP = 0, sM = 0;
  for (let i = 1; i <= period; i++) { sTR += tr[i]; sP += pdm[i]; sM += mdm[i]; }
  const dx = new Array(n).fill(null);
  const step = (i) => {
    const pdi = sTR === 0 ? 0 : (100 * sP) / sTR;
    const mdi = sTR === 0 ? 0 : (100 * sM) / sTR;
    pdiOut[i] = pdi; mdiOut[i] = mdi;
    dx[i] = pdi + mdi === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / (pdi + mdi);
  };
  step(period);
  for (let i = period + 1; i < n; i++) {
    sTR = sTR - sTR / period + tr[i];
    sP = sP - sP / period + pdm[i];
    sM = sM - sM / period + mdm[i];
    step(i);
  }
  let sum = 0;
  for (let i = period; i < 2 * period; i++) sum += dx[i];
  let prev = sum / period;
  adxOut[2 * period - 1] = prev;
  for (let i = 2 * period; i < n; i++) {
    prev = (prev * (period - 1) + dx[i]) / period;
    adxOut[i] = prev;
  }
  return { adx: adxOut, plusDI: pdiOut, minusDI: mdiOut };
}

/** Bandas de Bollinger (desvio padrão populacional, como na maioria das plataformas). */
export function bollinger(closes, period = 20, mult = 2) {
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
