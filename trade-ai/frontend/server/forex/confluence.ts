import type { Filter } from "./engine.js";
import type { TFAnalysis } from "./mtf.js";
import type { Profile } from "./profile.js";
import type { Risk } from "./risk.js";
import type { StrategyResult } from "./strategies.js";
import type { Dir, Region, Trend } from "./types.js";
import { opposite } from "./types.js";

/**
 * Confluence Score (0 a 100): soma ponderada de 9 componentes técnicos, cada um com nota, estado e justificativa.
 * É confluência de evidências técnicas. NÃO é probabilidade de acerto e não foi calibrada contra resultados.
 * Componente sem dado verificável (ex.: histórico pequeno, calendário fora do ar) fica FORA da média; não ganha nem perde pontos.
 */
export type CState = "favoravel" | "neutro" | "contrario" | "nao_verificado" | "sem_dados";
export interface Component { id: string; name: string; weight: number; score: number | null; state: CState; why: string }
export interface ConfluenceResult {
  total: number; label: string; components: Component[];
  /** Quando um filtro obrigatório (exceto o gatilho) falha, a pontuação é limitada a 49. */
  capped: string[]; parts: Record<string, { got: number; max: number }>;
}
export interface PatternStat { strategy: string; symbol: string; n: number; sumR: number }

export interface ConfInput {
  dir: Dir; price: number; pip: number; now: number; symbol: string; currencies: string[];
  a: { H1: TFAnalysis; M15: TFAnalysis | null; M5: TFAnalysis; M1: TFAnalysis | null };
  regions: Region[]; strategy: StrategyResult; risk: Risk; filters: Filter[]; profile: Profile; history: PatternStat[];
  fvgAligned: boolean;
}

const W = { dd: 15, ms: 15, ph: 10, ss: 8, ta: 12, lq: 10, sr: 15, rr: 10, nw: 5 };
const want = (d: Dir): Trend => (d === "BUY" ? "alta" : "baixa");
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const stateOf = (score: number, hi = 65, lo = 35): CState => (score >= hi ? "favoravel" : score >= lo ? "neutro" : "contrario");
const side = (d: Dir) => (d === "BUY" ? "compradora" : "vendedora");

export const scoreLabel = (t: number) => t >= 85 ? "SETUP DE ALTA CONFLUÊNCIA" : t >= 75 ? "SETUP BOM — POSSÍVEL ENTRADA APÓS CONFIRMAÇÃO" : t >= 65 ? "CENÁRIO EM FORMAÇÃO — AGUARDAR CONFIRMAÇÃO" : t >= 50 ? "CENÁRIO FRACO — AGUARDAR" : "NÃO OPERAR";

/** Direction Delta: saldo das evidências de direção. Positivo = a favor de `dir`; o mesmo cálculo com a direção oposta dá o valor negativo. */
export function directionDelta(a: ConfInput["a"], price: number, dir: Dir) {
  const w = want(dir), o = want(opposite(dir));
  const s = (t: Trend) => (t === w ? 1 : t === o ? -1 : 0);
  const items: { name: string; wt: number; v: number }[] = [
    { name: "tendência M5", wt: 2, v: s(a.M5.trend) },
    { name: "EMAs M5", wt: 1.5, v: a.M5.ema.stack === "misto" ? 0 : a.M5.ema.stack === w ? 1 : -1 },
    { name: "preço vs EMA 20 (M5)", wt: 1, v: price === a.M5.ema.e20 ? 0 : (price > a.M5.ema.e20) === (dir === "BUY") ? 1 : -1 },
    { name: "BOS/CHoCH M5", wt: 2, v: a.M5.struct.bos === dir || a.M5.struct.choch === dir ? 1 : a.M5.struct.bos === opposite(dir) || a.M5.struct.choch === opposite(dir) ? -1 : 0 },
  ];
  if (a.M5.rsi !== null) items.push({ name: "RSI M5", wt: 0.5, v: a.M5.rsi === 50 ? 0 : (a.M5.rsi > 50) === (dir === "BUY") ? 1 : -1 });
  if (a.M1) { items.push({ name: "tendência M1", wt: 2, v: s(a.M1.trend) }, { name: "EMAs M1", wt: 1, v: a.M1.ema.stack === "misto" ? 0 : a.M1.ema.stack === w ? 1 : -1 }); }
  const max = items.reduce((t, i) => t + i.wt, 0), delta = items.reduce((t, i) => t + i.wt * i.v, 0);
  return { delta, max, items };
}

/** Sessões em UTC (aproximadas, sem ajuste de horário de verão). Moeda → sessão de origem. */
function sessionOf(h: number) {
  return { asia: h >= 22 || h < 8, london: h >= 7 && h < 16, ny: h >= 12 && h < 21 };
}
const HOME: Record<string, "asia" | "london" | "ny"> = { JPY: "asia", AUD: "asia", NZD: "asia", EUR: "london", GBP: "london", CHF: "london", USD: "ny", CAD: "ny" };

export function sessionComponent(now: number, currencies: string[]): Component {
  const d = new Date(now * 1000), h = d.getUTCHours(), wd = d.getUTCDay();
  const closed = wd === 6 || (wd === 5 && h >= 22) || (wd === 0 && h < 22);
  if (closed) return { id: "session", name: "Session Analysis", weight: W.ss, score: 0, state: "contrario", why: "Mercado de Forex fechado (fim de semana)." };
  if (h === 21) return { id: "session", name: "Session Analysis", weight: W.ss, score: 20, state: "contrario", why: "21h UTC: virada do dia, liquidez baixa e spread maior." };
  const act = sessionOf(h);
  const active = currencies.filter((c) => HOME[c] && act[HOME[c]]);
  const names = [act.asia && "Ásia", act.london && "Londres", act.ny && "Nova York"].filter(Boolean).join(" + ") || "nenhuma sessão principal";
  const overlap = act.london && act.ny && currencies.some((c) => c === "USD" || HOME[c] === "london");
  let score = active.length >= 2 ? 90 : active.length === 1 ? 65 : 30;
  if (overlap && active.length) score = Math.min(100, score + 10);
  return { id: "session", name: "Session Analysis", weight: W.ss, score, state: stateOf(score), why: `${String(h).padStart(2, "0")}h UTC — ${names}. Moedas do par com sessão ativa: ${active.length ? active.join(", ") : "nenhuma"}${overlap ? "; sobreposição Londres/Nova York" : ""}. Regra de horário aproximada, não estatística.` };
}

function nearRegion(regions: Region[], dir: Dir, lim: number): Region | null {
  const role = dir === "BUY" ? "suporte" : "resistencia";
  return regions.filter((r) => r.role === role && r.distance <= lim).sort((x, y) => (y.strength === "forte" ? 1 : 0) - (x.strength === "forte" ? 1 : 0) || x.distance - y.distance)[0] ?? null;
}

export function patternHistoryComponent(strategy: string, symbol: string, history: PatternStat[]): Component {
  const base = { id: "history", name: "Pattern History", weight: W.ph };
  const mine = history.filter((h) => h.strategy === strategy);
  const same = mine.filter((h) => h.symbol === symbol);
  const pick = (list: PatternStat[]) => ({ n: list.reduce((t, h) => t + h.n, 0), sum: list.reduce((t, h) => t + h.sumR, 0) });
  const a = pick(same), b = pick(mine);
  const src = a.n >= 10 ? { ...a, scope: "neste par" } : b.n >= 10 ? { ...b, scope: "em todos os pares" } : null;
  if (!src) return { ...base, score: null, state: "sem_dados", why: `Sem amostra: só ${b.n} resultado(s) resolvido(s) desta estratégia no seu histórico (mínimo 10). Componente fora da média.` };
  const exp = src.sum / src.n;
  const score = clamp(50 + exp * 100); // −0,5R → 0, 0R → 50, +0,5R → 100
  return { ...base, score, state: stateOf(score, 60, 40), why: `${src.n} resultados resolvidos ${src.scope}, expectativa de ${exp >= 0 ? "+" : ""}${exp.toFixed(2)}R por operação (histórico do seu navegador, inclui simulados). Amostra pequena engana.` };
}

export function buildConfluence(x: ConfInput): ConfluenceResult {
  const { dir, a } = x, w = want(dir), o = want(opposite(dir));
  const comps: Component[] = [];

  // 1. Direction Delta
  const dd = directionDelta(a, x.price, dir);
  const ddScore = clamp(50 + (50 * dd.delta) / dd.max);
  const strong = dd.items.filter((i) => i.v === 1).map((i) => i.name), weak = dd.items.filter((i) => i.v === -1).map((i) => i.name);
  comps.push({ id: "delta", name: "Direction Delta", weight: W.dd, score: ddScore, state: dd.delta / dd.max >= 0.4 ? "favoravel" : dd.delta / dd.max <= -0.1 ? "contrario" : "neutro",
    why: `Δ ${dd.delta >= 0 ? "+" : ""}${dd.delta.toFixed(1)} de ±${dd.max.toFixed(1)} a favor da ${dir === "BUY" ? "compra" : "venda"}. A favor: ${strong.join(", ") || "nada"}. Contra: ${weak.join(", ") || "nada"}.` });

  // 2. Market Structure (M5)
  const st = a.M5.struct;
  const seq = dir === "BUY" ? st.higherLows : st.lowerHighs;
  const against = st.choch === opposite(dir) || st.bos === opposite(dir);
  let ms = (a.M5.trend === w ? 40 : a.M5.trend === "lateral" ? 15 : 0) + (seq ? 20 : 0) + (st.bos === dir ? 25 : st.choch === dir ? 15 : 0) + (against ? 0 : 15);
  if (x.strategy.id === 3 && st.bos !== dir) ms += 10; // BOS + reteste: o rompimento já ocorreu antes do reteste
  ms = clamp(ms);
  comps.push({ id: "structure", name: "Market Structure", weight: W.ms, score: ms, state: stateOf(ms),
    why: `M5 ${a.M5.trend}${seq ? (dir === "BUY" ? ", fundos ascendentes" : ", topos descendentes") : ""}; ${st.bos === dir ? "BOS a favor" : st.choch === dir ? "CHoCH a favor" : "sem BOS/CHoCH a favor"}${against ? "; há quebra de estrutura CONTRA" : ""}.` });

  // 3. Pattern History
  comps.push(patternHistoryComponent(x.strategy.name, x.symbol, x.history));

  // 4. Session
  comps.push(sessionComponent(x.now, x.currencies));

  // 5. Trend Alignment (H1 e M15 só entram se estiverem no contexto do perfil)
  const tr: { tf: string; wt: number; t: Trend }[] = [{ tf: "M5", wt: 35, t: a.M5.trend }];
  if (a.M1) tr.push({ tf: "M1", wt: 20, t: a.M1.trend });
  if (a.M15 && x.profile.context.includes("M15")) tr.push({ tf: "M15", wt: 25, t: a.M15.trend });
  if (x.profile.context.includes("H1")) tr.push({ tf: "H1", wt: 20, t: a.H1.trend });
  const tw = tr.reduce((t, i) => t + i.wt, 0);
  const ta = clamp((100 * tr.reduce((t, i) => t + i.wt * (i.t === w ? 1 : i.t === "lateral" ? 0.4 : 0), 0)) / tw);
  const contra = tr.filter((i) => i.t === o).map((i) => i.tf);
  comps.push({ id: "alignment", name: "Trend Alignment", weight: W.ta, score: ta, state: stateOf(ta),
    why: tr.map((i) => `${i.tf} ${i.t}`).join(" · ") + (contra.length ? `. Contra a direção: ${contra.join(", ")}.` : ". Nenhum tempo gráfico contra.") });

  // 6. Liquidity
  const sw = a.M5.sweep;
  const swAligned = sw?.dir === dir, swAgainst = sw?.dir === opposite(dir);
  const pool = a.M5.liquidity.some((l) => (dir === "BUY" ? l.side === "acima" : l.side === "abaixo") && (l.kind === "topos iguais" || l.kind === "fundos iguais")) || a.H1.liquidity.some((l) => (dir === "BUY" ? l.side === "acima" : l.side === "abaixo") && (l.kind === "topos iguais" || l.kind === "fundos iguais"));
  let lq = (swAligned ? 50 : 0) + (x.fvgAligned ? 25 : 0) + (pool ? 25 : 0);
  if (swAgainst) lq = Math.min(lq, 20);
  comps.push({ id: "liquidity", name: "Liquidity Analysis", weight: W.lq, score: lq, state: swAgainst ? "contrario" : lq >= 50 ? "favoravel" : "neutro",
    why: `${swAligned ? `Varredura ${side(dir)} em ${sw!.level.toFixed(x.symbol.includes("JPY") ? 3 : 5)}` : swAgainst ? "Varredura contra a direção" : "Sem varredura recente"}; ${x.fvgAligned ? "FVG a favor aberto/parcial" : "sem FVG a favor"}; ${pool ? "liquidez (topos/fundos iguais) no caminho do alvo" : "sem piscina de liquidez no caminho"}.` });

  // 7. Support and Resistance
  const reg = x.strategy.region ?? nearRegion(x.regions, dir, 6 * a.M5.atr);
  const ahead = x.regions.filter((r) => r.role === (dir === "BUY" ? "resistencia" : "suporte")).sort((p, q) => p.distance - q.distance)[0] ?? null;
  const blocked = ahead && ahead.distance < 1.5 * a.M5.atr;
  let sr = reg ? (reg.strength === "forte" ? 65 : 40) + (reg.origin === "H1" ? 10 : 0) + Math.min(20, reg.reactions * 5) : 0;
  if (blocked) sr = Math.max(0, sr - 30);
  sr = clamp(sr);
  comps.push({ id: "sr", name: "Support and Resistance", weight: W.sr, score: sr, state: reg ? stateOf(sr) : "neutro",
    why: reg ? `${reg.role === "suporte" ? "Suporte" : "Resistência"} ${reg.strength} do ${reg.origin} com ${reg.reactions} reações a ${reg.distancePips.toFixed(1)} pips${blocked ? `; mas há ${ahead!.role} a só ${ahead!.distancePips.toFixed(1)} pips no caminho` : ""}.` : "Nenhuma região do H1 com reações repetidas perto do preço." });

  // 8. Risk/Reward
  const rr0 = x.risk.rr[0];
  if (rr0 === null || rr0 === undefined) comps.push({ id: "rr", name: "Risk/Reward", weight: W.rr, score: x.risk.ok ? null : 0, state: x.risk.ok ? "sem_dados" : "contrario", why: x.risk.notes.join(" ") || "Sem alvo estrutural calculado." });
  else {
    const rrs = clamp((rr0 / (x.profile.minRR * 2)) * 100);
    comps.push({ id: "rr", name: "Risk/Reward", weight: W.rr, score: x.risk.ok ? rrs : Math.min(rrs, 30), state: x.risk.ok && rr0 >= x.profile.minRR ? "favoravel" : "contrario",
      why: `R:R ao alvo 1 de ${rr0.toFixed(2)} (mínimo do perfil ${x.profile.minRR}). Stop de ${x.risk.riskPips.toFixed(1)} pips.${x.risk.notes.length ? " " + x.risk.notes.join(" ") : ""}` });
  }

  // 9. News Check
  const nf = x.filters.find((f) => f.id === 9);
  if (!nf || nf.status === "nao_verificado") comps.push({ id: "news", name: "News Check", weight: W.nw, score: null, state: "nao_verificado", why: nf?.note ?? "Calendário não consultado." });
  else comps.push({ id: "news", name: "News Check", weight: W.nw, score: nf.status === "ok" ? 100 : 0, state: nf.status === "ok" ? "favoravel" : "contrario", why: nf.note });

  const avail = comps.filter((c) => c.score !== null);
  const wsum = avail.reduce((t, c) => t + c.weight, 0);
  let total = Math.round(avail.reduce((t, c) => t + c.weight * (c.score as number), 0) / wsum);
  // filtros obrigatórios (menos o gatilho, que só define "aguardar") limitam a pontuação
  const capped = x.filters.filter((f) => f.status === "falha" && f.id !== 4).map((f) => f.name);
  if (capped.length) total = Math.min(total, 49);
  const parts: ConfluenceResult["parts"] = {};
  for (const c of comps) parts[c.name] = { got: c.score === null ? 0 : Math.round((c.score * c.weight) / 100), max: c.weight };
  return { total, label: capped.length ? `BLOQUEADO PELOS FILTROS: ${capped.join(", ")}` : scoreLabel(total), components: comps, capped, parts };
}
