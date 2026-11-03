import type { Candle, Fvg } from "./types.js";

/** FairValueGapAnalyzer: gaps de três velas e quanto já foram preenchidos. */
export function findFvgs(c: Candle[], atrV: number, lookback = 80): Fvg[] {
  const out: Fvg[] = [];
  for (let i = Math.max(2, c.length - lookback); i < c.length; i++) {
    const a = c[i - 2], z = c[i];
    let dir: Fvg["dir"] | null = null, low = 0, high = 0;
    if (a.h < z.l && z.l - a.h >= 0.1 * atrV) { dir = "BUY"; low = a.h; high = z.l; }
    else if (a.l > z.h && a.l - z.h >= 0.1 * atrV) { dir = "SELL"; low = z.h; high = a.l; }
    if (!dir) continue;
    let status: Fvg["status"] = "aberto";
    for (let j = i + 1; j < c.length; j++) {
      if (dir === "BUY") { if (c[j].l <= low) { status = "preenchido"; break; } if (c[j].l < high) status = "parcial"; }
      else { if (c[j].h >= high) { status = "preenchido"; break; } if (c[j].h > low) status = "parcial"; }
    }
    if (status !== "preenchido") out.push({ dir, low, high, index: i, status });
  }
  return out;
}
