// Detecção de padrões de Price Action sobre candles FECHADOS.
// `i` é o índice do candle de confirmação (o último fechado).

const body = (c) => Math.abs(c.close - c.open);
const range = (c) => c.high - c.low;
const isBull = (c) => c.close > c.open;
const isBear = (c) => c.close < c.open;
const upperWick = (c) => c.high - Math.max(c.open, c.close);
const lowerWick = (c) => Math.min(c.open, c.close) - c.low;

export function avgBody(candles, i, lookback = 14) {
  let s = 0, k = 0;
  for (let j = Math.max(0, i - lookback); j < i; j++) { s += body(candles[j]); k++; }
  return k ? s / k : 0;
}

export function bullishEngulfing(c, i) {
  if (i < 1) return false;
  const p = c[i - 1], x = c[i];
  return isBear(p) && isBull(x) && x.close >= p.open && x.open <= p.close && body(x) > body(p);
}

export function bearishEngulfing(c, i) {
  if (i < 1) return false;
  const p = c[i - 1], x = c[i];
  return isBull(p) && isBear(x) && x.close <= p.open && x.open >= p.close && body(x) > body(p);
}

/** Pin bar de alta: pavio inferior >= 2x corpo e >= 60% do range, pavio superior pequeno. */
export function bullishPinBar(c, i) {
  const x = c[i], r = range(x);
  if (r <= 0) return false;
  return lowerWick(x) >= 2 * body(x) && lowerWick(x) >= 0.6 * r && upperWick(x) <= 0.25 * r;
}

export function bearishPinBar(c, i) {
  const x = c[i], r = range(x);
  if (r <= 0) return false;
  return upperWick(x) >= 2 * body(x) && upperWick(x) >= 0.6 * r && lowerWick(x) <= 0.25 * r;
}

/** Mínima/máxima dos `lookback` candles ANTERIORES a i (sem incluir i). */
function priorExtremes(c, i, lookback) {
  let hi = -Infinity, lo = Infinity;
  for (let j = Math.max(0, i - lookback); j < i; j++) {
    if (c[j].high > hi) hi = c[j].high;
    if (c[j].low < lo) lo = c[j].low;
  }
  return { hi, lo };
}

/**
 * Rejeição de suporte: o candle testou um nível de suporte (mínima recente,
 * banda inferior ou EMA 21) e fechou acima dele com pavio inferior relevante.
 * `levels` = valores de suporte dinâmico conhecidos no candle i.
 */
export function supportRejection(c, i, levels = [], lookback = 20) {
  const x = c[i], r = range(x);
  if (r <= 0 || !isBull(x)) return false;
  const { lo } = priorExtremes(c, i, lookback);
  const tol = r * 0.15;
  const all = [lo, ...levels.filter((v) => v != null)];
  const touched = all.some((lvl) => x.low <= lvl + tol && x.close > lvl);
  return touched && lowerWick(x) >= 0.4 * r;
}

export function resistanceRejection(c, i, levels = [], lookback = 20) {
  const x = c[i], r = range(x);
  if (r <= 0 || !isBear(x)) return false;
  const { hi } = priorExtremes(c, i, lookback);
  const tol = r * 0.15;
  const all = [hi, ...levels.filter((v) => v != null)];
  const touched = all.some((lvl) => x.high >= lvl - tol && x.close < lvl);
  return touched && upperWick(x) >= 0.4 * r;
}

/** Rompimento confirmado: FECHAMENTO acima da máxima dos últimos N com corpo forte. */
export function bullishBreakout(c, i, lookback = 10) {
  if (i < lookback) return false;
  const x = c[i];
  const { hi } = priorExtremes(c, i, lookback);
  return isBull(x) && x.close > hi && body(x) >= 1.2 * avgBody(c, i) && body(x) >= 0.6 * range(x);
}

export function bearishBreakout(c, i, lookback = 10) {
  if (i < lookback) return false;
  const x = c[i];
  const { lo } = priorExtremes(c, i, lookback);
  return isBear(x) && x.close < lo && body(x) >= 1.2 * avgBody(c, i) && body(x) >= 0.6 * range(x);
}

/**
 * Continuação: pequena correção (1-3 candles contra) seguida de candle a favor
 * que fecha além da máxima/mínima da correção.
 */
export function bullishContinuation(c, i) {
  if (i < 4) return false;
  const x = c[i];
  if (!isBull(x)) return false;
  let k = i - 1, pullback = 0, pbHigh = -Infinity;
  while (k >= i - 3 && isBear(c[k])) { pbHigh = Math.max(pbHigh, c[k].high); pullback++; k--; }
  if (pullback === 0 || !isBull(c[k])) return false;
  return x.close > pbHigh;
}

export function bearishContinuation(c, i) {
  if (i < 4) return false;
  const x = c[i];
  if (!isBear(x)) return false;
  let k = i - 1, pullback = 0, pbLow = Infinity;
  while (k >= i - 3 && isBull(c[k])) { pbLow = Math.min(pbLow, c[k].low); pullback++; k--; }
  if (pullback === 0 || !isBear(c[k])) return false;
  return x.close < pbLow;
}

/** Resumo dos padrões detectados para uma direção. */
export function detectPatterns(c, i, dir, levels = []) {
  const found = [];
  if (dir === 'CALL') {
    if (bullishEngulfing(c, i)) found.push({ id: 'engulfing', label: 'Engolfo de alta', pts: 20 });
    if (bullishPinBar(c, i)) found.push({ id: 'pinbar', label: 'Pin bar de alta', pts: 20 });
    if (supportRejection(c, i, levels)) found.push({ id: 'rejection', label: 'Rejeição de suporte', pts: 18 });
    if (bullishBreakout(c, i)) found.push({ id: 'breakout', label: 'Rompimento confirmado de alta', pts: 16 });
    if (bullishContinuation(c, i)) found.push({ id: 'continuation', label: 'Continuação de alta', pts: 14 });
  } else {
    if (bearishEngulfing(c, i)) found.push({ id: 'engulfing', label: 'Engolfo de baixa', pts: 20 });
    if (bearishPinBar(c, i)) found.push({ id: 'pinbar', label: 'Pin bar de baixa', pts: 20 });
    if (resistanceRejection(c, i, levels)) found.push({ id: 'rejection', label: 'Rejeição de resistência', pts: 18 });
    if (bearishBreakout(c, i)) found.push({ id: 'breakout', label: 'Rompimento confirmado de baixa', pts: 16 });
    if (bearishContinuation(c, i)) found.push({ id: 'continuation', label: 'Continuação de baixa', pts: 14 });
  }
  return found;
}

export const candleHelpers = { body, range, isBull, isBear, upperWick, lowerWick };
