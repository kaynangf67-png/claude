import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduce, autoArmed } from '../src/core/state.js';

const T0 = Date.UTC(2026, 10, 8, 15, 0, 0);
const TZ = 'America/Sao_Paulo';
const ok = (r) => { assert.equal(r.error, undefined, r.error); return r.state; };
const ENTRY = Math.floor(T0 / 60000) * 60000;
const sig = { id: `BTCUSDT-${ENTRY - 60000}`, symbol: 'BTCUSDT', direction: 'PUT', score: 86, confirmCandleTime: ENTRY - 60000, entryTime: ENTRY, expiryTime: ENTRY + 60000 };
const page = { pageMode: 'DEMO', pageAsset: 'BTCUSDT', pageAmount: 1 };

function calibrated() {
  let s = ok(reduce(initialState(T0, TZ), { type: 'SET_ACTIVE', value: true }, T0));
  for (const key of ['call', 'put']) s = ok(reduce(s, { type: 'SET_CALIB', key, selector: `#${key}` }, T0));
  return s;
}
function armedWithSignal() {
  let s = ok(reduce(calibrated(), { type: 'SET_AUTO', armed: true, expiryConfirmed: true }, T0));
  return ok(reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig }, T0 + 1000));
}

test('armar exige painel ligado, calibração completa e confirmação de expiração 1 min', () => {
  const off = initialState(T0, TZ);
  assert.match(reduce(off, { type: 'SET_AUTO', armed: true, expiryConfirmed: true }, T0).error, /Ligue/);
  const on = ok(reduce(off, { type: 'SET_ACTIVE', value: true }, T0));
  assert.match(reduce(on, { type: 'SET_AUTO', armed: true, expiryConfirmed: true }, T0).error, /Calibre/);
  assert.match(reduce(calibrated(), { type: 'SET_AUTO', armed: true }, T0).error, /1 minuto/);
  assert.ok(autoArmed(ok(reduce(calibrated(), { type: 'SET_AUTO', armed: true, expiryConfirmed: true }, T0))));
});

test('entrada automática só no mercado indicado, conta e valor conferidos, dentro da janela', () => {
  const s = armedWithSignal();
  assert.match(reduce(s, { type: 'AUTO_ENTRY', signalId: sig.id, ...page, pageAsset: 'ETHUSDT' }, T0 + 1500).error, /não é o indicado/);
  assert.match(reduce(s, { type: 'AUTO_ENTRY', signalId: sig.id, ...page, pageAsset: null }, T0 + 1500).error, /não é o indicado/);
  assert.match(reduce(s, { type: 'AUTO_ENTRY', signalId: sig.id, ...page, pageMode: 'REAL' }, T0 + 1500).error, /Conta/);
  assert.match(reduce(s, { type: 'AUTO_ENTRY', signalId: sig.id, ...page, pageAmount: 50 }, T0 + 1500).error, /Valor/);
  assert.match(reduce(s, { type: 'AUTO_ENTRY', signalId: sig.id, ...page }, ENTRY + 7000).error, /Tarde demais|não está mais disponível/);
  const t = ok(reduce(s, { type: 'AUTO_ENTRY', signalId: sig.id, ...page }, T0 + 1500));
  assert.equal(t.openTrade.auto, true);
  assert.equal(t.openTrade.direction, 'PUT');
  // não entra duas vezes
  assert.ok(reduce(t, { type: 'AUTO_ENTRY', signalId: sig.id, ...page }, T0 + 1600).error);
});

test('sem armar, nada é executado; desligar o painel desarma', () => {
  let s = ok(reduce(calibrated(), { type: 'PROPOSE_SIGNAL', signal: sig }, T0 + 1000));
  assert.match(reduce(s, { type: 'AUTO_ENTRY', signalId: sig.id, ...page }, T0 + 1500).error, /não está armado/);
  s = armedWithSignal();
  s = ok(reduce(s, { type: 'SET_ACTIVE', value: false }, T0 + 1200));
  assert.equal(autoArmed(s), false);
});

test('automático vale só no dia em que foi armado', () => {
  const s = ok(reduce(calibrated(), { type: 'SET_AUTO', armed: true, expiryConfirmed: true }, T0));
  const next = ok(reduce(s, { type: 'TICK' }, T0 + 86400000));
  assert.equal(autoArmed(next), false);
});

test('falha no clique cancela a operação e desarma', () => {
  let s = ok(reduce(armedWithSignal(), { type: 'AUTO_ENTRY', signalId: sig.id, ...page }, T0 + 1500));
  s = ok(reduce(s, { type: 'ABORT_AUTO_TRADE', tradeId: s.openTrade.id, reason: 'botão não encontrado' }, T0 + 2000));
  assert.equal(s.openTrade, null);
  assert.equal(autoArmed(s), false);
  assert.equal(s.signalLog.at(-1).userAction, 'auto_failed');
});

test('trava de 3 LOSS desarma o automático', () => {
  let s = ok(reduce(armedWithSignal(), { type: 'AUTO_ENTRY', signalId: sig.id, ...page }, T0 + 1500));
  s.day.losses = 2;
  s = ok(reduce(s, { type: 'RECORD_RESULT', tradeId: s.openTrade.id, result: 'LOSS', by: 'auto' }, s.openTrade.expiryTime + 1));
  assert.equal(s.day.locked, 'LOSS');
  assert.equal(autoArmed(s), false);
  assert.equal(s.trades.at(-1).recordedBy, 'auto');
});

test('mudar a calibração desarma', () => {
  let s = ok(reduce(calibrated(), { type: 'SET_AUTO', armed: true, expiryConfirmed: true }, T0));
  s = ok(reduce(s, { type: 'SET_CALIB', key: 'call', selector: '#outro' }, T0));
  assert.equal(autoArmed(s), false);
});

test('tempo da Quotex diferente de 1 minuto bloqueia a entrada automática', () => {
  const s = armedWithSignal();
  assert.match(reduce(s, { type: 'AUTO_ENTRY', signalId: sig.id, ...page, pageExpirySec: 120 }, T0 + 1500).error, /1 minuto/);
  assert.equal(reduce(s, { type: 'AUTO_ENTRY', signalId: sig.id, ...page, pageExpirySec: 60 }, T0 + 1500).error, undefined);
});
