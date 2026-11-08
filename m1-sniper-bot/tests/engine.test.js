import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, REQUIRED_CANDLES, computeIndicators, analyzeAt, DEFAULT_ENGINE_CONFIG } from '../src/core/engine.js';
import { runBacktest, outcomeOf } from '../src/core/backtest.js';
import { validateSeries, closedOnly, mergeCandles } from '../src/core/validate.js';
import { series } from './helpers.js';

test('dados insuficientes ou com lacuna não geram sinal', () => {
  assert.equal(analyze(series(100)).status, 'invalid');
  const s = series(300); s.splice(150, 1);
  assert.equal(analyze(s).status, 'invalid');
  const bad = series(300); bad[299] = { ...bad[299], high: bad[299].low - 1 };
  assert.equal(analyze(bad).status, 'invalid');
});

test('mercado lateral (sem tendência) não gera sinal', () => {
  const r = analyze(series(REQUIRED_CANDLES + 40, { drift: 0, noise: 0.02 }), {}, { symbol: 'X' });
  assert.notEqual(r.status, 'signal');
});

test('nenhum sinal com indicadores contraditórios: CALL exige EMA9>EMA21 e preço acima da EMA200', () => {
  const cs = series(REQUIRED_CANDLES + 60, { drift: -0.02, noise: 0.03 });
  const ind = computeIndicators(cs);
  for (let i = REQUIRED_CANDLES; i < cs.length; i++) {
    const r = analyzeAt(cs, ind, i, DEFAULT_ENGINE_CONFIG);
    if (r.status === 'signal') assert.equal(r.signal.direction, 'PUT');
  }
});

test('sinal tem pontuação >= mínimo, motivos e horários de entrada/expiração corretos', () => {
  let found = null;
  for (let seed = 1; seed < 400 && !found; seed++) {
    const cs = series(REQUIRED_CANDLES + 120, { drift: 0.004, noise: 0.03, seed });
    const ind = computeIndicators(cs);
    for (let i = REQUIRED_CANDLES; i < cs.length && !found; i++) {
      const r = analyzeAt(cs, ind, i, DEFAULT_ENGINE_CONFIG, { symbol: 'X' });
      if (r.status === 'signal') found = { r, c: cs[i] };
    }
  }
  assert.ok(found, 'nenhum sinal encontrado nas séries sintéticas');
  const { signal } = found.r;
  assert.ok(signal.score >= 80 && signal.score <= 100);
  assert.ok(signal.reasons.length >= 4);
  assert.equal(signal.entryTime, found.c.time + 60000);
  assert.equal(signal.expiryTime, found.c.time + 120000);
});

test('backtest não usa candles futuros: resultado igual com série truncada', () => {
  const cs = series(REQUIRED_CANDLES + 400, { drift: 0.003, noise: 0.04, seed: 7 });
  const full = runBacktest(cs, { applyDailyLimits: false });
  const cut = runBacktest(cs.slice(0, REQUIRED_CANDLES + 200), { applyDailyLimits: false });
  const cutoff = cs[REQUIRED_CANDLES + 199].time;
  const a = full.trades.filter((t) => t.time <= cutoff).map((t) => t.time + t.direction);
  const b = cut.trades.map((t) => t.time + t.direction);
  assert.deepEqual(a, b);
});

test('outcome e utilidades de série', () => {
  assert.equal(outcomeOf('CALL', { open: 1, close: 2 }), 'GREEN');
  assert.equal(outcomeOf('PUT', { open: 1, close: 2 }), 'LOSS');
  assert.equal(outcomeOf('PUT', { open: 1, close: 1 }), 'DRAW');
  const s = series(5);
  assert.equal(closedOnly(s, s[4].time + 59999).length, 4);
  assert.equal(mergeCandles(s.slice(0, 3), s.slice(2), 10).length, 5);
  assert.equal(validateSeries(s, 5).ok, true);
});

test('modo rápido: analisa com 12 velas usando indicadores curtos', async () => {
  const { profileForCount, QUICK_REQUIRED } = await import('../src/core/engine.js');
  assert.equal(profileForCount(11), null);
  const p = profileForCount(QUICK_REQUIRED);
  assert.equal(p.name, 'rápido');
  assert.equal(profileForCount(60).fast, 9);
  assert.equal(profileForCount(260).long, 200);
  const cs = series(QUICK_REQUIRED, { drift: 0.01, noise: 0.03, seed: 3 });
  const r = analyze(cs, { profile: p, longEma: p.long }, { symbol: 'QX:X' });
  assert.notEqual(r.status, 'invalid', r.reason);
  assert.equal(analyze(cs.slice(1), { profile: p, longEma: p.long }).status, 'invalid');
  assert.match(r.best.checks.find((c) => c.id === 'rsi').label, /RSI 6/);
});
