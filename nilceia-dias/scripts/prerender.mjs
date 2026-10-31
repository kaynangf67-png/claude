// Pré-renderiza cada página em HTML estático (melhor LCP, SEO e prévias de link).
// Roda depois de `vite build` (cliente) e `vite build --ssr` (servidor).
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const { render } = await import(pathToFileURL(resolve(root, 'dist-ssr/entry-server.js')).href);

const files = {
  home: 'index.html',
  noivas: 'noivas/index.html',
  tratamentos: 'tratamentos-capilares/index.html',
  cabelos: 'cabelos/index.html',
  privacidade: 'privacidade/index.html',
};

// Pré-carrega as duas fontes latinas usadas acima da dobra.
const assets = readdirSync(resolve(root, 'dist/assets'));
const fontPreloads = ['cormorant-garamond-latin-wght-normal', 'montserrat-latin-wght-normal']
  .map((n) => assets.find((f) => f.startsWith(n) && f.endsWith('.woff2')))
  .filter(Boolean)
  .map((f) => `<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin />`);

for (const [key, file] of Object.entries(files)) {
  const path = resolve(root, 'dist', file);
  const html = readFileSync(path, 'utf8');
  if (!html.includes('<!--app-html-->')) throw new Error(`Marcador ausente em ${file}`);
  const body = render(key);
  // Imagem do hero (LCP) com prioridade de download.
  const hero = /<img[^>]*fetchPriority="high"[^>]*>|<img[^>]*fetchpriority="high"[^>]*>/i.exec(body)?.[0];
  const heroSrc = hero && /src="([^"]+)"/.exec(hero)?.[1];
  const preloads = [...fontPreloads, heroSrc && `<link rel="preload" href="${heroSrc}" as="image" fetchpriority="high" />`]
    .filter(Boolean)
    .join('\n    ');
  writeFileSync(path, html.replace('<!--app-html-->', body).replace('</title>', `</title>\n    ${preloads}`));
  console.log(`pré-renderizado: /${file}`);
}
rmSync(resolve(root, 'dist-ssr'), { recursive: true, force: true });
