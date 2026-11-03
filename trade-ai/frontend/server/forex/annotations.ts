import type { TFAnalysis } from "./mtf.js";
import type { Candle, Dir, Region } from "./types.js";

/**
 * Chart Annotation: marcações com os preços EXATOS calculados pelo motor.
 * Só usa pivôs confirmados e velas fechadas, então uma marcação que já existe não muda de lugar com velas novas.
 * (Linhas de tendência e FVG podem sair do gráfico quando deixam de existir; sinais confirmados ficam congelados no histórico.)
 */
export type AnnKind = "entrada" | "stop" | "take" | "suporte" | "resistencia" | "lta" | "ltb" | "sweep" | "bos" | "choch" | "fvg";
export interface Annotation {
  kind: AnnKind; label: string;
  /** linha horizontal */ price?: number;
  /** faixa de preço */ low?: number; high?: number;
  /** segmento / início no tempo */ t1?: number; t2?: number; p1?: number; p2?: number;
  dir?: Dir;
}
export interface Plan { status: "confirmado" | "condicional"; dir: Dir; entry: number; sl: number; tps: (number | null)[]; rr: (number | null)[]; entryZone: { low: number; high: number } | null }

const KEEP_M5 = 400;

export function buildAnnotations(o: { m5: Candle[]; m5a: TFAnalysis; regions: Region[]; plan: Plan | null }): Annotation[] {
  const out: Annotation[] = [];
  const c = o.m5.slice(-KEEP_M5), last = c[c.length - 1];
  if (!last) return out;
  const a = o.m5a;
  for (const r of o.regions.slice(0, 6)) out.push({ kind: r.role === "suporte" ? "suporte" : "resistencia", label: `${r.role === "suporte" ? "Suporte" : "Resistência"} ${r.strength} (${r.origin}, ${r.reactions}x)`, low: r.low, high: r.high });
  for (const ln of [a.lines.lta, a.lines.ltb]) {
    if (!ln || ln.points.length < 1) continue;
    const p0 = ln.points[0];
    out.push({ kind: ln.kind === "LTA" ? "lta" : "ltb", label: `${ln.kind}${ln.broken ? " (rompida)" : ""} · ${ln.touches} toques`, t1: p0.t, p1: p0.price, t2: last.t, p2: ln.valueNow });
  }
  if (a.sweep) { const k = c[a.sweep.index]; if (k) out.push({ kind: "sweep", label: `Varredura de liquidez ${a.sweep.dir === "BUY" ? "compradora" : "vendedora"}`, price: a.sweep.level, t1: k.t, dir: a.sweep.dir }); }
  const s = a.struct;
  if (s.bos && (s.bos === "BUY" ? s.lastHigh : s.lastLow)) { const p = s.bos === "BUY" ? s.lastHigh! : s.lastLow!; out.push({ kind: "bos", label: `BOS ${s.bos === "BUY" ? "alta" : "baixa"}`, price: p.price, t1: p.t, t2: last.t, dir: s.bos }); }
  if (s.choch && (s.choch === "BUY" ? s.lastHigh : s.lastLow)) { const p = s.choch === "BUY" ? s.lastHigh! : s.lastLow!; out.push({ kind: "choch", label: `CHoCH ${s.choch === "BUY" ? "alta" : "baixa"}`, price: p.price, t1: p.t, t2: last.t, dir: s.choch }); }
  for (const g of a.fvgs.slice(-3)) { const k = c[Math.max(0, g.index - 2)]; if (k) out.push({ kind: "fvg", label: `FVG ${g.dir === "BUY" ? "comprador" : "vendedor"} (${g.status})`, low: g.low, high: g.high, t1: k.t, t2: last.t, dir: g.dir }); }
  const p = o.plan;
  if (p) {
    const tag = p.status === "confirmado" ? "" : " (condicional)";
    if (p.entryZone) out.push({ kind: "entrada", label: `Região de entrada${tag}`, low: p.entryZone.low, high: p.entryZone.high, dir: p.dir });
    out.push({ kind: "entrada", label: `Entrada ${p.dir === "BUY" ? "compra" : "venda"}${tag}`, price: p.entry, dir: p.dir });
    out.push({ kind: "stop", label: `Stop Loss${tag}`, price: p.sl, dir: p.dir });
    p.tps.forEach((tp, i) => { if (tp !== null) out.push({ kind: "take", label: `Take ${i + 1}${p.rr[i] != null ? ` · ${p.rr[i]!.toFixed(2)}R` : ""}${tag}`, price: tp, dir: p.dir }); });
  }
  return out;
}
