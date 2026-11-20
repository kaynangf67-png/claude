// node --test trade-calendar/calc.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { netOf, normalizeEntry, entriesIn, summarize, cumulative, cellValue, money, moneyShort, parseMoney, daysInMonth, firstWeekday } from './calc.js';

const E = {
  '2026-11-03': { gain: 500, loss: 150, ops: 4 },
  '2026-11-04': { gain: 0, loss: 320.5, ops: 2 },
  '2026-11-05': { noTrade: true },
  '2026-11-06': { gain: 100, loss: 100, ops: 1 },
  '2026-11-10': { gain: 1200.1, loss: 0.2, ops: 3 },
  '2026-10-30': { gain: 50, loss: 0, ops: 1 },
};

test('resultado líquido = ganho − perda, sem erro de arredondamento', () => {
  assert.equal(netOf({ gain: 0.3, loss: 0.1 }), 0.2);
  assert.equal(netOf({ gain: 1200.1, loss: 0.2 }), 1199.9);
  assert.equal(netOf({ noTrade: true, gain: 999 }), 0);
});

test('normalizeEntry zera valores de dia sem operação e rejeita negativos', () => {
  assert.deepEqual({ ...normalizeEntry({ noTrade: true, gain: 5, ops: 3 }), updatedAt: 0 }, { gain: 0, loss: 0, ops: 0, notes: '', noTrade: true, updatedAt: 0 });
  assert.equal(normalizeEntry({ gain: -10 }).gain, 0);
  assert.equal(normalizeEntry(null), null);
});

test('resumo do mês', () => {
  const s = summarize(entriesIn(E, { year: 2026, month: 10 }));
  assert.equal(s.profit, 1549.9);
  assert.equal(s.loss, -320.5);
  assert.equal(s.net, 1229.4);
  assert.equal(s.positiveDays, 2);
  assert.equal(s.negativeDays, 1);
  assert.equal(s.flatDays, 1);
  assert.equal(s.noTradeDays, 1);
  assert.equal(s.tradedDays, 4);
  assert.equal(s.ops, 10);
  assert.equal(s.winRate, 2 / 3);
  assert.equal(s.best.key, '2026-11-10');
  assert.equal(s.worst.key, '2026-11-04');
  assert.equal(s.avgProfit, 774.95);
  assert.equal(s.avgLoss, -320.5);
});

test('período vazio', () => {
  const s = summarize([]);
  assert.equal(s.winRate, null);
  assert.equal(s.best, null);
  assert.equal(s.net, 0);
});

test('acumulado', () => {
  assert.deepEqual(cumulative([{ value: 0 }, { value: 10.1 }, { value: -0.2 }]).map((p) => p.total), [0, 10.1, 9.9]);
});

test('formatação em reais', () => {
  assert.equal(money(1234.5), 'R$ 1.234,50');
  assert.equal(money(-20, { sign: true }), '−R$ 20,00');
  assert.equal(money(20, { sign: true }), '+R$ 20,00');
  assert.equal(moneyShort(12345), 'R$ 12,3 mil');
  assert.equal(cellValue(1250), '+1.250');
  assert.equal(cellValue(-320.5), '−321');
  assert.equal(cellValue(12500), '+12,5k');
  assert.equal(cellValue(0), '0');
  assert.equal(parseMoney('1.234,56'), 1234.56);
  assert.equal(parseMoney('1234.5'), 1234.5);
});

test('calendário', () => {
  assert.equal(daysInMonth(2028, 1), 29);
  assert.equal(firstWeekday(2026, 10), 0); // 1º/nov/2026 é domingo
});
