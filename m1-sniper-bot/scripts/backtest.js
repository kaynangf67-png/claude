#!/usr/bin/env node
/*
 * M1 SNIPER BOT — Backtest histórico do motor de sinais.
 *
 * Modelo: sinal no fechamento do candle i → entrada na abertura do candle i+1 → expiração no
 * fechamento de i+1 (opção binária de 1 minuto). close == open conta como EMPATE (devolução).
 * Uma operação por vez. Resultado em unidades de stake (GREEN = +payout, LOSS = -1).
 * Também simula a gestão diária (para no 10º GREEN ou no 3º LOSS do dia, data local).
 *
 * Uso:
 *   node scripts/backtest.js --symbols BTCUSDT,ETHUSDT --days 7         (Binance pública)
 *   node scripts/backtest.js --csv dados/eurusd.csv,dados/gbpusd.csv    (CSV: time,open,high,low,close)
 *   node scripts/backtest.js --synthetic                                 (só valida a mecânica)
 * Opções: --minScore 70 --adxMin 20 --payout 0.85 --out reports
 * Fuso: a data "do dia" usa o fuso do processo; ex.: TZ=America/Sao_Paulo node scripts/backtest.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../src/core/engine.js');
const H = require('../src/core/history.js');
const S = require('../src/core/stats.js');
const R = require('../src/core/risk.js');
const B = require('../src/data/binance.js');
const Settings = require('../src/core/settings.js');
const { generate } = require('./synthetic.js');

function args() {
  const a = process.argv.slice(2);
  const o = { symbols: 'BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT,EURUSDT', days: 7, minScore: 70, adxMin: 20, payout: 0.85, out: 'reports' };
  for (let i = 0; i < a.length; i++) {
    const k = a[i].replace(/^--/, '');
    if (k === 'synthetic') o.synthetic = true;
    else o[k] = a[i + 1], i++;
  }
  o.days = Number(o.days); o.minScore = Number(o.minScore); o.adxMin = Number(o.adxMin); o.payout = Number(o.payout);
  return o;
}

async function loadBinance(symbol, days) {
  const end = Math.floor(Date.now() / 60000) * 60000 - 1;
  const start = end - days * 86400000;
  let out = [];
  let cursor = start;
  while (cursor < end) {
    const part = await B.fetchKlines(symbol, { limit: 1000, startTime: cursor, endTime: end });
    if (!part.length) break;
    out = B.merge(out, part, Infinity);
    cursor = part[part.length - 1].time + 60000;
    await new Promise((r) => setTimeout(r, 150));
  }
  return out.filter((c) => c.closeTime < Date.now());
}

function simulate(asset, candles, opts) {
  const ind = E.computeIndicators(candles);
  const raw = [];
  for (let i = E.MIN_CANDLES - 1; i < candles.length - 1; i++) {
    const r = E.evaluateAt(candles, ind, i, { minScore: opts.minScore, adxMin: opts.adxMin });
    if (!r.signal) continue;
    const entry = candles[i + 1];
    if (entry.time - candles[i].time !== 60000) continue; // buraco nos dados
    raw.push({ asset, time: entry.time, direction: r.signal, score: r.score, result: H.binaryOutcome(r.signal, entry) });
    i++; // o candle de entrada fica ocupado; o próximo sinal pode surgir no fechamento dele
  }
  return raw;
}

/**
 * Gestão diária GLOBAL, como no painel: uma operação por vez entre todos os ativos
 * (no mesmo minuto, fica o sinal de maior pontuação), para no 10º GREEN ou no 3º LOSS do dia.
 */
function manage(items) {
  const sorted = items.slice().sort((a, b) => a.time - b.time || b.score - a.score);
  const out = [];
  let risk = null;
  let lastTime = null;
  for (const it of sorted) {
    if (it.time === lastTime) continue;
    risk = R.rollover(risk, it.time).state;
    if (!R.check(risk, { active: true }).ok) continue;
    const id = `${it.asset}:${it.time}`;
    risk = R.registerEntry(risk, id, { active: true }).state;
    risk = R.registerResult(risk, id, it.result, 1).state;
    out.push(it);
    lastTime = it.time;
  }
  return out;
}

function pct(x) { return x == null ? '—' : (x * 100).toFixed(1) + '%'; }

function table(title, stats, extra) {
  const rows = Object.entries(stats.byAsset).map(([k, s]) =>
    `| ${k} | ${s.count} | ${s.wins} | ${s.losses} | ${s.draws} | ${pct(s.winRate)} | ${s.net.toFixed(2)} | ${s.maxDrawdown.toFixed(2)} | ${s.maxLossStreak} |`);
  rows.push(`| **TOTAL** | **${stats.count}** | ${stats.wins} | ${stats.losses} | ${stats.draws} | **${pct(stats.winRate)}** | **${stats.net.toFixed(2)}** | ${stats.maxDrawdown.toFixed(2)} | ${stats.maxLossStreak} |`);
  return [`### ${title}`, extra || '', '', '| Ativo | Sinais | GREEN | LOSS | Empate | Acerto | Resultado (stakes) | Drawdown máx. (stakes) | Seq. LOSS máx. |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|', ...rows, ''].join('\n');
}

(async () => {
  const o = args();
  const datasets = [];
  if (o.synthetic) {
    for (const [i, name] of ['SINT-A', 'SINT-B', 'SINT-C'].entries()) datasets.push({ asset: name, candles: generate(o.days * 1440, { seed: 100 + i }) });
  } else if (o.csv) {
    for (const f of String(o.csv).split(',')) {
      const { candles, errors } = Settings.parseCandlesCSV(fs.readFileSync(f, 'utf8'));
      if (errors.length) console.warn(`${f}: ${errors.length} linhas ignoradas`);
      datasets.push({ asset: path.basename(f).replace(/\.[^.]+$/, ''), candles });
    }
  } else {
    for (const s of o.symbols.split(',')) {
      process.stderr.write(`Baixando ${s} (${o.days} dias)… `);
      try {
        const candles = await loadBinance(s, o.days);
        process.stderr.write(`${candles.length} candles\n`);
        datasets.push({ asset: s, candles });
      } catch (e) {
        process.stderr.write(`falhou: ${e.message}\n`);
      }
    }
  }
  if (!datasets.length) { console.error('Nenhum dado carregado.'); process.exit(1); }

  const raw = [];
  const coverage = [];
  for (const d of datasets) {
    const bad = E.validateCandles(d.candles);
    if (bad) { console.error(`${d.asset}: ${bad}`); continue; }
    raw.push(...simulate(d.asset, d.candles, o));
    coverage.push(`${d.asset}: ${d.candles.length} candles, ${new Date(d.candles[0].time).toISOString().slice(0, 16)} → ${new Date(d.candles[d.candles.length - 1].time).toISOString().slice(0, 16)} UTC`);
  }
  const sRaw = S.compute(raw, o.payout);
  const managed = manage(raw);
  const sMan = S.compute(managed, o.payout);
  const days = new Set(raw.map((x) => R.localDateKey(x.time))).size;
  const label = o.synthetic ? 'DADOS SINTÉTICOS (validação da mecânica — NÃO representa mercado real)' : o.csv ? 'CSV fornecido' : 'Binance Spot (API pública)';
  const md = [
    `# Backtest M1 SNIPER BOT — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '',
    `**Fonte:** ${label}  `,
    `**Parâmetros:** minScore ${o.minScore}, ADX mín. ${o.adxMin}, payout ${(o.payout * 100).toFixed(0)}% → break-even ${pct(sRaw.breakeven)}  `,
    `**Modelo:** entrada na abertura do candle seguinte ao sinal, expiração 1 min, uma operação por vez.`, '',
    '**Cobertura:**', ...coverage.map((c) => `- ${c}`), '',
    table('Todos os sinais (sem gestão diária)', sRaw, `Dias com sinal: ${days}. Média ${(sRaw.count / Math.max(days, 1)).toFixed(1)} sinais/dia.`),
    table('Com gestão diária global (uma operação por vez, para em 10 GREEN ou 3 LOSS)', sMan, `Operações: ${sMan.count} em ${new Set(managed.map((x) => R.localDateKey(x.time))).size} dias.`),
    '> Resultado passado não garante resultado futuro. Preços da Binance não são os preços da Quotex;',
    '> pares OTC da corretora não têm fonte independente e não podem ser validados por este backtest.', '',
  ].join('\n');
  fs.mkdirSync(o.out, { recursive: true });
  const stamp = o.synthetic ? 'synthetic' : new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(o.out, `backtest-${stamp}.md`), md);
  fs.writeFileSync(path.join(o.out, `backtest-${stamp}.json`), JSON.stringify({ params: o, raw: sRaw, managed: sMan, trades: raw }, null, 2));
  console.log(md);
})();
