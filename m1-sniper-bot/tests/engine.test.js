'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/core/engine.js');
const { generate } = require('../scripts/synthetic.js');

test('histórico insuficiente não gera sinal', () => {
  const r = E.evaluate(generate(100));
  assert.equal(r.signal, null);
  assert.match(r.rejections[0], /insuficiente/);
});

test('dados inválidos são rejeitados', () => {
  const c = generate(300);
  c[150] = Object.assign({}, c[150], { high: c[150].low - 1 });
  assert.match(E.evaluate(c).rejections[0], /inválidos/);
});

test('mercado lateral e plano: nenhum sinal', () => {
  const c = Array.from({ length: 300 }, (_, i) => ({ time: i * 60000, open: 100, high: 100.01, low: 99.99, close: 100 + (i % 2 ? 0.001 : -0.001) }));
  const ind = E.computeIndicators(c);
  for (let i = 229; i < 300; i++) assert.equal(E.evaluateAt(c, ind, i).signal, null);
});

test('evaluateAt com indicadores da série completa == evaluate no recorte (sem lookahead)', () => {
  const c = generate(3000, { seed: 11 });
  const ind = E.computeIndicators(c);
  let checked = 0;
  for (let i = 229; i < c.length; i += 37) {
    const a = E.evaluateAt(c, ind, i);
    const b = E.evaluate(c.slice(0, i + 1));
    assert.equal(a.signal, b.signal);
    assert.equal(a.score, b.score);
    checked++;
  }
  assert.ok(checked > 50);
});

test('sinais emitidos respeitam todas as regras', () => {
  let n = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const c = generate(6000, { seed });
    const ind = E.computeIndicators(c);
    for (let i = 229; i < c.length; i++) {
      const r = E.evaluateAt(c, ind, i);
      if (!r.signal) continue;
      n++;
      const v = r.snapshot, k = c[i];
      assert.ok(r.score >= 70 && r.score <= 100);
      assert.equal(r.rejections.length, 0);
      assert.ok(r.patterns.some((p) => p.direction === r.signal));
      assert.ok(v.adx >= 20);
      if (r.signal === 'CALL') {
        assert.ok(v.ema9 > v.ema21 && k.close > v.ema200 && v.plusDI > v.minusDI && v.rsi > 50 && v.rsi < 70 && k.close > k.open);
      } else {
        assert.ok(v.ema9 < v.ema21 && k.close < v.ema200 && v.minusDI > v.plusDI && v.rsi > 30 && v.rsi < 50 && k.close < k.open);
      }
    }
  }
  assert.ok(n > 0, 'esperava ao menos um sinal nos dados sintéticos');
});

test('minScore mais alto nunca gera mais sinais', () => {
  const c = generate(6000, { seed: 9 });
  const ind = E.computeIndicators(c);
  const count = (ms) => { let k = 0; for (let i = 229; i < c.length; i++) if (E.evaluateAt(c, ind, i, { minScore: ms }).signal) k++; return k; };
  assert.ok(count(85) <= count(70));
});
