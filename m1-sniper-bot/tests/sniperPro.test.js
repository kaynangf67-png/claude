import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSniperPro, backtestSniperPro, analyzeSniperProAt, sniperProRequired } from '../src/core/strategies/sniperPro.js';
import { analyzeStrategy } from '../src/core/engine.js';
import { series } from './helpers.js';

test('script: não usa o futuro (série cortada dá os mesmos sinais)', () => {
  const cs = series(900, { drift: 0.003, noise: 0.05, seed: 11 });
  const full = backtestSniperPro(cs).map((t) => t.time + t.direction);
  const cut = backtestSniperPro(cs.slice(0, 600)).map((t) => t.time + t.direction);
  assert.deepEqual(full.filter((x) => parseInt(x) <= cs[599].time), cut);
});

test('script: COMPRA só em vela de alta e VENDA só em vela de baixa; respeita intervalo de 3 velas', () => {
  let n = 0;
  for (let seed = 1; seed < 40; seed++) {
    const cs = series(700, { drift: seed % 2 ? 0.004 : -0.004, noise: 0.05, seed });
    const ind = computeSniperPro(cs); let last = null;
    for (let i = sniperProRequired() - 1; i < cs.length; i++) {
      const r = analyzeSniperProAt(cs, ind, i, {}, last);
      if (r.status !== 'signal') continue;
      n++;
      const c = cs[i];
      assert.equal(r.signal.direction === 'CALL', c.close > c.open);
      if (last != null) assert.ok(i - last >= 3);
      last = i;
    }
  }
  assert.ok(n > 0, 'nenhum sinal gerado nas séries de teste');
});

test('script: exige 204 velas (EMA 200 + inclinação de 3 velas)', () => {
  const cs = series(203, { drift: 0.004, noise: 0.05, seed: 2 });
  assert.equal(analyzeStrategy(cs, { strategy: 'sniperPro' }).status, 'invalid');
  assert.notEqual(analyzeStrategy(series(260, { drift: 0.004, noise: 0.05, seed: 2 }), { strategy: 'sniperPro' }).status, 'invalid');
});
