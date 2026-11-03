import type { ForexAnalysis } from "../forex/engine.js";
import type { RadarClass } from "./store.js";

/**
 * OPPORTUNITY RADAR: classifica cada par em A (distante), B (em formação) ou C (confirmada) e dá um id estável ao setup
 * (ativo + estratégia + direção + região), para nunca alertar duas vezes pelo mesmo setup.
 */
export interface Opportunity {
  cls: RadarClass | null; setupId: string | null; quality: number; symbol: string; label: string;
  dir: "BUY" | "SELL" | null; strategy: string | null; strategyId: number | null;
  region: { low: number; high: number } | null; invalidation: number | null; why: string;
}
const CLASS_RANK: Record<RadarClass, number> = { CONFIRMADA: 3, FORMACAO: 2, DISTANTE: 1 };
export const rankKey = (o: Opportunity) => (o.cls ? CLASS_RANK[o.cls] * 1000 : 0) + o.quality;

/** A região entra no id arredondada a 5 pips: pequenas mudanças do mesmo nível não geram um setup "novo". */
export function regionBucket(r: { low: number; high: number } | null, pip: number, invalidation: number | null = null): string {
  if (r) return String(Math.round((r.low + r.high) / 2 / (5 * pip)));
  // estratégias sem região (ex.: varredura de liquidez) se identificam pelo nível estrutural de invalidação
  return invalidation === null ? "sem-regiao" : `inv${Math.round(invalidation / (5 * pip))}`;
}

export function classifyOpportunity(a: ForexAnalysis, pip: number, distantAtr: number): Opportunity {
  const base = { symbol: a.symbol, label: a.label, dir: null, strategy: null, strategyId: null, region: null, invalidation: null } as const;
  if (!a.data.ok) return { ...base, cls: null, setupId: null, quality: 0, why: "Dados com problema: sem classificação." };
  const st = a.setup;
  if (st && a.chosen && (a.state === "entrada_confirmada" || a.state === "aguardando_confirmacao")) {
    const cls: RadarClass = a.state === "entrada_confirmada" ? "CONFIRMADA" : "FORMACAO";
    return {
      cls, setupId: `${a.symbol}|${st.strategyId}|${st.dir}|${regionBucket(st.region, pip, st.invalidation)}`, quality: a.score?.total ?? 0, symbol: a.symbol, label: a.label,
      dir: st.dir, strategy: a.chosen.name, strategyId: st.strategyId, region: st.region, invalidation: st.invalidation,
      why: cls === "CONFIRMADA" ? "Gatilho confirmado e todos os filtros obrigatórios aprovados." : (a.missing[0] ?? "Falta confirmação do gatilho."),
    };
  }
  // A: o preço se aproxima de uma região forte do H1 (ainda sem setup)
  const atr = a.tfs.M5.atr, slope = a.tfs.M5.ema.slope20;
  const cands = a.regions.filter((r) => r.distance > 1.5 * atr && r.distance <= distantAtr * atr && (r.strength === "forte" || r.intensity >= 60 || r.reactions >= 3)
    && ((r.role === "suporte" && slope < 0) || (r.role === "resistencia" && slope > 0)));
  const r = cands.sort((x, y) => x.distance - y.distance)[0];
  if (r) {
    const region = { low: r.low, high: r.high };
    return {
      ...base, cls: "DISTANTE", setupId: `${a.symbol}|A|${r.role}|${regionBucket(region, pip)}`, quality: Math.min(60, Math.round(r.intensity * 0.5 + r.reactions * 4)),
      region, why: `Preço a ${r.distancePips.toFixed(1)} pips de ${r.role} ${r.strength} do ${r.origin} (${r.reactions} reações), caminhando em direção a ela.`,
    };
  }
  return { ...base, cls: null, setupId: null, quality: 0, why: a.missing[0] ?? "Sem setup e longe de regiões relevantes." };
}
