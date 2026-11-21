// node --test trade-calendar/calc.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAccount, balanceOf, normalizeAccount, evaluateDay, discipline, disciplineStreak, periodRange, comparisons, change, buckets, entriesInRange, weekStartKey, rangeLabel, netOf, normalizeEntry, entriesIn, summarize, cumulative, cellValue, money, moneyShort, parseMoney, daysInMonth, firstWeekday } from './calc.js';

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
  assert.deepEqual({ ...normalizeEntry({ noTrade: true, gain: 5, ops: 3 }), updatedAt: 0 }, { followed: null, gain: 0, loss: 0, ops: 0, notes: '', noTrade: true, updatedAt: 0 });
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

test('períodos respeitam as datas', () => {
  const t = '2026-11-20'; // sexta
  assert.deepEqual(periodRange('today', t), { start: t, end: t });
  assert.deepEqual(periodRange('week', t), { start: '2026-11-16', end: t }); // segunda
  assert.deepEqual(periodRange('30d', t), { start: '2026-10-22', end: t });   // 30 dias com hoje
  assert.deepEqual(periodRange('month', t), { start: '2026-11-01', end: t });
  assert.deepEqual(periodRange('lastMonth', t), { start: '2026-10-01', end: '2026-10-31' });
  assert.deepEqual(periodRange('lastMonth', '2026-01-15'), { start: '2025-12-01', end: '2025-12-31' });
  assert.deepEqual(periodRange('custom', t, { start: '2026-11-10', end: '2026-11-01' }), { start: '2026-11-01', end: '2026-11-10' });
  assert.equal(weekStartKey('2026-11-22'), '2026-11-16'); // domingo pertence à semana iniciada na segunda
  assert.equal(weekStartKey('2026-03-02'), '2026-03-02');
});

test('comparações', () => {
  const c = comparisons('2026-11-20');
  assert.deepEqual(c[0].prev, { start: '2026-11-19', end: '2026-11-19' });
  assert.deepEqual(c[1].prev, { start: '2026-11-09', end: '2026-11-15' });
  assert.deepEqual(c[3].prev, { start: '2026-09-22', end: '2026-10-21' });
  assert.deepEqual(change(300, 200), { diff: 100, pct: 0.5 });
  assert.deepEqual(change(-100, -200), { diff: 100, pct: 0.5 }); // melhorou
  assert.equal(change(100, 0).pct, null);
});

test('resultado líquido = lucro bruto − prejuízo bruto (exemplo do enunciado)', () => {
  const s = summarize(entriesInRange({ '2026-11-20': { gain: 300, loss: 100, ops: 2 } }, '2026-11-01', '2026-11-30'));
  assert.equal(s.grossGain, 300);
  assert.equal(s.grossLoss, 100);
  assert.equal(s.net, 200);
  assert.equal(round(s.grossGain - s.grossLoss), s.net);
});
const round = (n) => Math.round(n * 100) / 100;

test('dias sem operação não contam como positivos/negativos', () => {
  const s = summarize(entriesInRange(E, '2026-11-01', '2026-11-30'));
  assert.equal(s.tradedDays, 4);
  assert.equal(s.positiveRate, 0.5);
});

test('agrupamento semanal e mensal', () => {
  const list = entriesInRange(E, '2026-10-01', '2026-11-30');
  const w = buckets(list, 'week', '2026-10-26', '2026-11-15');
  assert.deepEqual(w.map((b) => [b.key, b.value]), [['2026-10-26', 50], ['2026-11-02', 29.5], ['2026-11-09', 1199.9]]);
  const m = buckets(list, 'month', '2026-10-01', '2026-11-30');
  assert.deepEqual(m.map((b) => b.value), [50, 1229.4]);
  assert.equal(rangeLabel('2026-11-16', '2026-11-20', 2026), '16 – 20 de nov.');
});

test('plano do dia: stop, meta, operações e marcação manual', () => {
  const plan = { enabled: true, stop: 300, target: 500, maxOps: 5 };
  assert.equal(evaluateDay({ gain: 0, loss: 300, ops: 2 }, plan).status, 'ok');        // bateu o stop exato: respeitou
  assert.equal(evaluateDay({ gain: 0, loss: 300, ops: 2 }, plan).hitStop, true);
  assert.deepEqual(evaluateDay({ gain: 0, loss: 350, ops: 2 }, plan).reasons, ['stop']); // passou do stop
  assert.equal(evaluateDay({ gain: 600, loss: 50, ops: 3 }, plan).hitTarget, true);
  assert.deepEqual(evaluateDay({ gain: 100, loss: 0, ops: 7 }, plan).reasons, ['ops']);
  assert.deepEqual(evaluateDay({ gain: 100, loss: 0, ops: 1, followed: false }, plan).reasons, ['manual']);
  assert.equal(evaluateDay({ noTrade: true }, plan).status, 'none');
  assert.equal(evaluateDay({ gain: 0, loss: 900 }, { ...plan, enabled: false }).status, 'none');
});

test('disciplina e sequência', () => {
  const plan = { enabled: true, stop: 300, target: 0, maxOps: 0 };
  const ents = {
    '2026-11-16': { gain: 0, loss: 500, ops: 1 },  // fora
    '2026-11-17': { gain: 200, loss: 0, ops: 1 },  // dentro
    '2026-11-18': { noTrade: true },               // não conta nem quebra
    '2026-11-19': { gain: 0, loss: 100, ops: 1 },  // dentro
    '2026-11-20': { gain: 400, loss: 0, ops: 1 },  // dentro
  };
  assert.equal(disciplineStreak(ents, plan, '2026-11-20'), 3);
  const d = discipline(entriesInRange(ents, '2026-11-01', '2026-11-30'), plan);
  assert.equal(d.ok, 3); assert.equal(d.broken, 1); assert.equal(d.rate, 0.75);
  assert.equal(d.avgOk, 166.67); assert.equal(d.avgBroken, -500);
});

test('saldo da conta: informa R$ 100 e cada resultado registrado soma ao saldo', () => {
  const ents = { '2026-11-03': { gain: 500, loss: 100 } }; // já registrado antes de informar o saldo
  const acc = makeAccount(ents, 100);
  assert.equal(balanceOf(ents, acc), 100);                  // o que já existia não é somado de novo
  ents['2026-11-20'] = { gain: 30, loss: 10 };              // +20
  assert.equal(balanceOf(ents, acc), 120);
  ents['2026-11-21'] = { gain: 0, loss: 45.5 };             // −45,50
  assert.equal(balanceOf(ents, acc), 74.5);
  ents['2026-11-21'] = { gain: 0, loss: 5 };                // editou o dia: −5
  assert.equal(balanceOf(ents, acc), 115);
  delete ents['2026-11-21'];                                // excluiu o dia
  assert.equal(balanceOf(ents, acc), 120);
  ents['2026-11-22'] = { noTrade: true };
  assert.equal(balanceOf(ents, acc), 120);
  assert.equal(balanceOf(ents, null), null);
  assert.equal(normalizeAccount({ offset: 'x' }), null);
});
