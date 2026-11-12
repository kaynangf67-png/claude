import { fetchCalendar, type CalEvent } from "../calendar.js";
import { closedOnly } from "../forex/candles.js";
import { analyze } from "../forex/engine.js";
import { currenciesOf, fetchSeries, FOREX_LABEL, type RawSeries } from "../forex/marketData.js";
import { HORIZON_TFS, pipSize, type Candle, type TF } from "../forex/types.js";
import { marketOpen } from "../agent/agent.js";
import type { Store } from "../agent/store.js";
import { enqueue } from "./mt5.js";
import {
  brain, emptyState, master, pushEvent, resolvePosition, riskGuard, RISK_RULES, specialist, trimState, ZYON_PAIRS,
  type AgentCard, type ClosedPosition, type Opportunity, type Position, type ZyonState,
} from "./core.js";

export interface CycleDeps {
  store: Store; now?: () => number;
  series?: (id: string, tf: TF) => Promise<RawSeries>; calendar?: () => Promise<CalEvent[]>;
}
export const STATE_KEY = "zyon:state";
/** Intervalo mínimo entre ciclos (o botão do escritório é público; o agendador chama a cada 5 min). */
export const MIN_GAP_S = 240;

export async function loadState(store: Store): Promise<ZyonState> {
  const s = await store.getKv<ZyonState>(STATE_KEY);
  return s && s.version === 1 ? s : emptyState();
}

/** Um ciclo da mesa: resolve posições, ouve os especialistas, Master escolhe, News e Risk Guard julgam, execução SIMULADA, Brain registra. */
export async function runCycle(d: CycleDeps): Promise<{ ran: boolean; note: string; state: ZyonState }> {
  const now = Math.floor((d.now ?? Date.now)() / 1000);
  const st = await loadState(d.store);
  if (st.lastCycle && now - st.lastCycle < MIN_GAP_S) return { ran: false, note: `Último ciclo há ${now - st.lastCycle}s; o próximo pode rodar em ${MIN_GAP_S - (now - st.lastCycle)}s.`, state: st };
  if (!(await d.store.acquireLease("zyon-cycle", 120, now))) return { ran: false, note: "Outro ciclo está rodando.", state: st };
  try {
    st.lastCycle = now; st.cycles++;
    const get = d.series ?? fetchSeries;
    const open = marketOpen(now);
    const R = HORIZON_TFS.curto;
    let events: CalEvent[] | null = null;
    try { events = await (d.calendar ?? fetchCalendar)(); } catch { events = null; }
    if (!events) pushEvent(st, { at: now, who: "NEWS", kind: "erro", text: "Calendário econômico indisponível: o Risk Guard vai vetar entradas (notícias não verificadas)." });

    const cards: AgentCard[] = [], opps: Opportunity[] = [];
    const m5BySymbol: Record<string, Candle[]> = {};
    for (const sym of ZYON_PAIRS) {
      const lbl = FOREX_LABEL(sym);
      if (!open) { cards.push({ symbol: sym, label: lbl, status: "dormindo", text: "Mercado fechado.", score: null, at: now }); continue; }
      try {
        const tfs: TF[] = [R.ctx, R.setup, R.trigger, R.struct];
        const res = await Promise.allSettled(tfs.map((t) => get(sym, t)));
        const c = (i: number) => (res[i].status === "fulfilled" ? closedOnly((res[i] as PromiseFulfilledResult<RawSeries>).value.candles, tfs[i], now) : null);
        if (!c(0) || !c(1)) throw new Error(`sem velas ${!c(0) ? R.ctx : R.setup}`);
        m5BySymbol[sym] = c(1)!;
        const a = analyze({ symbol: sym, label: lbl, pip: pipSize(sym), currencies: currenciesOf(sym), now, events,
          candles: { H1: c(0)!, M5: c(1)!, M1: c(2), M15: c(3) } });
        const { card, opp } = specialist(sym, a, now);
        const inTrade = st.open.find((p) => p.symbol === sym);
        cards.push(inTrade && !opp ? { ...card, status: "em_operacao", text: `Em operação simulada: ${inTrade.dir === "BUY" ? "compra" : "venda"} desde ${hm(inTrade.at)}.` } : card);
        if (opp) { opps.push(opp); pushEvent(st, { at: now, who: "ESPECIALISTA", symbol: sym, kind: "oportunidade", text: `${lbl}: ${card.text}. Evidências: ${opp.evidence.slice(0, 2).join("; ")}.` }); }
      } catch (e) {
        cards.push({ symbol: sym, label: lbl, status: "erro", text: `Falha ao analisar: ${(e as Error).message}`.slice(0, 160), score: null, at: now });
      }
    }
    st.agents = cards;

    // EXECUÇÃO (simulada): fecha posições e acompanha as "sombras" (vetadas) com as velas M5 reais
    const settle = (list: Position[], into: ClosedPosition[], real: boolean): Position[] => list.filter((p) => {
      const cs = m5BySymbol[p.symbol]; if (!cs) return true;
      const done = resolvePosition(p, cs); if (!done) return true;
      into.push(done);
      if (real) pushEvent(st, { at: now, who: "EXEC", symbol: p.symbol, kind: "fechada", text: `${p.label} ${p.dir === "BUY" ? "compra" : "venda"} SIMULADA encerrada: ${done.status === "tp1" ? "alvo" : done.status === "expirado" ? "prazo" : "stop"}, ${done.rNet >= 0 ? "+" : ""}${done.rNet.toFixed(2)}R (com custos).` });
      return false;
    });
    st.open = settle(st.open, st.closed, true);
    st.shadows = settle(st.shadows, st.shadowClosed, false);

    if (opps.length) {
      const { pick, dropped } = master(opps, st.open);
      for (const x of dropped) pushEvent(st, { at: now, who: "MASTER", symbol: x.opp.symbol, kind: "descartada", text: `${x.opp.label} descartada: ${x.reason}` });
      if (pick) {
        pushEvent(st, { at: now, who: "MASTER", symbol: pick.symbol, kind: "info", text: `${pick.label} encaminhada ao Risk Guard (confluência ${pick.score}, R:R ${pick.rr.toFixed(2)}).` });
        const veto = riskGuard(pick, st, events, now);
        if (veto.length) {
          pushEvent(st, { at: now, who: "RISK", symbol: pick.symbol, kind: "vetada", text: `${pick.label} VETADA: ${veto.join(" | ")}` });
          st.shadows.push({ ...pick, kind: "sombra", maxHoldS: RISK_RULES.maxHoldS, vetoReasons: veto });
        } else {
          pushEvent(st, { at: now, who: "RISK", symbol: pick.symbol, kind: "aprovada", text: `${pick.label} APROVADA: dentro de todos os limites.` });
          st.open.push({ ...pick, kind: "simulada", maxHoldS: RISK_RULES.maxHoldS });
          pushEvent(st, { at: now, who: "EXEC", symbol: pick.symbol, kind: "aberta", text: `${pick.label} ${pick.dir === "BUY" ? "compra" : "venda"} SIMULADA aberta em ${pick.entry}, stop ${fmt(pick.sl, pick.symbol)}, alvo ${fmt(pick.tps[0]!, pick.symbol)}.` });
          // PONTE MT5 (desligada por padrão): a mesma ordem aprovada vai para o EA executar na conta DEMO
          const q = await enqueue(d.store, pick, now).catch((e) => ({ queued: false, reason: (e as Error).message }));
          if (q.queued) pushEvent(st, { at: now, who: "EXEC", symbol: pick.symbol, kind: "aberta", text: `${pick.label}: ${q.reason}. O EA calcula o lote para ${0.5}% de risco.` });
          else if (q.reason !== "ponte MT5 desligada") pushEvent(st, { at: now, who: "EXEC", symbol: pick.symbol, kind: "info", text: `${pick.label} não foi ao MT5: ${q.reason}.` });
          const c = st.agents.find((a) => a.symbol === pick.symbol);
          if (c) { c.status = "em_operacao"; c.text = `Em operação simulada: ${pick.dir === "BUY" ? "compra" : "venda"}.`; }
        }
      }
    } else if (open) pushEvent(st, { at: now, who: "MASTER", kind: "info", text: "Nenhum especialista trouxe entrada confirmada neste ciclo." });
    if (!open) pushEvent(st, { at: now, who: "SISTEMA", kind: "info", text: "Mercado Forex fechado: especialistas dormindo; só o acompanhamento roda." });

    const b = brain(st);
    pushEvent(st, { at: now, who: "BRAIN", kind: "info", text: `Registrado. ${b.executed.n} operações simuladas fechadas, ${st.open.length} abertas, ${b.vetoN} vetadas acompanhadas.` });
    await d.store.setKv(STATE_KEY, trimState(st));
    return { ran: true, note: "Ciclo concluído.", state: st };
  } finally { await d.store.releaseLease("zyon-cycle"); }
}

const hm = (sec: number) => new Date(sec * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const fmt = (v: number, s: string) => v.toFixed(s.includes("JPY") ? 3 : 5);

/** O que o escritório lê: estado + relatório do Brain + regras fixas (para mostrar). */
export function view(st: ZyonState, now: number) {
  return { ...st, brain: brain(st), rules: RISK_RULES, pairs: ZYON_PAIRS, now, nextIn: st.lastCycle ? Math.max(0, MIN_GAP_S - (now - st.lastCycle)) : 0,
    mode: "SIMULADO", note: "Execução SIMULADA com preços reais (Yahoo), custos descontados. Nenhuma ordem vai para corretora." };
}
