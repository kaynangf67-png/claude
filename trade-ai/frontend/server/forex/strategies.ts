import type { TFAnalysis } from "./mtf.js";
import type { Candle, Dir, Fvg, Pattern, Region, Trend } from "./types.js";
import { opposite } from "./types.js";

/** Estratégias 1 a 5 geram candidatos; 6 (EMAs), 7 (FVG) e 8 (padrões de candle) entram como confluência, nunca isoladas. */
export interface Ctx {
  price: number; pip: number;
  /** H1 só fornece suporte e resistência (regions). A direção vem do movimento atual: M5 e, quando existe, M1. */
  a: { H1: TFAnalysis; M5: TFAnalysis; M1: TFAnalysis | null };
  regions: Region[]; m5: Candle[]; patterns: Pattern[];
}
export interface StrategyResult {
  id: number; name: string; dir: Dir; ready: boolean; met: number; total: number;
  region: Region | null; favor: string[]; against: string[]; needs: string[]; invalidation: number | null;
}

const want = (d: Dir): Trend => (d === "BUY" ? "alta" : "baixa");
/** Movimento atual a favor da direção: estrutura do M5 ou EMAs do M5 alinhadas. */
export const moves = (ctx: Ctx, dir: Dir) => ctx.a.M5.trend === want(dir) || ctx.a.M5.ema.stack === want(dir);
const word = (d: Dir) => (d === "BUY" ? "compradora" : "vendedora");

export function nearRegion(ctx: Ctx, dir: Dir, atrMult: number, strongOnly = false): Region | null {
  const role = dir === "BUY" ? "suporte" : "resistencia";
  const lim = atrMult * ctx.a.M5.atr;
  return ctx.regions
    .filter((r) => r.role === role && r.distance <= lim && (!strongOnly || r.strength === "forte" || r.intensity >= 60))
    .sort((x, y) => (y.strength === "forte" ? 1 : 0) - (x.strength === "forte" ? 1 : 0) || x.distance - y.distance)[0] ?? null;
}

const rejection = (ctx: Ctx, dir: Dir) =>
  ctx.patterns.find((p) => p.dir === dir && p.weight >= 0.7 && /Martelo|Pin bar|rejeição|Engolfo|Estrela/.test(p.name) && (p.confirmed || p.index === ctx.m5.length - 1));

function mk(id: number, name: string, dir: Dir, checks: { ok: boolean; yes: string; no: string; against?: string }[], extra: Partial<StrategyResult> = {}): StrategyResult {
  const favor = checks.filter((c) => c.ok).map((c) => c.yes);
  const needs = checks.filter((c) => !c.ok).map((c) => c.no);
  const against = checks.filter((c) => !c.ok && c.against).map((c) => c.against!);
  return { id, name, dir, ready: needs.length === 0, met: favor.length, total: checks.length, region: null, favor, against, needs, invalidation: null, ...extra };
}

/** 1. Continuidade de tendência (pullback). */
export function continuity(ctx: Ctx, dir: Dir): StrategyResult {
  const buy = dir === "BUY", a = ctx.a, atr = a.M5.atr, e20 = a.M5.ema.e20;
  const w = want(dir);
  const structOk = moves(ctx, dir);
  const last10 = ctx.m5.slice(-10), last14 = ctx.m5.slice(-14);
  const touched = buy ? Math.min(...last10.map((k) => k.l)) <= e20 + 0.5 * atr : Math.max(...last10.map((k) => k.h)) >= e20 - 0.5 * atr;
  const reg = nearRegion(ctx, dir, 0.8);
  const retrace = buy ? Math.max(...last14.map((k) => k.c)) - ctx.price : ctx.price - Math.min(...last14.map((k) => k.c));
  const rej = rejection(ctx, dir);
  const last = ctx.m5[ctx.m5.length - 1];
  const conf = buy ? last.c > last.o && last.c > e20 : last.c < last.o && last.c < e20;
  const stretched = buy ? ctx.price - e20 > 2 * atr : e20 - ctx.price > 2 * atr;
  return mk(1, "Continuidade de tendência", dir, [
    { ok: structOk, yes: `Movimento ${w} no M5 (estrutura ou EMAs)`, no: `Movimento ${w} no M5 (estrutura ou EMAs)`, against: `M5 sem movimento ${w}` },
    { ok: retrace >= 0.8 * atr, yes: "Houve correção (pullback) antes do preço atual", no: "Correção (pullback) contra a tendência" },
    { ok: touched || !!reg, yes: reg ? "Pullback em região estrutural" : "Pullback na EMA 20 do M5", no: `Pullback até a EMA 20 ou até uma região de ${buy ? "suporte" : "resistência"}` },
    { ok: !!rej, yes: `Candle de rejeição ${word(dir)}: ${rej?.name}`, no: `Candle de rejeição ${word(dir)} no M5` },
    { ok: conf, yes: `Fechamento ${word(dir)} do M5 confirmando`, no: `Fechamento ${word(dir)} do M5 ${buy ? "acima" : "abaixo"} da EMA 20` },
    { ok: !stretched, yes: "Preço não está esticado em relação à EMA 20", no: "Preço esticado demais em relação à EMA 20", against: "Movimento esticado (mais de 2 ATR da EMA 20)" },
  ], { region: reg, invalidation: buy ? Math.min(...last10.map((k) => k.l)) : Math.max(...last10.map((k) => k.h)) });
}

/** 2. Reversão em suporte/resistência: região relevante + rejeição + mudança no M5. */
export function reversal(ctx: Ctx, dir: Dir): StrategyResult {
  const buy = dir === "BUY", a = ctx.a;
  const reg = nearRegion(ctx, dir, 0.5, true);
  const rej = rejection(ctx, dir);
  const sweep = a.M5.sweep?.dir === dir ? a.M5.sweep : null;
  const shift = a.M5.struct.choch === dir || ctx.patterns.some((p) => p.dir === dir && p.confirmed && /Engolfo|Pin bar|Martelo/.test(p.name));
  const last6 = ctx.m5.slice(-6);
  const inv = reg ? (buy ? Math.min(reg.low, ...last6.map((k) => k.l)) : Math.max(reg.high, ...last6.map((k) => k.h))) : null;
  return mk(2, "Reversão em suporte/resistência", dir, [
    { ok: !!reg, yes: `Preço em ${buy ? "suporte" : "resistência"} ${reg?.strength} (${reg?.reactions} reações, ${reg?.origin})`, no: `Preço em ${buy ? "suporte" : "resistência"} relevante (várias reações)` },
    { ok: !!rej, yes: `Rejeição ${word(dir)}: ${rej?.name}`, no: `Rejeição ${word(dir)} na região` },
    { ok: shift, yes: `M5 confirma mudança de comportamento (${a.M5.struct.choch === dir ? "CHoCH" : "padrão confirmado"})`, no: "Mudança de comportamento no M5 (CHoCH ou padrão confirmado)" },
    ...(sweep ? [{ ok: true, yes: `Varredura de liquidez em ${sweep.level.toFixed(5)} antes da reação`, no: "" }] : []),
  ], { region: reg, invalidation: inv });
}

/** 3. Rompimento de estrutura (BOS) e reteste. Rompimento só vale com fechamento. */
export function bosRetest(ctx: Ctx, dir: Dir): StrategyResult {
  const buy = dir === "BUY", atr = ctx.a.M5.atr;
  let found: { level: number; tf: "M5" } | null = null;
  for (const tf of ["M5"] as const) {
    const A = ctx.a[tf], cs = ctx.m5;
    const pivots = A.pivots.filter((p) => p.type === (buy ? "high" : "low")).slice(-5).reverse();
    for (const p of pivots) {
      const idx = cs.findIndex((k, i) => i > p.i && (buy ? k.c > p.price + 0.05 * atr : k.c < p.price - 0.05 * atr));
      if (idx < 0 || idx < cs.length - 70) continue;
      const after = cs.slice(idx + 1);
      const came = after.length > 0 && (buy ? Math.min(...after.map((k) => k.l)) <= p.price + 0.3 * atr : Math.max(...after.map((k) => k.h)) >= p.price - 0.3 * atr);
      const near = buy ? ctx.price >= p.price - 0.5 * atr && ctx.price <= p.price + 1.0 * atr : ctx.price <= p.price + 0.5 * atr && ctx.price >= p.price - 1.0 * atr;
      if (came && near) { found = { level: p.price, tf }; break; }
    }
    if (found) break;
  }
  const rej = rejection(ctx, dir);
  const hold = found ? (buy ? ctx.price >= found.level - 0.2 * atr : ctx.price <= found.level + 0.2 * atr) : false;
  return mk(3, "BOS e reteste", dir, [
    { ok: !!found, yes: `Rompimento ${buy ? "de topo" : "de fundo"} com fechamento (${found?.tf}) e retorno à região ${found?.level.toFixed(5)}`, no: `${buy ? "Topo" : "Fundo"} estrutural rompido com fechamento e preço de volta à região` },
    { ok: !!rej, yes: `Rejeição ${word(dir)} no reteste: ${rej?.name}`, no: `Rejeição ${word(dir)} no reteste` },
    { ok: hold, yes: "Preço sustenta a região rompida", no: "Preço sustentando a região rompida" },
  ], { invalidation: found ? (buy ? found.level - 0.5 * atr : found.level + 0.5 * atr) : null });
}

/** 4. Varredura de liquidez (sweep) seguida de mudança de estrutura. */
export function liquiditySweep(ctx: Ctx, dir: Dir): StrategyResult {
  const buy = dir === "BUY";
  const sweep = ctx.a.M5.sweep?.dir === dir ? ctx.a.M5.sweep : null;
  const shift = ctx.a.M5.struct.choch === dir || ctx.patterns.some((p) => p.dir === dir && p.confirmed && /Engolfo|Pin bar|Martelo|Candle de força/.test(p.name));
  let inv: number | null = null;
  if (sweep) {
    const from = sweep.index;
    const ext = ctx.m5.slice(Math.max(0, from)).map((k) => (buy ? k.l : k.h));
    inv = ext.length ? (buy ? Math.min(...ext) : Math.max(...ext)) : null;
  }
  return mk(4, "Varredura de liquidez", dir, [
    { ok: !!sweep, yes: `Preço passou de ${buy ? "um fundo" : "um topo"} (${sweep?.level.toFixed(5)}) e voltou para dentro`, no: `Varredura de ${buy ? "fundo" : "topo"} com retorno do fechamento para dentro da região` },
    { ok: shift, yes: "Mudança de estrutura no M5 após a varredura", no: `Mudança de estrutura ${word(dir)} no M5 (CHoCH ou padrão confirmado)` },
  ], { invalidation: inv });
}

/** 5. LTA/LTB calculadas de pivôs reais. */
export function trendLines(ctx: Ctx, dir: Dir): StrategyResult {
  const buy = dir === "BUY", atr = ctx.a.M5.atr;
  const rej = rejection(ctx, dir);
  let via: string | null = null, inv: number | null = null;
  for (const tf of ["M5"] as const) {
    const { lta, ltb } = ctx.a[tf].lines;
    const own = buy ? lta : ltb, other = buy ? ltb : lta;
    if (own && !own.broken && Math.abs(ctx.price - own.valueNow) <= 0.5 * atr) { via = `Teste da ${own.kind} no ${tf} (${own.touches} toques)`; inv = buy ? own.valueNow - 0.5 * atr : own.valueNow + 0.5 * atr; break; }
    if (other && other.broken && other.retested && (buy ? ctx.price > other.valueNow - 0.2 * atr : ctx.price < other.valueNow + 0.2 * atr)) { via = `${other.kind} rompida e retestada no ${tf}`; inv = buy ? other.valueNow - 0.5 * atr : other.valueNow + 0.5 * atr; break; }
  }
  return mk(5, "LTA e LTB", dir, [
    { ok: !!via, yes: via ?? "", no: `Teste de ${buy ? "LTA" : "LTB"} (ou rompimento e reteste da linha contrária)` },
    { ok: !!rej, yes: `Rejeição ${word(dir)} na linha: ${rej?.name}`, no: `Rejeição ${word(dir)} na linha` },
  ], { invalidation: inv });
}

export function runDirectional(ctx: Ctx, dir: Dir): StrategyResult[] {
  return [continuity(ctx, dir), reversal(ctx, dir), bosRetest(ctx, dir), liquiditySweep(ctx, dir), trendLines(ctx, dir)];
}

/** 6, 7 e 8: confluências. */
export interface Confluence {
  emaAligned: boolean; emaText: string;
  fvg: Fvg | null; fvgText: string;
  patterns: Pattern[]; patternText: string;
}
export function confluence(ctx: Ctx, dir: Dir): Confluence {
  const a = ctx.a, w = want(dir);
  const emaAligned = a.M5.ema.stack === w && (!a.M1 || a.M1.ema.stack !== want(opposite(dir)));
  const emaText = emaAligned ? `EMAs 9/20/50 alinhadas e inclinadas a favor (M5)${a.M5.ema.e200 !== null ? `; EMA 200 ${ctx.price > a.M5.ema.e200 ? "abaixo" : "acima"} do preço` : ""}` : `EMAs sem alinhamento ${w} no M5`;
  const fvg = a.M5.fvgs.filter((f) => f.dir === dir && (ctx.price >= f.low - 0.3 * a.M5.atr && ctx.price <= f.high + 0.3 * a.M5.atr)).at(-1) ?? null;
  const fvgText = fvg ? `FVG ${dir === "BUY" ? "comprador" : "vendedor"} ${fvg.status} entre ${fvg.low.toFixed(5)} e ${fvg.high.toFixed(5)}` : "Sem FVG a favor perto do preço";
  const patterns = ctx.patterns.filter((p) => p.dir === dir && p.weight >= 0.4);
  const patternText = patterns.length ? patterns.map((p) => `${p.name}${p.confirmed ? " (confirmado)" : ""}`).join(", ") : "Sem padrão de candle a favor";
  return { emaAligned, emaText, fvg, fvgText, patterns, patternText };
}
