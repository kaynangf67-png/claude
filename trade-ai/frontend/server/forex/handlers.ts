import { fetchCalendar } from "../calendar.js";
import { backtestNote } from "./notes.js";
import { runBacktest } from "./backtest.js";
import { closedOnly } from "./candles.js";
import { analyze, type ForexAnalysis, type NewsEvent } from "./engine.js";
import { computeStats, resolveSignal, summarizeHistory, type HistItem, type SavedSignal } from "./history.js";
import type { PatternStat } from "./confluence.js";
import { sanitizeProfile } from "./profile.js";
import { currenciesOf, fetchSeries, FOREX_LABEL, FOREX_YAHOO, type RawSeries } from "./marketData.js";
import { narrate } from "./narrative.js";
import { pipSize, TF_SECONDS, type TF } from "./types.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const brt = (t: number) => new Date(t * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export interface Deps {
  series?: (id: string, tf: TF) => Promise<RawSeries>;
  calendar?: () => Promise<NewsEvent[]>;
  narrate?: typeof narrate;
  now?: () => number;
}

/** Resumo enxuto para o navegador (sem os arrays de pivôs). */
export function toView(a: ForexAnalysis, pip: number, m5?: { t: number; o: number; h: number; l: number; c: number }[]) {
  const f = (v: number) => Number(v.toFixed(a.symbol.includes("JPY") ? 3 : 5));
  const tf = (x: NonNullable<ForexAnalysis["tfs"]["M1"]>) => ({
    trend: x.trend, rsi: x.rsi === null ? null : Math.round(x.rsi * 10) / 10, rsiDiv: x.rsiDiv, atrPips: Math.round((x.atr / pip) * 10) / 10,
    ema: { e9: f(x.ema.e9), e20: f(x.ema.e20), e50: f(x.ema.e50), e200: x.ema.e200 === null ? null : f(x.ema.e200), stack: x.ema.stack },
    bos: x.struct.bos, choch: x.struct.choch, lastHigh: x.struct.lastHigh ? f(x.struct.lastHigh.price) : null, lastLow: x.struct.lastLow ? f(x.struct.lastLow.price) : null,
    lta: x.lines.lta ? { value: f(x.lines.lta.valueNow), touches: x.lines.lta.touches, broken: x.lines.lta.broken, retested: x.lines.lta.retested } : null,
    ltb: x.lines.ltb ? { value: f(x.lines.ltb.valueNow), touches: x.lines.ltb.touches, broken: x.lines.ltb.broken, retested: x.lines.ltb.retested } : null,
    sweep: x.sweep ? { dir: x.sweep.dir, level: f(x.sweep.level) } : null,
    fvgs: x.fvgs.slice(-3).map((g) => ({ dir: g.dir, low: f(g.low), high: f(g.high), status: g.status })),
  });
  const trade = a.trade && { dir: a.trade.dir, entry: f(a.trade.entry), sl: f(a.trade.sl), tps: a.trade.tps.map((p) => (p === null ? null : f(p))), rr: a.trade.rr.map((r) => (r === null ? null : Math.round(r * 100) / 100)), maxHoldMin: a.trade.maxHoldMin, targetAtr: a.trade.targetAtr === null ? null : Math.round(a.trade.targetAtr * 10) / 10, riskPips: Math.round(a.trade.riskPips * 10) / 10, atrPips: Math.round(a.trade.atrPips * 10) / 10, notes: a.trade.notes };
  return {
    symbol: a.symbol, label: a.label, at: a.at, atBrt: brt(a.at), price: f(a.price), pip,
    decision: a.decision, state: a.state, watch: a.watch, chosen: a.chosen,
    data: { ok: a.data.ok, issues: a.data.issues, lastCandles: Object.fromEntries(Object.entries(a.data.quality).map(([k, q]) => [k, q?.lastClosedAt ? brt(q.lastClosedAt) : null])) },
    trends: a.trends, context: a.context, context30: a.context30,
    tfs: { H1: tf(a.tfs.H1), M15: a.tfs.M15 ? tf(a.tfs.M15) : null, M5: tf(a.tfs.M5), M1: a.tfs.M1 ? tf(a.tfs.M1) : null },
    profile: a.profile,
    release: a.release,
    sizing: a.sizing,
    thesis: a.thesis,
    plan: a.plan && { status: a.plan.status, dir: a.plan.dir, entry: f(a.plan.entry), sl: f(a.plan.sl), tps: a.plan.tps.map((p) => (p === null ? null : f(p))), rr: a.plan.rr.map((r) => (r === null ? null : Math.round(r * 100) / 100)) },
    chart: {
      candles: (m5 ?? []).slice(-96).map((k) => ({ t: k.t, o: f(k.o), h: f(k.h), l: f(k.l), c: f(k.c) })),
      annotations: a.annotations.map((n) => ({ ...n, price: n.price === undefined ? undefined : f(n.price), low: n.low === undefined ? undefined : f(n.low), high: n.high === undefined ? undefined : f(n.high), p1: n.p1 === undefined ? undefined : f(n.p1), p2: n.p2 === undefined ? undefined : f(n.p2) })),
    },
    regions: a.regions.slice(0, 8).map((r) => ({ role: r.role, strength: r.strength, low: f(r.low), high: f(r.high), reactions: r.reactions, origin: r.origin, distancePips: Math.round(r.distancePips * 10) / 10, intensity: r.intensity })),
    liquidity: a.liquidity.slice(0, 6).map((l) => ({ ...l, price: f(l.price) })),
    closest: a.closest && { ...a.closest, stop: a.closest.stop === null ? null : f(a.closest.stop), targetRegion: a.closest.targetRegion && { low: f(a.closest.targetRegion.low), high: f(a.closest.targetRegion.high) } },
    strategies: a.strategies, trigger: a.trigger, trade, filters: a.filters, score: a.score,
    favor: a.favor, contra: a.contra, invalidation: a.invalidation, missing: a.missing,
    sourceNote: "Velas do Yahoo Finance (gratuito, pode atrasar). O gráfico exibido é do TradingView/FXCM e os preços podem divergir em alguns pips.",
  };
}

export async function handleForexAnalyze(request: Request, deps: Deps = {}): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  let body: { asset?: unknown; explain?: unknown; profile?: unknown; history?: unknown };
  try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const id = typeof body.asset === "string" ? body.asset : "";
  if (!FOREX_YAHOO[id]) return json({ error: "Par de Forex desconhecido" }, 400);
  const profile = sanitizeProfile(body.profile);
  if (!profile.pairs.includes(id)) return json({ error: `${FOREX_LABEL(id)} não está nos pares monitorados do seu Trade Profile. Inclua o par no perfil para analisá-lo.` }, 400);
  const history: PatternStat[] = (Array.isArray(body.history) ? body.history : []).slice(0, 200).filter((h): h is PatternStat => !!h && typeof h.strategy === "string" && typeof h.symbol === "string" && Number.isFinite(h.n) && Number.isFinite(h.sumR) && h.n >= 0);
  const now = Math.floor((deps.now ?? Date.now)() / 1000);
  const get = deps.series ?? fetchSeries;
  const tfs: TF[] = ["H1", "M5", "M1", "M15"]; // H1 e M15 = contexto e regiões; M5 e M1 = movimento atual
  const res = await Promise.allSettled(tfs.map((t) => get(id, t)));
  const [h1, m5, m1, m15] = res;
  for (const [i, r] of [h1, m5].entries()) if (r.status === "rejected") return json({ error: `Não consegui buscar as velas ${tfs[i === 0 ? 0 : 1]}: ${(r.reason as Error).message}` }, 502);
  const closed = (r: PromiseSettledResult<RawSeries>, tf: TF) => (r.status === "fulfilled" ? closedOnly(r.value.candles, tf, now) : null);
  let events: NewsEvent[] | null = null;
  try { events = await (deps.calendar ?? fetchCalendar)(); } catch { events = null; }
  const pip = pipSize(id);
  const analysis = analyze({
    symbol: id, label: FOREX_LABEL(id), pip, currencies: currenciesOf(id), now, events,
    candles: { H1: closed(h1, "H1")!, M5: closed(m5, "M5")!, M1: closed(m1, "M1"), M15: closed(m15, "M15") },
    profile, history,
  });
  const view = toView(analysis, pip, closed(m5, "M5")!);
  let narrative = null as Awaited<ReturnType<typeof narrate>> | null, narrativeError: string | null = null;
  const wantsExplain = body.explain !== false && (analysis.decision !== "NO_TRADE" || analysis.state === "aguardando_confirmacao");
  if (wantsExplain && (deps.narrate || process.env.ANTHROPIC_API_KEY)) {
    try { narrative = await (deps.narrate ?? narrate)(view); } catch (e) { narrativeError = (e as Error).message.slice(0, 200); }
  }
  return json({ ...view, narrative, narrativeError, m1Used: view.tfs.M1 !== null });
}

export async function handleForexResolve(request: Request, deps: Deps = {}): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  let body: { signals?: SavedSignal[]; items?: HistItem[] };
  try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 400).filter((i) => i && typeof i.id === "string" && typeof i.symbol === "string");
  const sigs = (Array.isArray(body.signals) ? body.signals : items.filter((i) => i.dir) as unknown as SavedSignal[]).slice(0, 100).filter((s) => s && FOREX_YAHOO[s.symbol] && (s.dir === "BUY" || s.dir === "SELL") && Number.isFinite(s.entry) && Number.isFinite(s.sl) && Array.isArray(s.tps));
  const get = deps.series ?? fetchSeries;
  const symbols = [...new Set(sigs.map((s) => s.symbol))];
  const data = new Map<string, { m1: RawSeries["candles"]; m5: RawSeries["candles"] }>();
  await Promise.all(symbols.map(async (sy) => {
    const [a, b] = await Promise.allSettled([get(sy, "M1"), get(sy, "M5")]);
    data.set(sy, { m1: a.status === "fulfilled" ? a.value.candles : [], m5: b.status === "fulfilled" ? b.value.candles : [] });
  }));
  const resolved = sigs.map((s) => {
    const d = data.get(s.symbol)!;
    // prefere M1 (sequência real mais fina); se o sinal for mais antigo que o M1 disponível, usa M5
    const useM1 = d.m1.length > 0 && d.m1[0].t <= s.at;
    return resolveSignal(s, useM1 ? d.m1 : d.m5);
  });
  return json({ resolved, stats: computeStats(resolved), summary: summarizeHistory(items, resolved) });
}

export async function handleForexBacktest(request: Request, deps: Deps = {}): Promise<Response> {
  const url = new URL(request.url);
  const id = (url.searchParams.get("symbol") ?? "EURUSD").toUpperCase();
  if (!FOREX_YAHOO[id]) return json({ error: "Par de Forex desconhecido" }, 400);
  const get = deps.series ?? fetchSeries;
  const [h1, m5] = await Promise.allSettled([get(id, "H1"), get(id, "M5")]);
  for (const [i, r] of [h1, m5].entries()) if (r.status === "rejected") return json({ error: `Não consegui buscar as velas ${["H1", "M5"][i]}: ${(r.reason as Error).message}` }, 502);
  const now = Math.floor((deps.now ?? Date.now)() / 1000);
  const ok = (r: PromiseSettledResult<RawSeries>, tf: TF) => closedOnly((r as PromiseFulfilledResult<RawSeries>).value.candles, tf, now);
  const c5 = ok(m5, "M5");
  const result = runBacktest(c5, ok(h1, "H1"), {
    pip: pipSize(id), label: FOREX_LABEL(id), symbol: id, currencies: currenciesOf(id),
    profile: sanitizeProfile({ style: url.searchParams.get("style") ?? undefined }),
    spreadPips: Number(url.searchParams.get("spread") ?? 1.0), slipPips: Number(url.searchParams.get("slip") ?? 0.2), stride: Number(url.searchParams.get("stride") ?? 3),
  });
  const first = c5[0]?.t ?? 0, last = c5.at(-1)?.t ?? 0;
  return json({ symbol: id, label: FOREX_LABEL(id), period: { from: brt(first), to: brt(last), days: Math.round((last - first) / 86400), candlesM5: c5.length, tfSeconds: TF_SECONDS.M5 }, ...result, note: backtestNote });
}
