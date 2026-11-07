/*
 * M1 SNIPER BOT — Estatísticas (taxa de acerto, drawdown, por ativo) e validação DEMO → REAL.
 * Resultado em "unidades de stake": GREEN = +payout, LOSS = -1, EMPATE = 0.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.M1 = root.M1 || {};
  root.M1.Stats = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function compute(items, payout) {
    const p = Number.isFinite(payout) ? payout : 0.85;
    const base = () => ({ count: 0, wins: 0, losses: 0, draws: 0, net: 0, peak: 0, maxDrawdown: 0, lossStreak: 0, maxLossStreak: 0 });
    const all = base();
    const byAsset = {};
    const push = (acc, r) => {
      acc.count++;
      if (r === 'GREEN') { acc.wins++; acc.net += p; acc.lossStreak = 0; }
      else if (r === 'LOSS') { acc.losses++; acc.net -= 1; acc.lossStreak++; acc.maxLossStreak = Math.max(acc.maxLossStreak, acc.lossStreak); }
      else acc.draws++;
      acc.peak = Math.max(acc.peak, acc.net);
      acc.maxDrawdown = Math.max(acc.maxDrawdown, acc.peak - acc.net);
    };
    for (const it of items) {
      if (!it || !['GREEN', 'LOSS', 'EMPATE'].includes(it.result)) continue;
      push(all, it.result);
      const k = it.asset || '—';
      byAsset[k] = byAsset[k] || base();
      push(byAsset[k], it.result);
    }
    const finish = (a) => {
      const decided = a.wins + a.losses;
      return {
        count: a.count, wins: a.wins, losses: a.losses, draws: a.draws,
        winRate: decided ? a.wins / decided : null,
        net: +a.net.toFixed(4), maxDrawdown: +a.maxDrawdown.toFixed(4), maxLossStreak: a.maxLossStreak,
      };
    };
    const out = finish(all);
    out.payout = p;
    out.breakeven = 1 / (1 + p);
    out.byAsset = Object.fromEntries(Object.entries(byAsset).map(([k, v]) => [k, finish(v)]));
    return out;
  }

  const REAL_REQUIREMENTS = Object.freeze({ minDemoTrades: 50, marginOverBreakeven: 0.05 });

  /** Só libera REAL depois de N operações registradas em DEMO com acerto acima do break-even + margem. */
  function realValidation(trades, payout) {
    const demo = trades.filter((t) => t.accountMode === 'DEMO');
    const s = compute(demo, payout);
    const need = s.breakeven + REAL_REQUIREMENTS.marginOverBreakeven;
    const decided = s.wins + s.losses;
    const ok = decided >= REAL_REQUIREMENTS.minDemoTrades && s.winRate != null && s.winRate >= need;
    let reason = '';
    if (decided < REAL_REQUIREMENTS.minDemoTrades) reason = `Faltam ${REAL_REQUIREMENTS.minDemoTrades - decided} operações DEMO com resultado.`;
    else if (!ok) reason = `Acerto DEMO ${(s.winRate * 100).toFixed(1)}% abaixo do exigido ${(need * 100).toFixed(1)}%.`;
    return { ok, reason, stats: s, required: need, decided };
  }

  return { compute, realValidation, REAL_REQUIREMENTS };
});
