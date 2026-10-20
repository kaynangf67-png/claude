// Gera ebook/dist/pele-em-foco.pdf a partir de ebook/src/pele-em-foco.html.
//
// 1. Miolo em duas passagens: a primeira descobre em que página cada capítulo
//    começa; a segunda preenche o sumário com esses números.
// 2. Capa e contracapa são renderizadas à parte (página sem margens) e entram
//    no lugar das páginas em branco reservadas no miolo.
// 3. Exporta a capa em PNG para a página de vendas (public/capa-pele-em-foco.png).
//
// Requisitos: `npm install` e python3 com pypdf.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlUrl = pathToFileURL(resolve(root, 'src/pele-em-foco.html')).href;
const outDir = resolve(root, 'dist');
const tmp = (name) => resolve(outDir, `.${name}.pdf`);
const outPdf = resolve(outDir, 'pele-em-foco.pdf');
const publicDir = resolve(root, '../public');

const config = JSON.parse(readFileSync(resolve(root, 'config.json'), 'utf8'));
const coverSvg = readFileSync(resolve(root, 'assets/cover.svg'), 'utf8');

const values = {
  ...config,
  technicalReviewerLine: config.technicalReviewer
    ? `${config.technicalReviewer}${config.technicalReviewerCredentials ? ` — ${config.technicalReviewerCredentials}` : ''}`
    : 'Este material não passou por revisão técnica de médico dermatologista. As informações foram compiladas a partir das fontes listadas no capítulo 12.',
  appAccessLine:
    'Quem compra o e-book ganha 30 dias de acesso ao app, contados a partir da ativação: crie sua conta com o mesmo e-mail da compra e confirme esse e-mail. Depois do período, você continua podendo ver, exportar e apagar seus registros.',
  appUrlLine: config.appUrl ? `Acesse: ${config.appUrl}` : 'O link de acesso está no e-mail de entrega da sua compra.',
};

const pdfOptions = { preferCSSPageSize: true, printBackground: true, tagged: true };
const launchOptions = existsSync('/opt/pw-browsers/chromium')
  ? { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }
  : {};

async function openBook(browser) {
  const page = await browser.newPage();
  await page.goto(htmlUrl, { waitUntil: 'load' });
  await page.evaluate(({ svg, values }) => {
    document.getElementById('cover').innerHTML = svg;
    for (const el of document.querySelectorAll('[data-config]')) {
      el.textContent = values[el.dataset.config] || el.dataset.fallback || '';
    }
  }, { svg: coverSvg, values });
  return page;
}

// Renderiza só um elemento (capa ou contracapa) numa página A5 sem margens.
async function renderSingle(browser, selector, path) {
  const page = await openBook(browser);
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    document.body.replaceChildren(el);
    el.style.breakBefore = 'auto';
    el.style.breakAfter = 'auto';
    const style = document.createElement('style');
    style.textContent = '@page { margin: 0 !important; @top-right { content: none } @bottom-center { content: none } }';
    document.head.append(style);
  }, selector);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path, ...pdfOptions });
  return page;
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch(launchOptions);

// Miolo
const book = await openBook(browser);
await book.evaluate(() => {
  const slot = (cls) => Object.assign(document.createElement('section'), { className: cls });
  document.getElementById('cover').replaceWith(slot('slot'));
  document.querySelector('.back-cover').replaceWith(slot('slot end'));
  for (const h of document.querySelectorAll('[data-marker]')) {
    const m = document.createElement('span');
    m.className = 'pf-marker';
    m.textContent = h.dataset.marker;
    m.style.cssText = 'position:absolute;font-size:2px;color:#fff;';
    h.prepend(m);
  }
});
await book.evaluate(() => document.fonts.ready);
await book.pdf({ path: tmp('pass1'), ...pdfOptions });

const found = JSON.parse(execFileSync('python3', ['-I', resolve(root, 'scripts/find_pages.py'), tmp('pass1')]).toString());
await book.evaluate((pages) => {
  for (const el of document.querySelectorAll('[data-toc]')) el.textContent = pages[el.dataset.toc] ?? '';
  for (const m of document.querySelectorAll('.pf-marker')) m.remove();
}, found.pages);
await book.pdf({ path: tmp('body'), ...pdfOptions });
const bookmarks = await book.evaluate((pages) => [
  ['Sumário', 3],
  ...Array.from(document.querySelectorAll('[data-marker]'), (h) => [h.textContent.trim(), pages[h.dataset.marker.slice(1)]]),
], found.pages);

// Capa e contracapa
const coverPage = await renderSingle(browser, '#cover', tmp('cover'));
await renderSingle(browser, '.back-cover', tmp('back'));

// PNG da capa
mkdirSync(publicDir, { recursive: true });
await coverPage.setViewportSize({ width: 560, height: 795 });
await coverPage.evaluate(() => {
  const el = document.getElementById('cover');
  el.style.width = '560px';
  el.style.height = '795px';
  document.body.style.margin = '0';
});
await coverPage.locator('#cover').screenshot({ path: resolve(publicDir, 'capa-pele-em-foco.png') });

await browser.close();

execFileSync('python3', ['-I', resolve(root, 'scripts/merge_pdf.py'), tmp('body'), tmp('cover'), tmp('back'), outPdf, JSON.stringify(bookmarks)]);
for (const n of ['pass1', 'body', 'cover', 'back']) rmSync(tmp(n), { force: true });

const tocIds = Array.from(readFileSync(resolve(root, 'src/pele-em-foco.html'), 'utf8').matchAll(/data-toc="([^"]+)"/g), (m) => m[1]);
const missing = tocIds.filter((id) => !(id in found.pages));
console.log(`PDF gerado: ${outPdf} (${found.total} páginas)`);
console.log('Início dos capítulos:', JSON.stringify(found.pages));
if (missing.length) {
  console.error('Capítulos não localizados para o sumário:', missing);
  process.exit(1);
}
