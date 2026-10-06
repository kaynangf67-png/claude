import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { academia, seo } from './src/config/academia';
import { buildStructuredData } from './src/lib/structuredData';

/**
 * URL pública do site, sem barra no final. Ordem: variável SITE_URL,
 * domínio de produção da Vercel (definido automaticamente no build) ou vazio.
 * Sem URL, canonical/og:url/sitemap não são gerados (melhor ausente que errado).
 */
const siteUrl = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
).replace(/\/$/, '');

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Injeta title, meta, Open Graph e JSON-LD no HTML e gera robots.txt e sitemap.xml,
// para que buscadores e prévias de WhatsApp leiam tudo sem executar JavaScript.
function seoPlugin(): Plugin {
  let outDir = 'dist';
  let isSsr = false;
  return {
    name: 'nobre-seo',
    configResolved(config) {
      outDir = config.build.outDir;
      isSsr = Boolean(config.build.ssr);
    },
    transformIndexHtml(html) {
      const ogImage = siteUrl ? `${siteUrl}/og-image.jpg` : '/og-image.jpg';
      const jsonLd = buildStructuredData(siteUrl);
      const head = [
        `<title>${escape(seo.title)}</title>`,
        `<meta name="description" content="${escape(seo.description)}" />`,
        siteUrl && `<link rel="canonical" href="${siteUrl}/" />`,
        `<meta name="geo.region" content="BR-ES" />`,
        `<meta name="geo.placename" content="${escape(`${academia.address.neighborhood}, ${academia.address.city}`)}" />`,
        academia.geo && `<meta name="geo.position" content="${academia.geo.lat};${academia.geo.lng}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:locale" content="pt_BR" />`,
        `<meta property="og:site_name" content="${escape(academia.name)}" />`,
        `<meta property="og:title" content="${escape(seo.title)}" />`,
        `<meta property="og:description" content="${escape(seo.description)}" />`,
        siteUrl && `<meta property="og:url" content="${siteUrl}/" />`,
        `<meta property="og:image" content="${ogImage}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:image:alt" content="${escape(`${academia.name} — academia em Jacaraípe, Serra/ES`)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
      ]
        .filter(Boolean)
        .join('\n    ');
      return html.replace('<!--seo-->', head);
    },
    closeBundle() {
      if (isSsr) return;
      const robots = ['User-agent: *', 'Allow: /', siteUrl && `\nSitemap: ${siteUrl}/sitemap.xml`]
        .filter(Boolean)
        .join('\n');
      writeFileSync(resolve(outDir, 'robots.txt'), robots + '\n');
      if (siteUrl) {
        const today = new Date().toISOString().slice(0, 10);
        writeFileSync(
          resolve(outDir, 'sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${today}</lastmod>\n  </url>\n</urlset>\n`,
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoPlugin()],
});
