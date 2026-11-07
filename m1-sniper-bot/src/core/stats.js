// Estatísticas de validação (taxa de acerto, drawdown, por ativo, por horário).
import { localHour, dayKey } from './time.js';

/**
 * @param {Array<{result:'GREEN'|'LOSS'|'DRAW', time:number, symbol:string, amount?:number}>} rows
 * @param {number} payout fração paga no GREEN (ex.: 0.85)
 */
export function computeStats(rows, payout = 0.85, tz = 'UTC') {
  const resolved = rows.filter((r) => r.result === 'GREEN' || r.result === 'LOSS' || r.result === 'DRAW')
    .sort((a, b) => a.time - b.time);
  const base = summarize(resolved, payout);
  const byAsset = groupBy(resolved, (r) => r.symbol, payout);
  const byHour = groupBy(resolved, (r) => String(localHour(r.time, tz)).padStart(2, '0') + 'h', payout);
  const days = new Set(resolved.map((r) => dayKey(r.time, tz)));
  return { ...base, byAsset, byHour, distinctDays: days.size };
}

function summarize(rows, payout) {
  let wins = 0, losses = 0, draws = 0, equity = 0, peak = 0, maxDD = 0, money = 0, moneyPeak = 0, moneyDD = 0;
  let streak = 0, maxLossStreak = 0;
  for (const r of rows) {
    const amt = r.amount ?? 1;
    if (r.result === 'GREEN') { wins++; equity += payout; money += amt * payout; streak = 0; }
    else if (r.result === 'LOSS') { losses++; equity -= 1; money -= amt; streak++; maxLossStreak = Math.max(maxLossStreak, streak); }
    else draws++;
    peak = Math.max(peak, equity); maxDD = Math.max(maxDD, peak - equity);
    moneyPeak = Math.max(moneyPeak, money); moneyDD = Math.max(moneyDD, moneyPeak - money);
  }
  const decided = wins + losses;
  return {
    total: rows.length, wins, losses, draws,
    winRate: decided ? wins / decided : 0,
    breakEven: 1 / (1 + payout),
    netStakes: equity,               // resultado em "unidades de entrada"
    maxDrawdownStakes: maxDD,
    netMoney: money, maxDrawdownMoney: moneyDD,
    maxLossStreak,
  };
}

function groupBy(rows, keyFn, payout) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return Object.fromEntries([...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, summarize(v, payout)]));
}

// Critérios mínimos para PERMITIR que o usuário considere o modo REAL.
export const REAL_CRITERIA = Object.freeze({
  minDemoTrades: 100,        // operações DEMO com resultado registrado
  minSignals: 100,           // sinais registrados com resultado medido
  minDistinctDays: 5,        // evita amostra de um único dia
  winRateMarginOverBreakEven: 0.03, // taxa de acerto >= break-even + 3 p.p.
  maxDrawdownStakes: 10,     // drawdown máximo em unidades de entrada
});

export const REAL_CONFIRM_PHRASE = 'ENTENDO OS RISCOS E QUERO O MODO REAL';

export function realReadiness(state, now = Date.now()) {
  const payout = state.settings.payout;
  const tz = state.settings.timeZone;
  const demo = state.trades.filter((t) => t.mode === 'DEMO');
  const ds = computeStats(demo, payout, tz);
  const sigRows = state.signalLog.filter((s) => s.outcome).map((s) => ({ result: s.outcome, time: s.confirmCandleTime, symbol: s.symbol }));
  const ss = computeStats(sigRows, payout, tz);
  const C = REAL_CRITERIA;
  const checks = [
    { id: 'trades', label: `≥ ${C.minDemoTrades} operações DEMO registradas`, ok: ds.total >= C.minDemoTrades, value: ds.total },
    { id: 'signals', label: `≥ ${C.minSignals} sinais com resultado medido`, ok: ss.total >= C.minSignals, value: ss.total },
    { id: 'days', label: `≥ ${C.minDistinctDays} dias diferentes de teste`, ok: ds.distinctDays >= C.minDistinctDays, value: ds.distinctDays },
    { id: 'winrate', label: `Taxa de acerto DEMO ≥ break-even + ${C.winRateMarginOverBreakEven * 100} p.p. (${((ds.breakEven + C.winRateMarginOverBreakEven) * 100).toFixed(1)}%)`, ok: ds.wins + ds.losses > 0 && ds.winRate >= ds.breakEven + C.winRateMarginOverBreakEven, value: `${(ds.winRate * 100).toFixed(1)}%` },
    { id: 'expectancy', label: 'Resultado líquido DEMO positivo', ok: ds.netStakes > 0, value: ds.netStakes.toFixed(2) + ' entradas' },
    { id: 'drawdown', label: `Drawdown máximo ≤ ${C.maxDrawdownStakes} entradas`, ok: ds.total > 0 && ds.maxDrawdownStakes <= C.maxDrawdownStakes, value: ds.maxDrawdownStakes.toFixed(2) },
  ];
  return { ready: checks.every((c) => c.ok), checks, demoStats: ds, signalStats: ss };
}
