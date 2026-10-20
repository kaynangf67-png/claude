import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { professional, seo } from './src/config/site';
import { buildStructuredData } from './src/lib/structuredData';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Injeta title, meta, Open Graph e JSON-LD no HTML a partir de src/config/site.ts,
// e gera robots.txt e sitemap.xml no build (o sitemap só quando siteUrl estiver definido).
function siteSeo(): Plugin {
  const url = professional.siteUrl;
  return {
    name: 'site-seo',
    transformIndexHtml(html) {
      const ogImage = url ? `${url}/og-image.jpg` : '/og-image.jpg';
      const head = [
        `<title>${escape(seo.title)}</title>`,
        `<meta name="description" content="${escape(seo.description)}" />`,
        url && `<link rel="canonical" href="${url}/" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:locale" content="pt_BR" />`,
        `<meta property="og:site_name" content="${escape(professional.brandName)}" />`,
        `<meta property="og:title" content="${escape(seo.title)}" />`,
        `<meta property="og:description" content="${escape(seo.description)}" />`,
        url && `<meta property="og:url" content="${url}/" />`,
        `<meta property="og:image" content="${ogImage}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:image:alt" content="${escape(`${professional.brandName} · ${professional.profession} · ${professional.cro}`)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<script type="application/ld+json">${JSON.stringify(buildStructuredData()).replace(/</g, '\\u003c')}</script>`,
      ]
        .filter(Boolean)
        .join('\n    ');
      return html.replace('<!--site-seo-->', head);
    },
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', url && `Sitemap: ${url}/sitemap.xml`].filter(Boolean).join('\n');
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots + '\n' });
      if (url) {
        const today = new Date().toISOString().slice(0, 10);
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url}/</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`,
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), siteSeo()],
});
