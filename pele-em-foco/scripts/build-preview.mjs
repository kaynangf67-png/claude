// Gera uma pré-visualização em UM arquivo HTML (modo demonstração, roteamento em memória),
// com JS, CSS, fontes e imagens embutidos. Serve para mostrar o app sem hospedagem.
// Uso: node scripts/build-preview.mjs <saida.html>
import { build } from 'vite';
import { readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const out = resolve(process.argv[2] ?? 'preview/pele-em-foco.html');
const dist = join(tmpdir(), `pef-preview-${Date.now()}`);
process.env.VITE_DEMO_MODE = 'true';
process.env.VITE_ROUTER = 'memory';

await build({
  logLevel: 'warn',
  build: {
    outDir: dist,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000, // fontes viram data: URI
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { codeSplitting: false } },
  },
});

const assets = join(dist, 'assets');
const files = readdirSync(assets);
let js = readFileSync(join(assets, files.find((f) => f.endsWith('.js'))), 'utf8');
const css = readFileSync(join(assets, files.find((f) => f.endsWith('.css'))), 'utf8');

// Imagens de /public referenciadas por caminho absoluto → data: URI
const png = (p) => `data:image/png;base64,${readFileSync(join('public', p)).toString('base64')}`;
for (const p of ['capa-pele-em-foco.png', ...readdirSync('public/amostras').map((f) => `amostras/${f}`)]) {
  for (const q of ['"', "'", '`']) js = js.replaceAll(`${q}/${p}${q}`, JSON.stringify(png(p)));
}

const html = `<title>Pele em Foco</title>
<meta name="description" content="Pré-visualização do Pele em Foco em modo demonstração.">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js.replaceAll('</script', '<\\/script')}</script>
`;
writeFileSync(out, html);
rmSync(dist, { recursive: true, force: true });
console.log(`${out} (${(html.length / 1024).toFixed(0)} KB)`);
