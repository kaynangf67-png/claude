import test from 'node:test';
import assert from 'node:assert/strict';
import * as PA from '../src/core/priceAction.js';

const k = (open, high, low, close, t = 0) => ({ time: t, open, high, low, close });

test('engolfos', () => {
  assert.ok(PA.bullishEngulfing([k(10, 10.1, 9.4, 9.5), k(9.4, 10.3, 9.3, 10.2)], 1));
  assert.ok(!PA.bullishEngulfing([k(10, 10.1, 9.4, 9.5), k(9.6, 9.9, 9.5, 9.8)], 1));
  assert.ok(PA.bearishEngulfing([k(9.5, 10.1, 9.4, 10), k(10.1, 10.2, 9.3, 9.4)], 1));
});

test('pin bars', () => {
  assert.ok(PA.bullishPinBar([k(10, 10.05, 9, 10.02)], 0));
  assert.ok(PA.bearishPinBar([k(10, 11, 9.97, 9.98)], 0));
  assert.ok(!PA.bullishPinBar([k(10, 11, 9.9, 10.9)], 0));
});

test('rompimento exige FECHAMENTO acima da máxima anterior', () => {
  const c = Array.from({ length: 12 }, (_, i) => k(10, 10.2, 9.9, 10.05 + (i % 2 ? 0.05 : -0.05), i));
  c.push(k(10.05, 10.6, 10.04, 10.55, 12));
  assert.ok(PA.bullishBreakout(c, 12));
  c[12] = k(10.05, 10.6, 10.04, 10.15, 12); // só pavio rompeu
  assert.ok(!PA.bullishBreakout(c, 12));
});
