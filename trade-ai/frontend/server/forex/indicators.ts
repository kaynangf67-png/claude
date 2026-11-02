import type { Candle, Pivot } from "./types.js";

/** IndicatorCalculator: cálculos determinísticos (EMA, RSI de Wilder, ATR). */
export function ema(values: number[], n: number): number[] {
  const k = 2 / (n + 1), out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

export function rsiSeries(closes: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = closes.map(() => null);
  if (closes.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gain += d; else loss -= d; }
  gain /= n; loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n; loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function atrSeries(c: Candle[], n = 14): number[] {
  const tr = c.map((k, i) => (i === 0 ? k.h - k.l : Math.max(k.h - k.l, Math.abs(k.h - c[i - 1].c), Math.abs(k.l - c[i - 1].c))));
  const out: number[] = [];
  tr.forEach((v, i) => {
    if (i < n) out.push(tr.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1));
    else out.push((out[i - 1] * (n - 1) + v) / n);
  });
  return out;
}

export const atr = (c: Candle[], n = 14) => (c.length ? atrSeries(c, n)[c.length - 1] : 0);

/** Divergência de RSI entre os dois últimos pivôs do mesmo tipo. */
export function rsiDivergence(rsi: (number | null)[], pivots: Pivot[]): "alta" | "baixa" | null {
  const highs = pivots.filter((p) => p.type === "high").slice(-2);
  const lows = pivots.filter((p) => p.type === "low").slice(-2);
  if (highs.length === 2) {
    const [a, b] = highs, ra = rsi[a.i], rb = rsi[b.i];
    if (ra !== null && rb !== null && b.price > a.price && rb < ra - 2) return "baixa";
  }
  if (lows.length === 2) {
    const [a, b] = lows, ra = rsi[a.i], rb = rsi[b.i];
    if (ra !== null && rb !== null && b.price < a.price && rb > ra + 2) return "alta";
  }
  return null;
}

export const median = (v: number[]) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
