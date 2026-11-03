import type { Candle, Dir, Pattern } from "./types.js";

/** CandlestickPatternAnalyzer: padrões nas últimas velas fechadas, ponderados pela posição. */
const parts = (k: Candle) => {
  const body = Math.abs(k.c - k.o), range = k.h - k.l;
  return { body, range, upper: k.h - Math.max(k.o, k.c), lower: Math.min(k.o, k.c) - k.l, bull: k.c > k.o, bear: k.c < k.o };
};

type Raw = { name: string; dir: Dir | "neutro"; kind: "reversao" | "continuidade" | "neutro" };

function at(c: Candle[], i: number, atrV: number, avg: number): Raw[] {
  const out: Raw[] = [];
  const k = c[i], p = i > 0 ? c[i - 1] : null;
  const a = parts(k);
  if (a.range <= 0) return out;
  const priorDown = i >= 4 && c[i - 1].c < c[i - 4].c, priorUp = i >= 4 && c[i - 1].c > c[i - 4].c;
  if (a.body <= 0.1 * a.range) out.push({ name: "Doji", dir: "neutro", kind: "neutro" });
  if (a.body >= 0.9 * a.range && a.range >= 0.8 * atrV) out.push({ name: "Marubozu", dir: a.bull ? "BUY" : "SELL", kind: "continuidade" });
  if (a.body >= 1.5 * avg && a.range >= 0.8 * atrV) out.push({ name: "Candle de força", dir: a.bull ? "BUY" : "SELL", kind: "continuidade" });
  if (a.lower >= 2 * a.body && a.upper <= a.body && a.body >= 0.05 * a.range && priorDown) out.push({ name: "Martelo", dir: "BUY", kind: "reversao" });
  if (a.upper >= 2 * a.body && a.lower <= a.body && a.body >= 0.05 * a.range && priorDown) out.push({ name: "Martelo invertido", dir: "BUY", kind: "reversao" });
  if (a.upper >= 2 * a.body && a.lower <= a.body && a.body >= 0.05 * a.range && priorUp) out.push({ name: "Estrela cadente", dir: "SELL", kind: "reversao" });
  if (a.lower >= 0.66 * a.range && a.body > 0) out.push({ name: "Pin bar de alta", dir: "BUY", kind: "reversao" });
  if (a.upper >= 0.66 * a.range && a.body > 0) out.push({ name: "Pin bar de baixa", dir: "SELL", kind: "reversao" });
  if (a.lower >= 2 * a.body && a.lower >= 0.5 * a.range) out.push({ name: "Candle de rejeição (alta)", dir: "BUY", kind: "reversao" });
  if (a.upper >= 2 * a.body && a.upper >= 0.5 * a.range) out.push({ name: "Candle de rejeição (baixa)", dir: "SELL", kind: "reversao" });
  if (p) {
    const b = parts(p);
    if (b.bear && a.bull && k.o <= p.c && k.c >= p.o && a.body > b.body) out.push({ name: "Engolfo de alta", dir: "BUY", kind: "reversao" });
    if (b.bull && a.bear && k.o >= p.c && k.c <= p.o && a.body > b.body) out.push({ name: "Engolfo de baixa", dir: "SELL", kind: "reversao" });
    if (k.h < p.h && k.l > p.l) out.push({ name: "Inside bar", dir: "neutro", kind: "neutro" });
    if (k.h > p.h && k.l < p.l) out.push({ name: "Outside bar", dir: "neutro", kind: "neutro" });
  }
  return out;
}

/** Padrões nas 3 últimas velas fechadas. Confirmado = a vela seguinte fecha no sentido do padrão. Padrão fora de região pesa menos. */
export function detectPatterns(c: Candle[], ctx: { atr: number; inRegion: boolean }, avgBodyN = 20): Pattern[] {
  const n = c.length, out: Pattern[] = [];
  if (n < 6) return out;
  const avg = c.slice(-avgBodyN).reduce((s, k) => s + Math.abs(k.c - k.o), 0) / Math.min(avgBodyN, n);
  for (let i = n - 1; i >= n - 3; i--) {
    for (const r of at(c, i, ctx.atr, avg)) {
      let confirmed = false;
      if (i < n - 1 && r.dir !== "neutro") confirmed = r.dir === "BUY" ? c[i + 1].c > c[i].c && c[i + 1].c > c[i + 1].o : c[i + 1].c < c[i].c && c[i + 1].c < c[i + 1].o;
      const weight = r.kind === "reversao" ? (ctx.inRegion ? 1 : 0.4) : r.kind === "continuidade" ? 0.7 : 0.2;
      out.push({ name: r.name, dir: r.dir, index: i, confirmed, weight });
    }
  }
  return out;
}
