import { atrSeries, ema, rsiSeries } from "../forex/indicators.js";
import type { Candle } from "../forex/types.js";

/**
 * OPERAÇÕES RÁPIDAS (binárias): duas estratégias de tempo curto, com regras objetivas e checáveis.
 *  - REVERSÃO DE PREÇO: preço esticado (RSI extremo + toque na banda de Bollinger) com vela de rejeição → volta para a média.
 *  - RETRAÇÃO: tendência definida pelas médias, recuo de 30% a 70% da última perna até a EMA 20, vela de retomada → segue a tendência.
 * Binária não tem stop nem alvo: o resultado é só "o preço fechou acima ou abaixo da entrada na expiração".
 * Nada aqui prevê a próxima vela. É o conjunto de condições técnicas que o gráfico mostra agora.
 */
export type BinStrategy = "reversao" | "retracao";
export type BinDir = "CALL" | "PUT";
export type BinLevel = "confirmada" | "parcial" | "fraca";
export interface Cond { ok: boolean; text: string }
export interface BinSignal {
  strategy: BinStrategy; label: string; dir: BinDir; level: BinLevel; met: number; total: number; conds: Cond[]; defaultExpiry: number;
}
export const STRATEGY_LABEL: Record<BinStrategy, string> = { reversao: "Reversão de preço", retracao: "Retração" };
export const DEFAULT_EXPIRY: Record<BinStrategy, number> = { reversao: 2, retracao: 3 };
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

const better = (a: BinSignal, b: BinSignal, prefer: BinDir) => (b.met > a.met || (b.met === a.met && b.dir === prefer) ? b : a);

/** Avalia as duas estratégias na vela i (já fechada). Em cada uma escolhe o lado com mais condições atendidas. */
export function evalAt(S: Series, i: number): Record<BinStrategy, BinSignal> {
  const k = S.c[i];
  const reversalPrefer: BinDir = k.c < S.mid[i] ? "CALL" : "PUT";      // reversão: volta para a média
  const trendPrefer: BinDir = k.c > S.e50[i] ? "CALL" : "PUT";         // retração: lado da tendência
  return {
    reversao: better(reversalFor(S, i, "CALL"), reversalFor(S, i, "PUT"), reversalPrefer),
    retracao: better(retracementFor(S, i, "CALL"), retracementFor(S, i, "PUT"), trendPrefer),
  };
}

/** Melhor sinal agora: nível (confirmada > parcial > fraca), depois condições atendidas. Sempre devolve algo quando há histórico. */
export function bestOf(sig: Record<BinStrategy, BinSignal>, pick: BinStrategy | "auto"): BinSignal {
  if (pick !== "auto") return sig[pick];
  const list = [sig.reversao, sig.retracao];
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
