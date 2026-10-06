import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { clinic, seo } from './src/config/clinic';
import { buildStructuredData } from './src/lib/structuredData';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Injeta title, meta, Open Graph e JSON-LD no HTML a partir de src/config/clinic.ts,
// para que buscadores e prévias de WhatsApp leiam tudo sem executar JavaScript.
function clinicSeo(): Plugin {
  return {
    name: 'clinic-seo',
    transformIndexHtml(html) {
      const url = clinic.siteUrl;
      const ogImage = url ? `${url}/og-image.jpg` : '/og-image.jpg';
      const jsonLd = buildStructuredData();
      const head = [
        `<title>${escape(seo.title)}</title>`,
        `<meta name="description" content="${escape(seo.description)}" />`,
        url && `<link rel="canonical" href="${url}/" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:locale" content="pt_BR" />`,
        `<meta property="og:site_name" content="${escape(clinic.name)}" />`,
        `<meta property="og:title" content="${escape(seo.title)}" />`,
        `<meta property="og:description" content="${escape(seo.description)}" />`,
        url && `<meta property="og:url" content="${url}/" />`,
        `<meta property="og:image" content="${ogImage}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        jsonLd &&
          `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
      ]
        .filter(Boolean)
        .join('\n    ');
      return html.replace('<!--clinic-seo-->', head);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), clinicSeo()],
});
