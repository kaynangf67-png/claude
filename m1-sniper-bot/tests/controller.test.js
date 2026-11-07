'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createController, KEYS } = require('../src/content/controller.js');
const E = require('../src/core/engine.js');
const { generate } = require('../scripts/synthetic.js');

function memStorage(initial) {
  const data = Object.assign({}, initial || {});
  return {
    data,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, JSON.parse(JSON.stringify(data[k]))])),
    set: async (o) => { for (const k in o) data[k] = JSON.parse(JSON.stringify(o[k])); },
  };
}

/** Acha um índice da série sintética onde o motor dá sinal, para simular o "agora". */
function findSignal(c) {
  const ind = E.computeIndicators(c);
  for (let i = 300; i < c.length - 2; i++) if (E.evaluateAt(c, ind, i).signal) return i;
  return -1;
}

function setup(storage) {
  const series = generate(4000, { seed: 3, startTime: new Date(2026, 10, 7, 9, 0).getTime() });
  const idx = findSignal(series);
  assert.ok(idx > 0);
  let clock = series[idx].time + 60000 + 2000; // 2s após o fechamento do candle de sinal
  const feed = {
    fetchKlines: async (_sym, limit) => {
      // devolve candles com abertura <= agora, incluindo o que está em formação
      const upto = series.filter((c) => c.time <= clock).map((c) => Object.assign({}, c, { closeTime: c.time + 59999 }));
      return upto.slice(-limit);
    },
  };
  const ctl = createController({ storage, feed, now: () => clock });
  return { ctl, series, idx, setClock: (t) => { clock = t; }, getClock: () => clock };
}

test('fluxo completo: ativar → sinal → ENTREI → resultado → persistência', async () => {
  const storage = memStorage();
  const { ctl, series, idx, setClock } = setup(storage);
  await ctl.init();
  ctl.setActive(true);
  await ctl.fetchFeed();
  const s = ctl.state.current;
  assert.ok(s, 'sinal esperado');
  assert.equal(s.signalTime, series[idx].time);
  assert.equal(s.entryTime, series[idx + 1].time);
  assert.ok(ctl.confirmEntry());
  assert.equal(ctl.confirmEntry(), false, 'duplicidade');
  assert.equal(ctl.setStake(50), false, 'valor travado com operação aberta');

  // candle de entrada fecha → feed calcula o resultado sugerido
  setClock(series[idx + 2].time + 1000);
  await ctl.fetchFeed();
  const expected = require('../src/core/history.js').binaryOutcome(s.direction, series[idx + 1]);
  assert.equal(ctl.state.current.feedResult, expected);
  assert.ok(ctl.recordResult(expected));
  assert.equal(ctl.state.current, null);
  const risk = storage.data[KEYS.risk];
  assert.equal(risk.greens + risk.losses + risk.draws, 1);
  assert.equal(storage.data[KEYS.history].trades.length, 1);
  assert.equal(storage.data[KEYS.history].trades[0].result, expected);
});

test('painel desativado não gera sinal', async () => {
  const { ctl } = setup(memStorage());
  await ctl.init();
  await ctl.fetchFeed();
  assert.equal(ctl.state.current, null);
  assert.ok(ctl.state.analysis.signal);
  assert.match(ctl.state.analysis.blockedBy, /desativado/);
});

test('sinal expira se o usuário não confirmar a tempo', async () => {
  const { ctl, setClock, getClock } = setup(memStorage());
  await ctl.init();
  ctl.setActive(true);
  await ctl.fetchFeed();
  assert.ok(ctl.state.current);
  setClock(getClock() + 15000);
  ctl.tick();
  assert.equal(ctl.state.current, null);
  assert.equal(ctl.state.history.signals[0].status, 'EXPIRADO');
});

test('bloqueio de 3 LOSS persiste após reinício e impede ativar', async () => {
  const storage = memStorage();
  const today = new Date(2026, 10, 7, 9, 0).getTime();
  const R = require('../src/core/risk.js');
  const st = Object.assign(R.createState(today), { losses: 3 });
  storage.data[KEYS.risk] = st;
  const { ctl } = setup(storage);
  await ctl.init();
  assert.equal(ctl.setActive(true), false);
  assert.match(ctl.state.message, /LOSS/);
});

test('conta REAL bloqueada sem validação em DEMO', async () => {
  const { ctl } = setup(memStorage());
  await ctl.init();
  assert.equal(ctl.updateSettings({ accountMode: 'REAL' }), false);
  assert.equal(ctl.state.settings.accountMode, 'DEMO');
});

test('conta REAL liberada após 50 operações DEMO acima do break-even + 5pp', async () => {
  const trades = Array.from({ length: 60 }, (_, i) => ({ id: 't' + i, asset: 'BTCUSDT', accountMode: 'DEMO', result: i % 3 === 0 ? 'LOSS' : 'GREEN' }));
  const storage = memStorage({ [KEYS.history]: { signals: [], trades } });
  const { ctl } = setup(storage);
  await ctl.init();
  assert.equal(ctl.updateSettings({ accountMode: 'REAL' }), true);
});

test('CSV manual é analisado', async () => {
  const { ctl } = setup(memStorage());
  await ctl.init();
  ctl.updateSettings({ source: 'manual' });
  const csv = 'open,high,low,close\n' + generate(300, { seed: 5 }).map((c) => [c.open, c.high, c.low, c.close].join(',')).join('\n');
  const r = ctl.loadManualCSV(csv);
  assert.ok(r.ok);
  assert.equal(r.count, 300);
  assert.ok(ctl.state.analysis);
  assert.equal(ctl.state.analysis.index, 299);
});

test('feed só é consultado com o painel ativo', async () => {
  const { ctl } = setup(memStorage());
  await ctl.init();
  ctl.state.lastFetch = 0;
  // tick com painel desativado não dispara busca
  const before = ctl.state.lastFetch;
  ctl.tick();
  assert.equal(ctl.state.lastFetch, before);
  ctl.setActive(true);
  ctl.tick();
  assert.notEqual(ctl.state.lastFetch, before);
});
