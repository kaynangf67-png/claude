import { courseLevel } from '../shared/generator.js';
import { solve } from './solver.js';
const n = Number(process.argv[2] || 12);
let fails = 0;
for (const diff of [0.45, 0.7, 1]) {
  for (let i = 0; i < n; i++) {
    const id = `test-${diff}-${i}`;
    const lvl = courseLevel(id, { chunks: 5, diff });
    const r = solve(lvl, { width: 300, maxTicks: 60 * 90 });
    if (!r.ok) { fails++; console.log('FALHOU', id, JSON.stringify(r.best)); }
    else process.stdout.write('.');
  }
}
console.log('\nfalhas:', fails);
