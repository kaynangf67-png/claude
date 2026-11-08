import test from 'node:test';
import assert from 'node:assert/strict';
import { swings, backtestPriceAction, analyzePriceActionAt, PA_REQUIRED } from '../src/core/strategies/priceAction.js';
import { analyzeStrategy } from '../src/core/engine.js';
import { series } from './helpers.js';

test('topos/fundos só são confirmados com 2 velas fechadas depois', () => {
  const k = (h, l) => ({ open: (h + l) / 2, close: (h + l) / 2, high: h, low: l });
  const c = [k(1, 0.5), k(2, 1), k(5, 4), k(3, 2), k(2, 1)];
  assert.equal(swings(c, 0, 4, 2).highs.length, 1);
  assert.equal(swings(c, 0, 3, 2).highs.length, 0); // ainda não confirmado
});

test('price action não usa o futuro e exige 30 velas', () => {
  const cs = series(800, { drift: 0.002, noise: 0.06, seed: 5 });
  const full = backtestPriceAction(cs).map((t) => t.time + t.direction);
  const cut = backtestPriceAction(cs.slice(0, 500)).map((t) => t.time + t.direction);
  assert.deepEqual(full.filter((x) => parseInt(x) <= cs[499].time), cut);
  assert.equal(analyzeStrategy(cs.slice(0, PA_REQUIRED - 1), { strategy: 'priceAction' }).status, 'invalid');
});

test('sinal de price action: COMPRA só com tendência de alta, Fibonacci, S/R, pullback e vela de rejeição', () => {
  let n = 0;
  for (let seed = 1; seed < 60 && n < 5; seed++) {
    const cs = series(400, { drift: seed % 2 ? 0.003 : -0.003, noise: 0.06, seed });
    for (let i = PA_REQUIRED; i < cs.length; i++) {
      const r = analyzePriceActionAt(cs, i);
      if (r.status !== 'signal') continue;
      n++;
      assert.ok(r.signal.checks.every((k) => k.status === 'ok'));
      assert.deepEqual(r.signal.checks.map((k) => k.id), ['trend', 'fib', 'pull', 'sr', 'candle', 'room']);
    }
  }
  assert.ok(n > 0);
});
