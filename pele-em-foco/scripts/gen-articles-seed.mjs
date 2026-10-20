// Gera a migration de conteúdo da biblioteca a partir de src/content/articles.ts,
// para o app (modo demonstração) e o banco usarem exatamente o mesmo texto.
// Uso: npm run db:seed-articles
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { ARTICLES } = await server.ssrLoadModule('/src/content/articles.ts');
await server.close();

const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;
const rows = ARTICLES.map((a, i) =>
  `  (${[q(a.slug), q(a.category), q(a.title), q(a.summary), a.minutes, json(a.sections), json(a.sources), i].join(', ')})`,
);
const sql = `-- GERADO por scripts/gen-articles-seed.mjs a partir de src/content/articles.ts. Não edite à mão.
insert into public.educational_articles (slug, category, title, summary, reading_minutes, body, sources, sort_order) values
${rows.join(',\n')}
on conflict (slug) do update set
  category = excluded.category, title = excluded.title, summary = excluded.summary,
  reading_minutes = excluded.reading_minutes, body = excluded.body, sources = excluded.sources,
  sort_order = excluded.sort_order, published = true;
`;
const out = 'supabase/migrations/20261020120100_seed_educational_articles.sql';
writeFileSync(out, sql);
console.log(`${ARTICLES.length} artigos → ${out}`);
