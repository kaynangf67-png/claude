'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/core/risk.js');

const day = (d, h = 12) => new Date(2026, 10, d, h, 0, 0);
const on = { active: true };

function trade(s, id, result, stake = 10) {
  let r = R.registerEntry(s, id, on);
  assert.ok(r.ok, r.reason);
  r = R.registerResult(r.state, id, result, stake);
  assert.ok(r.ok, r.reason);
  return r.state;
}

test('data local YYYY-MM-DD', () => {
  assert.equal(R.localDateKey(new Date(2026, 0, 3, 23, 59)), '2026-01-03');
});

test('bloqueia após 10 GREEN e libera no dia seguinte', () => {
  let s = R.createState(day(7));
  for (let i = 0; i < 10; i++) s = trade(s, 'g' + i, 'GREEN');
  const c = R.check(s, on);
  assert.equal(c.ok, false); assert.equal(c.code, 'GOAL');
  assert.equal(R.registerEntry(s, 'x', on).ok, false);
  assert.equal(R.rollover(s, day(7, 23)).rolled, false);
  const next = R.rollover(s, day(8, 0)).state;
  assert.equal(R.check(next, on).ok, true);
  assert.equal(next.greens, 0);
});

test('bloqueia após 3 LOSS', () => {
  let s = R.createState(day(7));
  s = trade(s, 'a', 'LOSS'); s = trade(s, 'b', 'GREEN'); s = trade(s, 'c', 'LOSS');
  assert.equal(R.check(s, on).ok, true);
  s = trade(s, 'd', 'LOSS');
  assert.equal(R.check(s, on).code, 'STOP');
});

test('estado persistido (JSON) mantém o bloqueio após reinício no mesmo dia', () => {
  let s = R.createState(day(7));
  for (const id of ['a', 'b', 'c']) s = trade(s, id, 'LOSS');
  const restored = R.rollover(JSON.parse(JSON.stringify(s)), day(7, 22)).state;
  assert.equal(R.check(restored, on).code, 'STOP');
});

test('sem martingale: valor não sobe depois de LOSS no mesmo dia', () => {
  let s = R.createState(day(7));
  assert.ok(R.canSetStake(s, 50).ok);
  s = trade(s, 'a', 'LOSS', 10);
  assert.equal(R.canSetStake(s, 20).ok, false);
  assert.ok(R.canSetStake(s, 10).ok);
  assert.ok(R.canSetStake(s, 5).ok);
  assert.ok(R.canSetStake(R.rollover(s, day(8)).state, 20).ok);
});

test('sem duplicidade e sem operação com painel desativado', () => {
  let s = R.createState(day(7));
  let r = R.registerEntry(s, 'a', on);
  assert.ok(r.ok);
  assert.equal(R.registerEntry(r.state, 'b', on).ok, false, 'duas operações abertas');
  s = R.registerResult(r.state, 'a', 'GREEN', 10).state;
  assert.equal(R.registerEntry(s, 'a', on).ok, false, 'mesmo sinal duas vezes');
  assert.equal(R.registerEntry(s, 'c', { active: false }).ok, false, 'painel desativado');
  assert.equal(R.canSetStake(R.registerEntry(s, 'c', on).state, 5).ok, false, 'trocar valor com operação aberta');
});
