import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_IDS, getStoryLevel } from '../shared/levels.js';
import { endlessLevel, courseLevel } from '../shared/generator.js';
import { createSim, step, runInputs } from '../shared/sim.js';
import { sanitizeRle, expandRle } from '../shared/replay.js';
import { IN_RIGHT, IN_JUMP } from '../shared/constants.js';
import { solve } from '../tools/solver.js';

test('todas as 20 fases da História são completáveis (prova por busca com a física real)', () => {
  for (const id of LEVEL_IDS) {
    const r = solve(getStoryLevel(id), { width: 400, maxTicks: 60 * 120 });
    assert.ok(r.ok, `fase ${id} não foi resolvida: ${JSON.stringify(r.best)}`);
    // o replay da solução reproduz exatamente o mesmo resultado
    const { sim } = runInputs(getStoryLevel(id), r.inputs, 1e6);
    assert.equal(sim.s.finished, true, id);
    assert.equal(sim.s.finishT, r.ticks, id);
  }
});

test('percursos gerados (diário/evento/corrida) são completáveis', () => {
  for (const [i, diff] of [[1, 0.55], [2, 0.8], [3, 0.5], [4, 1]]) {
    const lvl = courseLevel(`teste-${i}`, { chunks: 5, diff });
    const r = solve(lvl, { width: 300, maxTicks: 60 * 90 });
    assert.ok(r.ok, `percurso ${i}`);
  }
});

test('simulação é determinística', () => {
  const lvl = getStoryLevel('2-3');
  const inputs = [];
  for (let i = 0; i < 900; i++) inputs.push(i % 37 < 10 ? IN_RIGHT | IN_JUMP : IN_RIGHT);
  const a = createSim(lvl), b = createSim(lvl);
  for (const m of inputs) { step(a, m); step(b, m); }
  assert.deepEqual(a.s, b.s);
});

test('modo infinito: mesma semente gera o mesmo mundo; sementes diferentes divergem', () => {
  const a = endlessLevel(1234), b = endlessLevel(1234), c = endlessLevel(999);
  let same = true, diff = false;
  for (let x = 0; x < 32 * 12; x++) for (let y = 0; y < 15; y++) {
    if (a.tileAt(x, y) !== b.tileAt(x, y)) same = false;
    if (a.tileAt(x, y) !== c.tileAt(x, y)) diff = true;
  }
  assert.ok(same);
  assert.ok(diff);
});

test('a parede de energia elimina quem fica parado no Modo Infinito', () => {
  const lvl = endlessLevel(42);
  const sim = createSim(lvl);
  let n = 0;
  while (!sim.s.over && n < 60 * 60) { step(sim, 0); n++; }
  assert.ok(sim.s.over);
});

test('validação do formato das entradas', () => {
  assert.equal(sanitizeRle([[8, 1]]), null);
  assert.equal(sanitizeRle([[1, 0]]), null);
  assert.equal(sanitizeRle([[1, 1.5]]), null);
  assert.equal(sanitizeRle('x'), null);
  assert.equal(sanitizeRle([]), null);
  assert.equal(sanitizeRle([[1, 60 * 60 * 31]]), null);
  assert.deepEqual(sanitizeRle([[2, 3], [6, 1]]), [[2, 3], [6, 1]]);
  assert.deepEqual(expandRle([[2, 2], [4, 1]]), [2, 2, 4]);
});
