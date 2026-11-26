import { LEVEL_IDS, getStoryLevel } from '../shared/levels.js';
import { solve } from './solver.js';
const only = process.argv.slice(2);
for (const id of LEVEL_IDS) {
  if (only.length && !only.includes(id)) continue;
  const lvl = getStoryLevel(id);
  const t0 = Date.now();
  const r = solve(lvl, { width: Number(process.env.W || 400), maxTicks: 60 * 120 });
  console.log(id.padEnd(5), r.ok ? `OK  ${(r.ticks / 60).toFixed(2)}s` : `FALHOU ${r.reason} ${JSON.stringify(r.best)}`, `(${Date.now() - t0}ms)`);
}
