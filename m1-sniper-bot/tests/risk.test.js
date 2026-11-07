import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduce, hydrate } from '../src/core/state.js';
import { REAL_CONFIRM_PHRASE } from '../src/core/stats.js';

const T0 = Date.UTC(2026, 10, 7, 15, 0, 0); // 12:00 em São Paulo
const TZ = 'America/Sao_Paulo';

function sig(n, now) {
  const confirm = Math.floor(now / 60000) * 60000 - 60000;
  return { id: `BTCUSDT-${confirm + n}`, symbol: 'BTCUSDT', direction: 'CALL', score: 85, confirmCandleTime: confirm, entryTime: confirm + 60000, expiryTime: confirm + 120000 };
}

function ok(r) { assert.equal(r.error, undefined, r.error); return r.state; }

/** Executa um ciclo completo sinal → entrada → resultado. */
function cycle(s, now, result, n = 0) {
  s = ok(reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig(n, now) }, now));
  s = ok(reduce(s, { type: 'CONFIRM_ENTRY', signalId: s.activeSignal.id }, now + 1000));
  const t = s.openTrade;
  return ok(reduce(s, { type: 'RECORD_RESULT', tradeId: t.id, result }, t.expiryTime + 1000));
}

function on(now = T0) { return ok(reduce(initialState(now, TZ), { type: 'SET_ACTIVE', value: true }, now)); }

test('não gera sinal com painel desativado', () => {
  const s = initialState(T0, TZ);
  const r = reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig(0, T0) }, T0);
  assert.equal(r.error, 'Painel desativado');
});

test('desativar interrompe o sinal em aberto imediatamente', () => {
  let s = on();
  s = ok(reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig(0, T0) }, T0));
  assert.ok(s.activeSignal);
  s = ok(reduce(s, { type: 'SET_ACTIVE', value: false }, T0 + 1));
  assert.equal(s.activeSignal, null);
  assert.equal(reduce(s, { type: 'CONFIRM_ENTRY', signalId: sig(0, T0).id }, T0 + 2).error !== undefined, true);
});

test('sem duplicidade e sem entradas simultâneas', () => {
  let s = on();
  s = ok(reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig(0, T0) }, T0));
  assert.match(reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig(1, T0) }, T0).error, /sinal em aberto/);
  s = ok(reduce(s, { type: 'CONFIRM_ENTRY', signalId: s.activeSignal.id }, T0 + 1000));
  assert.match(reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig(2, T0) }, T0 + 2000).error, /operação aberta/);
  assert.match(reduce(s, { type: 'RECORD_RESULT', tradeId: s.openTrade.id, result: 'GREEN' }, T0 + 2000).error, /não expirou/);
  s = ok(reduce(s, { type: 'RECORD_RESULT', tradeId: s.openTrade.id, result: 'GREEN' }, s.openTrade.expiryTime + 1));
  assert.match(reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig(0, T0) }, T0 + 3000).error, /duplicado|desatualizado/);
});

test('sinal desatualizado é recusado e sinal pendente expira', () => {
  let s = on();
  const late = sig(0, T0); late.entryTime -= 60000;
  assert.equal(reduce(s, { type: 'PROPOSE_SIGNAL', signal: late }, T0).error, 'Sinal desatualizado');
  s = ok(reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig(0, T0) }, T0));
  s = ok(reduce(s, { type: 'TICK' }, s.activeSignal.entryTime + 16_000));
  assert.equal(s.activeSignal, null);
  assert.equal(s.signalLog[0].userAction, 'expired');
});

test('trava de 10 GREEN: bloqueia, desativa e persiste até o dia seguinte', () => {
  let s = on(); let now = T0;
  for (let i = 0; i < 10; i++) { s = cycle(s, now, 'GREEN', i); now += 3 * 60000; }
  assert.equal(s.day.greens, 10); assert.equal(s.day.locked, 'GOAL'); assert.equal(s.active, false);
  assert.match(reduce(s, { type: 'SET_ACTIVE', value: true }, now).error, /META DIÁRIA ATINGIDA/);
  // Reinicialização (hydrate) mantém a trava.
  const h = hydrate(JSON.parse(JSON.stringify(s)), now);
  assert.equal(h.day.locked, 'GOAL');
  // Relógio voltando NÃO desbloqueia.
  assert.ok(reduce(h, { type: 'SET_ACTIVE', value: true }, T0 - 86400000).error);
  // Próximo dia local libera.
  const tomorrow = Date.UTC(2026, 10, 8, 3, 1); // 00:01 em São Paulo
  const n = ok(reduce(h, { type: 'SET_ACTIVE', value: true }, tomorrow));
  assert.equal(n.day.greens, 0); assert.equal(n.day.locked, null); assert.equal(n.active, true);
});

test('trava de 3 LOSS', () => {
  let s = on(); let now = T0;
  for (let i = 0; i < 3; i++) { s = cycle(s, now, 'LOSS', i); now += 3 * 60000; }
  assert.equal(s.day.locked, 'LOSS'); assert.equal(s.active, false);
  assert.match(reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig(9, now) }, now).error, /Painel desativado|LIMITE/);
});

test('trava reaplicada mesmo se o estado salvo for adulterado', () => {
  const s = initialState(T0, TZ); s.day.losses = 3; s.day.locked = null; s.active = true;
  const h = hydrate(s, T0);
  assert.equal(h.day.locked, 'LOSS'); assert.equal(h.active, false);
});

test('sem Martingale: valor não sobe após LOSS no mesmo dia', () => {
  let s = ok(reduce(on(), { type: 'SET_AMOUNT', value: 5 }, T0));
  s = cycle(s, T0, 'LOSS');
  assert.match(reduce(s, { type: 'SET_AMOUNT', value: 10 }, T0 + 200000).error, /Martingale/);
  s = ok(reduce(s, { type: 'SET_AMOUNT', value: 3 }, T0 + 200000));
  assert.equal(s.settings.amount, 3);
  assert.ok(reduce(s, { type: 'SET_AMOUNT', value: -1 }, T0).error);
  assert.ok(reduce(s, { type: 'SET_AMOUNT', value: 'abc' }, T0).error);
});

test('pontuação mínima nunca abaixo de 80; fuso travado com operações no dia', () => {
  let s = on();
  assert.ok(reduce(s, { type: 'SET_SETTINGS', value: { minScore: 70 } }, T0).error);
  s = cycle(s, T0, 'GREEN');
  assert.match(reduce(s, { type: 'SET_SETTINGS', value: { timeZone: 'Asia/Tokyo' } }, T0 + 200000).error, /fuso/);
});

test('modo REAL exige validação E confirmação expressa', () => {
  let s = on();
  assert.match(reduce(s, { type: 'SET_MODE', mode: 'REAL', confirmation: REAL_CONFIRM_PHRASE }, T0).error, /Validação DEMO incompleta/);
  // 100 operações em 5 dias com bom resultado (forjadas diretamente para o teste do critério)
  const trades = [];
  for (let i = 0; i < 100; i++) trades.push({ mode: 'DEMO', result: i % 3 === 0 ? 'LOSS' : 'GREEN', time: T0 - (i % 5) * 86400000 - i * 60000, symbol: 'BTCUSDT', amount: 1 });
  s.trades = trades;
  s.signalLog = trades.map((t, i) => ({ id: 'x' + i, outcome: t.result, confirmCandleTime: t.time, symbol: t.symbol }));
  assert.match(reduce(s, { type: 'SET_MODE', mode: 'REAL', confirmation: 'sim' }, T0).error, /Confirmação expressa/);
  s = ok(reduce(s, { type: 'SET_MODE', mode: 'REAL', confirmation: REAL_CONFIRM_PHRASE }, T0));
  assert.equal(s.account.mode, 'REAL');
});

test('página em REAL com bot em DEMO bloqueia sinais', () => {
  const s = on();
  assert.match(reduce(s, { type: 'PROPOSE_SIGNAL', signal: sig(0, T0), pageMode: 'REAL' }, T0).error, /REAL/);
});
