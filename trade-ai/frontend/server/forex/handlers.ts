import { fetchCalendar } from "../calendar.js";
import { backtestNote, swingBacktestNote } from "./notes.js";
import { runBacktest } from "./backtest.js";
import { closedOnly } from "./candles.js";
import { analyze, type ForexAnalysis, type NewsEvent } from "./engine.js";
import { computeStats, resolveSignal, summarizeHistory, type HistItem, type SavedSignal } from "./history.js";
import type { PatternStat } from "./confluence.js";
import { sanitizeProfile } from "./profile.js";
import { currenciesOf, fetchSeries, FOREX_LABEL, FOREX_YAHOO, type RawSeries } from "./marketData.js";
import { narrate } from "./narrative.js";
import { backtestCandle, candleEntryNow, costPipsOf, CS_RANGE, CS_RULES, isCsTf, type CsBacktest, type CsTf } from "./candleStrategies.js";
import { buildSeries } from "../binary/engine.js";
import { newsAlertFor } from "../newsAlert.js";
import { HORIZON_TFS, isSetupTf, pipSize, SETUP_TFS, TF_SECONDS, type Horizon, type Roles, type SetupTf, type TF } from "./types.js";

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
  let body: { asset?: unknown; explain?: unknown; profile?: unknown; history?: unknown; horizon?: unknown; tf?: unknown; entry?: unknown };
  try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const id = typeof body.asset === "string" ? body.asset : "";
  if (!FOREX_YAHOO[id]) return json({ error: "Par de Forex desconhecido" }, 400);
  // tf = tempo gráfico escolhido (M1, M5, M15, H1, H4): define os quatro papéis e o horizonte. Sem tf, vale o horizonte.
  // tf = "auto": a IA analisa todos os tempos do horizonte e recomenda o de setup mais forte AGORA.
  const auto = body.tf === "auto";
  const pick = isSetupTf(body.tf) ? SETUP_TFS[body.tf] : null;
  const horizon: Horizon = pick ? pick.horizon : body.horizon === "swing" ? "swing" : "curto";
  const roleSets: Roles[] = auto
    ? AUTO_TFS[horizon].map((t) => { const x = SETUP_TFS[t]; return { ctx: x.ctx, struct: x.struct, setup: x.setup, trigger: x.trigger }; })
    : [pick ? { ctx: pick.ctx, struct: pick.struct, setup: pick.setup, trigger: pick.trigger } : HORIZON_TFS[horizon]];
  const profile = sanitizeProfile(body.profile);
  if (!profile.pairs.includes(id)) return json({ error: `${FOREX_LABEL(id)} não está nos pares monitorados do seu Trade Profile. Inclua o par no perfil para analisá-lo.` }, 400);
  const history: PatternStat[] = (Array.isArray(body.history) ? body.history : []).slice(0, 200).filter((h): h is PatternStat => !!h && typeof h.strategy === "string" && typeof h.symbol === "string" && Number.isFinite(h.n) && Number.isFinite(h.sumR) && h.n >= 0);
  const now = Math.floor((deps.now ?? Date.now)() / 1000);
  const get = deps.series ?? fetchSeries;
  // busca cada tempo gráfico uma vez só, mesmo quando vários papéis ou vários tempos candidatos o usam
  const uniq = [...new Set(roleSets.flatMap((R) => [R.ctx, R.setup, R.trigger, R.struct]))];
  const got = await Promise.allSettled(uniq.map((t) => get(id, t)));
  const series = (t: TF) => got[uniq.indexOf(t)];
  const closed = (t: TF) => { const r = series(t); return r.status === "fulfilled" ? closedOnly(r.value.candles, t, now) : null; };
  let events: NewsEvent[] | null = null;
  try { events = await (deps.calendar ?? fetchCalendar)(); } catch { events = null; }
  const pip = pipSize(id);
  const wantEntry = body.entry === true;
  // gerar entrada: notícia de 2+ estrelas NÃO bloqueia no motor; vira alerta e o usuário decide (newsAlert)
  const newsAlert = newsAlertFor(currenciesOf(id), events, now);
  if (wantEntry && events) events = events.filter((e) => e.impact < 2);

  const runs: { R: Roles; analysis: ForexAnalysis }[] = [];
  let firstError: string | null = null;
  for (const R of roleSets) {
    const bad = [R.ctx, R.setup].find((t) => series(t).status === "rejected");
    if (bad) { firstError ??= `Não consegui buscar as velas ${bad}: ${((series(bad) as PromiseRejectedResult).reason as Error).message}`; continue; }
    runs.push({ R, analysis: analyze({
      symbol: id, label: FOREX_LABEL(id), pip, currencies: currenciesOf(id), now, events,
      candles: { H1: closed(R.ctx)!, M5: closed(R.setup)!, M1: closed(R.trigger), M15: closed(R.struct) },
      profile, history, horizon, roles: R,
    }) });
  }
  if (!runs.length) return json({ error: firstError ?? "Sem dados." }, 502);
  const ranked = [...runs].sort((x, y) => setupStrength(y.analysis) - setupStrength(x.analysis));
  const R = ranked[0].R;
  let analysis = ranked[0].analysis;
  // entry:true (botão "gerar entrada" do app): sempre devolve direção, entrada, stop e alvo quando há dados válidos.
  // 1º a entrada confirmada; 2º a antecipada (perfil Livre, sem todos os filtros); 3º um plano pela leitura do gráfico (baixa convicção).
  const hasEntry = (a: ForexAnalysis) => !!a.trade && (a.state === "entrada_confirmada" || a.state === "entrada_antecipada");
  if (wantEntry && analysis.data.ok && !hasEntry(analysis)) {
    const a2 = analyze({
      symbol: id, label: FOREX_LABEL(id), pip, currencies: currenciesOf(id), now, events,
      candles: { H1: closed(R.ctx)!, M5: closed(R.setup)!, M1: closed(R.trigger), M15: closed(R.struct) },
      profile: sanitizeProfile({ ...profile, style: "livre", minRR: 1 }), history, horizon, roles: R,
    });
    if (hasEntry(a2)) analysis = a2;
  }
  const suggested = wantEntry && analysis.data.ok && !hasEntry(analysis) ? suggestEntry(analysis, pip, R.setup) : null;
  const autoPick = auto ? {
    tf: R.setup,
    reason: autoReason(analysis, ranked.length),
    ranking: ranked.map((x) => ({ tf: x.R.setup, decision: x.analysis.decision, state: x.analysis.state, score: x.analysis.score?.total ?? null,
      rr: x.analysis.trade?.rr[0] ?? null, dataOk: x.analysis.data.ok })),
  } : null;
  // estratégias de vela (as 7 das operações rápidas) no tempo da entrada: só geram entrada as VALIDADAS no histórico deste par e tempo
  const candle = wantEntry && isCsTf(R.setup) ? await candleLayer(id, R.setup, get, now).catch((e) => ({ error: (e as Error).message.slice(0, 160) })) : null;
  const view = { ...toView(analysis, pip, closed(R.setup)!), horizon, roleTf: R, autoPick, suggested, candle, newsAlert };
  let narrative = null as Awaited<ReturnType<typeof narrate>> | null, narrativeError: string | null = null;
  const wantsExplain = body.explain !== false && (analysis.decision !== "NO_TRADE" || analysis.state === "aguardando_confirmacao");
  if (wantsExplain && (deps.narrate || process.env.ANTHROPIC_API_KEY)) {
    try { narrative = await (deps.narrate ?? narrate)(view); } catch (e) { narrativeError = (e as Error).message.slice(0, 200); }
  }
  return json({ ...view, narrative, narrativeError, m1Used: view.tfs.M1 !== null });
}

/** Tempos que a IA compara no modo automático. */
export const AUTO_TFS: Record<Horizon, SetupTf[]> = { curto: ["M1", "M5", "M15", "M30"], swing: ["H1", "H4"] };

/** Força do setup AGORA, para escolher o tempo: estado (entrada > antecipada > aguardando > nada), dados válidos, confluência e R:R.
 * Não é chance de acerto: só ordena qual tempo tem o cenário mais completo neste momento. */
export function setupStrength(a: ForexAnalysis): number {
  const st = { entrada_confirmada: 4, entrada_antecipada: 3, aguardando_confirmacao: 2, sem_operacao: 1 }[a.state];
  return (a.data.ok ? 10_000 : 0) + st * 1_000 + (a.score?.total ?? 0) * 5 + Math.min(5, a.trade?.rr[0] ?? 0);
}

function autoReason(a: ForexAnalysis, n: number): string {
  if (!a.data.ok) return `Nenhum dos ${n} tempos tem dados atualizados (mercado fechado ou dados atrasados).`;
  if (a.state === "entrada_confirmada") return `Único ou melhor tempo com entrada confirmada${a.score ? ` (confluência ${a.score.total})` : ""}.`;
  if (a.state === "entrada_antecipada") return "Melhor cenário encontrado é uma entrada antecipada (sem todos os filtros).";
  if (a.state === "aguardando_confirmacao") return `Nenhum tempo tem entrada confirmada; este é o cenário mais perto de liberar${a.score ? ` (confluência ${a.score.total})` : ""}.`;
  return `Nenhum dos ${n} tempos tem setup agora; mostrando o de leitura mais completa.`;
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
  const get = deps.series ?? fetchSeries;
  if (url.searchParams.get("mode") === "candle") {
    const tf = url.searchParams.get("tf") ?? "H1";
    if (!isCsTf(tf)) return json({ error: "Tempo inválido (M1, M5, M15, M30, H1 ou H4)" }, 400);
    const ids = id === "ALL" ? Object.keys(FOREX_YAHOO) : [id];
    if (ids.some((x) => !FOREX_YAHOO[x])) return json({ error: "Par de Forex desconhecido" }, 400);
    const now = Math.floor((deps.now ?? Date.now)() / 1000);
    const out = await Promise.allSettled(ids.map(async (x) => ({ symbol: x, ...(await candleLayer(x, tf, get, now)) })));
    return json({ tf, rules: CS_RULES, pairs: out.map((r, i) => (r.status === "fulfilled" ? r.value : { symbol: ids[i], error: (r.reason as Error).message.slice(0, 160) })) });
  }
  if (!FOREX_YAHOO[id]) return json({ error: "Par de Forex desconhecido" }, 400);
  const horizon: Horizon = url.searchParams.get("horizon") === "swing" ? "swing" : "curto";
  const R = HORIZON_TFS[horizon];
  // swing: 1 ano de H1 (o Yahoo limita o 60m a ~2 anos) e 2 anos de D1 para o contexto
  const [h1, m5] = await Promise.allSettled([get(id, R.ctx), horizon === "swing" ? get(id, R.setup, "1y") : get(id, R.setup)]);
  for (const [i, r] of [h1, m5].entries()) if (r.status === "rejected") return json({ error: `Não consegui buscar as velas ${[R.ctx, R.setup][i]}: ${(r.reason as Error).message}` }, 502);
  const now = Math.floor((deps.now ?? Date.now)() / 1000);
  const ok = (r: PromiseSettledResult<RawSeries>, tf: TF) => closedOnly((r as PromiseFulfilledResult<RawSeries>).value.candles, tf, now);
  const c5 = ok(m5, R.setup);
  const result = runBacktest(c5, ok(h1, R.ctx), {
    horizon,
    pip: pipSize(id), label: FOREX_LABEL(id), symbol: id, currencies: currenciesOf(id),
    profile: sanitizeProfile({ style: url.searchParams.get("style") ?? undefined }),
    spreadPips: Number(url.searchParams.get("spread") ?? 1.0), slipPips: Number(url.searchParams.get("slip") ?? 0.2), stride: Number(url.searchParams.get("stride") ?? 3),
  });
  const first = c5[0]?.t ?? 0, last = c5.at(-1)?.t ?? 0;
  return json({ symbol: id, label: FOREX_LABEL(id), period: { from: brt(first), to: brt(last), days: Math.round((last - first) / 86400), candlesM5: c5.length, candlesSetup: c5.length, tfSeconds: TF_SECONDS[R.setup] }, horizon, ...result, note: horizon === "swing" ? swingBacktestNote : backtestNote });
}

/** Backtest das estratégias de vela por par e tempo; guardado 6 h na memória da função (o histórico longo muda pouco). */
const csCache = new Map<string, { at: number; bt: CsBacktest }>();
export async function candleBacktest(id: string, tf: CsTf, get: NonNullable<Deps["series"]> | typeof fetchSeries, now: number) {
  const key = `${id}|${tf}`, hit = csCache.get(key);
  const raw = await (get as typeof fetchSeries)(id, tf, CS_RANGE[tf]);
  const c = closedOnly(raw.candles, tf, now);
  if (hit && now - hit.at < 6 * 3600) return { c, bt: hit.bt };
  const bt = backtestCandle(c, pipSize(id), costPipsOf(id));
  csCache.set(key, { at: now, bt });
  return { c, bt };
}

export async function candleLayer(id: string, tf: CsTf, get: NonNullable<Deps["series"]> | typeof fetchSeries, now: number) {
  const { c, bt } = await candleBacktest(id, tf, get, now);
  const pip = pipSize(id), d = id.includes("JPY") ? 3 : 5, f = (v: number) => Number(v.toFixed(d));
  const price = c.at(-1)?.c ?? 0;
  const now_ = candleEntryNow(c, pip, bt, price, buildSeries(c));
  const ageMin = c.length ? Math.round((now - c.at(-1)!.t) / 60) : null;
  return {
    tf, price: f(price), lastCandleBrt: c.length ? brt(c.at(-1)!.t) : null, ageMin,
    period: { from: bt.from ? brt(bt.from) : null, to: bt.to ? brt(bt.to) : null, days: bt.from && bt.to ? Math.round((bt.to - bt.from) / 86400) : 0, candles: bt.candles },
    costPips: bt.costPips, rules: CS_RULES,
    entry: now_.entry && { ...now_.entry, entry: f(now_.entry.entry), sl: f(now_.entry.sl), tp: f(now_.entry.tp), riskPips: Math.round(now_.entry.riskPips * 10) / 10, riskAtr: Math.round(now_.entry.riskAtr * 100) / 100 },
    candidate: now_.candidate && { ...now_.candidate, entry: f(now_.candidate.entry), sl: f(now_.candidate.sl), tp: f(now_.candidate.tp), riskPips: Math.round(now_.candidate.riskPips * 10) / 10, riskAtr: Math.round(now_.candidate.riskAtr * 100) / 100 },
    signals: now_.signals.map((x) => ({ strategy: x.strategy, label: x.label, dir: x.dir, validated: x.validated })),
    strategies: Object.values(bt.results).map((r) => ({ strategy: r.strategy, label: r.label, validated: r.validated, reason: r.reason,
      n: r.all.n, winRate: r.all.winRate, expR: r.all.expR, pf: r.all.pf, devExpR: r.development.expR, valExpR: r.validation.expR, valN: r.validation.n })),
  };
}

export interface Suggested { dir: "BUY" | "SELL"; entry: number; sl: number; tps: number[]; rr: number[]; riskPips: number; basis: string[] }
/** Plano de BAIXA CONVICÇÃO quando nenhuma estratégia confirmou: direção pela tendência do setup, stop além do último
 * fundo/topo (entre 1 e 3 ATR) e alvos em 1,5R e 2,5R. Não passou pelos filtros nem pelo backtest: é só a leitura do momento. */
export function suggestEntry(a: ForexAnalysis, pip: number, setupTf: string): Suggested | null {
  const t = a.tfs.M5, atr = t.atr, price = a.price;
  if (!(atr > 0) || !(price > 0)) return null;
  const basis: string[] = [];
  let dir: "BUY" | "SELL";
  if (t.trend === "alta" || t.trend === "baixa") { dir = t.trend === "alta" ? "BUY" : "SELL"; basis.push(`Tendência de ${t.trend} no ${setupTf} (topos e fundos).`); }
  else if (t.ema.stack === "alta" || t.ema.stack === "baixa") { dir = t.ema.stack === "alta" ? "BUY" : "SELL"; basis.push(`Médias alinhadas para ${t.ema.stack} no ${setupTf}.`); }
  else { dir = price >= t.ema.e20 ? "BUY" : "SELL"; basis.push(`${setupTf} lateral: direção só pelo preço ${dir === "BUY" ? "acima" : "abaixo"} da média de 20 (sinal fraco).`); }
  const buy = dir === "BUY";
  const piv = t.pivots.filter((p) => p.type === (buy ? "low" : "high") && (buy ? p.price < price : p.price > price)).at(-1);
  let dist = piv ? Math.abs(price - piv.price) + 0.5 * atr : 1.5 * atr;
  const raw = dist; dist = Math.min(3 * atr, Math.max(1 * atr, dist));
  basis.push(piv && raw === dist ? `Stop além do último ${buy ? "fundo" : "topo"} do ${setupTf}, com margem de 0,5 ATR.` : `Stop a ${(dist / atr).toFixed(1)} ATR do ${setupTf} (${piv ? "o ponto estrutural ficava fora da faixa de 1 a 3 ATR" : "sem fundo/topo próximo"}).`);
  basis.push("Alvos fixos em 1,5R e 2,5R (não são alvos estruturais).");
  const r = (v: number) => Math.round(v / (pip / 10)) * (pip / 10);
  const sl = r(buy ? price - dist : price + dist);
  const tps = [1.5, 2.5].map((k) => r(buy ? price + k * dist : price - k * dist));
  return { dir, entry: r(price), sl, tps, rr: [1.5, 2.5], riskPips: Math.round((dist / pip) * 10) / 10, basis };
}
