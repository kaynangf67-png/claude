import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistory } from '../src/content/chartHistory.js';

const NOW = Date.UTC(2026, 10, 8, 12, 30, 20);
const mk = (n, gapAt = -1) => {
  const out = []; let x = 1000; let p = 100;
  for (let i = 0; i < n; i++) { const c = p, o = p - 0.1; out.push({ open: o, close: c, high: c + 0.05, low: o - 0.05, x }); p -= 0.1; x -= i === gapAt ? 40 : 20; }
  return out;
};

test('monta velas M1 com horários a partir da vela atual', () => {
  const r = buildHistory(mk(80), { livePrice: 100, now: NOW });
  assert.equal(r.ok, true); assert.equal(r.candles.length, 80);
  assert.equal(r.candles.at(-1).time, Date.UTC(2026, 10, 8, 12, 30));
  assert.equal(r.candles[0].time, Date.UTC(2026, 10, 8, 12, 30) - 79 * 60000);
});

test('recusa se a vela atual não bate com o preço ao vivo ou se leu pouco', () => {
  assert.equal(buildHistory(mk(80), { livePrice: 120, now: NOW }).ok, false);
  assert.equal(buildHistory(mk(5), { livePrice: 100, now: NOW }).ok, false);
});

test('vela faltando (espaçamento dobrado): usa só o trecho contínuo', () => {
  const r = buildHistory(mk(80, 30), { livePrice: 100, now: NOW });
  assert.equal(r.ok, true); assert.equal(r.candles.length, 31);
});
