import type { Candle, Pivot, Sweep } from "./types.js";

/** LiquidityAnalyzer: topos/fundos iguais, topos/fundos anteriores e varreduras (sweeps). */
export interface LiquidityLevel { price: number; kind: "topos iguais" | "fundos iguais" | "topo anterior" | "fundo anterior"; side: "acima" | "abaixo" }

export function liquidityLevels(pivots: Pivot[], price: number, atrV: number): LiquidityLevel[] {
  const out: LiquidityLevel[] = [];
  const tol = 0.15 * atrV;
  const group = (type: "high" | "low") => {
    const arr = pivots.filter((p) => p.type === type).slice(-12).sort((a, b) => a.price - b.price);
    const cl: Pivot[][] = [];
    for (const p of arr) {
      const l = cl.at(-1);
      if (l && p.price - l[l.length - 1].price <= tol) l.push(p); else cl.push([p]);
    }
    return cl.filter((x) => x.length >= 2);
  };
  for (const g of group("high")) { const p = Math.max(...g.map((x) => x.price)); if (p > price) out.push({ price: p, kind: "topos iguais", side: "acima" }); }
  for (const g of group("low")) { const p = Math.min(...g.map((x) => x.price)); if (p < price) out.push({ price: p, kind: "fundos iguais", side: "abaixo" }); }
  const lastH = pivots.filter((p) => p.type === "high").at(-1), lastL = pivots.filter((p) => p.type === "low").at(-1);
  if (lastH && lastH.price > price) out.push({ price: lastH.price, kind: "topo anterior", side: "acima" });
  if (lastL && lastL.price < price) out.push({ price: lastL.price, kind: "fundo anterior", side: "abaixo" });
  return out;
}

/** Sweep nas últimas 3 velas fechadas: o pavio passa do pivô e o fechamento volta para dentro. Rompimento com fechamento NÃO é sweep. */
export function detectSweep(c: Candle[], pivots: Pivot[], atrV: number): Sweep | null {
  const n = c.length;
  for (let k = n - 1; k >= Math.max(0, n - 3); k--) {
    const cand = pivots.filter((p) => p.i <= k - 2 && p.i >= k - 80);
    for (const p of [...cand].reverse()) {
      if (p.type === "high" && c[k].h > p.price + 0.05 * atrV && c[k].c < p.price) return { dir: "SELL", level: p.price, index: k };
      if (p.type === "low" && c[k].l < p.price - 0.05 * atrV && c[k].c > p.price) return { dir: "BUY", level: p.price, index: k };
    }
  }
  return null;
}
