// Lê o JSON exportado do Google Maps Scraper (compass/crawler-google-places),
// separa quem não tem site próprio e ranqueia os leads.
// Uso: node prospeccao/rank.mjs dataset.json [saida.csv]
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output = 'leads-sem-site.csv'] = process.argv.slice(2);
if (!input) {
  console.error('Uso: node prospeccao/rank.mjs dataset.json [saida.csv]');
  process.exit(1);
}

// Links que o Google mostra como "site", mas não são um site do negócio.
const NOT_A_SITE = [
  'instagram.com', 'facebook.com', 'fb.com', 'wa.me', 'whatsapp.com', 'api.whatsapp',
  'linktr.ee', 'linktree', 'bio.link', 'beacons.ai', 'taplink', 'linkme.bio',
  'business.site', 'sites.google.com', 'g.page', 'ifood.com.br', 'tiktok.com',
  'youtube.com', 'doctoralia', 'boaconsulta', 'getninjas', 'olx.com.br',
];

const MIN_REVIEWS = 10; // abaixo disso o negócio é pequeno ou pouco ativo demais
const MIN_RATING = 4.0;

function siteStatus(website) {
  if (!website) return 'sem site';
  const url = website.toLowerCase();
  const hit = NOT_A_SITE.find((d) => url.includes(d));
  return hit ? `só ${hit}` : 'tem site';
}

const places = JSON.parse(readFileSync(input, 'utf8'))
  .filter((p) => !p.permanentlyClosed && !p.temporarilyClosed);

const seen = new Set();
const rows = [];
for (const p of places) {
  const key = p.placeId || p.url || p.title;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push({
    nicho: p.searchString || p.categoryName || '',
    nome: p.title || '',
    categoria: p.categoryName || '',
    bairro: p.neighborhood || '',
    cidade: p.city || '',
    telefone: p.phone || p.phoneUnformatted || '',
    nota: p.totalScore ?? '',
    avaliacoes: p.reviewsCount ?? 0,
    site: siteStatus(p.website),
    link_atual: p.website || '',
    maps: p.url || '',
  });
}

// Resumo por nicho: tamanho, % sem site próprio e quantos leads qualificados.
const qualifies = (r) =>
  r.site !== 'tem site' && r.telefone && r.avaliacoes >= MIN_REVIEWS && Number(r.nota) >= MIN_RATING;

const byNiche = new Map();
for (const r of rows) {
  const n = byNiche.get(r.nicho) || { total: 0, semSite: 0, qualificados: 0, reviews: [] };
  n.total++;
  if (r.site !== 'tem site') n.semSite++;
  if (qualifies(r)) n.qualificados++;
  n.reviews.push(r.avaliacoes);
  byNiche.set(r.nicho, n);
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
console.table(
  [...byNiche].map(([nicho, n]) => ({
    nicho,
    total: n.total,
    '% sem site': Math.round((100 * n.semSite) / n.total),
    qualificados: n.qualificados,
    'mediana avaliações': median(n.reviews),
  })).sort((a, b) => b.qualificados - a.qualificados),
);

// Mais avaliações = mais movimento = mais dinheiro e mais a perder sem site.
const leads = rows.filter(qualifies).sort((a, b) => b.avaliacoes - a.avaliacoes);
const cols = Object.keys(rows[0] || { nome: '' });
const esc = (v) => `"${String(v).replaceAll('"', '""')}"`;
writeFileSync(output, [cols.join(','), ...leads.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n'));
console.log(`${leads.length} leads qualificados de ${rows.length} negócios -> ${output}`);
