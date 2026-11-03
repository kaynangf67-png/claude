import type { Candle, Dir, Line, Pivot, StructureInfo } from "./types.js";

/** MarketStructureAnalyzer + TrendAnalyzer: pivôs, tendência, BOS, CHoCH e linhas de tendência (a partir de pivôs reais). */

/** Pivô confirmado: exige `right` velas fechadas depois, então nunca repinta. */
export function findPivots(c: Candle[], left = 3, right = 3): Pivot[] {
  const out: Pivot[] = [];
  for (let i = left; i < c.length - right; i++) {
    let hi = true, lo = true;
    for (let j = 1; j <= left; j++) { if (c[i - j].h >= c[i].h) hi = false; if (c[i - j].l <= c[i].l) lo = false; }
    for (let j = 1; j <= right; j++) { if (c[i + j].h > c[i].h) hi = false; if (c[i + j].l < c[i].l) lo = false; }
    if (hi) out.push({ i, t: c[i].t, price: c[i].h, type: "high" });
    if (lo) out.push({ i, t: c[i].t, price: c[i].l, type: "low" });
  }
  return out;
}

export function analyzeStructure(c: Candle[], pivots: Pivot[]): StructureInfo {
  const highs = pivots.filter((p) => p.type === "high"), lows = pivots.filter((p) => p.type === "low");
  const lastHigh = highs.at(-1) ?? null, lastLow = lows.at(-1) ?? null;
  const hh = highs.length >= 2 && highs[highs.length - 1].price > highs[highs.length - 2].price;
  const lh = highs.length >= 2 && highs[highs.length - 1].price < highs[highs.length - 2].price;
  const hl = lows.length >= 2 && lows[lows.length - 1].price > lows[lows.length - 2].price;
  const ll = lows.length >= 2 && lows[lows.length - 1].price < lows[lows.length - 2].price;
  const trend = hh && hl ? "alta" : lh && ll ? "baixa" : "lateral";
  const recent = c.slice(-3).map((k) => k.c);
  const above = lastHigh ? Math.max(...recent) > lastHigh.price : false;
  const below = lastLow ? Math.min(...recent) < lastLow.price : false;
  let bos: Dir | null = null, choch: Dir | null = null;
  if (trend === "alta") { if (above) bos = "BUY"; if (below) choch = "SELL"; }
  else if (trend === "baixa") { if (below) bos = "SELL"; if (above) choch = "BUY"; }
  else { if (above && !below) bos = "BUY"; if (below && !above) bos = "SELL"; }
  return { trend, lastHigh, lastLow, higherHighs: hh, higherLows: hl, lowerHighs: lh, lowerLows: ll, bos, choch };
}

const valueAt = (a: Pivot, slope: number, i: number) => a.price + slope * (i - a.i);

function buildLine(c: Candle[], pivots: Pivot[], kind: "LTA" | "LTB", atrV: number): Line | null {
  const type = kind === "LTA" ? "low" : "high";
  const pts = pivots.filter((p) => p.type === type).slice(-5);
  for (let k = pts.length - 1; k >= 1; k--) {
    const a = pts[k - 1], b = pts[k];
    const ok = kind === "LTA" ? b.price > a.price : b.price < a.price;
    if (!ok || b.i - a.i < 5) continue;
    const slope = (b.price - a.price) / (b.i - a.i), tol = 0.3 * atrV;
    const points = pts.filter((p) => p.i >= a.i && Math.abs(p.price - valueAt(a, slope, p.i)) <= tol);
    if (points.length < 2) continue;
    // rompimento: fechamento além da linha (com folga) depois do último ponto; reteste: volta a encostar sem recuperar
    let broken = false, retested = false;
    for (let i = b.i + 1; i < c.length; i++) {
      const v = valueAt(a, slope, i);
      const beyond = kind === "LTA" ? c[i].c < v - 0.15 * atrV : c[i].c > v + 0.15 * atrV;
      if (beyond) broken = true;
      else if (broken) {
        const touch = kind === "LTA" ? c[i].h >= v - tol && c[i].c < v : c[i].l <= v + tol && c[i].c > v;
        if (touch) retested = true;
      }
    }
    return { kind, slope, valueNow: valueAt(a, slope, c.length - 1), touches: points.length, points, broken, retested };
  }
  return null;
}

export function trendlines(c: Candle[], pivots: Pivot[], atrV: number) {
  return { lta: buildLine(c, pivots, "LTA", atrV), ltb: buildLine(c, pivots, "LTB", atrV) };
}
