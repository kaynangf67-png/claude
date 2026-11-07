import type { CalEvent } from "../calendar.js";
import type { ForexAnalysis } from "../forex/engine.js";
import { computeStats, type Resolved, type SavedSignal, type Stats } from "../forex/history.js";
import type { Candle, Dir } from "../forex/types.js";
import { newsGate } from "../agent/news.js";

/**
 * ZYON AI TRADING FLOOR — núcleo determinístico (sem banco, sem rede): especialistas, Master, News, Risk Guard,
 * execução SIMULADA e Brain. A IA (o motor de análise) PROPÕE; estas regras DECIDEM. Nada aqui envia ordem a corretora.
 * As regras de risco são constantes no código: o Brain mede e sugere, nunca as altera.
 */

export const ZYON_PAIRS = ["EURUSD", "GBPUSD", "USDJPY"] as const;
export const RISK_RULES = {
  minScore: 75,          // confluência mínima para o Risk Guard aceitar
  minRR: 1.5,            // retorno mínimo em R até o alvo 1
  maxOpen: 2,            // posições simuladas abertas ao mesmo tempo
  maxTradesDay: 6,       // entradas por dia (UTC)
  dailyStopR: -3,        // perda do dia que trava novas entradas
  costPips: 1.2,         // spread + slippage descontados de cada resultado
  maxHoldS: 3600,        // day trade M5: no máximo 1 hora
} as const;

export type AgentStatus = "dormindo" | "analisando" | "sem_setup" | "aguardando" | "oportunidade" | "em_operacao" | "erro";
export interface AgentCard { symbol: string; label: string; status: AgentStatus; text: string; score: number | null; at: number }
export interface Opportunity extends SavedSignal { rr: number; evidence: string[]; against: string[] }
export interface Position extends Opportunity { maxHoldS: number; kind: "simulada" | "sombra"; vetoReasons?: string[] }
export interface ClosedPosition extends Resolved { kind: "simulada" | "sombra"; rNet: number; vetoReasons?: string[] }
export type Who = "ESPECIALISTA" | "MASTER" | "NEWS" | "RISK" | "EXEC" | "BRAIN" | "SISTEMA";
export interface ZEvent { id: string; at: number; who: Who; symbol?: string; kind: "info" | "oportunidade" | "descartada" | "aprovada" | "vetada" | "aberta" | "fechada" | "erro"; text: string }
export interface ZyonState {
  version: 1; lastCycle: number | null; cycles: number;
  agents: AgentCard[]; open: Position[]; closed: ClosedPosition[]; shadows: Position[]; shadowClosed: ClosedPosition[]; events: ZEvent[];
}
export const emptyState = (): ZyonState => ({ version: 1, lastCycle: null, cycles: 0, agents: [], open: [], closed: [], shadows: [], shadowClosed: [], events: [] });

const KEEP_EVENTS = 200, KEEP_CLOSED = 400;
const label = (s: string) => `${s.slice(0, 3)}/${s.slice(3)}`;
export const dayOf = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

export function pushEvent(st: ZyonState, e: Omit<ZEvent, "id">): void {
  st.events.unshift({ id: `${e.at}-${st.events.length}-${Math.random().toString(36).slice(2, 7)}`, ...e });
  if (st.events.length > KEEP_EVENTS) st.events.length = KEEP_EVENTS;
}

/** ESPECIALISTA: transforma a análise do seu ativo em cartão de status e, se houver entrada confirmada, numa oportunidade. */
export function specialist(symbol: string, a: ForexAnalysis, now: number): { card: AgentCard; opp: Opportunity | null } {
  const base = { symbol, label: label(symbol), at: now, score: a.score?.total ?? null };
  if (!a.data.ok) return { card: { ...base, status: "erro", text: `Dados bloqueados: ${a.data.issues[0] ?? "qualidade"}` }, opp: null };
  if (a.state === "entrada_confirmada" && a.trade && a.chosen && a.trade.tps[0] !== null) {
    const t = a.trade, rr = t.rr[0] ?? 0;
    const opp: Opportunity = {
      id: `${symbol}-${now}`, symbol, label: label(symbol), at: now, tf: "M5", dir: t.dir, strategy: a.chosen.name,
      entry: t.entry, sl: t.sl, tps: t.tps, score: a.score?.total ?? 0, reasons: a.favor.slice(0, 4), pip: symbol.includes("JPY") ? 0.01 : 0.0001,
      rr, evidence: a.favor.slice(0, 4), against: a.contra.slice(0, 3),
    };
    return { card: { ...base, status: "oportunidade", text: `${t.dir === "BUY" ? "Compra" : "Venda"} · ${a.chosen.name} · R:R ${rr.toFixed(2)}` }, opp };
  }
  if (a.state === "aguardando_confirmacao" && a.watch) return { card: { ...base, status: "aguardando", text: a.watch.condition.slice(0, 140) }, opp: null };
  return { card: { ...base, status: "sem_setup", text: a.missing[0] ?? "Sem setup completo agora." }, opp: null };
}

/** Exposição por moeda: comprar EURUSD = +EUR e −USD. */
export function exposure(ps: Pick<Position, "symbol" | "dir">[]): Record<string, number> {
  const ex: Record<string, number> = {};
  for (const p of ps) {
    const s = p.dir === "BUY" ? 1 : -1;
    ex[p.symbol.slice(0, 3)] = (ex[p.symbol.slice(0, 3)] ?? 0) + s;
    ex[p.symbol.slice(3)] = (ex[p.symbol.slice(3)] ?? 0) - s;
  }
  return ex;
}

/** MASTER: descarta ativo já em operação e apostas repetidas na mesma moeda; ordena por confluência e R:R; deixa passar 1 por ciclo. */
export function master(opps: Opportunity[], open: Position[]): { pick: Opportunity | null; dropped: { opp: Opportunity; reason: string }[] } {
  const dropped: { opp: Opportunity; reason: string }[] = [];
  const ok: Opportunity[] = [];
  const ex = exposure(open);
  for (const o of opps) {
    if (open.some((p) => p.symbol === o.symbol)) { dropped.push({ opp: o, reason: `${o.label} já tem posição aberta.` }); continue; }
    const mine = exposure([o]);
    const clash = Object.entries(mine).find(([c, v]) => (ex[c] ?? 0) * v > 0);
    if (clash) { dropped.push({ opp: o, reason: `Repete a aposta em ${clash[0]} de uma posição aberta (correlação).` }); continue; }
    ok.push(o);
  }
  ok.sort((x, y) => y.score - x.score || y.rr - x.rr);
  // entre oportunidades do mesmo ciclo que apostam na mesma moeda, só a melhor segue
  const pick = ok[0] ?? null;
  for (const o of ok.slice(1)) dropped.push({ opp: o, reason: pick ? `Master priorizou ${pick.label} (confluência ${pick.score}); só 1 entrada por ciclo.` : "—" });
  return { pick, dropped };
}

/** RISK GUARD: autoridade final. Devolve os motivos de veto (vazio = aprovada). */
export function riskGuard(o: Opportunity, st: ZyonState, events: CalEvent[] | null, now: number): string[] {
  const v: string[] = [];
  const today = dayOf(now);
  const todays = [...st.open, ...st.closed].filter((p) => p.kind === "simulada" && dayOf(p.at) === today);
  const dayR = st.closed.filter((p) => p.kind === "simulada" && dayOf(p.at) === today).reduce((s, p) => s + p.rNet, 0);
  if (o.score < RISK_RULES.minScore) v.push(`Confluência ${o.score} abaixo do mínimo ${RISK_RULES.minScore}.`);
  if (o.rr < RISK_RULES.minRR) v.push(`R:R ${o.rr.toFixed(2)} abaixo do mínimo ${RISK_RULES.minRR}.`);
  if (st.open.length >= RISK_RULES.maxOpen) v.push(`Já há ${st.open.length} posições abertas (máximo ${RISK_RULES.maxOpen}).`);
  if (todays.length >= RISK_RULES.maxTradesDay) v.push(`Limite de ${RISK_RULES.maxTradesDay} entradas no dia atingido.`);
  if (dayR <= RISK_RULES.dailyStopR) v.push(`Perda do dia ${dayR.toFixed(2)}R atingiu o limite de ${RISK_RULES.dailyStopR}R: dia travado.`);
  const costR = (RISK_RULES.costPips * o.pip) / Math.abs(o.entry - o.sl);
  if (costR > 0.25) v.push(`Custo (spread+slippage) seria ${(costR * 100).toFixed(0)}% do risco: stop curto demais.`);
  const gate = newsGate(events, [o.symbol.slice(0, 3), o.symbol.slice(3)], now);
  if (gate.blocked) v.push(gate.reason ?? "Notícia de alto impacto.");
  return v;
}

/** Resolve uma posição com velas fechadas: stop e alvo na mesma vela contam como stop; passou do prazo, fecha no último preço. */
export function resolvePosition(p: Position, candles: Candle[]): ClosedPosition | null {
  const buy = p.dir === "BUY", risk = Math.abs(p.entry - p.sl), tp = p.tps[0];
  if (!tp || risk <= 0) return null;
  const costR = (RISK_RULES.costPips * p.pip) / risk;
  const close = (status: ClosedPosition["status"], r: number, at: number): ClosedPosition =>
    ({ ...p, status, r, rNet: r - costR, closedAt: at });
  for (const k of candles) {
    if (k.t < p.at) continue;
    const hitSl = buy ? k.l <= p.sl : k.h >= p.sl, hitTp = buy ? k.h >= tp : k.l <= tp;
    if (hitSl) return close(hitTp ? "ambiguo" : "stop", -1, k.t);
    if (hitTp) return close("tp1", Math.abs(tp - p.entry) / risk, k.t);
    if (k.t - p.at >= p.maxHoldS) return close("expirado", (buy ? k.c - p.entry : p.entry - k.c) / risk, k.t);
  }
  return null;
}

export interface BrainReport {
  executed: Stats; shadow: Stats;
  /** Efeito do veto: soma em R das oportunidades BLOQUEADAS, acompanhadas como se tivessem entrado. Negativo = o veto evitou perda. */
  vetoEffectR: number; vetoN: number;
  verdict: string;
  suggestions: string[];
}

/** BRAIN: mede. Só sugere; nenhuma regra muda sozinha. */
export function brain(st: ZyonState): BrainReport {
  const asResolved = (xs: ClosedPosition[]) => xs.map((x) => ({ ...x, r: x.rNet }));
  const executed = computeStats(asResolved(st.closed)), shadow = computeStats(asResolved(st.shadowClosed));
  const vetoEffectR = st.shadowClosed.reduce((s, x) => s + x.rNet, 0);
  let verdict = `Amostra pequena (${executed.n} operações simuladas): ainda não dá para dizer se há vantagem. O mínimo é 100.`;
  if (executed.n >= 100 && executed.ci) {
    verdict = (executed.expectancy ?? 0) > 0 ? "Expectativa positiva depois de custos nas operações simuladas. Próximo passo: validar em conta demo do MT5." : "Sem vantagem: expectativa não positiva depois de custos. Não avance para execução.";
  }
  const suggestions: string[] = [];
  for (const g of executed.byStrategy) if (g.n >= 20 && g.sumR / g.n < -0.2) suggestions.push(`Revisar a estratégia "${g.key}": ${g.n} operações, ${(g.sumR / g.n).toFixed(2)}R por operação.`);
  for (const g of executed.bySymbol) if (g.n >= 20 && g.sumR / g.n < -0.2) suggestions.push(`Revisar o especialista ${g.key}: ${(g.sumR / g.n).toFixed(2)}R por operação em ${g.n}.`);
  if (st.shadowClosed.length >= 20 && vetoEffectR > 0) suggestions.push(`O veto bloqueou entradas que teriam somado +${vetoEffectR.toFixed(1)}R. Avaliar se algum filtro está rígido demais (decisão humana).`);
  if (!suggestions.length) suggestions.push("Nenhuma sugestão: amostra ainda pequena para concluir algo com segurança.");
  return { executed, shadow, vetoEffectR, vetoN: st.shadowClosed.length, verdict, suggestions };
}

export function trimState(st: ZyonState): ZyonState {
  if (st.closed.length > KEEP_CLOSED) st.closed = st.closed.slice(-KEEP_CLOSED);
  if (st.shadowClosed.length > KEEP_CLOSED) st.shadowClosed = st.shadowClosed.slice(-KEEP_CLOSED);
  return st;
}

export type { Dir };
