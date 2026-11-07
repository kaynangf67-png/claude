'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/core/patterns.js');

const C = (o, h, l, c) => ({ open: o, high: h, low: l, close: c });

test('Engolfo de alta e de baixa', () => {
  const bull = [C(10, 10.1, 9.4, 9.5), C(9.45, 10.3, 9.4, 10.2)];
  assert.deepEqual(P.engulfing(bull, 1, 0.5).map((p) => p.name), ['bullishEngulfing']);
  const bear = [C(9.5, 10.1, 9.4, 10), C(10.05, 10.1, 9.2, 9.3)];
  assert.deepEqual(P.engulfing(bear, 1, 0.5).map((p) => p.name), ['bearishEngulfing']);
  // corpo pequeno demais em relação ao ATR → não conta
  assert.equal(P.engulfing(bull, 1, 5).length, 0);
});

test('Pin bar de alta e de baixa', () => {
  const hammer = [C(10, 10, 10, 10), C(10, 10.05, 9.0, 10.04)];
  assert.deepEqual(P.pinBar(hammer, 1, 0.8).map((p) => p.direction), ['CALL']);
  const star = [C(10, 10, 10, 10), C(10, 11, 9.95, 9.97)];
  assert.deepEqual(P.pinBar(star, 1, 0.8).map((p) => p.direction), ['PUT']);
  const doji = [C(10, 10, 10, 10), C(10, 10.5, 9.5, 10.02)];
  assert.equal(P.pinBar(doji, 1, 0.8).length, 0);
});

test('Rompimento confirmado pelo fechamento', () => {
  const base = Array.from({ length: 21 }, () => C(10, 10.2, 9.8, 10));
  const up = base.concat(C(10.1, 10.6, 10.08, 10.55));
  assert.ok(P.breakout(up, 21, 0.4, {}).some((p) => p.name === 'bullishBreakout'));
  // pavio acima mas fechamento abaixo da resistência → não é rompimento
  const fake = base.concat(C(10, 10.6, 9.95, 10.15));
  assert.equal(P.breakout(fake, 21, 0.4, {}).length, 0);
});

test('Rejeição de suporte', () => {
  const base = Array.from({ length: 21 }, (_, i) => C(10.5, 10.7, 10 + (i === 5 ? 0 : 0.2), 10.5));
  const rej = base.concat(C(10.3, 10.5, 10.0, 10.45));
  const pats = P.rejection(rej, 21, 0.4, {});
  assert.ok(pats.some((p) => p.direction === 'CALL'), JSON.stringify(pats));
});
