import test from 'node:test';
import assert from 'node:assert/strict';
import { QuotexFeed } from '../src/content/quotexFeed.js';
import { analyze, WARMUP_LONG_EMA } from '../src/core/engine.js';

const T = Date.UTC(2026, 10, 8, 12, 0, 0);

test('monta OHLC por minuto a partir das leituras de preço', () => {
  const f = new QuotexFeed({ storage: null });
  f.tick('BTC', 100, T + 1000); f.tick('BTC', 103, T + 20000); f.tick('BTC', 99, T + 40000); f.tick('BTC', 101, T + 59000);
  f.tick('BTC', 101.5, T + 61000);
  const c = f.candles('BTC');
  assert.equal(c.length, 2);
  assert.deepEqual({ ...c[0] }, { time: T, open: 100, high: 103, low: 99, close: 101 });
  assert.equal(c[1].open, 101.5);
});

test('descarta a vela inicial incompleta e leituras absurdas', () => {
  const f = new QuotexFeed({ storage: null });
  f.tick('X', 10, T + 30000);            // abriu no meio do minuto
  assert.equal(f.candles('X').length, 0);
  f.tick('X', 10.1, T + 61000);
  assert.equal(f.candles('X').length, 1); // só a vela completa (em formação)
  assert.equal(f.tick('X', 50, T + 62000), false); // salto de 400%: ignorado
});

test('lacuna curta é preenchida; lacuna longa recomeça', () => {
  const f = new QuotexFeed({ storage: null });
  f.tick('Y', 1, T + 500); f.tick('Y', 1.1, T + 3 * 60000 + 500);
  assert.equal(f.candles('Y').length, 4);
  f.tick('Y', 1.2, T + 20 * 60000 + 500);
  assert.equal(f.candles('Y').length, 1);
});

test('com 60 velas da Quotex o motor já analisa (EMA 50 no aquecimento)', () => {
  const f = new QuotexFeed({ storage: null });
  let p = 100;
  for (let m = 0; m < 62; m++) for (let s = 1; s < 60; s += 15) { p += Math.sin(m * 7 + s) * 0.05 + 0.01; f.tick('Z', p, T + m * 60000 + s * 1000); }
  const closed = f.candles('Z').slice(0, -1);
  const r = analyze(closed, { longEma: WARMUP_LONG_EMA }, { symbol: 'QX:Z' });
  assert.notEqual(r.status, 'invalid', r.reason);
  assert.equal(analyze(closed.slice(-40), { longEma: WARMUP_LONG_EMA }).status, 'invalid');
});

test('preço errado logo após trocar de ativo não trava as leituras', () => {
  const f = new QuotexFeed({ storage: null });
  f.tick('ETH', 75000, T + 500);               // preço do BTC lido como se fosse do ETH
  for (let k = 0; k < 7; k++) assert.equal(f.tick('ETH', 3000 + k, T + 1000 + k * 250), false);
  assert.equal(f.tick('ETH', 3008, T + 3000), true); // 8ª leitura consistente: aceita e recomeça
  f.tick('ETH', 3010, T + 61000);
  assert.ok(f.candles('ETH').every((c) => c.high < 4000));
});
