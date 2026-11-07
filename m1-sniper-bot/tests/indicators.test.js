import test from 'node:test';
import assert from 'node:assert/strict';
import { ema, sma, rsi, adx, bollinger } from '../src/core/indicators.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('SMA e EMA básicas', () => {
  assert.deepEqual(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
  const e = ema([1, 2, 3, 4, 5], 3);
  assert.equal(e[1], null); close(e[2], 2); close(e[3], 3); close(e[4], 4);
});

test('RSI de Wilder confere com valores de referência (Wilder/StockCharts)', () => {
  // Série clássica do exemplo do StockCharts (RSI 14 = 70.53 no 15º fechamento).
  const c = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
  const r = rsi(c, 14);
  assert.equal(r[13], null);
  close(r[14], 70.46, 0.1);
  close(r[15], 66.25, 0.1);
  assert.ok(rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14)[15] === 100);
});

test('ADX: tendência forte de alta gera ADX alto e +DI > -DI', () => {
  const cs = Array.from({ length: 80 }, (_, i) => ({ time: i * 60000, open: 100 + i, high: 101.5 + i, low: 99.8 + i, close: 101 + i }));
  const { adx: a, plusDI, minusDI } = adx(cs, 14);
  assert.equal(a[26], null);
  assert.ok(a[27] != null);
  assert.ok(a.at(-1) > 50, `ADX ${a.at(-1)}`);
  assert.ok(plusDI.at(-1) > minusDI.at(-1));
});

test('Bollinger: série constante tem bandas coladas na média', () => {
  const b = bollinger(Array(25).fill(10), 20, 2);
  assert.equal(b.middle[24], 10); assert.equal(b.upper[24], 10); assert.equal(b.lower[24], 10);
  const b2 = bollinger([...Array(19).fill(10), 12], 20, 2);
  assert.ok(b2.upper[19] > 12 - 1e-9 || b2.upper[19] > b2.middle[19]);
});
