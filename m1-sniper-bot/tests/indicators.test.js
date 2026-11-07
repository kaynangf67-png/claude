'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../src/core/indicators.js');
const { generate } = require('../scripts/synthetic.js');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('SMA e EMA com valores conhecidos', () => {
  const v = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(I.sma(v, 3), [null, null, 2, 3, 4, 5]);
  const e = I.ema(v, 3); // k=0.5, seed=2
  assert.deepEqual(e.slice(0, 2), [null, null]);
  near(e[2], 2); near(e[3], 3); near(e[4], 4); near(e[5], 5);
  const e2 = I.ema([10, 10, 10, 20], 3);
  near(e2[3], 15);
});

test('RSI: série só de alta = 100, só de baixa = 0, constante = 50', () => {
  const up = Array.from({ length: 30 }, (_, i) => i);
  const down = up.map((x) => 100 - x);
  assert.equal(I.rsi(up, 14)[29], 100);
  assert.equal(I.rsi(down, 14)[29], 0);
  assert.equal(I.rsi(Array(30).fill(5), 14)[29], 50);
  assert.equal(I.rsi(up, 14)[13], null);
});

test('RSI de Wilder bate com cálculo de referência (dados clássicos de Wilder)', () => {
  // Série amplamente usada em material didático; RSI(14) no índice 14 ≈ 70.46 (tabela StockCharts)
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
  const r = I.rsi(closes, 14);
  near(r[14], 70.46, 0.01);
  near(r[15], 66.25, 0.01);
});

test('Bollinger: banda colapsa em série constante e envolve a média', () => {
  const b = I.bollinger(Array(25).fill(3), 20, 2);
  near(b.upper[24], 3); near(b.lower[24], 3); near(b.width[24], 0);
  const c = generate(100).map((x) => x.close);
  const bb = I.bollinger(c, 20, 2);
  for (let i = 19; i < 100; i++) assert.ok(bb.lower[i] <= bb.middle[i] && bb.middle[i] <= bb.upper[i]);
});

test('ADX: tendência limpa gera ADX alto e +DI > -DI; disponível a partir de 2p-1', () => {
  const candles = Array.from({ length: 60 }, (_, i) => ({ time: i, open: 100 + i, high: 101.5 + i, low: 99.5 + i, close: 101 + i }));
  const a = I.adx(candles, 14);
  assert.equal(a.adx[26], null);
  assert.ok(Number.isFinite(a.adx[27]));
  assert.ok(a.adx[59] > 50, `adx=${a.adx[59]}`);
  assert.ok(a.plusDI[59] > a.minusDI[59]);
});

test('Indicadores são causais (sem repintura): valor em i não muda com candles futuros', () => {
  const c = generate(400, { seed: 7 });
  const closes = c.map((x) => x.close);
  const full = { e: I.ema(closes, 200), r: I.rsi(closes, 14), a: I.adx(c, 14).adx, b: I.bollinger(closes, 20, 2).upper, t: I.atr(c, 14) };
  for (const i of [230, 300, 399]) {
    const cs = c.slice(0, i + 1);
    const cl = cs.map((x) => x.close);
    near(I.ema(cl, 200)[i], full.e[i]);
    near(I.rsi(cl, 14)[i], full.r[i]);
    near(I.adx(cs, 14).adx[i], full.a[i]);
    near(I.bollinger(cl, 20, 2).upper[i], full.b[i]);
    near(I.atr(cs, 14)[i], full.t[i]);
  }
});
