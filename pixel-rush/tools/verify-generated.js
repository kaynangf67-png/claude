// Prova que as fases geradas (20 a 999) são completáveis. Se uma semente não
// tiver solução encontrada pelo bot, tenta sementes alternativas (salt).
// Uso: node tools/verify-generated.js <de> <até> [saida.json]
import { writeFileSync } from 'node:fs';
import { storyGenLevel, storyGenParams } from '../shared/generator.js';
import { solve } from './solver.js';

const from = Number(process.argv[2] || 20), to = Number(process.argv[3] || 999);
const out = process.argv[4];
const salts = {}, failed = [];
for (let n = from; n <= to; n++) {
  const { chunks } = storyGenParams(n);
  let ok = false;
  for (let salt = 0; salt < 12 && !ok; salt++) {
    const r = solve(storyGenLevel(n, salt), { width: 220, maxTicks: 60 * (20 + chunks * 14) });
    if (r.ok) { ok = true; if (salt) salts[n] = salt; }
  }
  if (!ok) failed.push(n);
  if (n % 25 === 0) console.log('fase', n, 'ok até aqui; salts', Object.keys(salts).length, 'falhas', failed.length);
}
const res = { from, to, salts, failed };
if (out) writeFileSync(out, JSON.stringify(res));
console.log(JSON.stringify(res));
