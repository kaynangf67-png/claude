#!/usr/bin/env node
// Uso:
//   node scripts/backtest.mjs --symbol BTCUSDT --days 7 [--payout 0.85] [--tz America/Sao_Paulo] [--min-score 80]
//   node scripts/backtest.mjs --csv arquivo.csv --symbol EURUSD
// CSV: time(ms ou ISO),open,high,low,close  (com cabeçalho)
import { readFileSync } from 'node:fs';
import { fetchHistory } from '../src/data/binance.js';
import { runBacktest } from '../src/core/backtest.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));

const symbols = String(args.symbol || 'BTCUSDT').split(',');
const days = Number(args.days || 7);
const payout = Number(args.payout || 0.85);
const tz = args.tz || 'America/Sao_Paulo';
const config = args['min-score'] ? { minScore: Number(args['min-score']) } : {};

function loadCsv(path) {
  const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/).slice(1);
  return lines.map((l) => {
    const [t, o, h, lo, c] = l.split(/[,;]/);
    const time = /^\d+$/.test(t) ? Number(t) : Date.parse(t);
    return { time, open: +o, high: +h, low: +lo, close: +c };
  }).sort((a, b) => a.time - b.time);
}

const pct = (x) => (x * 100).toFixed(1) + '%';
const all = [];
for (const symbol of symbols) {
  const candles = args.csv ? loadCsv(args.csv) : await fetchHistory(symbol, { minutes: days * 1440 });
  const r = runBacktest(candles, { symbol, payout, tz, config });
  all.push(...r.trades);
  const s = r.stats;
  console.log(`\n=== ${symbol} — ${r.candles} candles M1 (${new Date(candles[0].time).toISOString()} → ${new Date(candles.at(-1).time).toISOString()})`);
  console.log(`Sinais: ${s.total} | GREEN ${s.wins} | LOSS ${s.losses} | EMPATE ${s.draws}`);
  console.log(`Taxa de acerto: ${pct(s.winRate)} (break-even com payout ${payout}: ${pct(s.breakEven)})`);
  console.log(`Resultado: ${s.netStakes.toFixed(2)} entradas | Drawdown máx: ${s.maxDrawdownStakes.toFixed(2)} entradas | Maior sequência de LOSS: ${s.maxLossStreak}`);
  console.log(`Dias com trava acionada: ${r.lockedDays} de ${s.distinctDays} dias com sinais`);
  console.log('Por horário (' + tz + '):');
  for (const [h, v] of Object.entries(s.byHour)) console.log(`  ${h}: ${v.total} sinais, ${pct(v.winRate)}`);
}
if (symbols.length > 1) {
  const { computeStats } = await import('../src/core/stats.js');
  const s = computeStats(all, payout, tz);
  console.log(`\n=== TOTAL: ${s.total} sinais, acerto ${pct(s.winRate)}, resultado ${s.netStakes.toFixed(2)} entradas, DD ${s.maxDrawdownStakes.toFixed(2)}`);
  for (const [a, v] of Object.entries(s.byAsset)) console.log(`  ${a}: ${v.total} sinais, ${pct(v.winRate)}, ${v.netStakes.toFixed(2)} entradas`);
}
console.log('\nAviso: resultado passado não garante resultado futuro. A pontuação NÃO é probabilidade de acerto.');
