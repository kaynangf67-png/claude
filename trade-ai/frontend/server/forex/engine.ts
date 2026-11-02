import { assessQuality, type Quality } from "./candles.js";
import { buildRegions, mergeRegions } from "./levels.js";
import { analyzeTF, type TFAnalysis } from "./mtf.js";
import { detectPatterns } from "./patterns.js";
import { computeRisk, type Risk } from "./risk.js";
import { confluence, runDirectional, type Ctx, type StrategyResult } from "./strategies.js";
import { entryTrigger, type Trigger } from "./triggers.js";
import { opposite, type Candle, type Dir, type Region, type TF } from "./types.js";

/** ForexSignalEngine: reúne os módulos, aplica os 10 filtros, pontua a confluência e decide BUY / SELL / NO_TRADE. */

export interface NewsEvent { at: number; title: string; country: string; impact: number }
export interface EngineInput {
  symbol: string; label: string; pip: number; currencies: string[]; now: number;
  candles: { H1: Candle[]; M15: Candle[]; M5: Candle[]; M1: Candle[] | null }; // só velas FECHADAS
  events: NewsEvent[] | null;       // null = calendário não verificado
  skipFreshness?: boolean;          // backtest
}

export type FilterStatus = "ok" | "falha" | "atencao" | "nao_verificado";
export interface Filter { id: number; name: string; status: FilterStatus; note: string }
export interface Score { total: number; label: string; parts: Record<string, { got: number; max: number }> }

export interface ForexAnalysis {
  symbol: string; label: string; at: number; price: number;
  decision: "BUY" | "SELL" | "NO_TRADE";
  state: "entrada_confirmada" | "aguardando_confirmacao" | "sem_operacao";
  watch: { dir: Dir; condition: string } | null;
  data: { ok: boolean; issues: string[]; quality: Partial<Record<TF, Quality>> };
  trends: { H1: string; M15: string; M5: string };
  tfs: { H1: TFAnalysis; M15: TFAnalysis; M5: TFAnalysis; M1: TFAnalysis | null };
  regions: Region[];
  liquidity: { price: number; kind: string; side: string }[];
  context: "consolidação" | "tendência" | "transição";
  strategies: { id: number; name: string; dir: Dir | null; status: "pronta" | "em_formacao" | "ausente" | "confluencia" | "confluencia_ausente"; detail: string[]; needs: string[] }[];
  chosen: { id: number; name: string; dir: Dir } | null;
  trigger: Trigger | null;
  trade: (Risk & { dir: Dir }) | null;
  filters: Filter[];
  score: Score | null;
  favor: string[]; contra: string[]; invalidation: string; missing: string[];
  context30: string;
}

const scoreLabel = (t: number) => t >= 85 ? "SETUP DE ALTA CONFLUÊNCIA" : t >= 75 ? "SETUP BOM — POSSÍVEL ENTRADA APÓS CONFIRMAÇÃO" : t >= 65 ? "CENÁRIO EM FORMAÇÃO — AGUARDAR CONFIRMAÇÃO" : t >= 50 ? "CENÁRIO FRACO — AGUARDAR" : "NÃO OPERAR";
const wantTrend = (d: Dir) => (d === "BUY" ? "alta" : "baixa");

function pips(v: number, pip: number) { return Math.round((v / pip) * 10) / 10; }

function context30(m5: Candle[], pip: number): string {
  const s = m5.slice(-6);
  if (s.length < 6) return "Poucas velas para descrever os últimos 30 minutos.";
  const net = s[s.length - 1].c - s[0].o, up = s.filter((k) => k.c > k.o).length;
  const hi = Math.max(...s.map((k) => k.h)), lo = Math.min(...s.map((k) => k.l));
  const dirTxt = Math.abs(net) < 2 * pip ? "ficou praticamente lateral" : net > 0 ? `subiu ${pips(net, pip)} pips` : `caiu ${pips(-net, pip)} pips`;
  return `Nos últimos 30 minutos (6 velas M5) o preço ${dirTxt}: ${up} velas de alta e ${6 - up} de baixa, com máxima ${hi.toFixed(5)}, mínima ${lo.toFixed(5)} e amplitude de ${pips(hi - lo, pip)} pips.`;
}

export function analyze(inp: EngineInput): ForexAnalysis {
  const { symbol, pip, now } = inp;
  const quality: Partial<Record<TF, Quality>> = {
    H1: assessQuality(inp.candles.H1, "H1", now, !inp.skipFreshness), M15: assessQuality(inp.candles.M15, "M15", now, !inp.skipFreshness),
    M5: assessQuality(inp.candles.M5, "M5", now, !inp.skipFreshness),
  };
  if (inp.candles.M1) quality.M1 = assessQuality(inp.candles.M1, "M1", now, !inp.skipFreshness);
  const issues = Object.values(quality).flatMap((q) => q?.issues ?? []);
  // sem M1 válido, o gatilho usa o M5 (isso não bloqueia, mas é informado)
  const m1Ok = !!inp.candles.M1 && !!quality.M1?.ok;
  const baseOk = !!(quality.H1?.ok && quality.M15?.ok && quality.M5?.ok);

  const a = { H1: analyzeTF(inp.candles.H1, "H1"), M15: analyzeTF(inp.candles.M15, "M15"), M5: analyzeTF(inp.candles.M5, "M5") };
  const a1 = inp.candles.M1 && inp.candles.M1.length >= 30 ? analyzeTF(inp.candles.M1, "M1") : null;
  const price = a.M5.lastClose;
  const regions = mergeRegions([buildRegions(inp.candles.H1, "H1", price, a.H1.atr, pip), buildRegions(inp.candles.M15, "M15", price, a.M15.atr, pip)], price, pip);
  const m5 = inp.candles.M5.slice(-400), m15 = inp.candles.M15.slice(-400);
  const inContext = regions.some((r) => r.distance <= a.M5.atr) || Math.abs(price - a.M5.ema.e20) <= 0.6 * a.M5.atr;
  const patterns = detectPatterns(m5, { atr: a.M5.atr, inRegion: inContext });
  const ctx: Ctx = { price, pip, a, regions, m5, m15, patterns };

  const consolid = a.M15.trend === "lateral" && a.M5.trend === "lateral";
  const transicao = !consolid && (a.M5.struct.choch !== null || a.M15.struct.choch !== null || (a.H1.trend !== "lateral" && a.M15.trend !== "lateral" && a.H1.trend !== a.M15.trend));
  const context: ForexAnalysis["context"] = consolid ? "consolidação" : transicao ? "transição" : "tendência";

  // candidatos
  const all: (StrategyResult)[] = [...runDirectional(ctx, "BUY"), ...runDirectional(ctx, "SELL")];
  type Cand = { s: StrategyResult; trig: Trigger; risk: Risk; score: Score; filters: Filter[]; pass: boolean; hardFail: string[] };
  const cands: Cand[] = [];
  for (const s of all.filter((x) => x.ready)) {
    const dir = s.dir, conf = confluence(ctx, dir);
    // contra estrutura maior (H1 e M15 contrários): só reversão/varredura em região forte com CHoCH ou sweep
    const bothAgainst = a.H1.trend === wantTrend(opposite(dir)) && a.M15.trend === wantTrend(opposite(dir));
    const justified = (s.id === 2 || s.id === 4) && (s.region?.strength === "forte" || s.id === 4) && (a.M5.struct.choch === dir || [a.M5.sweep, a.M15.sweep].some((w) => w?.dir === dir));
    const trig = entryTrigger(m1Ok ? inp.candles.M1! : m5, dir, m1Ok ? "M1" : "M5", m1Ok && a1 ? a1.atr : a.M5.atr);
    const invalidation = s.invalidation ?? (dir === "BUY" ? Math.min(...m5.slice(-10).map((k) => k.l)) : Math.max(...m5.slice(-10).map((k) => k.h)));
    const entry = m1Ok ? inp.candles.M1![inp.candles.M1!.length - 1].c : price;
    const extra = [...a.M15.pivots.filter((p) => p.type === (dir === "BUY" ? "high" : "low")).slice(-6).map((p) => p.price)];
    const risk = computeRisk(dir, entry, { invalidation, regions, extraTargets: extra, atr: a.M5.atr, pip });
    // movimento já percorrido
    const start = s.region ? (dir === "BUY" ? s.region.high : s.region.low) : invalidation;
    const tp1 = risk.tps[0];
    const traveled = tp1 !== null && tp1 !== undefined && Math.abs(tp1 - start) > 0 ? Math.abs(entry - start) / Math.abs(tp1 - start) : 0;
    const exhausted = traveled > 0.6;

    const sc = scoreIt(dir, s, ctx, trig, risk, conf, regions);
    const filters = buildFilters({ dir, s, a, ctx, trig, risk, exhausted, traveled, bothAgainst, justified, context, baseOk, issues, events: inp.events, currencies: inp.currencies, now, m1Ok });
    const hard = filters.filter((f) => f.status === "falha" && f.id !== 4).map((f) => `${f.name}: ${f.note}`);
    const pass = filters.every((f) => f.status !== "falha") && sc.total >= 75;
    cands.push({ s, trig, risk, score: sc, filters, pass, hardFail: hard });
  }
  cands.sort((x, y) => Number(y.pass) - Number(x.pass) || y.score.total - x.score.total);
  const best = cands[0] ?? null;

  // estratégias para exibição
  const strategies: ForexAnalysis["strategies"] = [];
  for (const id of [1, 2, 3, 4, 5]) {
    const rs = all.filter((x) => x.id === id).sort((x, y) => Number(y.ready) - Number(x.ready) || y.met / y.total - x.met / x.total);
    const r = rs[0];
    strategies.push({ id, name: r.name, dir: r.ready || r.met > 0 ? r.dir : null, status: r.ready ? "pronta" : r.met > 0 ? "em_formacao" : "ausente", detail: r.favor, needs: r.needs });
  }
  const dirForConf: Dir = best ? best.s.dir : (a.M15.trend === "baixa" || a.M5.trend === "baixa") && !(a.M15.trend === "alta") ? "SELL" : "BUY";
  const cf = confluence(ctx, dirForConf);
  strategies.push({ id: 6, name: "EMAs 9/20/50/200", dir: cf.emaAligned ? dirForConf : null, status: cf.emaAligned ? "confluencia" : "confluencia_ausente", detail: [cf.emaText], needs: [] });
  strategies.push({ id: 7, name: "FVG e imbalance", dir: cf.fvg ? dirForConf : null, status: cf.fvg ? "confluencia" : "confluencia_ausente", detail: [cf.fvgText], needs: [] });
  strategies.push({ id: 8, name: "Padrões de candle", dir: cf.patterns.length ? dirForConf : null, status: cf.patterns.length ? "confluencia" : "confluencia_ausente", detail: [cf.patternText], needs: [] });

  const base = {
    symbol, label: inp.label, at: now, price,
    data: { ok: baseOk, issues, quality },
    trends: { H1: a.H1.trend, M15: a.M15.trend, M5: a.M5.trend },
    tfs: { ...a, M1: a1 }, regions,
    liquidity: [...a.H1.liquidity, ...a.M15.liquidity, ...a.M5.liquidity].map((l) => ({ price: l.price, kind: l.kind, side: l.side })),
    context, strategies, context30: context30(m5, pip),
  };
  const noData = !baseOk;
  const missingBase = noData ? ["Dados atualizados e completos (bloqueio por qualidade dos dados)."] : [];

  if (noData) {
    return { ...base, decision: "NO_TRADE", state: "sem_operacao", watch: null, chosen: null, trigger: null, trade: null, filters: dataOnlyFilters(issues, inp.events, inp.currencies, now), score: null,
      favor: [], contra: issues, invalidation: "—", missing: missingBase };
  }
  if (best) {
    const dir = best.s.dir;
    const verb = dir === "BUY" ? "compra" : "venda";
    const f = best.filters;
    const nonTrigger = f.filter((x) => x.id !== 4 && x.status === "falha");
    if (best.pass && best.trig.confirmed) {
      const conf = confluence(ctx, dir);
      return { ...base, decision: dir, state: "entrada_confirmada", watch: null, chosen: { id: best.s.id, name: best.s.name, dir }, trigger: best.trig,
        trade: { ...best.risk, dir }, filters: f, score: best.score,
        favor: [...best.s.favor, ...(conf.emaAligned ? [conf.emaText] : []), ...(conf.fvg ? [conf.fvgText] : []), best.trig.detail], contra: best.s.against.concat(best.risk.notes, f.filter((x) => x.status === "atencao").map((x) => `${x.name}: ${x.note}`)),
        invalidation: invalidationText(dir, best.risk.invalidation, symbol), missing: [] };
    }
    if (nonTrigger.length === 0 && best.score.total >= 65) {
      const lvl = best.risk.entry;
      return { ...base, decision: "NO_TRADE", state: "aguardando_confirmacao", watch: { dir, condition: `Aguardar gatilho de ${verb} no ${best.trig.source}: ${best.trig.kinds.length ? "falta fechar a favor" : "engolfo, rejeição ou rompimento de microestrutura"} ${dir === "BUY" ? "acima" : "abaixo"} de ${lvl.toFixed(5)}, depois reavaliar com dados novos.` },
        chosen: { id: best.s.id, name: best.s.name, dir }, trigger: best.trig, trade: null, filters: f, score: best.score,
        favor: best.s.favor, contra: best.s.against.concat(["Gatilho de entrada ainda não confirmado."]), invalidation: invalidationText(dir, best.risk.invalidation, symbol),
        missing: [best.trig.detail, ...(best.score.total < 75 ? [`Pontuação ${best.score.total} (mínimo 75 para liberar entrada).`] : [])] };
    }
    return { ...base, decision: "NO_TRADE", state: "sem_operacao", watch: null, chosen: { id: best.s.id, name: best.s.name, dir }, trigger: best.trig, trade: null, filters: f, score: best.score,
      favor: best.s.favor, contra: [...best.s.against, ...nonTrigger.map((x) => `${x.name}: ${x.note}`)], invalidation: invalidationText(dir, best.risk.invalidation, symbol),
      missing: nonTrigger.map((x) => `${x.name}: ${x.note}`).concat(best.score.total < 75 ? [`Pontuação ${best.score.total} (mínimo 75).`] : []) };
  }
  // nenhuma estratégia pronta: procura o cenário mais próximo para "próxima oportunidade"
  const partial = all.filter((x) => x.met >= 2 && x.met < x.total).sort((x, y) => y.met / y.total - x.met / x.total)[0];
  const nearAny = regions.find((r) => r.distance <= 1.5 * a.M15.atr);
  const filters = dataOnlyFilters(issues, inp.events, inp.currencies, now).map((f) => f);
  let watch: ForexAnalysis["watch"] = null;
  if (partial && nearAny) watch = { dir: partial.dir, condition: `Faltam: ${partial.needs.join("; ")}.` };
  return { ...base, decision: "NO_TRADE", state: "sem_operacao", watch, chosen: null, trigger: null, trade: null, filters, score: null,
    favor: partial ? partial.favor : [], contra: [context === "consolidação" ? "Mercado em consolidação sem direção." : "Nenhuma estratégia com as condições completas."],
    invalidation: "—", missing: partial ? partial.needs : ["Setup em região relevante com rejeição e confirmação."] };
}

function invalidationText(dir: Dir, level: number, symbol: string) {
  const f = symbol.includes("JPY") ? 3 : 5;
  return dir === "BUY" ? `Fechamento do M5 abaixo de ${level.toFixed(f)} invalida a compra.` : `Fechamento do M5 acima de ${level.toFixed(f)} invalida a venda.`;
}

function newsFilter(events: NewsEvent[] | null, currencies: string[], now: number): Filter {
  if (!events) return { id: 9, name: "Notícias", status: "nao_verificado", note: "Calendário econômico indisponível: filtro de notícias NÃO foi verificado." };
  const hit = events.find((e) => e.impact === 3 && currencies.includes(e.country) && e.at >= now - 15 * 60 && e.at <= now + 30 * 60);
  return hit ? { id: 9, name: "Notícias", status: "falha", note: `Evento de alto impacto (${hit.country} ${hit.title}) próximo.` } : { id: 9, name: "Notícias", status: "ok", note: "Sem evento de alto impacto das moedas do par entre -15 e +30 minutos." };
}

function dataOnlyFilters(issues: string[], events: NewsEvent[] | null, currencies: string[], now: number): Filter[] {
  return [
    { id: 10, name: "Qualidade dos dados", status: issues.length ? "falha" : "ok", note: issues.length ? issues.join(" | ") : "Velas atualizadas, completas e sem duplicatas." },
    newsFilter(events, currencies, now),
  ];
}

interface FArgs { dir: Dir; s: StrategyResult; a: { H1: TFAnalysis; M15: TFAnalysis; M5: TFAnalysis }; ctx: Ctx; trig: Trigger; risk: Risk; exhausted: boolean; traveled: number; bothAgainst: boolean; justified: boolean; context: ForexAnalysis["context"]; baseOk: boolean; issues: string[]; events: NewsEvent[] | null; currencies: string[]; now: number; m1Ok: boolean }

function buildFilters(x: FArgs): Filter[] {
  const o = wantTrend(opposite(x.dir));
  const { a } = x;
  const f: Filter[] = [];
  const dirs = [a.H1.trend, a.M15.trend, a.M5.trend];
  const nTrend = dirs.filter((t) => t !== "lateral").length;
  f.push({ id: 1, name: "Tendência", status: nTrend > 0 ? "ok" : "falha", note: `H1 ${a.H1.trend}, M15 ${a.M15.trend}, M5 ${a.M5.trend}.` });
  const reg = x.s.region ?? nearRegionAny(x.ctx, x.dir);
  f.push({ id: 2, name: "Localização", status: reg || Math.abs(x.ctx.price - a.M5.ema.e20) <= 0.8 * a.M5.atr ? "ok" : "falha", note: reg ? `Preço em/perto de ${reg.role} ${reg.strength} (${reg.origin}, ${reg.reactions} reações).` : "Preço longe de região relevante e da EMA 20." });
  const structOk = a.M5.struct.bos === x.dir || a.M5.struct.choch === x.dir || a.M15.struct.bos === x.dir || (x.dir === "BUY" ? a.M15.struct.higherLows : a.M15.struct.lowerHighs) || x.s.id === 3;
  f.push({ id: 3, name: "Estrutura", status: structOk ? "ok" : "falha", note: structOk ? "Há topos/fundos, BOS ou CHoCH a favor." : "Sem topos/fundos, BOS ou CHoCH a favor." });
  f.push({ id: 4, name: "Candle / gatilho", status: x.trig.confirmed ? "ok" : "falha", note: x.trig.detail });
  const conflict = a.M5.trend === o || a.M15.trend === o;
  f.push({ id: 5, name: "Alinhamento M5/M15", status: conflict && !x.justified ? "falha" : "ok",
    note: conflict ? (x.justified ? `M5 ${a.M5.trend} e M15 ${a.M15.trend} divergem, com reversão justificada em região forte.` : `M5 ${a.M5.trend} e M15 ${a.M15.trend}: divergência contra a direção, sem justificativa estrutural.`) : `M5 ${a.M5.trend} e M15 ${a.M15.trend}: sem conflito com a direção.` });
  const r = a.M5.atrRatio;
  f.push({ id: 6, name: "Volatilidade", status: r >= 0.45 && r <= 2.2 ? "ok" : "falha", note: `ATR M5 ${(a.M5.atr / x.ctx.pip).toFixed(1)} pips (${r.toFixed(2)}x a mediana).` });
  const exh = x.exhausted ? ` Preço já percorreu ${Math.round(x.traveled * 100)}% do caminho até o alvo.` : "";
  f.push({ id: 7, name: "Risco e retorno", status: x.risk.ok && !x.exhausted ? "ok" : "falha", note: (x.risk.ok ? `R:R ao TP1 de ${(x.risk.rr[0] ?? 0).toFixed(2)}.` : x.risk.notes.join(" ")) + exh });
  const mid = x.context === "consolidação";
  f.push({ id: 8, name: "Contexto", status: mid && x.s.id === 1 ? "falha" : "ok", note: `Mercado em ${x.context}.` });
  f.push(newsFilter(x.events, x.currencies, x.now));
  f.push({ id: 10, name: "Qualidade dos dados", status: x.baseOk ? "ok" : "falha", note: x.baseOk ? `Velas atualizadas e completas${x.m1Ok ? "" : "; M1 indisponível, gatilho confirmado pelo M5"}.` : x.issues.join(" | ") });
  return f.sort((p, q) => p.id - q.id);
}

function nearRegionAny(ctx: Ctx, dir: Dir): Region | null {
  const role = dir === "BUY" ? "suporte" : "resistencia";
  return ctx.regions.find((r) => r.role === role && r.distance <= 1.2 * ctx.a.M15.atr) ?? null;
}

function scoreIt(dir: Dir, s: StrategyResult, ctx: Ctx, trig: Trigger, risk: Risk, conf: ReturnType<typeof confluence>, _regions: Region[]): Score {
  const { a } = ctx, w = wantTrend(dir), o = wantTrend(opposite(dir));
  const parts: Score["parts"] = {};
  const put = (k: string, got: number, max: number) => { parts[k] = { got: Math.min(max, Math.round(got)), max }; };
  put("Tendência e estrutura", (a.H1.trend === w ? 8 : 0) + (a.M15.trend === w ? 6 : 0) + (a.M5.trend === w ? 6 : 0), 20);
  const reg = s.region ?? nearRegionAny(ctx, dir);
  put("Suporte e resistência", reg ? (reg.strength === "forte" ? 12 : 7) + (reg.origin === "H1" ? 3 : 0) : 0, 15);
  const bos = a.M5.struct.bos === dir || a.M15.struct.bos === dir ? 15 : a.M5.struct.choch === dir ? 11 : s.id === 3 ? 12 : s.id === 5 ? 10 : 0;
  put("BOS, CHoCH ou rompimento", bos, 15);
  put("Gatilho de candle", trig.confirmed ? (trig.source === "M1" ? 15 : 11) : conf.patterns.some((p) => p.weight >= 0.7) ? 5 : 0, 15);
  const n = [a.H1.trend, a.M15.trend, a.M5.trend].filter((t) => t === w).length;
  const contradict = a.M5.trend === o && a.M15.trend === w || a.M15.trend === o && a.M5.trend === w;
  put("Alinhamento multitemporal", contradict ? 0 : n >= 3 ? 15 : n === 2 ? 9 : n === 1 ? 4 : 0, 15);
  const sweep = [a.M5.sweep, a.M15.sweep].some((x) => x?.dir === dir);
  put("Liquidez e FVG", (sweep ? 6 : 0) + (conf.fvg ? 4 : 0), 10);
  const rsiOk = a.M5.rsi === null ? 0 : dir === "BUY" ? (a.M5.rsi < 70 ? 1.5 : 0) : a.M5.rsi > 30 ? 1.5 : 0;
  put("Indicadores e volatilidade", (conf.emaAligned ? 2 : 0) + rsiOk + (a.M5.atrRatio >= 0.45 && a.M5.atrRatio <= 2.2 ? 1.5 : 0), 5);
  const rr = risk.rr[0] ?? 0;
  put("Risco e retorno", rr >= 2 ? 5 : rr >= 1.5 ? 3 : 0, 5);
  const total = Object.values(parts).reduce((s2, p) => s2 + p.got, 0);
  return { total, label: scoreLabel(total), parts };
}
