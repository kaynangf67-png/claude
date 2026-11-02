import type { Dir, Region } from "./types.js";

/** RiskRewardCalculator: stop pela estrutura (com margem de ATR) e alvos pelas próximas regiões reais. */
export interface Risk {
  ok: boolean; notes: string[];
  entry: number; sl: number; tps: (number | null)[];
  riskDist: number; riskPips: number; atrPips: number; rr: (number | null)[];
  invalidation: number;
}

export function computeRisk(dir: Dir, entry: number, o: { invalidation: number; regions: Region[]; extraTargets: number[]; atr: number; pip: number }): Risk {
  const notes: string[] = [];
  const buy = dir === "BUY";
  let sl = buy ? o.invalidation - 0.5 * o.atr : o.invalidation + 0.5 * o.atr;
  let dist = Math.abs(entry - sl);
  if (dist < 1.0 * o.atr) { dist = 1.0 * o.atr; sl = buy ? entry - dist : entry + dist; notes.push("Stop ampliado para pelo menos 1 ATR do M5 (evitar stop apertado)."); }
  let ok = true;
  if (dist > 4 * o.atr) { ok = false; notes.push("Stop muito distante (mais de 4 ATR do M5): a invalidação estrutural está longe."); }
  // alvos: borda mais próxima de cada região contrária, mais pivôs de M15 na direção
  const cands = [
    ...o.regions.filter((r) => (buy ? r.role === "resistencia" && r.low > entry : r.role === "suporte" && r.high < entry)).map((r) => (buy ? r.low : r.high)),
    ...o.extraTargets.filter((p) => (buy ? p > entry : p < entry)),
  ].sort((a, b) => (buy ? a - b : b - a));
  const tps: number[] = [];
  for (const p of cands) if (!tps.length || Math.abs(p - tps[tps.length - 1]) >= 0.3 * o.atr) tps.push(p);
  const t = [tps[0] ?? null, tps[1] ?? null, tps[2] ?? null];
  const rr = t.map((p) => (p === null ? null : Math.abs(p - entry) / dist));
  if (t[0] === null) { ok = false; notes.push("Não há região estrutural contrária para servir de alvo."); }
  else if (Math.abs(t[0] - entry) > 10 * o.atr) { notes.push(`Alvo distante: TP1 está a ${(Math.abs(t[0] - entry) / o.pip).toFixed(0)} pips (cerca de ${(Math.abs(t[0] - entry) / o.atr).toFixed(0)} ATR do M5). Para operação rápida pode levar horas; o R:R alto vem da distância, não da qualidade do setup.`); }
  if (t[0] !== null && (rr[0] ?? 0) < 1.5) { ok = false; notes.push(`Primeira região contrária muito perto: relação risco/retorno ${(rr[0] ?? 0).toFixed(2)} (mínimo 1,5).`); }
  return { ok, notes, entry, sl, tps: t, riskDist: dist, riskPips: dist / o.pip, atrPips: o.atr / o.pip, rr, invalidation: o.invalidation };
}
