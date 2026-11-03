import { findPivots } from "./structure.js";
import type { Candle, Region, TF } from "./types.js";

/** SupportResistanceAnalyzer: regiões a partir de vários pavios/pivôs. Um único pavio não é região forte. */
export function buildRegions(c: Candle[], tf: TF, price: number, atrV: number, pip: number, lookback = 300): Region[] {
  const slice = c.slice(-lookback);
  const w = tf === "H1" ? 2 : 3;
  const piv = findPivots(slice, w, w);
  const tol = 0.35 * atrV;
  const sorted = [...piv].sort((a, b) => a.price - b.price);
  const clusters: typeof piv[] = [];
  for (const p of sorted) {
    const last = clusters.at(-1);
    if (last && p.price - last[last.length - 1].price <= tol) last.push(p);
    else clusters.push([p]);
  }
  const out: Region[] = [];
  for (const cl of clusters) {
    if (cl.length < 2) continue; // um pavio só não confirma região
    let low = Math.min(...cl.map((p) => p.price)), high = Math.max(...cl.map((p) => p.price));
    const minThick = 0.1 * atrV;
    if (high - low < minThick) { const mid = (low + high) / 2; low = mid - minThick / 2; high = mid + minThick / 2; }
    const inside = price >= low && price <= high;
    const highsN = cl.filter((p) => p.type === "high").length;
    const role: Region["role"] = price > high ? "suporte" : price < low ? "resistencia" : highsN >= cl.length - highsN ? "resistencia" : "suporte";
    const rejections = cl.filter((p) => {
      const k = slice[p.i], range = k.h - k.l, wick = p.type === "high" ? k.h - Math.max(k.o, k.c) : Math.min(k.o, k.c) - k.l;
      return range > 0 && wick / range >= 0.4;
    }).length;
    const recency = Math.max(...cl.map((p) => p.i)) / Math.max(1, slice.length);
    const distance = inside ? 0 : Math.min(Math.abs(price - low), Math.abs(price - high));
    out.push({
      low, high, role, strength: cl.length >= 3 ? "forte" : "secundaria", reactions: cl.length, origin: tf,
      distance, distancePips: distance / pip, intensity: Math.min(100, Math.round(cl.length * 20 + rejections * 6 + recency * 20)),
    });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

/** Junta regiões que se sobrepõem (H1 e M15), somando as reações. */
export function mergeRegions(lists: Region[][], price: number, pip: number): Region[] {
  const all = lists.flat().sort((a, b) => a.low - b.low);
  const out: Region[] = [];
  for (const r of all) {
    const last = out.at(-1);
    if (last && r.low <= last.high) {
      last.high = Math.max(last.high, r.high);
      last.reactions += r.reactions;
      last.intensity = Math.min(100, Math.max(last.intensity, r.intensity) + 8);
      if (r.origin === "H1") last.origin = "H1";
      last.strength = last.reactions >= 3 ? "forte" : "secundaria";
    } else out.push({ ...r });
  }
  for (const r of out) {
    const inside = price >= r.low && price <= r.high;
    r.distance = inside ? 0 : Math.min(Math.abs(price - r.low), Math.abs(price - r.high));
    r.distancePips = r.distance / pip;
    if (price > r.high) r.role = "suporte"; else if (price < r.low) r.role = "resistencia";
  }
  return out.sort((a, b) => a.distance - b.distance);
}
