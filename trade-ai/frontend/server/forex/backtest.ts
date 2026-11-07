import type { Profile } from "./profile.js";
import { analyze, type ForexAnalysis } from "./engine.js";
import { computeStats, type Resolved, type Stats } from "./history.js";
import { HORIZON_TFS, TF_SECONDS, type Candle, type Dir, type Horizon } from "./types.js";

/**
 * Backtest passo a passo: em cada vela M5 só existem velas FECHADAS até aquele momento (sem look-ahead, sem repintar).
 * Sem M1 na história longa: o gatilho usa o M5. Custos: spread + slippage em pips, descontados em R.
 */
export interface BtOptions { pip: number; label: string; symbol: string; currencies: string[]; spreadPips?: number; slipPips?: number; stride?: number; maxHold?: number; budgetMs?: number; profile?: Profile; horizon?: Horizon }
export interface BtTrade extends Resolved { rGross: number; strategyId: number }
export interface BtResult {
  steps: number; analyzed: number; truncated: boolean; trades: number;
  development: Stats; validation: Stats; all: Stats; splitAt: number | null; costsPips: number;
  verdict: string; byStrategy: Record<string, { n: number; expectancyR: number | null }>;
  list: BtTrade[];
}

/** m5 = velas do SETUP (M5 no curto, H1 no swing); h1 = velas de CONTEXTO (H1 no curto, D1 no swing). */
export function runBacktest(m5: Candle[], h1: Candle[], o: BtOptions): BtResult {
  const horizon = o.horizon ?? "curto", R = HORIZON_TFS[horizon];
  const stepS = TF_SECONDS[R.setup], ctxS = TF_SECONDS[R.ctx];
  // curto: no máximo 12 velas de M5 (1 hora). swing: no máximo 120 velas de H1 (5 dias de mercado)
  const spread = o.spreadPips ?? 1.0, slip = o.slipPips ?? 0.2, stride = o.stride ?? (horizon === "swing" ? 2 : 3), maxHold = o.maxHold ?? (horizon === "swing" ? 120 : 12);
  const t0 = Date.now(), budget = o.budgetMs ?? 40_000;
  const trades: BtTrade[] = [];
  let analyzed = 0, truncated = false;
  let i = 400, p1 = 0;
  for (; i < m5.length - 2; i += stride) {
    if (Date.now() - t0 > budget) { truncated = true; break; }
    const now = m5[i].t + stepS;
    while (p1 < h1.length && h1[p1].t + ctxS <= now) p1++;
    if (p1 < 90) continue;
    const a: ForexAnalysis = analyze({
      symbol: o.symbol, label: o.label, pip: o.pip, currencies: o.currencies, now, events: null, skipFreshness: true,
      candles: { H1: h1.slice(Math.max(0, p1 - 400), p1), M5: m5.slice(Math.max(0, i - 399), i + 1), M1: null }, profile: o.profile, horizon,
    });
    analyzed++;
    if (a.decision === "NO_TRADE" || !a.trade || !a.chosen) continue;
    const t = a.trade, dir: Dir = a.trade.dir, buy = dir === "BUY", tp1 = t.tps[0]!, risk = t.riskDist;
    const costR = ((spread + slip) * o.pip) / risk, rr = Math.abs(tp1 - t.entry) / risk;
    let status: BtTrade["status"] = "expirado", rGross = 0, closedAt = m5[Math.min(m5.length - 1, i + maxHold)].t, j = i + 1;
    for (; j < Math.min(m5.length, i + 1 + maxHold); j++) {
      const k = m5[j];
      const hitSl = buy ? k.l <= t.sl : k.h >= t.sl, hitTp = buy ? k.h >= tp1 : k.l <= tp1;
      if (hitSl && hitTp) { status = "ambiguo"; rGross = -1; closedAt = k.t; break; }
      if (hitSl) { status = "stop"; rGross = -1; closedAt = k.t; break; }
      if (hitTp) { status = "tp1"; rGross = rr; closedAt = k.t; break; }
    }
    if (status === "expirado") { const k = m5[Math.min(m5.length - 1, j - 1)]; rGross = (buy ? k.c - t.entry : t.entry - k.c) / risk; closedAt = k.t; }
    trades.push({ id: `${a.at}-${a.symbol}`, symbol: o.symbol, label: o.label, at: m5[i].t + stepS, tf: R.setup, dir, strategy: a.chosen.name, strategyId: a.chosen.id,
      entry: t.entry, sl: t.sl, tps: t.tps, score: a.score!.total, reasons: a.favor.slice(0, 3), pip: o.pip, status, r: rGross - costR, rGross, closedAt });
    i = Math.max(i, j); // sem sobreposição: só volta a analisar depois que a operação termina
  }
  const first = trades[0]?.at ?? null, last = trades.at(-1)?.at ?? null;
  const splitAt = first !== null && last !== null ? first + (last - first) * 0.6 : null;
  const dev = trades.filter((t) => splitAt === null || t.at <= splitAt), val = trades.filter((t) => splitAt !== null && t.at > splitAt);
  const all = computeStats(trades), development = computeStats(dev), validation = computeStats(val);
  const byStrategy: BtResult["byStrategy"] = {};
  for (const g of all.byStrategy) { const rs = trades.filter((t) => t.strategy === g.key); byStrategy[g.key] = { n: g.n, expectancyR: rs.length ? rs.reduce((s, r) => s + (r.r ?? 0), 0) / rs.length : null }; }
  let verdict = "Sem amostra suficiente: são necessárias ao menos 100 operações, e pelo menos 30 na validação.";
  if (all.n >= 100 && validation.n >= 30) {
    verdict = (validation.expectancy ?? 0) > 0 && (development.expectancy ?? 0) > 0
      ? "Expectativa positiva em desenvolvimento e validação (com custos). Ainda exige teste em tempo real antes de qualquer confiança."
      : "Sem vantagem comprovada: a expectativa na validação não é positiva depois dos custos.";
  }
  return { steps: Math.ceil((m5.length - 402) / stride), analyzed, truncated, trades: trades.length, development, validation, all, splitAt, costsPips: spread + slip, verdict, byStrategy, list: trades.slice(-200) };
}
