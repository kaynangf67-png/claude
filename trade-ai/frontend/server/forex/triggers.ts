import { detectPatterns } from "./patterns.js";
import { analyzeStructure, findPivots } from "./structure.js";
import type { Candle, Dir } from "./types.js";

/** EntryTriggerAnalyzer: gatilho de entrada (M1; se não houver M1, usa M5). */
export interface Trigger { confirmed: boolean; source: "M1" | "M5"; kinds: string[]; detail: string; level: number | null }

export function entryTrigger(c: Candle[], dir: Dir, source: "M1" | "M5", atrV: number): Trigger {
  const kinds: string[] = [];
  if (c.length < 12) return { confirmed: false, source, kinds, detail: `${source}: velas insuficientes para o gatilho`, level: null };
  const last = c[c.length - 1];
  const lastInDir = dir === "BUY" ? last.c > last.o : last.c < last.o;
  const pats = detectPatterns(c, { atr: atrV, inRegion: true }).filter((p) => p.dir === dir && p.weight >= 0.7);
  const patOk = pats.find((p) => p.confirmed || (p.index === c.length - 1 && /Engolfo|Candle de força|Marubozu/.test(p.name)));
  if (patOk) kinds.push(`${patOk.name}${patOk.confirmed ? " (confirmado)" : ""}`);
  const piv = findPivots(c.slice(-40), 2, 2);
  const sInfo = analyzeStructure(c.slice(-40), piv);
  const opposite = piv.filter((p) => p.type === (dir === "BUY" ? "high" : "low")).at(-1);
  if (opposite && (dir === "BUY" ? last.c > opposite.price : last.c < opposite.price)) kinds.push("Rompimento de microestrutura");
  if (sInfo.choch === dir) kinds.push("CHoCH");
  const confirmed = lastInDir && kinds.length > 0;
  const detail = confirmed
    ? `${source}: ${kinds.join(" + ")}; última vela fechou a favor da ${dir === "BUY" ? "compra" : "venda"}.`
    : `${source}: sem gatilho a favor da ${dir === "BUY" ? "compra" : "venda"} ainda.`;
  return { confirmed, source, kinds, detail, level: opposite ? opposite.price : null };
}
