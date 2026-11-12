import { buildSeries, evalAt, MIN_INDEX, STRATEGY_LABEL, type BinStrategy, type Series } from "../binary/engine.js";
import type { Candle } from "./types.js";

/**
 * ESTRATÉGIAS DE VELA NO FOREX (M15, H1, H4): as 7 regras das operações rápidas (reversão, retração, fluxo de vela, três velas,
 * diminuição de vela, dupla posição, vela de força) aplicadas a tempos maiores, com STOP e ALVO no lugar da expiração.
 *
 * Regras fixas, definidas ANTES de olhar o resultado (nada foi ajustado para o backtest ficar bonito):
 * - Sinal só no nível "confirmada", na vela FECHADA; entrada na abertura da vela seguinte.
 * - Stop além do extremo das últimas 5 velas (+0,2 ATR), no mínimo 0,7 ATR; acima de 3 ATR não opera.
 * - Alvo = 1,5 x o risco. Prazo máximo de 24 velas (H1 = 1 dia, H4 = 4 dias); no prazo, sai no fechamento.
 * - Stop e alvo na mesma vela contam como STOP (conservador). Custo (spread + deslize) descontado em R de cada operação.
 * - "Validada" = passou nos dois pedaços do histórico (60% desenvolvimento, 40% validação) com amostra mínima e fator de lucro.
 */
export const CS_LIST: BinStrategy[] = ["reversao", "retracao", "fluxo", "tres", "diminuicao", "dupla", "forca"];
export const CS_RULES = { targetR: 1.5, maxHold: 24, lookback: 5, padAtr: 0.2, minStopAtr: 0.7, maxStopAtr: 3, minN: 30, minValN: 10, minPf: 1.15 } as const;
export const CS_TFS = ["M15", "H1", "H4"] as const;
export type CsTf = (typeof CS_TFS)[number];
export const isCsTf = (t: string): t is CsTf => (CS_TFS as readonly string[]).includes(t);
/** Quanto histórico buscar para validar (o Yahoo limita: 15m ~60 dias, 60m ~730 dias). */
export const CS_RANGE: Record<CsTf, string> = { M15: "60d", H1: "1y", H4: "730d" };

const CROSSES = new Set(["EURJPY", "EURGBP", "GBPJPY", "AUDCAD", "AUDJPY"]);
/** Spread + deslize típicos de conta comum (pips). */
export const costPipsOf = (symbol: string) => (CROSSES.has(symbol) ? 2.0 : 1.2);

export interface CsPlan { dir: "BUY" | "SELL"; entry: number; sl: number; tp: number; riskAtr: number }

/** Stop e alvo pela estrutura das últimas velas. null = stop grande demais para operar. */
export function planFor(S: Series, i: number, buy: boolean, entry: number): CsPlan | null {
  const at = S.atr[i];
  if (!Number.isFinite(at) || at <= 0) return null;
  const win = S.c.slice(Math.max(0, i - CS_RULES.lookback + 1), i + 1);
  let sl = buy ? Math.min(...win.map((k) => k.l)) - CS_RULES.padAtr * at : Math.max(...win.map((k) => k.h)) + CS_RULES.padAtr * at;
  let risk = buy ? entry - sl : sl - entry;
  if (risk < CS_RULES.minStopAtr * at) { risk = CS_RULES.minStopAtr * at; sl = buy ? entry - risk : entry + risk; }
  if (risk > CS_RULES.maxStopAtr * at) return null;
  const tp = buy ? entry + CS_RULES.targetR * risk : entry - CS_RULES.targetR * risk;
  return { dir: buy ? "BUY" : "SELL", entry, sl, tp, riskAtr: risk / at };
}

export interface CsStats { n: number; wins: number; losses: number; timeouts: number; winRate: number | null; expR: number | null; pf: number | null; sumR: number }
export function statsR(rs: { r: number; out: "tp" | "sl" | "time" }[]): CsStats {
  const n = rs.length, sumR = rs.reduce((a, x) => a + x.r, 0);
  const gain = rs.filter((x) => x.r > 0).reduce((a, x) => a + x.r, 0), loss = -rs.filter((x) => x.r < 0).reduce((a, x) => a + x.r, 0);
  return {
    n, wins: rs.filter((x) => x.out === "tp").length, losses: rs.filter((x) => x.out === "sl").length, timeouts: rs.filter((x) => x.out === "time").length,
    winRate: n ? rs.filter((x) => x.r > 0).length / n : null, expR: n ? sumR / n : null, pf: loss > 0 ? gain / loss : gain > 0 ? 99 : null, sumR,
  };
}

export interface CsResult { strategy: BinStrategy; label: string; all: CsStats; development: CsStats; validation: CsStats; validated: boolean; reason: string }
export interface CsBacktest { results: Record<BinStrategy, CsResult>; candles: number; from: number | null; to: number | null; costPips: number }

export function verdict(all: CsStats, dev: CsStats, val: CsStats): { validated: boolean; reason: string } {
  if (all.n < CS_RULES.minN) return { validated: false, reason: `poucas operações no histórico (${all.n}; mínimo ${CS_RULES.minN})` };
  if (val.n < CS_RULES.minValN) return { validated: false, reason: `poucas operações no período de validação (${val.n})` };
  if ((dev.expR ?? 0) <= 0) return { validated: false, reason: `negativa no desenvolvimento (${fmtR(dev.expR)} por operação)` };
  if ((val.expR ?? 0) <= 0) return { validated: false, reason: `negativa na validação (${fmtR(val.expR)} por operação)` };
  if ((all.pf ?? 0) < CS_RULES.minPf) return { validated: false, reason: `fator de lucro ${(all.pf ?? 0).toFixed(2)} abaixo de ${CS_RULES.minPf}` };
  return { validated: true, reason: `positiva nos dois períodos (${fmtR(all.expR)} por operação, fator de lucro ${(all.pf ?? 0).toFixed(2)})` };
}
const fmtR = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`);

/** Backtest das 7 estratégias de uma vez (os sinais de cada vela são calculados uma só vez). Uma posição por estratégia. */
export function backtestCandle(c: Candle[], pip: number, costPips: number, S0?: Series): CsBacktest {
  const S = S0 ?? buildSeries(c);
  const trades: Record<BinStrategy, { at: number; r: number; out: "tp" | "sl" | "time" }[]> = Object.fromEntries(CS_LIST.map((s) => [s, []])) as never;
  const busy: Record<BinStrategy, number> = Object.fromEntries(CS_LIST.map((s) => [s, -1])) as never;
  for (let i = MIN_INDEX; i < c.length - 2; i++) {
    if (CS_LIST.every((s) => busy[s] > i)) continue;
    const sig = evalAt(S, i);
    for (const s of CS_LIST) {
      if (busy[s] > i || sig[s].level !== "confirmada") continue;
      const buy = sig[s].dir === "CALL", entry = c[i + 1].o;
      const p = planFor(S, i, buy, entry); if (!p) continue;
      const risk = Math.abs(entry - p.sl);
      let out: "tp" | "sl" | "time" = "time", r = 0, end = Math.min(c.length - 1, i + CS_RULES.maxHold);
      for (let j = i + 1; j <= end; j++) {
        const k = c[j];
        if (buy ? k.l <= p.sl : k.h >= p.sl) { out = "sl"; r = -1; end = j; break; }
        if (buy ? k.h >= p.tp : k.l <= p.tp) { out = "tp"; r = CS_RULES.targetR; end = j; break; }
      }
      if (out === "time") { if (end - i < CS_RULES.maxHold) continue; r = (buy ? c[end].c - entry : entry - c[end].c) / risk; } // sem velas até o prazo: não conta
      trades[s].push({ at: c[i + 1].t, r: r - (costPips * pip) / risk, out });
      busy[s] = end + 1;
    }
  }
  const from = c[MIN_INDEX]?.t ?? null, to = c.at(-1)?.t ?? null;
  const split = from !== null && to !== null ? from + (to - from) * 0.6 : 0;
  const results = Object.fromEntries(CS_LIST.map((s) => {
    const t = trades[s], all = statsR(t), development = statsR(t.filter((x) => x.at <= split)), validation = statsR(t.filter((x) => x.at > split));
    return [s, { strategy: s, label: STRATEGY_LABEL[s], all, development, validation, ...verdict(all, development, validation) }];
  })) as Record<BinStrategy, CsResult>;
  return { results, candles: c.length, from, to, costPips };
}

export interface CsSignalNow { strategy: BinStrategy; label: string; dir: "BUY" | "SELL"; validated: boolean; met: number; total: number; conds: { ok: boolean; text: string }[] }
export interface CsEntry extends CsPlan { strategy: BinStrategy; label: string; rr: number; riskPips: number; stats: CsStats; validation: CsStats; conds: string[] }

/** Agora: quais estratégias confirmaram na última vela fechada e, entre as VALIDADAS, a entrada (melhor resultado na validação). */
export function candleEntryNow(c: Candle[], pip: number, bt: CsBacktest, price: number, S0?: Series): { signals: CsSignalNow[]; entry: CsEntry | null } {
  const S = S0 ?? buildSeries(c), i = c.length - 1;
  if (i < MIN_INDEX) return { signals: [], entry: null };
  const sig = evalAt(S, i);
  const signals = CS_LIST.filter((s) => sig[s].level === "confirmada").map((s) => ({
    strategy: s, label: STRATEGY_LABEL[s], dir: sig[s].dir === "CALL" ? "BUY" as const : "SELL" as const, validated: bt.results[s].validated,
    met: sig[s].met, total: sig[s].total, conds: sig[s].conds,
  }));
  const ok = signals.filter((x) => x.validated).sort((a, b) => (bt.results[b.strategy].validation.expR ?? 0) - (bt.results[a.strategy].validation.expR ?? 0));
  for (const x of ok) {
    const p = planFor(S, i, x.dir === "BUY", price); if (!p) continue;
    return { signals, entry: { ...p, strategy: x.strategy, label: x.label, rr: CS_RULES.targetR, riskPips: Math.abs(price - p.sl) / pip,
      stats: bt.results[x.strategy].all, validation: bt.results[x.strategy].validation, conds: x.conds.filter((q) => q.ok).map((q) => q.text) } };
  }
  return { signals, entry: null };
}
