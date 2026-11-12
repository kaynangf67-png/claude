import { atr, atrSeries, ema, median, rsiDivergence, rsiSeries } from "./indicators.js";
import { findFvgs } from "./fvg.js";
import { detectSweep, liquidityLevels, type LiquidityLevel } from "./liquidity.js";
import { analyzeStructure, findPivots, trendlines } from "./structure.js";
import type { Candle, Fvg, Line, Pivot, StructureInfo, Sweep, TF, Trend } from "./types.js";

/** MultiTimeframeAnalyzer: análise completa de um tempo gráfico. */
export interface TFAnalysis {
  tf: TF; n: number; lastClose: number; lastT: number;
  trend: Trend; struct: StructureInfo; pivots: Pivot[];
  atr: number; atrMedian: number; atrRatio: number;
  rsi: number | null; rsiDiv: "alta" | "baixa" | null;
  ema: { e9: number; e20: number; e50: number; e200: number | null; slope20: number; stack: "alta" | "baixa" | "misto"; priceVsE20: number };
  lines: { lta: Line | null; ltb: Line | null };
  fvgs: Fvg[]; sweep: Sweep | null; liquidity: LiquidityLevel[];
}

const KEEP: Record<TF, number> = { D1: 400, H4: 400, H1: 400, M30: 400, M15: 400, M5: 400, M1: 150 };

export function analyzeTF(all: Candle[], tf: TF): TFAnalysis {
  const c = all.slice(-KEEP[tf]);
  const closes = c.map((k) => k.c);
  const atrS = atrSeries(c), atrV = atrS[atrS.length - 1] || 0;
  const atrMed = median(atrS.slice(-100));
  const w = tf === "H1" || tf === "H4" || tf === "D1" ? 2 : 3;
  const pivots = findPivots(c, w, w);
  const struct = analyzeStructure(c, pivots);
  const e9 = ema(closes, 9), e20 = ema(closes, 20), e50 = ema(closes, 50), e200 = ema(closes, 200);
  const n = c.length - 1, price = closes[n];
  const slope20 = atrV > 0 && n >= 5 ? (e20[n] - e20[n - 5]) / atrV : 0;
  const stack = e9[n] > e20[n] && e20[n] > e50[n] && slope20 > 0 && price > e20[n] ? "alta"
    : e9[n] < e20[n] && e20[n] < e50[n] && slope20 < 0 && price < e20[n] ? "baixa" : "misto";
  const rs = rsiSeries(closes);
  return {
    tf, n: c.length, lastClose: price, lastT: c[n].t,
    trend: struct.trend, struct, pivots,
    atr: atrV, atrMedian: atrMed, atrRatio: atrMed > 0 ? atrV / atrMed : 1,
    rsi: rs[n], rsiDiv: rsiDivergence(rs, pivots),
    ema: { e9: e9[n], e20: e20[n], e50: e50[n], e200: c.length >= 200 ? e200[n] : null, slope20, stack, priceVsE20: atrV > 0 ? (price - e20[n]) / atrV : 0 },
    lines: trendlines(c, pivots, atrV),
    fvgs: findFvgs(c, atrV), sweep: detectSweep(c, pivots, atrV), liquidity: liquidityLevels(pivots, price, atrV),
  };
}

export { atr };
