import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { menu } from './src/config/restaurant.ts';
import { isPublishable } from './src/lib/menu.ts';
import { googleFontsHref, themeCss } from './src/lib/theme.ts';
import { validateMenu } from './src/lib/validate.ts';

const publicDir = fileURLToPath(new URL('./public/', import.meta.url));
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Lê src/config/restaurant.ts no build:
 * - falha o build se a configuração tiver erros;
 * - injeta title, meta, Open Graph, cores e fontes no HTML
 *   (prévias de WhatsApp e buscadores não executam JavaScript).
 */
const VIRTUAL_ID = 'virtual:menu';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/**
 * Dados públicos do cardápio. Em produção, produtos pendentes NÃO entram
 * no JavaScript publicado; em nenhum modo vão `source` e `note` (internos).
 */
function publicMenu(includePending: boolean) {
  return {
    ...menu,
    products: menu.products
      .filter((p) => includePending || isPublishable(p))
      .map(({ source: _source, note: _note, ...p }) => p),
  };
}

function restaurantMenu(): Plugin {
  let isBuild = false;
  return {
    name: 'restaurant-menu',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      this.addWatchFile(fileURLToPath(new URL('./src/config/restaurant.ts', import.meta.url)));
      return `export const menu = ${JSON.stringify(publicMenu(!isBuild))};`;
    },
    buildStart() {
      const errors = validateMenu(menu, (p) => existsSync(publicDir + p)).filter((i) => i.severity === 'erro');
      if (errors.length) {
        this.error(
          `Configuração inválida (rode npm run validate):\n${errors.map((e) => `  - ${e.field}: ${e.message}`).join('\n')}`,
        );
      }
    },
    transformIndexHtml(html) {
      const r = menu.restaurant;
      const title = `Cardápio · ${r.name}`;
      const description = r.tagline ?? `Cardápio digital de ${r.name}.`;
      const ogImage = r.heroImage ?? r.logo;
      const absolute = (path: string) => (/^https?:/.test(path) || !r.publicUrl ? path : `${r.publicUrl}/${path}`);
      const head = [
        `<title>${escape(title)}</title>`,
        `<meta name="description" content="${escape(description)}" />`,
        `<meta name="theme-color" content="${menu.theme.primary}" />`,
        r.publicUrl && `<link rel="canonical" href="${r.publicUrl}/" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:locale" content="pt_BR" />`,
        `<meta property="og:site_name" content="${escape(r.name)}" />`,
        `<meta property="og:title" content="${escape(title)}" />`,
        `<meta property="og:description" content="${escape(description)}" />`,
        r.publicUrl && `<meta property="og:url" content="${r.publicUrl}/" />`,
        ogImage && `<meta property="og:image" content="${escape(absolute(ogImage))}" />`,
        menu.demo && `<meta name="robots" content="noindex" />`,
        `<link rel="preconnect" href="https://fonts.googleapis.com" />`,
        `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
        `<link rel="stylesheet" href="${googleFontsHref(menu.theme)}" />`,
        `<style>${themeCss(menu.theme)}</style>`,
      ]
        .filter(Boolean)
        .join('\n    ');
      return html.replace('<!--restaurant-head-->', head);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), restaurantMenu()],
});
