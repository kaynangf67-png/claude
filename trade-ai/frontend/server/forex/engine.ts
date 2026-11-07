import { buildAnnotations, type Annotation, type Plan } from "./annotations.js";
import { assessQuality, type Quality } from "./candles.js";
import { buildConfluence, type Component, type PatternStat } from "./confluence.js";
import { DEFAULT_PROFILE, positionSize, STYLE_RULES, type Profile, type Sizing } from "./profile.js";
import { buildThesis, type Thesis } from "./thesis.js";
import { buildRegions, mergeRegions } from "./levels.js";
import { analyzeTF, type TFAnalysis } from "./mtf.js";
import { detectPatterns } from "./patterns.js";
import { computeRisk, type Risk } from "./risk.js";
import { confluence, moves, runDirectional, type Ctx, type StrategyResult } from "./strategies.js";
import { entryTrigger, type Trigger } from "./triggers.js";
import { HORIZON_TFS, opposite, type Candle, type Dir, type Horizon, type Region, type TF } from "./types.js";

/** ForexSignalEngine: reúne os módulos, aplica os 10 filtros, pontua a confluência e decide BUY / SELL / NO_TRADE. */

export interface NewsEvent { at: number; title: string; country: string; impact: number }
export interface EngineInput {
  symbol: string; label: string; pip: number; currencies: string[]; now: number;
  candles: { H1: Candle[]; M5: Candle[]; M1: Candle[] | null; M15?: Candle[] | null }; // só velas FECHADAS. H1 = regiões e contexto; M15 = contexto; M5 e M1 = movimento atual
  profile?: Profile;                // critérios do Trade Profile (padrão: equilibrado)
  history?: PatternStat[];          // resultados já resolvidos do usuário, para o componente Pattern History
  newsWindow?: { before: number; after: number }; // minutos de bloqueio ao redor de evento de alto impacto (padrão 15 antes e 30 depois)
  events: NewsEvent[] | null;       // null = calendário não verificado
  skipFreshness?: boolean;          // backtest
  /** curto (padrão): H1/M15/M5/M1. swing: as MESMAS posições recebem D1/H4/H1/M15 (contexto, estrutura, setup, gatilho). */
  horizon?: Horizon;
}

/** Nome do papel (como o motor fala internamente) → tempo gráfico real do swing. */
const ROLE_TO_SWING: Record<string, string> = { H1: "D1", M15: "H4", M5: "H1", M1: "M15" };
const SWING_TO_ROLE: Record<string, string> = { D1: "H1", H4: "M15", H1: "M5", M15: "M1" };
const relabelText = (s: string, map: Record<string, string>) => s.replace(/\b(D1|H4|H1|M15|M5|M1)\b/g, (m) => map[m] ?? m);
/** Swing: até 120 velas de H1 (5 dias de mercado), mesma regra do backtest. */
export const SWING_MAX_HOLD_MIN = 5 * 24 * 60;
const swingText = (s: string) => relabelText(s, ROLE_TO_SWING).replace(/operação curta/g, "swing");
/** Troca os rótulos de tempo gráfico em todos os textos do resultado (as chaves dos objetos não mudam). */
export function relabel<T>(v: T, map: Record<string, string> | ((s: string) => string)): T {
  if (typeof v === "string") return (typeof map === "function" ? map(v) : relabelText(v, map)) as T;
  if (Array.isArray(v)) return v.map((x) => relabel(x, map)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, relabel(x, map)])) as T;
  return v;
}

export type FilterStatus = "ok" | "falha" | "atencao" | "nao_verificado";
export interface Filter { id: number; name: string; status: FilterStatus; note: string }
export interface Score { total: number; raw?: number; label: string; parts: Record<string, { got: number; max: number }>; components: Component[]; capped: string[] }
export interface Release { dir: Dir; scenario: string; conditions: { ok: boolean; text: string }[] }

export interface ForexAnalysis {
  symbol: string; label: string; at: number; price: number;
  decision: "BUY" | "SELL" | "NO_TRADE";
  /** entrada_antecipada = modo Livre: entrada SEM todos os filtros confirmados (marcada como de risco maior). */
  state: "entrada_confirmada" | "entrada_antecipada" | "aguardando_confirmacao" | "sem_operacao";
  watch: { dir: Dir; condition: string } | null;
  data: { ok: boolean; issues: string[]; quality: Partial<Record<TF, Quality>> };
  trends: { M5: string; M1: string | null };
  tfs: { H1: TFAnalysis; M15: TFAnalysis | null; M5: TFAnalysis; M1: TFAnalysis | null };
  regions: Region[];
  liquidity: { price: number; kind: string; side: string }[];
  context: "consolidação" | "tendência" | "transição";
  strategies: { id: number; name: string; dir: Dir | null; status: "pronta" | "em_formacao" | "ausente" | "confluencia" | "confluencia_ausente" | "desabilitada"; detail: string[]; needs: string[] }[];
  chosen: { id: number; name: string; dir: Dir } | null;
  /** Cenário mais próximo de se completar (não é entrada ativa): o que já foi cumprido e o que falta. */
  closest: { name: string; dir: Dir; done: string[]; missing: string[]; stop: number | null; targetRegion: { low: number; high: number } | null } | null;
  /** O que falta, em lista de verificação, para o cenário mais próximo virar entrada (só quando não há entrada confirmada). */
  release: Release | null;
  /** Setup em foco (para identificar o mesmo setup entre análises): estratégia, direção e região operacional. */
  setup: { strategyId: number; dir: Dir; region: { low: number; high: number } | null; invalidation: number } | null;
  /** curto = minutos a ~1 hora; swing = pode durar dias (D1/H4/H1/M15). */
  horizon?: Horizon;
  plan: Plan | null; thesis: Thesis; annotations: Annotation[]; sizing: Sizing | null; profile: Profile;
  trigger: Trigger | null;
  trade: (Risk & { dir: Dir }) | null;
  filters: Filter[];
  score: Score | null;
  favor: string[]; contra: string[]; invalidation: string; missing: string[];
  context30: string;
}

const wantTrend = (d: Dir) => (d === "BUY" ? "alta" : "baixa");

function pips(v: number, pip: number) { return Math.round((v / pip) * 10) / 10; }

function context30(m5: Candle[], pip: number, swing = false): string {
  const s = m5.slice(-6);
  const span = swing ? "as últimas 6 horas" : "os últimos 30 minutos";
  if (s.length < 6) return `Poucas velas para descrever ${span}.`;
  const net = s[s.length - 1].c - s[0].o, up = s.filter((k) => k.c > k.o).length;
  const hi = Math.max(...s.map((k) => k.h)), lo = Math.min(...s.map((k) => k.l));
  const dirTxt = Math.abs(net) < 2 * pip ? "ficou praticamente lateral" : net > 0 ? `subiu ${pips(net, pip)} pips` : `caiu ${pips(-net, pip)} pips`;
  return `${swing ? "Nas últimas 6 horas" : "Nos últimos 30 minutos"} (6 velas M5) o preço ${dirTxt}: ${up} velas de alta e ${6 - up} de baixa, com máxima ${hi.toFixed(5)}, mínima ${lo.toFixed(5)} e amplitude de ${pips(hi - lo, pip)} pips.`;
}

/** Invalidação do swing: o ponto estrutural do H4 além da entrada (último fundo abaixo na compra, último topo acima na venda),
 * ou a invalidação do setup, se for mais distante. Sem H4, fica a do setup. */
export function swingRisk(dir: Dir, entry: number, setupInv: number, h4: TFAnalysis | null, _setupAtr: number): { invalidation: number } {
  if (!h4) return { invalidation: setupInv };
  const buy = dir === "BUY";
  const piv = h4.pivots.filter((p) => p.type === (buy ? "low" : "high") && (buy ? p.price < entry : p.price > entry)).at(-1);
  if (!piv) return { invalidation: setupInv };
  return { invalidation: buy ? Math.min(piv.price, setupInv) : Math.max(piv.price, setupInv) };
}

export function analyze(inp: EngineInput): ForexAnalysis {
  const out = analyzeRoles(inp);
  if ((inp.horizon ?? "curto") !== "swing") return { ...out, horizon: "curto" };
  const s = relabel(out, swingText);
  return { ...s, horizon: "swing", trade: s.trade && { ...s.trade, maxHoldMin: SWING_MAX_HOLD_MIN } };
}

function analyzeRoles(inp: EngineInput): ForexAnalysis {
  const { symbol, pip, now } = inp;
  const swing = inp.horizon === "swing", R = HORIZON_TFS[inp.horizon ?? "curto"];
  // qualidade e análise usam o tempo gráfico REAL; os textos saem com o nome do papel e são trocados no fim
  const toRole = (q: Quality): Quality => (swing ? { ...q, issues: q.issues.map((x) => relabelText(x, SWING_TO_ROLE)) } : q);
  const tfA = (c: Candle[], real: TF, role: TF): TFAnalysis => ({ ...analyzeTF(c, real), tf: role });
  const profile = inp.profile ?? DEFAULT_PROFILE, rules = STYLE_RULES[profile.style], history = inp.history ?? [];
  const minScore = rules.minScore;
  const f5 = (v: number) => v.toFixed(symbol.includes("JPY") ? 3 : 5);
  const quality: Partial<Record<TF, Quality>> = {
    H1: toRole(assessQuality(inp.candles.H1, R.ctx, now, !inp.skipFreshness)),
    M5: toRole(assessQuality(inp.candles.M5, R.setup, now, !inp.skipFreshness)),
  };
  if (inp.candles.M1) quality.M1 = toRole(assessQuality(inp.candles.M1, R.trigger, now, !inp.skipFreshness));
  const issues = Object.values(quality).flatMap((q) => q?.issues ?? []);
  // sem M1 válido, o gatilho usa o M5 (isso não bloqueia, mas é informado)
  const m1Ok = !!inp.candles.M1 && !!quality.M1?.ok;
  const useM1 = m1Ok && profile.entryTf === "M1"; // o perfil pode mandar avaliar o gatilho só no M5
  const baseOk = !!(quality.H1?.ok && quality.M5?.ok);

  const a1 = inp.candles.M1 && inp.candles.M1.length >= 30 ? tfA(inp.candles.M1, R.trigger, "M1") : null;
  const a15 = inp.candles.M15 && inp.candles.M15.length >= 60 ? tfA(inp.candles.M15, R.struct, "M15") : null;
  const a = { H1: tfA(inp.candles.H1, R.ctx, "H1"), M5: tfA(inp.candles.M5, R.setup, "M5"), M1: a1 };
  // ATR que mede stop e alvo: setup no day trade; H4 no swing (sem H4, aproxima por 2x o ATR do H1)
  const riskAtr = swing ? (a15 && a15.atr > 0 ? a15.atr : 2 * a.M5.atr) : a.M5.atr;
  const aAll = { ...a, M15: a15 };
  const price = a.M5.lastClose;
  const regions = mergeRegions([buildRegions(inp.candles.H1, "H1", price, a.H1.atr, pip)], price, pip);
  const m5 = inp.candles.M5.slice(-400);
  const inContext = regions.some((r) => r.distance <= a.M5.atr) || Math.abs(price - a.M5.ema.e20) <= 0.6 * a.M5.atr;
  const patterns = detectPatterns(m5, { atr: a.M5.atr, inRegion: inContext });
  const ctx: Ctx = { price, pip, a, regions, m5, patterns };

  const consolid = a.M5.trend === "lateral" && a.M5.ema.stack === "misto" && (!a1 || a1.trend === "lateral");
  const transicao = !consolid && a.M5.struct.choch !== null;
  const context: ForexAnalysis["context"] = consolid ? "consolidação" : transicao ? "transição" : "tendência";

  // candidatos
  const allRaw: (StrategyResult)[] = [...runDirectional(ctx, "BUY"), ...runDirectional(ctx, "SELL")];
  const all = allRaw.filter((x) => profile.strategies.includes(x.id));
  type Cand = { s: StrategyResult; trig: Trigger; risk: Risk; score: Score; filters: Filter[]; pass: boolean; hardFail: string[] };
  const cands: Cand[] = [];
  // no modo Livre também entram estratégias parcialmente formadas (60% das condições ou mais)
  for (const s of all.filter((x) => x.ready || (rules.relaxed && x.total > 0 && x.met / x.total >= 0.6))) {
    const dir = s.dir, conf = confluence(ctx, dir);
    // contra o movimento atual do M5: só reversão/varredura em região forte de H1 com CHoCH ou sweep
    const bothAgainst = a.M5.trend === wantTrend(opposite(dir)) || a.M5.ema.stack === wantTrend(opposite(dir));
    const justified = (s.id === 2 || s.id === 4) && (s.region?.strength === "forte" || s.id === 4) && (a.M5.struct.choch === dir || a.M5.sweep?.dir === dir);
    let trig = entryTrigger(useM1 ? inp.candles.M1! : m5, dir, useM1 ? "M1" : "M5", useM1 && a1 ? a1.atr : a.M5.atr);
    if (rules.requireM1 && !useM1) trig = { ...trig, confirmed: false, detail: `Perfil conservador exige gatilho no M1, e o M1 está indisponível. ${trig.detail}` };
    const setupInv = s.invalidation ?? (dir === "BUY" ? Math.min(...m5.slice(-10).map((k) => k.l)) : Math.max(...m5.slice(-10).map((k) => k.h)));
    const entry = useM1 ? inp.candles.M1![inp.candles.M1!.length - 1].c : price;
    // SWING: stop pela estrutura do H4 (último fundo/topo do H4 além da entrada) e alvos nos topos/fundos do H4 + regiões do D1.
    // DAY TRADE: stop pela estrutura do setup (M5) e alvos nos topos/fundos do M5 + regiões do H1.
    const sw = swing ? swingRisk(dir, entry, setupInv, a15, a.M5.atr) : null;
    const invalidation = sw ? sw.invalidation : setupInv;
    const swings = (sw ? a15!.pivots : a.M5.pivots).filter((p) => p.type === (dir === "BUY" ? "high" : "low")).slice(-8).map((p) => p.price);
    const risk = computeRisk(dir, entry, { invalidation, regions, extraTargets: swings, atr: riskAtr, pip, minRR: profile.minRR, atrTf: swing ? "M15" : "M5" });
    // movimento já percorrido
    const start = s.region ? (dir === "BUY" ? s.region.high : s.region.low) : invalidation;
    const tp1 = risk.tps[0];
    const traveled = tp1 !== null && tp1 !== undefined && Math.abs(tp1 - start) > 0 ? Math.abs(entry - start) / Math.abs(tp1 - start) : 0;
    const exhausted = traveled > 0.6;

    const filters = buildFilters({ dir, s, a, ctx, trig, risk, exhausted, traveled, bothAgainst, justified, context, baseOk, issues, events: inp.events, currencies: inp.currencies, now, m1Ok, blockUnverifiedNews: rules.blockUnverifiedNews, newsWindow: inp.newsWindow });
    const sc = buildConfluence({ dir, price, pip, now, symbol, currencies: inp.currencies, a: aAll, regions, strategy: s, risk, filters, profile, history, fvgAligned: !!conf.fvg });
    const hard = filters.filter((f) => f.status === "falha" && f.id !== 4).map((f) => `${f.name}: ${f.note}`);
    const pass = filters.every((f) => f.status !== "falha") && sc.total >= minScore;
    cands.push({ s, trig, risk, score: sc, filters, pass, hardFail: hard });
  }
  cands.sort((x, y) => Number(y.pass) - Number(x.pass) || y.score.total - x.score.total);
  const best = cands[0] ?? null;

  // só mostra cenário coerente com o movimento atual do M5 (reversões 2 e 4 podem ser contra, pois partem de uma região)
  const partial = all.filter((x) => x.met >= 2 && x.met < x.total && (x.id === 2 || x.id === 4 || moves(ctx, x.dir))).sort((x, y) => y.met / y.total - x.met / x.total)[0];
  const nearAny = regions.find((r) => r.distance <= 15 * a.M5.atr);

  const regionAhead = (d: Dir) => regions.filter((r) => r.role === (d === "BUY" ? "resistencia" : "suporte")).sort((x, y) => x.distance - y.distance)[0] ?? null;
  const mkClosest = (s2: StrategyResult, extra: string[]): ForexAnalysis["closest"] => {
    const reg = regionAhead(s2.dir);
    return { name: s2.name, dir: s2.dir, done: s2.favor, missing: [...s2.needs, ...extra], stop: s2.invalidation, targetRegion: reg ? { low: reg.low, high: reg.high } : null };
  };
  const closest: ForexAnalysis["closest"] = best
    ? mkClosest(best.s, [...best.filters.filter((x) => x.id !== 4 && x.status === "falha").map((x) => `${x.name}: ${x.note}`), ...(best.trig.confirmed ? [] : [best.trig.level !== null && (useM1 || !rules.requireM1) ? `Gatilho ${best.trig.source}: fechar vela ${best.s.dir === "BUY" ? "acima" : "abaixo"} de ${f5(best.trig.level)} (rompimento da microestrutura) ou engolfo/rejeição a favor` : best.trig.detail]), ...(best.score.total < minScore ? [`Confluência ${best.score.total} (mínimo ${minScore} do perfil ${profile.style} para liberar a entrada)`] : [])])
    : partial ? mkClosest(partial, []) : null;

  // estratégias para exibição
  const strategies: ForexAnalysis["strategies"] = [];
  for (const id of [1, 2, 3, 4, 5, 9]) {
    const rs = allRaw.filter((x) => x.id === id).sort((x, y) => Number(y.ready) - Number(x.ready) || y.met / y.total - x.met / x.total);
    const r = rs[0];
    const on = profile.strategies.includes(id);
    strategies.push({ id, name: r.name, dir: on && (r.ready || r.met > 0) ? r.dir : null, status: !on ? "desabilitada" : r.ready ? "pronta" : r.met > 0 ? "em_formacao" : "ausente", detail: on ? r.favor : ["Desabilitada no Trade Profile."], needs: on ? r.needs : [] });
  }
  const dirForConf: Dir = best ? best.s.dir : a.M5.trend === "baixa" || (a.M5.trend !== "alta" && a.M5.ema.stack === "baixa") ? "SELL" : "BUY";
  const cf = confluence(ctx, dirForConf);
  strategies.push({ id: 6, name: "EMAs 9/20/50/200", dir: cf.emaAligned ? dirForConf : null, status: cf.emaAligned ? "confluencia" : "confluencia_ausente", detail: [cf.emaText], needs: [] });
  strategies.push({ id: 7, name: "FVG e imbalance", dir: cf.fvg ? dirForConf : null, status: cf.fvg ? "confluencia" : "confluencia_ausente", detail: [cf.fvgText], needs: [] });
  strategies.push({ id: 8, name: "Padrões de candle", dir: cf.patterns.length ? dirForConf : null, status: cf.patterns.length ? "confluencia" : "confluencia_ausente", detail: [cf.patternText], needs: [] });

  const base = {
    symbol, label: inp.label, at: now, price,
    data: { ok: baseOk, issues, quality },
    trends: { M5: a.M5.trend, M1: a1 ? a1.trend : null },
    tfs: { ...a, M15: a15, M1: a1 }, regions,
    liquidity: [...a.H1.liquidity, ...a.M5.liquidity].map((l) => ({ price: l.price, kind: l.kind, side: l.side })),
    context, strategies, context30: context30(m5, pip, swing), closest,
  };
  const noData = !baseOk;
  const missingBase = noData ? ["Dados atualizados e completos (bloqueio por qualidade dos dados)."] : [];

  type Core = Pick<ForexAnalysis, "decision" | "state" | "watch" | "chosen" | "trigger" | "trade" | "filters" | "score" | "favor" | "contra" | "invalidation" | "missing">;
  /** Acrescenta tese, plano, anotações do gráfico, lista de liberação e tamanho de posição, sempre a partir dos mesmos números do motor. */
  const finish = (core: Core): ForexAnalysis => {
    const dir = core.chosen?.dir ?? null;
    const plan: Plan | null = best && best.risk.ok && core.state !== "sem_operacao"
      ? { status: core.state === "entrada_confirmada" ? "confirmado" : core.state === "entrada_antecipada" ? "antecipado" : "condicional", dir: best.s.dir, entry: best.risk.entry, sl: best.risk.sl, tps: best.risk.tps, rr: best.risk.rr,
          entryZone: best.s.region ? { low: best.s.region.low, high: best.s.region.high } : null }
      : null;
    const fvgAligned = dir ? !!confluence(ctx, dir).fvg : false;
    const thesis = buildThesis({ symbol, dir, state: core.state, a: aAll, regions, strategyName: core.chosen?.name ?? null, strategyId: core.chosen?.id ?? null, fvgAligned,
      trigger: core.trigger, plan, invalidation: core.invalidation, missing: core.missing, price });
    const release: Release | null = core.state !== "entrada_confirmada" && closest
      ? { dir: closest.dir, scenario: closest.name, conditions: [...closest.done.map((text) => ({ ok: true, text })), ...closest.missing.map((text) => ({ ok: false, text }))] }
      : null;
    const setup: ForexAnalysis["setup"] = best ? { strategyId: best.s.id, dir: best.s.dir, region: best.s.region ? { low: best.s.region.low, high: best.s.region.high } : null, invalidation: best.risk.invalidation } : null;
    return { ...base, ...core, release, plan, thesis, profile, setup,
      annotations: noData ? [] : buildAnnotations({ m5: inp.candles.M5, m5a: a.M5, regions, plan }),
      sizing: (core.state === "entrada_confirmada" || core.state === "entrada_antecipada") && core.trade ? positionSize(profile, symbol, price, core.trade.riskPips) : null };
  };

  if (noData) {
    return finish({ decision: "NO_TRADE", state: "sem_operacao", watch: null, chosen: null, trigger: null, trade: null, filters: dataOnlyFilters(issues, inp.events, inp.currencies, now, rules.blockUnverifiedNews, inp.newsWindow), score: null,
      favor: [], contra: issues, invalidation: "—", missing: missingBase });
  }
  if (best) {
    const dir = best.s.dir;
    const verb = dir === "BUY" ? "compra" : "venda";
    const f = best.filters;
    const nonTrigger = f.filter((x) => x.id !== 4 && x.status === "falha");
    if (best.pass && best.trig.confirmed) {
      const conf = confluence(ctx, dir);
      return finish({ decision: dir, state: "entrada_confirmada", watch: null, chosen: { id: best.s.id, name: best.s.name, dir }, trigger: best.trig,
        trade: { ...best.risk, dir }, filters: f, score: best.score,
        favor: [...best.s.favor, ...(conf.emaAligned ? [conf.emaText] : []), ...(conf.fvg ? [conf.fvgText] : []), best.trig.detail], contra: best.s.against.concat(best.risk.notes, f.filter((x) => x.status === "atencao").map((x) => `${x.name}: ${x.note}`)),
        invalidation: invalidationText(dir, best.risk.invalidation, symbol), missing: [] });
    }
    // modo Livre: entrada antecipada com o melhor candidato que tenha stop e alvo, sem exigir todos os filtros
    if (rules.relaxed) {
      const hard = (c: (typeof cands)[number]) => c.filters.some((x) => (x.id === 10 || x.id === 9) && x.status === "falha");
      const ok = cands.filter((c) => !hard(c) && c.risk.tps[0] !== null && (c.risk.rr[0] ?? 0) >= profile.minRR && (c.score.raw ?? c.score.total) >= minScore && c.risk.riskDist <= 4 * riskAtr)
        .sort((x, y) => (y.score.raw ?? y.score.total) - (x.score.raw ?? x.score.total));
      const e = ok[0];
      if (e) {
        const d2 = e.s.dir, fails = e.filters.filter((x) => x.status === "falha");
        const missingTxt = fails.map((x) => `${x.name}: ${x.note}`).concat(e.s.ready ? [] : e.s.needs.map((n) => `Estratégia incompleta: ${n}`));
        const trade = { ...e.risk, ok: true, dir: d2 };
        return finish({ decision: d2, state: "entrada_antecipada", watch: null, chosen: { id: e.s.id, name: `${e.s.name} (antecipada)`, dir: d2 }, trigger: e.trig,
          trade, filters: e.filters, score: { ...e.score, total: e.score.raw ?? e.score.total, label: `ENTRADA ANTECIPADA — ${fails.length} filtro(s) sem confirmação` },
          favor: e.s.favor, contra: [`Entrada ANTECIPADA (modo Livre): não passou em todos os filtros. Risco de erro maior.`, ...missingTxt, ...e.risk.notes],
          invalidation: invalidationText(d2, e.risk.invalidation, symbol), missing: missingTxt });
      }
    }
    if (nonTrigger.length === 0 && best.score.total >= minScore - 10) {
      const lvl = best.trig.level;
      return finish({ decision: "NO_TRADE", state: "aguardando_confirmacao", watch: { dir, condition: `Aguardar gatilho de ${verb} no ${best.trig.source}: fechamento de vela ${dir === "BUY" ? "acima" : "abaixo"} de ${lvl !== null ? f5(lvl) : f5(best.risk.entry)} (rompimento da microestrutura) ou engolfo/rejeição a favor, e então reavaliar com dados novos.` },
        chosen: { id: best.s.id, name: best.s.name, dir }, trigger: best.trig, trade: null, filters: f, score: best.score,
        favor: best.s.favor, contra: best.s.against.concat(["Gatilho de entrada ainda não confirmado."]), invalidation: invalidationText(dir, best.risk.invalidation, symbol),
        missing: [best.trig.detail, ...(best.score.total < minScore ? [`Confluência ${best.score.total} (mínimo ${minScore} do perfil ${profile.style}).`] : [])] });
    }
    return finish({ decision: "NO_TRADE", state: "sem_operacao", watch: null, chosen: { id: best.s.id, name: best.s.name, dir }, trigger: best.trig, trade: null, filters: f, score: best.score,
      favor: best.s.favor, contra: [...best.s.against, ...nonTrigger.map((x) => `${x.name}: ${x.note}`)], invalidation: invalidationText(dir, best.risk.invalidation, symbol),
      missing: nonTrigger.map((x) => `${x.name}: ${x.note}`).concat(best.score.total < minScore ? [`Confluência ${best.score.total} (mínimo ${minScore}).`] : []) });
  }
  // nenhuma estratégia pronta: procura o cenário mais próximo para "próxima oportunidade"
  const filters = dataOnlyFilters(issues, inp.events, inp.currencies, now, rules.blockUnverifiedNews, inp.newsWindow);
  let watch: ForexAnalysis["watch"] = null;
  if (partial && nearAny) watch = { dir: partial.dir, condition: `Faltam: ${partial.needs.join("; ")}.` };
  return finish({ decision: "NO_TRADE", state: "sem_operacao", watch, chosen: null, trigger: null, trade: null, filters, score: null,
    favor: partial ? partial.favor : [], contra: [context === "consolidação" ? "Mercado em consolidação sem direção." : "Nenhuma estratégia com as condições completas."],
    invalidation: "—", missing: partial ? partial.needs : ["Setup em região relevante com rejeição e confirmação."] });
}

function invalidationText(dir: Dir, level: number, symbol: string) {
  const f = symbol.includes("JPY") ? 3 : 5;
  return dir === "BUY" ? `Fechamento do M5 abaixo de ${level.toFixed(f)} invalida a compra.` : `Fechamento do M5 acima de ${level.toFixed(f)} invalida a venda.`;
}

function newsFilter(events: NewsEvent[] | null, currencies: string[], now: number, block = false, win = { before: 15, after: 30 }): Filter {
  if (!events) return { id: 9, name: "Notícias", status: block ? "falha" : "nao_verificado", note: block ? "Calendário econômico indisponível: o perfil conservador não opera sem verificar notícias." : "Calendário econômico indisponível: filtro de notícias NÃO foi verificado." };
  const hit = events.find((e) => e.impact === 3 && currencies.includes(e.country) && e.at >= now - win.after * 60 && e.at <= now + win.before * 60);
  return hit ? { id: 9, name: "Notícias", status: "falha", note: `Evento de alto impacto (${hit.country} ${hit.title}) próximo.` } : { id: 9, name: "Notícias", status: "ok", note: `Sem evento de alto impacto das moedas do par entre -${win.before} e +${win.after} minutos.` };
}

function dataOnlyFilters(issues: string[], events: NewsEvent[] | null, currencies: string[], now: number, block = false, win?: { before: number; after: number }): Filter[] {
  return [
    { id: 10, name: "Qualidade dos dados", status: issues.length ? "falha" : "ok", note: issues.length ? issues.join(" | ") : "Velas atualizadas, completas e sem duplicatas." },
    newsFilter(events, currencies, now, block, win),
  ];
}

interface FArgs { dir: Dir; s: StrategyResult; a: { H1: TFAnalysis; M5: TFAnalysis; M1: TFAnalysis | null }; ctx: Ctx; trig: Trigger; risk: Risk; exhausted: boolean; traveled: number; bothAgainst: boolean; justified: boolean; context: ForexAnalysis["context"]; baseOk: boolean; issues: string[]; events: NewsEvent[] | null; currencies: string[]; now: number; m1Ok: boolean; blockUnverifiedNews: boolean; newsWindow?: { before: number; after: number } }

function buildFilters(x: FArgs): Filter[] {
  const o = wantTrend(opposite(x.dir));
  const { a } = x;
  const f: Filter[] = [];
  const hasMove = a.M5.trend !== "lateral" || a.M5.ema.stack !== "misto";
  f.push({ id: 1, name: "Tendência (M5)", status: hasMove ? "ok" : "falha", note: `M5 ${a.M5.trend}, EMAs ${a.M5.ema.stack === "misto" ? "sem alinhamento" : "alinhadas p/ " + a.M5.ema.stack}${a.M1 ? `; M1 ${a.M1.trend}` : "; M1 indisponível"}.` });
  const reg = x.s.region ?? nearRegionAny(x.ctx, x.dir);
  f.push({ id: 2, name: "Localização", status: reg || Math.abs(x.ctx.price - a.M5.ema.e20) <= 0.8 * a.M5.atr ? "ok" : "falha", note: reg ? `Preço em/perto de ${reg.role} ${reg.strength} (${reg.origin}, ${reg.reactions} reações).` : "Preço longe de região relevante e da EMA 20." });
  const structOk = a.M5.struct.bos === x.dir || a.M5.struct.choch === x.dir || (x.dir === "BUY" ? a.M5.struct.higherLows : a.M5.struct.lowerHighs) || x.s.id === 3 || x.s.id === 9;
  f.push({ id: 3, name: "Estrutura", status: structOk ? "ok" : "falha", note: structOk ? "Há topos/fundos, BOS ou CHoCH a favor." : "Sem topos/fundos, BOS ou CHoCH a favor." });
  f.push({ id: 4, name: "Candle / gatilho", status: x.trig.confirmed ? "ok" : "falha", note: x.trig.detail });
  const against5 = a.M5.trend === o || a.M5.ema.stack === o, against1 = !!a.M1 && a.M1.trend === o;
  const conflict = against5 || against1;
  f.push({ id: 5, name: "Alinhamento M5/M1", status: conflict && !x.justified ? "falha" : "ok",
    note: conflict ? (x.justified ? "M5/M1 contra a direção, com reversão justificada em região forte de H1." : `${against5 ? "M5" : "M1"} se move contra a direção, sem justificativa estrutural.`) : a.M1 ? `M5 ${a.M5.trend} e M1 ${a.M1.trend}: sem conflito com a direção.` : "M1 indisponível: só o M5 foi comparado." });
  const r = a.M5.atrRatio;
  f.push({ id: 6, name: "Volatilidade", status: r >= 0.45 && r <= 2.2 ? "ok" : "falha", note: `ATR M5 ${(a.M5.atr / x.ctx.pip).toFixed(1)} pips (${r.toFixed(2)}x a mediana).` });
  const exh = x.exhausted ? ` Preço já percorreu ${Math.round(x.traveled * 100)}% do caminho até o alvo.` : "";
  f.push({ id: 7, name: "Risco e retorno", status: x.risk.ok && !x.exhausted ? "ok" : "falha", note: (x.risk.ok ? `R:R ao TP1 de ${(x.risk.rr[0] ?? 0).toFixed(2)}.` : x.risk.notes.join(" ")) + exh });
  const mid = x.context === "consolidação";
  f.push({ id: 8, name: "Contexto", status: mid && (x.s.id === 1 || x.s.id === 9) ? "falha" : "ok", note: `Mercado em ${x.context}.` });
  f.push(newsFilter(x.events, x.currencies, x.now, x.blockUnverifiedNews, x.newsWindow));
  f.push({ id: 10, name: "Qualidade dos dados", status: x.baseOk ? "ok" : "falha", note: x.baseOk ? `Velas atualizadas e completas${x.m1Ok ? "" : "; M1 indisponível, gatilho confirmado pelo M5"}.` : x.issues.join(" | ") });
  return f.sort((p, q) => p.id - q.id);
}

function nearRegionAny(ctx: Ctx, dir: Dir): Region | null {
  const role = dir === "BUY" ? "suporte" : "resistencia";
  return ctx.regions.find((r) => r.role === role && r.distance <= 6 * ctx.a.M5.atr) ?? null;
}
