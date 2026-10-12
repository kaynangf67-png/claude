/**
 * Relatório de revisão do cardápio.
 *   npm run validate        → erros e avisos (falha só com erros)
 *   npm run check:publish   → falha também com pendências que bloqueiam a publicação
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clients } from '../src/clients/index.ts';
import { formatPrice, isPublishable } from '../src/lib/menu.ts';
import { validateMenu, type Severity } from '../src/lib/validate.ts';

const clientId = process.env.CLIENT ?? 'demo';
const menu = clients[clientId];
if (!menu) {
  console.error(`CLIENT="${clientId}" não existe. Opções: ${Object.keys(clients).join(', ')}`);
  process.exit(1);
}
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const strict = process.argv.includes('--publish');
const issues = validateMenu(menu, (p) => existsSync(publicDir + p));

const titles: Record<Severity, string> = {
  erro: 'ERROS (quebram o site)',
  'bloqueia-publicacao': 'PENDÊNCIAS QUE BLOQUEIAM A PUBLICAÇÃO',
  aviso: 'AVISOS (melhorias opcionais)',
};

console.log(`\nCardápio: ${menu.restaurant.name} [${menu.stage}] (CLIENT=${clientId})\n`);

for (const c of menu.categories) {
  const items = menu.products.filter((p) => p.categoryId === c.id);
  if (!items.length) continue;
  console.log(`  ${c.name}`);
  for (const p of items) {
    const price = p.prices
      .map((o) => `${o.label ? `${o.label} ` : ''}${o.value === null ? 'PRECISA CONFIRMAR' : formatPrice(o.value)}`)
      .join(' / ');
    const status = isPublishable(p) ? 'ok' : 'PENDENTE';
    console.log(`    [${status}] ${p.name} — ${price}${p.image ? '' : ' (sem foto)'}`);
  }
}

for (const severity of ['erro', 'bloqueia-publicacao', 'aviso'] as const) {
  const list = issues.filter((i) => i.severity === severity);
  if (!list.length) continue;
  console.log(`\n${titles[severity]} — ${list.length}`);
  for (const i of list) console.log(`  - ${i.field}: ${i.message}`);
}

const errors = issues.filter((i) => i.severity === 'erro').length;
const blockers = issues.filter((i) => i.severity === 'bloqueia-publicacao').length;
console.log('');
if (errors || (strict && blockers)) {
  console.log(strict ? 'NÃO PUBLICAR: resolva os itens acima.' : 'Corrija os erros acima.');
  process.exit(1);
}
console.log(strict ? 'Pronto para publicar.' : 'Configuração válida.');
