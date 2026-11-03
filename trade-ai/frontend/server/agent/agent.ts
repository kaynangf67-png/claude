import { fetchCalendar, type CalEvent } from "../calendar.js";
import { closedOnly } from "../forex/candles.js";
import { analyze, type ForexAnalysis, type NewsEvent } from "../forex/engine.js";
import { resolveSignal, type SavedSignal } from "../forex/history.js";
import { currenciesOf, fetchSeries, FOREX_LABEL, FOREX_YAHOO, type RawSeries } from "../forex/marketData.js";
import type { PatternStat } from "../forex/confluence.js";
import { sanitizeProfile, STYLE_RULES } from "../forex/profile.js";
import { pipSize, type TF } from "../forex/types.js";
import { classify, newsGate, priceReaction, upcoming } from "./news.js";
import { classifyOpportunity, rankKey, type Opportunity } from "./radar.js";
import { buildDailyReport } from "./report.js";
import {
  brtDate, brtMinutes, canOpen, closeTrade, hasPending, isOperationalDay, losses, openTrade, panel, pending, rollover, RiskViolation, stateOf, wins, type DayState,
} from "./risk2x0.js";
import type { AgentConfig, AlertRecord, Heartbeat, JournalTrade, RadarClass, ScanRecord, Store } from "./store.js";
import { confirmedMsg, dataAgeSec, distantMsg, formingMsg, invalidatedMsg, lockedMsg, newsMsg, openingMsg, resultMsg, targetMsg, type Sender } from "./telegram.js";

/**
 * TRADE AGENT: uma execução ("tick") por chamada do agendador. Sem estado em memória: tudo vem do banco e volta para o banco,
 * então reiniciar, escalar ou chamar duas vezes não destrava o dia nem duplica entrada.
 * Modo ANALISTA AUTÔNOMO: monitora, analisa, alerta e SIMULA. Nenhuma ordem real é enviada (não há código de corretora).
 */
export interface TickDeps {
  store: Store; send: Sender; now?: () => number;
  series?: (id: string, tf: TF) => Promise<RawSeries>; calendar?: () => Promise<CalEvent[]>;
}
export interface TickResult {
  action: "busy" | "paused" | "idle" | "locked" | "scanned" | "error"; at: number; day: string; state: string; scanned: number; failed: number;
  opened: string | null; closed: string[]; alerts: number; note: string | null;
}

const STALE_OPEN_SEC = 90 * 60; // operação curta dura até 60 min; depois de 90 sem resolver, o resultado vira desconhecido (e bloqueia)
const CAL_FRESH_SEC = 20 * 60, CAL_USABLE_SEC = 3 * 3600;
const CONCURRENCY = 3;

/** Forex fecha de sexta ~22h UTC até domingo ~22h UTC. */
export function marketOpen(nowSec: number): boolean {
  const d = new Date(nowSec * 1000), wd = d.getUTCDay(), h = d.getUTCHours();
  return !(wd === 6 || (wd === 5 && h >= 22) || (wd === 0 && h < 22));
}
export const inWindow = (nowSec: number, cfg: AgentConfig) => { const m = brtMinutes(nowSec); return m >= cfg.window.startMin && m < cfg.window.endMin; };
export const profileOf = (cfg: AgentConfig) => sanitizeProfile({ pairs: cfg.enabledPairs, strategies: cfg.strategies, style: cfg.style, entryTf: cfg.entryTf, context: ["M15", "H1"], minRR: STYLE_RULES[cfg.style].minRR });

export function patternStats(trades: JournalTrade[]): PatternStat[] {
  const m = new Map<string, PatternStat>();
  for (const t of trades) {
    if ((t.status !== "WIN" && t.status !== "LOSS") || t.r === undefined) continue;
    const k = `${t.strategy}|${t.symbol}`, x = m.get(k) ?? { strategy: t.strategy, symbol: t.symbol, n: 0, sumR: 0 };
    x.n++; x.sumR += t.r; m.set(k, x);
  }
  return [...m.values()];
}

class Tick {
  alerts = 0; closed: string[] = []; opened: string | null = null; note: string | null = null;
  constructor(public d: TickDeps, public cfg: AgentConfig, public now: number) {}
  get store() { return this.d.store; }

  /** Grava o alerta (uma vez por chave) e só então tenta enviar; falha de envio não derruba a varredura. */
  async emit(a: Omit<AlertRecord, "at" | "sent" | "day"> & { day?: string }, deliver = true): Promise<boolean> {
    const rec: AlertRecord = { ...a, day: a.day ?? brtDate(this.now), at: this.now, sent: false };
    if (!(await this.store.addAlert(rec))) return false;
    this.alerts++;
    if (!deliver) { await this.store.markAlert(rec.key, false, "não enviado (desativado nas configurações)"); return true; }
    const r = await this.d.send(rec.text);
    await this.store.markAlert(rec.key, r.ok, r.ok ? undefined : r.error);
    return true;
  }

  async saveDay(next: DayState, prev: DayState): Promise<void> {
    const ok = await this.store.putDay(next, prev.version);
    if (!ok) throw new Error("Conflito de versão ao salvar o dia de risco (outra execução alterou o dia). Nada foi aplicado.");
  }

  series(id: string, tf: TF) { return (this.d.series ?? fetchSeries)(id, tf); }

  async calendar(): Promise<{ events: CalEvent[] | null; fetchedAt: number | null }> {
    const cache = await this.store.getKv<{ at: number; events: CalEvent[] }>("calendar:cache");
    if (cache && this.now - cache.at < CAL_FRESH_SEC) return { events: cache.events, fetchedAt: cache.at };
    try {
      const events = await (this.d.calendar ?? fetchCalendar)();
      await this.store.setKv("calendar:cache", { at: this.now, events });
      return { events, fetchedAt: this.now };
    } catch (e) {
      this.note = `Calendário indisponível: ${(e as Error).message}`;
      if (cache && this.now - cache.at < CAL_USABLE_SEC) return { events: cache.events, fetchedAt: cache.at };
      return { events: null, fetchedAt: null };
    }
  }

  // ---------------------------------------------------------------- reconciliação de operações abertas
  async reconcile(day: DayState): Promise<DayState> {
    let cur = day;
    for (const t of pending(day)) {
      const j = await this.store.getTrade(t.id);
      if (!j) { cur = closeTrade(cur, t.id, "UNKNOWN", this.now); await this.saveDay(cur, { ...cur, version: cur.version - 1 }); this.note = `Operação ${t.id} sem registro no diário: marcada como DESCONHECIDA (bloqueia entradas).`; continue; }
      let res: ReturnType<typeof resolveSignal> | null = null;
      try {
        const [m1, m5] = await Promise.allSettled([this.series(j.symbol, "M1"), this.series(j.symbol, "M5")]);
        const c1 = m1.status === "fulfilled" ? closedOnly(m1.value.candles, "M1", this.now) : [], c5 = m5.status === "fulfilled" ? closedOnly(m5.value.candles, "M5", this.now) : [];
        if (!c1.length && !c5.length) throw new Error("sem velas");
        const sig: SavedSignal = { id: j.id, symbol: j.symbol, label: j.label, at: j.openedAt, tf: "M5", dir: j.dir, strategy: j.strategy, entry: j.entry, sl: j.sl, tps: j.tps, score: j.score, reasons: [], pip: j.pip };
        res = resolveSignal(sig, c1.length && c1[0].t <= j.openedAt ? c1 : c5);
      } catch { res = null; }
      const stale = this.now - j.openedAt > STALE_OPEN_SEC;
      if (!res || res.status === "aberto") {
        if (stale && t.result === "OPEN") {
          cur = closeTrade(cur, t.id, "UNKNOWN", this.now);
          await this.saveDay(cur, { ...cur, version: cur.version - 1 });
          await this.store.putTrade({ ...j, status: "UNKNOWN" });
          await this.emit({ key: `${t.id}|SAUDE|unknown`, setupId: j.setupId, cls: "SAUDE", title: "Resultado desconhecido", text: `TRADE AGENT | ATENÇÃO\n\nNão consegui confirmar o resultado de ${j.label} (${j.dir}) depois de ${Math.round((this.now - j.openedAt) / 60)} min. Novas entradas ficam BLOQUEADAS até reconciliar.` });
        }
        continue;
      }
      const costR = (this.cfg.costPips * j.pip) / j.riskDist, r = Math.round(((res.r ?? 0) - costR) * 1000) / 1000;
      const win = res.status === "tp1" && r > 0; // só o Take 1 conta como vitória; stop, ambíguo e expirado contam como derrota para a meta 2x0
      const before = stateOf(cur);
      cur = closeTrade(cur, t.id, win ? "WIN" : "LOSS", this.now, { r });
      await this.saveDay(cur, { ...cur, version: cur.version - 1 });
      const done: JournalTrade = { ...j, status: win ? "WIN" : "LOSS", closedAt: res.closedAt ?? this.now, outcome: res.status as JournalTrade["outcome"], r, brl: cur.trades.find((x) => x.id === t.id)?.brl };
      await this.store.putTrade(done);
      this.closed.push(`${j.label} ${done.status}`);
      await this.emit({ key: `${t.id}|RESULTADO`, setupId: j.setupId, cls: "RESULTADO", title: `Resultado ${done.status}`, text: resultMsg(done, cur, this.now) });
      const after = stateOf(cur);
      if (after !== before && after === "TARGET_REACHED") await this.emit({ key: `${cur.date}|META`, setupId: "-", cls: "META", title: "Meta 2x0 alcançada", text: targetMsg(cur, this.now) });
      if (after !== before && after === "DAILY_LOCKED") await this.emit({ key: `${cur.date}|STOP`, setupId: "-", cls: "META", title: "Dia encerrado por LOSS", text: lockedMsg(cur, this.now) });
    }
    return cur;
  }

  // ---------------------------------------------------------------- varredura
  async analyzePair(id: string, events: CalEvent[] | null, history: PatternStat[]): Promise<ForexAnalysis> {
    const tfs: TF[] = ["H1", "M15", "M5", "M1"];
    const [h1, m15, m5, m1] = await Promise.allSettled(tfs.map((t) => this.series(id, t)));
    if (h1.status === "rejected") throw new Error(`H1: ${(h1.reason as Error).message}`);
    if (m5.status === "rejected") throw new Error(`M5: ${(m5.reason as Error).message}`);
    const ok = (r: PromiseSettledResult<RawSeries>, tf: TF) => (r.status === "fulfilled" ? closedOnly(r.value.candles, tf, this.now) : null);
    return analyze({
      symbol: id, label: FOREX_LABEL(id), pip: pipSize(id), currencies: currenciesOf(id), now: this.now, events: events as NewsEvent[] | null,
      candles: { H1: ok(h1, "H1")!, M5: ok(m5, "M5")!, M1: ok(m1, "M1"), M15: ok(m15, "M15") }, profile: profileOf(this.cfg), history,
      newsWindow: { before: this.cfg.news.beforeMin, after: this.cfg.news.afterMin },
    });
  }
}

const tradeFromAnalysis = (a: ForexAnalysis, o: Opportunity, now: number, day: string): JournalTrade => {
  const t = a.trade!;
  return {
    id: `${a.symbol}-${now}`, day, setupId: o.setupId!, symbol: a.symbol, label: a.label, dir: t.dir, strategy: a.chosen!.name, strategyId: a.chosen!.id, openedAt: now,
    entry: t.entry, sl: t.sl, tps: t.tps, rr: t.rr, riskDist: t.riskDist, pip: pipSize(a.symbol), score: a.score?.total ?? 0, status: "OPEN",
    thesis: a.thesis.lines.map((l) => `${l.label}: ${l.text}`), dataAgeSec: dataAgeSec(a, now) ?? undefined,
  };
};

export async function runTick(deps: TickDeps): Promise<TickResult> {
  const { store } = deps;
  const now = Math.floor((deps.now ?? Date.now)() / 1000);
  const today = brtDate(now);
  const base = (o: Partial<TickResult>): TickResult => ({ action: "idle", at: now, day: today, state: "READY", scanned: 0, failed: 0, opened: null, closed: [], alerts: 0, note: null, ...o });
  const t0 = Date.now();
  if (!(await store.acquireLease("tick", 240, now))) return base({ action: "busy", note: "Outra execução está em andamento." });
  let cfg: AgentConfig | null = null, hb: Partial<Heartbeat> = {}, result: TickResult = base({ action: "error" });
  const prevHb = await store.getKv<Heartbeat>("heartbeat");
  try {
    cfg = await store.getConfig();
    const tk = new Tick(deps, cfg, now);

    // 1. dia de risco (rolagem só sem operação pendente)
    const latest = await store.latestDay();
    const ro = rollover(latest, now);
    let day = ro.day;
    if (ro.rolled) {
      if (!(await store.putDay(day, null))) day = (await store.getDay(day.date)) ?? day;
    }
    if (ro.blockedByPending) tk.note = "Há operação pendente do dia anterior: o dia não foi reiniciado.";

    // 2. reconcilia operações abertas ou de resultado desconhecido (sempre, mesmo pausado ou fora do horário)
    const hadPending = hasPending(day);
    day = await tk.reconcile(day);
    const justClosed = hadPending && !hasPending(day);

    const open = marketOpen(now), win = inWindow(now, cfg), operational = isOperationalDay(now);
    const cal = await tk.calendar();
    hb = { marketOpen: open, paused: cfg.paused, lastDataAt: prevHb?.lastDataAt ?? null };

    // 3. notícias e relatórios (informativos; seguem mesmo com o dia travado)
    const armed = cfg.armedDay === today;
    if (open && operational && cfg.window.startMin <= brtMinutes(now) && brtMinutes(now) < cfg.window.endMin && !cfg.paused && armed) {
      const ups = upcoming(cal.events, now, cfg.enabledPairs, 24, 2);
      await tk.emit({ key: `${today}|ABERTURA`, setupId: "-", cls: "RELATORIO", title: "Relatório de abertura", text: openingMsg(day, ups, cfg.enabledPairs, now, cal.events !== null) });
      for (const e of cal.events ?? []) {
        if (e.impact < 3 || !cfg.enabledPairs.some((p) => p.includes(e.country))) continue;
        const item = classify(e, cfg.enabledPairs);
        if (e.at > now && e.at - now <= 30 * 60) await tk.emit({ key: `${e.at}|${e.country}|${e.title}|NOTICIA|pre`, setupId: "-", cls: "NOTICIA", title: `Notícia em breve: ${e.country} ${e.title}`, text: newsMsg(item, now) });
        if (e.at <= now - tk.cfg.news.afterMin * 60 && e.at > now - 3600) {
          const pair = cfg.enabledPairs.find((p) => p.includes(e.country));
          let extra = "";
          if (pair) { try { const m1 = await tk.series(pair, "M1"); const r = priceReaction(m1.candles, e.at, now, pipSize(pair)); extra = r ? `\nReação real em ${FOREX_LABEL(pair)}: ${r.text}` : ""; } catch { /* sem reação: segue só com o evento */ } }
          await tk.emit({ key: `${e.at}|${e.country}|${e.title}|NOTICIA|post`, setupId: "-", cls: "NOTICIA", title: `Notícia divulgada: ${e.country} ${e.title}`, text: newsMsg(item, now) + extra });
        }
      }
    }
    if (operational && day.date === today && brtMinutes(now) >= cfg.window.endMin && armed) {
      const scans = await store.listScans(today), trades = await store.listTrades({ day: today });
      const rep = buildDailyReport(day, trades, scans, await store.listAlerts(100), cfg.enabledPairs, now);
      if (await tk.emit({ key: `${today}|FECHAMENTO`, setupId: "-", cls: "RELATORIO", title: "Relatório de encerramento", text: rep.text })) await store.setKv(`report:${today}`, rep);
    }

    const gate = canOpen(day, now);
    const state = panel(day, now).state;
    const finish = async (action: TickResult["action"], extra: Partial<TickResult> = {}) => {
      result = base({ action, state, day: day.date, opened: tk.opened, closed: tk.closed, alerts: tk.alerts, note: tk.note, ...extra });
    };

    if (cfg.paused) { await finish("paused", { note: "Monitoramento PAUSADO pelo usuário." }); return result; }
    if (!open || !win || !operational) { await finish("idle", { note: !open ? "Mercado fechado." : !operational ? "Hoje não é dia operacional." : "Fora do horário operacional." }); return result; }
    if (!gate.ok || justClosed) { await finish("locked", { note: justClosed ? "Operação acabou de encerrar: nova busca só na próxima execução." : [tk.note, gate.reason].filter(Boolean).join(" ") }); return result; }

    if (!armed) { await finish("idle", { note: "Bot DESLIGADO hoje: ligue o bot no painel para começar as análises e operações." }); return result; }
    // 4. varredura de todos os pares habilitados
    const history = patternStats(await store.listTrades({ limit: 500 }));
    const pairs = cfg.enabledPairs.filter((p) => p in FOREX_YAHOO);
    const found: { a: ForexAnalysis; o: Opportunity }[] = [];
    let failed = 0, lastErr: string | null = null;
    for (let i = 0; i < pairs.length; i += CONCURRENCY) {
      await Promise.all(pairs.slice(i, i + CONCURRENCY).map(async (p) => {
        try { const a = await tk.analyzePair(p, cal.events, history); found.push({ a, o: classifyOpportunity(a, pipSize(p), cfg!.distantAtr) }); }
        catch (e) { failed++; lastErr = `${p}: ${(e as Error).message}`; }
      }));
    }
    if (found.length) hb.lastDataAt = now;

    // 5. entrada: a melhor CONFIRMADA que passar nas travas (uma só por execução)
    const confirmed = found.filter((f) => f.o.cls === "CONFIRMADA").sort((x, y) => rankKey(y.o) - rankKey(x.o));
    const discard = new Map<string, string>();
    let chosen: { a: ForexAnalysis; o: Opportunity } | null = null;
    for (const c of confirmed) {
      const age = dataAgeSec(c.a, now), maxAge = c.a.trigger?.source === "M1" ? 180 : 420;
      const ng = newsGate(cal.events, currenciesOf(c.a.symbol), now, cfg.news);
      const why = ng.blocked ? ng.reason! : age !== null && age > maxAge ? `Dados atrasados (${age}s; máximo ${maxAge}s).` : age === null ? "Idade dos dados desconhecida." : chosen ? "Outro setup de maior qualidade foi escolhido; só uma entrada por vez." : null;
      if (why) discard.set(c.o.setupId!, why); else if (!chosen) chosen = c;
    }
    if (chosen) {
      const { a, o } = chosen;
      try {
        const trade = tradeFromAnalysis(a, o, now, day.date);
        const next = openTrade(day, { id: trade.id, setupId: trade.setupId, symbol: trade.symbol, dir: trade.dir, openedAt: now }, now);
        await tk.saveDay(next, day); // o limite do dia é gravado ANTES de qualquer outra coisa
        await store.putTrade(trade);
        day = next; tk.opened = `${a.label} ${trade.dir}`;
        await tk.emit({ key: `${o.setupId}|CONFIRMADA|${day.date}`, setupId: o.setupId!, cls: "CONFIRMADA", title: `Entrada confirmada ${a.label}`, text: confirmedMsg(a, now) });
      } catch (e) {
        if (e instanceof RiskViolation) discard.set(o.setupId!, e.message); else throw e;
      }
    }

    // 6. alertas de radar (sem repetir o mesmo setup) e invalidações
    const active = (await store.getKv<Record<string, { cls: RadarClass; label: string; dir: "BUY" | "SELL" | null; strategy: string | null; invalidation: number | null; symbol: string }>>("radar:active")) ?? {};
    const next: typeof active = {};
    for (const { a, o } of found) {
      if (!o.cls || !o.setupId) continue;
      const k = `${o.setupId}|${o.cls}|${day.date}`;
      if (o.cls === "FORMACAO") await tk.emit({ key: k, setupId: o.setupId, cls: o.cls, title: `Setup em formação ${a.label}`, text: formingMsg(a, o, now) }, cfg.notify.forming);
      if (o.cls === "DISTANTE") await tk.emit({ key: k, setupId: o.setupId, cls: o.cls, title: `Próximo de região ${a.label}`, text: distantMsg(a, o, now) }, cfg.notify.distant);
      if (o.cls !== "DISTANTE" && !(o.cls === "CONFIRMADA" && tk.opened?.startsWith(a.label))) next[o.setupId] = { cls: o.cls, label: a.label, dir: o.dir, strategy: o.strategy, invalidation: o.invalidation, symbol: a.symbol };
    }
    for (const [id, prev] of Object.entries(active)) {
      if (next[id] || prev.cls === "DISTANTE") continue;
      const cur = found.find((f) => f.a.symbol === prev.symbol)?.a;
      const crossed = cur && prev.invalidation !== null && (prev.dir === "BUY" ? cur.price < prev.invalidation : cur.price > prev.invalidation);
      const reason = crossed ? `O preço perdeu o nível de invalidação (${prev.invalidation}). Cenário cancelado.` : `As condições do setup deixaram de existir${cur?.missing[0] ? ` (${cur.missing[0]})` : ""}. Cenário descartado.`;
      await tk.emit({ key: `${id}|INVALIDADO|${day.date}`, setupId: id, cls: "INVALIDADO", title: `Cenário invalidado ${prev.label}`, text: invalidatedMsg(prev.label, prev.dir, prev.strategy, reason) });
    }
    await store.setKv("radar:active", next);

    // 7. registro de tudo o que foi visto
    const scans: ScanRecord[] = found.map(({ a, o }) => ({
      at: now, day: day.date, symbol: a.symbol, label: a.label, decision: a.decision, state: a.state, cls: o.cls, score: a.score?.total ?? null, strategy: o.strategy, setupId: o.setupId,
      discard: o.setupId ? discard.get(o.setupId) ?? null : null, dataAgeSec: dataAgeSec(a, now),
    }));
    await store.logScans(scans);

    hb = { ...hb, pairsOk: found.length, pairsFailed: failed, lastError: lastErr };
    if (failed === pairs.length && pairs.length) {
      const hour = Math.floor(now / 3600);
      await tk.emit({ key: `saude|dados|${hour}`, setupId: "-", cls: "SAUDE", title: "Falha de dados", text: `TRADE AGENT | ATENÇÃO\n\nNão consegui buscar dados de nenhum par (${lastErr}). Sem dados confiáveis o agente não emite sinais. Ele tenta de novo na próxima execução.` });
    }
    await finish("scanned", { scanned: found.length, failed });
    return result;
  } catch (e) {
    result = base({ action: "error", note: (e as Error).message });
    hb = { ...hb, lastError: (e as Error).message };
    return result;
  } finally {
    const failedRun = result.action === "error" || (result.action === "scanned" && result.scanned === 0);
    const beat: Heartbeat = {
      at: now, ok: !failedRun, durationMs: Date.now() - t0, pairsOk: hb.pairsOk ?? 0, pairsFailed: hb.pairsFailed ?? 0, lastDataAt: hb.lastDataAt ?? prevHb?.lastDataAt ?? null,
      lastError: hb.lastError ?? (failedRun ? result.note : null), consecutiveFailures: failedRun ? (prevHb?.consecutiveFailures ?? 0) + 1 : 0,
      paused: cfg?.paused ?? false, marketOpen: hb.marketOpen ?? marketOpen(now), lastTickAction: result.action,
    };
    try { await store.setKv("heartbeat", beat); } catch { /* o batimento não pode derrubar a execução */ }
    try { await store.releaseLease("tick"); } catch { /* a trava expira sozinha em 4 min */ }
  }
}

// ---------------------------------------------------------------- estado para o painel
export interface AgentStatus {
  online: boolean; armed: boolean; reason: string; heartbeat: Heartbeat | null; marketOpen: boolean; config: AgentConfig;
  panel: ReturnType<typeof panel>; day: DayState; trades: JournalTrade[]; alerts: AlertRecord[]; radar: unknown[];
  news: ReturnType<typeof upcoming>; newsVerified: boolean; execution: "DESLIGADA"; mode: "ANALISTA AUTÔNOMO"; serverTime: number;
}
export async function agentStatus(store: Store, nowMs = Date.now()): Promise<AgentStatus> {
  const now = Math.floor(nowMs / 1000), cfg = await store.getConfig();
  const hb = await store.getKv<Heartbeat>("heartbeat"), latest = await store.latestDay(), day = rollover(latest, now).day;
  const limit = Math.max(15, 3 * cfg.intervalMin) * 60;
  const online = !!hb && now - hb.at <= limit && hb.consecutiveFailures < 3;
  const reason = !hb ? "Nenhuma execução registrada ainda: o agendador não chamou o agente." : now - hb.at > limit ? `Última execução há ${Math.round((now - hb.at) / 60)} min (limite ${limit / 60} min): agendador parado?` : hb.consecutiveFailures >= 3 ? `${hb.consecutiveFailures} execuções seguidas com falha: ${hb.lastError}` : cfg.paused ? "Online, monitoramento pausado." : cfg.armedDay !== brtDate(now) ? "Online, bot DESLIGADO hoje (ligue no painel para começar)." : "Online, bot LIGADO hoje.";
  const cache = await store.getKv<{ at: number; events: CalEvent[] }>("calendar:cache");
  const radar = Object.entries((await store.getKv<Record<string, unknown>>("radar:active")) ?? {}).map(([id, v]) => ({ id, ...(v as object) }));
  return {
    online, armed: cfg.armedDay === brtDate(now) && !cfg.paused, reason, heartbeat: hb, marketOpen: marketOpen(now), config: cfg, panel: panel(day, now), day,
    trades: await store.listTrades({ day: day.date }), alerts: await store.listAlerts(30), radar,
    news: cache ? upcoming(cache.events, now, cfg.enabledPairs, 24, 2) : [], newsVerified: !!cache && now - cache.at < CAL_USABLE_SEC,
    execution: "DESLIGADA", mode: "ANALISTA AUTÔNOMO", serverTime: now,
  };
}
void wins; void losses;
