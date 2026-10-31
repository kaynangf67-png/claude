import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Páginas geradas no build. Para uma nova campanha: crie o HTML e a entrada em src/config/pages.ts. */
export const pageEntries: Record<string, string> = {
  home: 'index.html',
  noivas: 'noivas/index.html',
  tratamentos: 'tratamentos-capilares/index.html',
  cabelos: 'cabelos/index.html',
  privacidade: 'privacidade/index.html',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Injeta title, description, canonical, Open Graph e JSON-LD em cada HTML,
 * a partir de src/config/pages.ts, para que buscadores e prévias de link
 * (WhatsApp, Instagram, Facebook) leiam tudo sem executar JavaScript.
 */
function seo(siteUrl: string): Plugin {
  return {
    name: 'nd-seo',
    async transformIndexHtml(html) {
      const key = /data-page="([^"]+)"/.exec(html)?.[1] ?? 'home';
      // Import dinâmico: os módulos usam import.meta.env, disponível aqui via Vite.
      const { pages } = await import('./src/config/pages.ts');
      const { brand } = await import('./src/config/site.ts');
      const { buildStructuredData } = await import('./src/lib/structuredData.ts');
      const page = pages[key];
      const url = siteUrl ? `${siteUrl}${page.path}` : '';
      const og = siteUrl ? `${siteUrl}/og-image.jpg` : '/og-image.jpg';
      const tags = [
        `<title>${esc(page.title)}</title>`,
        `<meta name="description" content="${esc(page.description)}" />`,
        key === 'privacidade' ? '<meta name="robots" content="noindex, follow" />' : '',
        url && `<link rel="canonical" href="${url}" />`,
        '<meta property="og:type" content="website" />',
        '<meta property="og:locale" content="pt_BR" />',
        `<meta property="og:site_name" content="${esc(brand.name)}" />`,
        `<meta property="og:title" content="${esc(page.title)}" />`,
        `<meta property="og:description" content="${esc(page.description)}" />`,
        url && `<meta property="og:url" content="${url}" />`,
        `<meta property="og:image" content="${og}" />`,
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        key === 'home'
          ? `<script type="application/ld+json">${JSON.stringify(buildStructuredData(siteUrl)).replace(/</g, '\\u003c')}</script>`
          : '',
      ]
        .filter(Boolean)
        .join('\n    ');
      return html.replace('<!--seo-->', tags);
    },
  };
}

export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL || '').replace(/\/$/, '');
  return {
    plugins: [react(), tailwindcss(), seo(siteUrl)],
    build: isSsrBuild
      ? { outDir: 'dist-ssr', emptyOutDir: true }
      : {
          rollupOptions: {
            input: Object.fromEntries(Object.entries(pageEntries).map(([k, f]) => [k, resolve(import.meta.dirname, f)])),
          },
        },
  };
});
