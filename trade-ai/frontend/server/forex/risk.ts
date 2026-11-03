import type { Dir, Region } from "./types.js";

/**
 * RiskRewardCalculator para OPERAÇÃO CURTA (minutos a no máximo ~1 hora).
 * Stop pela estrutura (com margem de ATR). Alvos: topos/fundos recentes do M5 e bordas das regiões de H1.
 * Uma região de H1 no caminho com menos de 1,5R de espaço reprova a operação; o alvo precisa ser alcançável (até 8 ATR do M5).
 */
export const MAX_HOLD_MIN = 60;
export const MAX_TARGET_ATR = 8;

export interface Risk {
  ok: boolean; notes: string[];
  entry: number; sl: number; tps: (number | null)[];
  riskDist: number; riskPips: number; atrPips: number; rr: (number | null)[];
  invalidation: number; maxHoldMin: number; targetAtr: number | null;
}

export function computeRisk(dir: Dir, entry: number, o: { invalidation: number; regions: Region[]; extraTargets: number[]; atr: number; pip: number; minRR?: number }): Risk {
  const minRR = o.minRR ?? 1.5;
  const notes: string[] = [];
  const buy = dir === "BUY";
  let sl = buy ? o.invalidation - 0.5 * o.atr : o.invalidation + 0.5 * o.atr;
  let dist = Math.abs(entry - sl);
  if (dist < 1.0 * o.atr) { dist = 1.0 * o.atr; sl = buy ? entry - dist : entry + dist; notes.push("Stop ampliado para pelo menos 1 ATR do M5 (evitar stop apertado)."); }
  let ok = true;
  if (dist > 4 * o.atr) { ok = false; notes.push("Stop muito distante (mais de 4 ATR do M5): a invalidação estrutural está longe."); }

  type T = { price: number; region: boolean };
  const ahead = (p: number) => (buy ? p > entry : p < entry);
  const regionTargets: T[] = o.regions.filter((r) => (buy ? r.role === "resistencia" : r.role === "suporte")).map((r) => ({ price: buy ? r.low : r.high, region: true })).filter((t) => ahead(t.price));
  const swingTargets: T[] = o.extraTargets.filter(ahead).map((price) => ({ price, region: false }));
  const sorted = [...regionTargets, ...swingTargets].sort((a, b) => (buy ? a.price - b.price : b.price - a.price));
  const list: T[] = [];
  for (const t of sorted) {
    const last = list.at(-1);
    if (!last || Math.abs(t.price - last.price) >= 0.3 * o.atr) list.push(t);
    else if (t.region && !last.region) list[list.length - 1] = t; // região vale mais que um topo solto no mesmo ponto
  }

  let tp1: T | null = null, idx = -1;
  for (let i = 0; i < list.length; i++) {
    const d = Math.abs(list[i].price - entry);
    if (d >= minRR * dist) { tp1 = list[i]; idx = i; break; }
    if (list[i].region) { ok = false; notes.push(`Região de H1 muito perto no caminho: só ${(d / dist).toFixed(2)}R de espaço (mínimo ${minRR}R).`); break; }
  }
  if (!tp1 && ok) { ok = false; notes.push(`Sem alvo estrutural com pelo menos ${minRR}R de espaço.`); }
  const t = [tp1?.price ?? null, idx >= 0 ? list[idx + 1]?.price ?? null : null, idx >= 0 ? list[idx + 2]?.price ?? null : null];
  const rr = t.map((p) => (p === null ? null : Math.abs(p - entry) / dist));
  const targetAtr = t[0] === null ? null : Math.abs(t[0] - entry) / o.atr;
  if (ok && targetAtr !== null && targetAtr > MAX_TARGET_ATR) { ok = false; notes.push(`Alvo longe demais para operação curta: ${(Math.abs(t[0]! - entry) / o.pip).toFixed(0)} pips (${targetAtr.toFixed(1)} ATR do M5; máximo ${MAX_TARGET_ATR}).`); }
  return { ok, notes, entry, sl, tps: t, riskDist: dist, riskPips: dist / o.pip, atrPips: o.atr / o.pip, rr, invalidation: o.invalidation, maxHoldMin: MAX_HOLD_MIN, targetAtr };
}
