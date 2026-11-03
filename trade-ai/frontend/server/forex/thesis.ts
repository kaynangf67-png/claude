import type { Plan } from "./annotations.js";
import type { TFAnalysis } from "./mtf.js";
import type { Trigger } from "./triggers.js";
import type { Dir, Region, Trend } from "./types.js";

/**
 * Trade Thesis: texto montado SÓ com dados do motor. Se um dado não existe (M1 fora do ar, sem alvo, sem gatilho),
 * a linha diz isso em vez de inventar preço ou confirmação.
 */
export interface ThesisLine { label: string; text: string }
export interface Thesis { scenario: string; status: "confirmada" | "condicional" | "sem_setup"; lines: ThesisLine[] }

export interface ThesisInput {
  symbol: string; dir: Dir | null; state: "entrada_confirmada" | "aguardando_confirmacao" | "sem_operacao";
  a: { H1: TFAnalysis; M15: TFAnalysis | null; M5: TFAnalysis; M1: TFAnalysis | null };
  regions: Region[]; strategyName: string | null; strategyId: number | null; fvgAligned: boolean;
  trigger: Trigger | null; plan: Plan | null; invalidation: string; missing: string[]; price: number;
}

const f = (v: number, sym: string) => v.toFixed(sym.includes("JPY") ? 3 : 5);
const tr = (t: Trend) => (t === "alta" ? "estrutura de alta (topos e fundos ascendentes)" : t === "baixa" ? "estrutura de baixa (topos e fundos descendentes)" : "estrutura lateral, sem sequência clara de topos e fundos");

export function buildThesis(x: ThesisInput): Thesis {
  if (!x.dir) {
    return { scenario: "SEM CENÁRIO", status: "sem_setup", lines: [
      { label: "H1", text: tr(x.a.H1.trend) + "." },
      ...(x.a.M15 ? [{ label: "M15", text: `${x.a.M15.trend === "lateral" ? "lateral" : "tendência de " + x.a.M15.trend}.` }] : []),
      { label: "M5", text: `${x.a.M5.trend === "lateral" ? "lateral" : "tendência de " + x.a.M5.trend}; EMAs ${x.a.M5.ema.stack === "misto" ? "sem alinhamento" : "alinhadas para " + x.a.M5.ema.stack}.` },
      { label: "ESTRATÉGIA", text: "Nenhuma estratégia habilitada tem as condições completas." },
      { label: "FALTA", text: x.missing[0] ?? "Setup em região relevante com rejeição e confirmação." },
    ] };
  }
  const buy = x.dir === "BUY", sym = x.symbol, a = x.a;
  const lines: ThesisLine[] = [];
  const near = x.regions.filter((r) => r.role === (buy ? "suporte" : "resistencia")).sort((p, q) => p.distance - q.distance)[0];
  lines.push({ label: "H1", text: `${tr(a.H1.trend)}${near ? `; ${near.role} ${near.strength} em ${f(near.low, sym)}–${f(near.high, sym)} (${near.reactions} reações)` : "; sem região relevante perto do preço"}.` });
  lines.push({ label: "M15", text: a.M15 ? (a.M15.trend === (buy ? "alta" : "baixa") ? `continuidade ${buy ? "compradora" : "vendedora"} (${tr(a.M15.trend)})` : a.M15.trend === "lateral" ? "lateral, sem direção definida" : `tendência CONTRA o cenário (${a.M15.trend})`) + "." : "indisponível neste momento." });
  const m5 = a.M5, bits: string[] = [m5.trend === "lateral" ? "estrutura lateral" : `tendência de ${m5.trend}`];
  if (m5.struct.bos) bits.push(`BOS de ${m5.struct.bos === "BUY" ? "alta" : "baixa"}`);
  if (m5.struct.choch) bits.push(`CHoCH de ${m5.struct.choch === "BUY" ? "alta" : "baixa"}`);
  bits.push(`preço a ${Math.abs(m5.ema.priceVsE20).toFixed(1)} ATR ${m5.ema.priceVsE20 >= 0 ? "acima" : "abaixo"} da EMA 20`);
  const ln = buy ? m5.lines.lta : m5.lines.ltb;
  if (ln) bits.push(`${ln.kind} com ${ln.touches} toques${ln.broken ? " (rompida)" : ""}`);
  lines.push({ label: "M5", text: bits.join("; ") + "." });
  const m1sweep = a.M1?.sweep?.dir === x.dir ? `varredura de liquidez ${buy ? "compradora" : "vendedora"} em ${f(a.M1.sweep.level, sym)}` : null;
  const m5sweep = m5.sweep?.dir === x.dir ? `varredura de liquidez ${buy ? "compradora" : "vendedora"} no M5 em ${f(m5.sweep.level, sym)}` : null;
  const tg = x.trigger;
  const trigTxt = tg && tg.kinds.length ? `${tg.kinds.join(" + ")}${m1sweep ? `, após ${m1sweep}` : m5sweep ? `, com ${m5sweep}` : ""}${tg.confirmed ? "" : " (ainda sem fechamento a favor)"}` : `sem padrão de gatilho a favor${m1sweep ? ` (há ${m1sweep})` : ""}`;
  lines.push({ label: "M1", text: tg?.source === "M1" ? trigTxt + "." : `indisponível neste momento; o gatilho foi avaliado no M5: ${trigTxt}.` });
  const extras = [m1sweep || m5sweep ? "Liquidity Sweep" : null, x.fvgAligned ? "FVG" : null, ln && x.strategyId !== 5 ? (buy ? "LTA" : "LTB") : null].filter(Boolean);
  lines.push({ label: "ESTRATÉGIA", text: (x.strategyName ?? "—") + (extras.length ? " + " + extras.join(" + ") : "") });
  lines.push({ label: "GATILHO", text: tg ? (tg.confirmed ? tg.detail : `${tg.detail}${tg.level !== null ? ` Libera com fechamento de vela ${tg.source} ${buy ? "acima" : "abaixo"} de ${f(tg.level, sym)}.` : ""}`) : "Sem gatilho avaliado." });
  const p = x.plan, tag = p && p.status === "condicional" ? " (condicional: só vale se o gatilho confirmar)" : "";
  if (p) {
    lines.push({ label: "ENTRADA", text: `${f(p.entry, sym)}${tag}: fechamento da vela do gatilho.` });
    lines.push({ label: "STOP", text: `${f(p.sl, sym)} — ${buy ? "abaixo" : "acima"} do ponto de invalidação estrutural, com margem de 0,5 ATR.` });
    const tp = (i: number) => { const v = p.tps[i]; if (v === null || v === undefined) return null; const reg = x.regions.find((r) => Math.abs((buy ? r.low : r.high) - v) < 1e-9); return `${f(v, sym)} (${(p.rr[i] ?? 0).toFixed(2)}R) — ${reg ? `borda da ${reg.role} do ${reg.origin}` : buy ? "topo anterior do M5" : "fundo anterior do M5"}`; };
    lines.push({ label: "TAKE 1", text: tp(0) ?? "sem alvo estrutural calculado." });
    lines.push({ label: "TAKE 2", text: tp(1) ?? "sem segundo alvo estrutural." });
  } else lines.push({ label: "ENTRADA / STOP / TAKES", text: `Não calculados: ${x.missing[0] ?? "o risco/retorno não passou nos critérios do perfil"}.` });
  lines.push({ label: "INVALIDAÇÃO", text: x.invalidation });
  return { scenario: buy ? "COMPRA" : "VENDA", status: x.state === "entrada_confirmada" ? "confirmada" : "condicional", lines };
}
