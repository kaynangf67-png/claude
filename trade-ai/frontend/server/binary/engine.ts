import { atrSeries, ema, rsiSeries } from "../forex/indicators.js";
import type { Candle } from "../forex/types.js";

/**
 * OPERAÇÕES RÁPIDAS (binárias): duas estratégias de tempo curto, com regras objetivas e checáveis.
 *  - REVERSÃO DE PREÇO: preço esticado (RSI extremo + toque na banda de Bollinger) com vela de rejeição → volta para a média.
 *  - RETRAÇÃO: tendência definida pelas médias, recuo de 30% a 70% da última perna até a EMA 20, vela de retomada → segue a tendência.
 * Binária não tem stop nem alvo: o resultado é só "o preço fechou acima ou abaixo da entrada na expiração".
 * Nada aqui prevê a próxima vela. É o conjunto de condições técnicas que o gráfico mostra agora.
 */
export type BinStrategy = "reversao" | "retracao" | "fluxo" | "tres" | "diminuicao";
export type BinDir = "CALL" | "PUT";
export type BinLevel = "confirmada" | "parcial" | "fraca";
export interface Cond { ok: boolean; text: string }
export interface BinSignal {
  strategy: BinStrategy; label: string; dir: BinDir; level: BinLevel; met: number; total: number; conds: Cond[]; defaultExpiry: number;
}
export const STRATEGY_LABEL: Record<BinStrategy, string> = { reversao: "Reversão de preço", retracao: "Retração", fluxo: "Fluxo de vela (região)", tres: "Três velas + região", diminuicao: "Diminuição de vela + região" };
export const DEFAULT_EXPIRY: Record<BinStrategy, number> = { reversao: 2, retracao: 3, fluxo: 1, tres: 1, diminuicao: 1 };
const LEVEL_RANK: Record<BinLevel, number> = { confirmada: 2, parcial: 1, fraca: 0 };
export const MIN_INDEX = 60; // velas mínimas antes do primeiro sinal (médias e bandas precisam de histórico)

export interface Series { c: Candle[]; closes: number[]; rsi: (number | null)[]; e20: number[]; e50: number[]; mid: number[]; up: number[]; lo: number[]; atr: number[] }

/** Indicadores de uma vez só (o backtest avalia cada vela sem recalcular tudo). */
export function buildSeries(c: Candle[]): Series {
  const closes = c.map((k) => k.c);
  const mid: number[] = [], up: number[] = [], lo: number[] = [];
  for (let i = 0; i < c.length; i++) {
    if (i < 19) { mid.push(NaN); up.push(NaN); lo.push(NaN); continue; }
    let s = 0; for (let j = i - 19; j <= i; j++) s += closes[j];
    const m = s / 20; let v = 0; for (let j = i - 19; j <= i; j++) v += (closes[j] - m) ** 2;
    const sd = Math.sqrt(v / 20);
    mid.push(m); up.push(m + 2 * sd); lo.push(m - 2 * sd);
  }
  return { c, closes, rsi: rsiSeries(closes), e20: ema(closes, 20), e50: ema(closes, 50), mid, up, lo, atr: atrSeries(c) };
}

const level = (met: number, key: boolean, strongAt: number, partialAt: number, gate = true): BinLevel =>
  met >= strongAt && key && gate ? "confirmada" : met >= partialAt && gate ? "parcial" : "fraca";

/** Reversão de preço para um lado (CALL = preço esticado para baixo, espera retorno). */
function reversalFor(S: Series, i: number, dir: BinDir): BinSignal {
  const buy = dir === "CALL", k = S.c[i], p = S.c[i - 1], range = Math.max(k.h - k.l, 1e-12), at = S.atr[i];
  const rsiW = [i, i - 1, i - 2].map((j) => S.rsi[j] ?? 50);
  const rsiOk = buy ? Math.min(...rsiW) <= 30 : Math.max(...rsiW) >= 70;
  const band = buy ? [i, i - 1].some((j) => S.c[j].l <= S.lo[j]) : [i, i - 1].some((j) => S.c[j].h >= S.up[j]);
  const wick = buy ? (Math.min(k.o, k.c) - k.l) / range : (k.h - Math.max(k.o, k.c)) / range;
  const engulf = buy ? p.c < p.o && k.c > k.o && k.c >= p.o && k.o <= p.c : p.c > p.o && k.c < k.o && k.c <= p.o && k.o >= p.c;
  const reject = (wick >= 0.5 && (buy ? k.c >= k.l + 0.5 * range : k.c <= k.h - 0.5 * range)) || engulf;
  const stretched = buy ? S.e20[i] - k.c >= at : k.c - S.e20[i] >= at;
  const calm = range <= 2.5 * at;
  const conds: Cond[] = [
    { ok: rsiOk, text: buy ? "RSI(14) em sobrevenda (30 ou menos) nas últimas 3 velas" : "RSI(14) em sobrecompra (70 ou mais) nas últimas 3 velas" },
    { ok: band, text: buy ? "Preço tocou a banda de Bollinger inferior" : "Preço tocou a banda de Bollinger superior" },
    { ok: reject, text: buy ? "Vela de rejeição compradora (pavio inferior longo ou engolfo de alta)" : "Vela de rejeição vendedora (pavio superior longo ou engolfo de baixa)" },
    { ok: stretched, text: "Preço esticado: a pelo menos 1 ATR da média de 20" },
    { ok: calm, text: "Vela sem exagero (até 2,5 ATR): sem pico de notícia" },
  ];
  const met = conds.filter((x) => x.ok).length;
  return { strategy: "reversao", label: STRATEGY_LABEL.reversao, dir, level: level(met, reject, 4, 3), met, total: 5, conds, defaultExpiry: DEFAULT_EXPIRY.reversao };
}

/** Retração (pullback) para um lado: CALL = tendência de alta com recuo. */
function retracementFor(S: Series, i: number, dir: BinDir): BinSignal {
  const buy = dir === "CALL", k = S.c[i], p = S.c[i - 1], range = Math.max(k.h - k.l, 1e-12), at = S.atr[i];
  const trend = buy ? S.e20[i] > S.e50[i] && k.c > S.e50[i] && S.e50[i] > S.e50[i - 10] : S.e20[i] < S.e50[i] && k.c < S.e50[i] && S.e50[i] < S.e50[i - 10];
  // última perna: extremo recente (15 velas) e o ponto de origem da perna (30 velas antes do extremo)
  let ext = buy ? -Infinity : Infinity, extIdx = i;
  for (let j = Math.max(0, i - 15); j <= i; j++) { const v = buy ? S.c[j].h : S.c[j].l; if (buy ? v > ext : v < ext) { ext = v; extIdx = j; } }
  let origin = buy ? Infinity : -Infinity;
  for (let j = Math.max(0, extIdx - 30); j <= extIdx; j++) { const v = buy ? S.c[j].l : S.c[j].h; origin = buy ? Math.min(origin, v) : Math.max(origin, v); }
  const leg = Math.abs(ext - origin), depth = leg > 0 ? Math.abs(ext - k.c) / leg : NaN;
  const depthOk = depth >= 0.3 && depth <= 0.7;
  const zone = [i, i - 1, i - 2].some((j) => S.c[j].l <= S.e20[j] + 0.3 * S.atr[j] && S.c[j].h >= S.e20[j] - 0.3 * S.atr[j]);
  const body = Math.abs(k.c - k.o);
  const resume = (buy ? k.c > k.o && k.c > p.c : k.c < k.o && k.c < p.c) && body >= 0.3 * range;
  const r = S.rsi[i] ?? 50;
  const calm = range <= 2 * at && r >= 35 && r <= 65;
  const conds: Cond[] = [
    { ok: trend, text: buy ? "Tendência de alta: EMA 20 acima da EMA 50, preço acima da EMA 50, EMA 50 subindo" : "Tendência de baixa: EMA 20 abaixo da EMA 50, preço abaixo da EMA 50, EMA 50 caindo" },
    { ok: depthOk, text: `Recuo de 30% a 70% da última perna (agora ${Number.isFinite(depth) ? Math.round(depth * 100) + "%" : "indefinido"})` },
    { ok: zone, text: "Preço tocou a região da EMA 20 nas últimas 3 velas" },
    { ok: resume, text: buy ? "Vela de retomada compradora (fechou em alta, corpo de ao menos 30%)" : "Vela de retomada vendedora (fechou em baixa, corpo de ao menos 30%)" },
    { ok: calm, text: "Sem exagero: vela até 2 ATR e RSI entre 35 e 65" },
  ];
  const met = conds.filter((x) => x.ok).length;
  return { strategy: "retracao", label: STRATEGY_LABEL.retracao, dir, level: level(met, resume, 4, 3, trend), met, total: 5, conds, defaultExpiry: DEFAULT_EXPIRY.retracao };
}

/**
 * FLUXO DE VELA (região): o preço toca uma região de suporte/resistência (nível testado ao menos 2 vezes), retrai e a vela de
 * confirmação fecha a favor; entrada na PRÓXIMA vela, expiração em 1 vela. Região = pivôs (topos e fundos já confirmados por 3 velas)
 * agrupados a até 0,5 ATR; vale tanto como suporte quanto como resistência, conforme o lado do preço.
 */
/** Pivôs (topos e fundos confirmados por 3 velas) das últimas 100 velas, sem os 4 mais recentes. Pivôs a menos de 3 velas do anterior contam como um só. */
function pivotPrices(S: Series, i: number): number[] {
  const prices: number[] = [];
  let lastHi = -9, lastLo = -9;
  for (let j = Math.max(3, i - 100); j <= i - 5; j++) {
    let hi = true, lo = true;
    for (let q = j - 3; q <= j + 3; q++) { if (q === j) continue; if (S.c[q].h > S.c[j].h) hi = false; if (S.c[q].l < S.c[j].l) lo = false; }
    if (hi && j - lastHi >= 3) { prices.push(S.c[j].h); lastHi = j; }
    if (lo && j - lastLo >= 3) { prices.push(S.c[j].l); lastLo = j; }
  }
  return prices;
}
interface Zone { lo: number; hi: number; n: number }
/** Região = pivôs agrupados a até 0,5 ATR (ao menos 2). Suporte fica abaixo do preço; resistência, acima. Devolve a mais próxima do extremo (mín./máx. das velas do toque). */
function nearestZone(S: Series, i: number, buy: boolean, extreme: number): { zone: Zone | null; dist: number } {
  const at = S.atr[i], prices = pivotPrices(S, i), close = S.c[i].c;
  let zone: Zone | null = null, best = Infinity;
  for (const p of prices) {
    const m = prices.filter((x) => Math.abs(x - p) <= 0.5 * at);
    if (m.length < 2) continue;
    const z = { lo: Math.min(...m) - 0.15 * at, hi: Math.max(...m) + 0.15 * at, n: m.length };
    if (buy ? z.lo > close : z.hi < close) continue;
    const d = extreme < z.lo ? z.lo - extreme : extreme > z.hi ? extreme - z.hi : 0;
    if (d < best) { best = d; zone = z; }
  }
  return { zone, dist: best };
}

/**
 * FLUXO DE VELA (região): o preço toca uma região de suporte/resistência (nível testado ao menos 2 vezes), retrai e a vela de
 * confirmação fecha a favor; entrada na PRÓXIMA vela, expiração em 1 vela. A região vale tanto como suporte quanto como resistência.
 */
function flowFor(S: Series, i: number, dir: BinDir): BinSignal {
  const buy = dir === "CALL", k = S.c[i], at = S.atr[i];
  const win = [i - 2, i - 1, i].map((j) => S.c[j]);
  const extreme = buy ? Math.min(...win.map((x) => x.l)) : Math.max(...win.map((x) => x.h));
  const { zone, dist } = nearestZone(S, i, buy, extreme);
  const near = !!zone && dist <= 1.0 * at;
  const z = near ? zone! : null;
  const t = z ? [...win].reverse().find((x) => (buy ? x.l <= z.hi : x.h >= z.lo)) ?? null : null;
  const tr = t ? Math.max(t.h - t.l, 1e-12) : 1;
  const wick = t ? (buy ? (Math.min(t.o, t.c) - t.l) / tr : (t.h - Math.max(t.o, t.c)) / tr) : 0;
  const retracted = !!(t && z && (buy ? t.c >= z.lo && (t.c >= z.hi || wick >= 0.4) : t.c <= z.hi && (t.c <= z.lo || wick >= 0.4)));
  const held = !!z && win.every((x) => (buy ? x.c >= z.lo : x.c <= z.hi));
  const confirm = !!z && (buy ? k.c > k.o && k.c > z.hi : k.c < k.o && k.c < z.lo);
  const conds: Cond[] = [
    { ok: near, text: buy ? "Região de suporte testada 2 ou mais vezes perto do preço" : "Região de resistência testada 2 ou mais vezes perto do preço" },
    { ok: !!t, text: "O preço tocou a região nas últimas 3 velas" },
    { ok: retracted, text: "Retraiu: a vela do toque não fechou dentro/através da região (fechou acima/abaixo ou deixou pavio de rejeição)" },
    { ok: held, text: "A região foi respeitada: nenhum fechamento do outro lado nas últimas 3 velas" },
    { ok: confirm, text: buy ? "Vela de confirmação verde, fechando acima da região" : "Vela de confirmação vermelha, fechando abaixo da região" },
  ];
  const met = conds.filter((x) => x.ok).length;
  return { strategy: "fluxo", label: STRATEGY_LABEL.fluxo, dir, level: level(met, confirm && !!t, 4, 3, near), met, total: 5, conds, defaultExpiry: DEFAULT_EXPIRY.fluxo };
}

/**
 * TRÊS VELAS + REGIÃO (reversão): três velas seguidas da mesma cor, QUALQUER tamanho, chegam numa região testada; a 3ª toca a região.
 * Entra CONTRA, na próxima vela, expiração em 1 vela. PUT = 3 verdes na resistência; CALL = 3 vermelhas no suporte.
 */
function threeFor(S: Series, i: number, dir: BinDir): BinSignal {
  const buy = dir === "CALL", at = S.atr[i];
  const win = [i - 2, i - 1, i].map((j) => S.c[j]), k = S.c[i];
  const same = win.every((x) => (buy ? x.c < x.o : x.c > x.o));
  const extreme = buy ? Math.min(...win.map((x) => x.l)) : Math.max(...win.map((x) => x.h));
  const { zone, dist } = nearestZone(S, i, buy, extreme);
  const near = !!zone && dist <= 1.0 * at;
  const z = near ? zone! : null;
  const touch = !!z && (buy ? k.l <= z.hi : k.h >= z.lo);
  const respected = !!z && (buy ? k.c >= z.lo : k.c <= z.hi);
  const history = !!z && z.n >= 3;
  const conds: Cond[] = [
    { ok: near, text: buy ? "Região de suporte testada 2 ou mais vezes perto do preço" : "Região de resistência testada 2 ou mais vezes perto do preço" },
    { ok: same, text: buy ? "Três velas vermelhas seguidas (qualquer tamanho)" : "Três velas verdes seguidas (qualquer tamanho)" },
    { ok: touch, text: "A 3ª vela tocou a região" },
    { ok: respected, text: "A 3ª vela não fechou do outro lado da região (não rompeu)" },
    { ok: history, text: "A região já respondeu antes: 3 ou mais testes no histórico" },
  ];
  const met = conds.filter((x) => x.ok).length;
  return { strategy: "tres", label: STRATEGY_LABEL.tres, dir, level: level(met, same && touch, 4, 3, near && same), met, total: 5, conds, defaultExpiry: DEFAULT_EXPIRY.tres };
}

/**
 * DIMINUIÇÃO DE VELA + REGIÃO: três velas da mesma cor chegando na região, cada corpo MENOR que o anterior e o 3º pequeno
 * (até metade do 1º): o movimento perde força ao chegar no suporte/resistência. Entra contra, na próxima vela, expiração de 1 vela.
 */
function shrinkFor(S: Series, i: number, dir: BinDir): BinSignal {
  const buy = dir === "CALL", at = S.atr[i];
  const win = [i - 2, i - 1, i].map((j) => S.c[j]), k = S.c[i];
  const body = win.map((x) => Math.abs(x.c - x.o));
  const same = win.every((x) => (buy ? x.c < x.o : x.c > x.o));
  const shrinking = body[0] > body[1] && body[1] > body[2];
  const small = body[2] <= 0.5 * body[0];
  const extreme = buy ? Math.min(...win.map((x) => x.l)) : Math.max(...win.map((x) => x.h));
  const { zone, dist } = nearestZone(S, i, buy, extreme);
  const near = !!zone && dist <= 1.0 * at;
  const z = near ? zone! : null;
  const ok = !!z && (buy ? k.l <= z.hi && k.c >= z.lo : k.h >= z.lo && k.c <= z.hi);
  const conds: Cond[] = [
    { ok: near, text: buy ? "Região de suporte testada 2 ou mais vezes perto do preço" : "Região de resistência testada 2 ou mais vezes perto do preço" },
    { ok: same, text: buy ? "Três velas vermelhas seguidas" : "Três velas verdes seguidas" },
    { ok: shrinking, text: "O corpo de cada vela é menor que o da anterior (a força diminui)" },
    { ok: small, text: "A 3ª vela é pequena: corpo de até metade do corpo da 1ª" },
    { ok: ok, text: "A 3ª vela tocou a região e não fechou do outro lado (não rompeu)" },
  ];
  const met = conds.filter((x) => x.ok).length;
  return { strategy: "diminuicao", label: STRATEGY_LABEL.diminuicao, dir, level: level(met, same && shrinking && small && ok, 4, 3, near && same), met, total: 5, conds, defaultExpiry: DEFAULT_EXPIRY.diminuicao };
}

const better = (a: BinSignal, b: BinSignal, prefer: BinDir) => (b.met > a.met || (b.met === a.met && b.dir === prefer) ? b : a);

/** Avalia as duas estratégias na vela i (já fechada). Em cada uma escolhe o lado com mais condições atendidas. */
export function evalAt(S: Series, i: number): Record<BinStrategy, BinSignal> {
  const k = S.c[i];
  const reversalPrefer: BinDir = k.c < S.mid[i] ? "CALL" : "PUT";      // reversão: volta para a média
  const trendPrefer: BinDir = k.c > S.e50[i] ? "CALL" : "PUT";         // retração: lado da tendência
  return {
    reversao: better(reversalFor(S, i, "CALL"), reversalFor(S, i, "PUT"), reversalPrefer),
    retracao: better(retracementFor(S, i, "CALL"), retracementFor(S, i, "PUT"), trendPrefer),
    fluxo: better(flowFor(S, i, "CALL"), flowFor(S, i, "PUT"), trendPrefer),
    tres: better(threeFor(S, i, "CALL"), threeFor(S, i, "PUT"), k.c > k.o ? "PUT" : "CALL"),
    diminuicao: better(shrinkFor(S, i, "CALL"), shrinkFor(S, i, "PUT"), k.c > k.o ? "PUT" : "CALL"),
  };
}

/** Melhor sinal agora: nível (confirmada > parcial > fraca), depois condições atendidas. Sempre devolve algo quando há histórico. */
export function bestOf(sig: Record<BinStrategy, BinSignal>, pick: BinStrategy | "auto"): BinSignal {
  if (pick !== "auto") return sig[pick];
  const list = [sig.reversao, sig.retracao, sig.fluxo, sig.tres, sig.diminuicao];
  return list.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.met - a.met)[0];
}

export function analyzeLatest(c: Candle[], pick: BinStrategy | "auto" = "auto"): { signals: Record<BinStrategy, BinSignal>; best: BinSignal; S: Series } | null {
  if (c.length < MIN_INDEX + 2) return null;
  const S = buildSeries(c), signals = evalAt(S, c.length - 1);
  return { signals, best: bestOf(signals, pick), S };
}

// ---------------- backtest ----------------
export interface BinTrade { at: number; dir: BinDir; strategy: BinStrategy; level: BinLevel; win: boolean | null }
export interface BinStats { n: number; wins: number; losses: number; ties: number; winRate: number | null; breakEven: number; expectancy: number | null; ci: [number, number] | null }

/** Wilson 95% (cópia local para não depender do front). */
function wilson(wins: number, n: number, z = 1.96): [number, number] | null {
  if (n === 0) return null;
  const p = wins / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

export function statsOf(trades: { win: boolean | null }[], payout: number): BinStats {
  const done = trades.filter((t) => t.win !== null), wins = done.filter((t) => t.win).length, n = done.length;
  return {
    n, wins, losses: n - wins, ties: trades.length - n, winRate: n ? wins / n : null, breakEven: 1 / (1 + payout),
    expectancy: n ? (wins * payout - (n - wins)) / n : null, ci: wilson(wins, n),
  };
}

export interface BtOpts { strategy: BinStrategy; expiry: number; payout: number; minLevel: "confirmada" | "parcial" }
/**
 * Backtest sem olhar o futuro: o sinal usa só a vela i fechada; a entrada é a ABERTURA da vela i+1; vale a vela i+expiry.
 * Empate (fechou igual à entrada) não conta. Sem sobreposição: depois de um sinal pula até a expiração.
 */
export function backtestBinary(c: Candle[], o: BtOpts): { trades: BinTrade[]; all: BinStats; development: BinStats; validation: BinStats; splitAt: number | null; candles: number } {
  const S = buildSeries(c), trades: BinTrade[] = [];
  const need = o.minLevel === "confirmada" ? 2 : 1;
  for (let i = MIN_INDEX; i < c.length - o.expiry - 1; i++) {
    const s = evalAt(S, i)[o.strategy];
    if (LEVEL_RANK[s.level] < need) continue;
    const entry = c[i + 1].o, close = c[i + o.expiry].c;
    const win = close === entry ? null : s.dir === "CALL" ? close > entry : close < entry;
    trades.push({ at: c[i + 1].t, dir: s.dir, strategy: o.strategy, level: s.level, win });
    i += o.expiry;
  }
  const first = trades[0]?.at ?? null, last = trades.at(-1)?.at ?? null;
  const splitAt = first !== null && last !== null ? first + (last - first) * 0.6 : null;
  const dev = trades.filter((t) => splitAt === null || t.at <= splitAt), val = trades.filter((t) => splitAt !== null && t.at > splitAt);
  return { trades: trades.slice(-100), all: statsOf(trades, o.payout), development: statsOf(dev, o.payout), validation: statsOf(val, o.payout), splitAt, candles: c.length };
}
