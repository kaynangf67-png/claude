// Teste de fumaça ponta a ponta com o build de produção.
// Uso: npm run build && npm run test:e2e   (sobe o `vite preview` sozinho)
// Gera capturas de tela em tests/screenshots/ (ignorado pelo git).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { /* já encerrado */ } };
process.on('exit', stopServer);
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview não subiu')), 15000);
  server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && (clearTimeout(t), resolve()));
});

const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] } : {});
const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(['ok', name]);
  } catch (e) {
    results.push(['FALHOU', name, e.message.split('\n').slice(0, 4).join(' | ')]);
  }
};

try {
  for (const vp of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1366, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'pt-BR', acceptDownloads: true });
    ctx.setDefaultTimeout(8000);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await check(`${vp.name}: página de vendas carrega sem rolagem horizontal`, async () => {
      await page.goto(BASE + '/');
      await page.getByRole('heading', { level: 1 }).waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `overflow horizontal de ${overflow}px`);
      await page.screenshot({ path: `${SHOTS}${vp.name}-vendas.png`, fullPage: true });
    });

    await check(`${vp.name}: CTA de compra fica desativado sem checkout configurado`, async () => {
      const cta = page.getByRole('button', { name: /checkout em configuração/i }).first();
      assert.equal(await cta.getAttribute('aria-disabled'), 'true');
      assert.equal(await page.locator('a[href*="checkout"]').count(), 0);
    });

    await check(`${vp.name}: imagens da página de vendas carregam`, async () => {
      await page.evaluate(() => Promise.all([...document.images].map((i) => { i.loading = 'eager'; return i.decode().catch(() => null); })));
      const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
      assert.deepEqual(broken, []);
    });

    await check(`${vp.name}: links internos do site respondem`, async () => {
      for (const path of ['/obrigado', '/privacidade', '/termos', '/rota-inexistente']) {
        await page.goto(BASE + path);
        await page.getByRole('heading', { level: 1 }).waitFor();
      }
      assert.ok(await page.getByText('Página não encontrada').isVisible());
    });

    await check(`${vp.name}: /app sem onboarding redireciona para boas-vindas`, async () => {
      await page.goto(BASE + '/app/rotina');
      await page.waitForURL('**/app/boas-vindas');
    });

    await check(`${vp.name}: onboarding exige aceite e cria rotina`, async () => {
      await page.getByRole('button', { name: 'Começar' }).click();
      const next = page.getByRole('button', { name: 'Continuar' });
      assert.ok(await next.isDisabled(), 'continuar deveria estar desativado sem aceite');
      await page.getByLabel(/Entendi que o app é educativo/).check();
      await next.click();
      await page.getByLabel(/Como prefere ser chamado/).fill('Lu');
      await page.getByRole('radio', { name: 'Oleosa', exact: true }).check();
      await page.getByLabel('Uso maquiagem').check();
      await page.screenshot({ path: `${SHOTS}${vp.name}-onboarding.png`, fullPage: true });
      await page.getByRole('button', { name: 'Criar minha rotina' }).click();
      await page.waitForURL(BASE + '/app');
      await page.getByRole('heading', { name: /, Lu\./ }).waitFor();
      await page.screenshot({ path: `${SHOTS}${vp.name}-inicio.png`, fullPage: true });
    });

    await check(`${vp.name}: checklist persiste após recarregar`, async () => {
      await page.goto(BASE + '/app/rotina?periodo=noite');
      await page.getByRole('checkbox', { name: /Remover maquiagem/ }).click();
      await page.getByRole('checkbox', { name: /Limpeza suave/ }).click();
      await page.reload();
      assert.equal(await page.getByRole('checkbox', { name: /Remover maquiagem/ }).getAttribute('aria-checked'), 'true');
      assert.equal(await page.getByRole('checkbox', { name: /Hidratante leve/ }).getAttribute('aria-checked'), 'false');
      await page.getByRole('tab', { name: /Manhã/ }).click();
      assert.equal(await page.getByRole('checkbox', { name: /Protetor solar/ }).getAttribute('aria-checked'), 'false');
      await page.screenshot({ path: `${SHOTS}${vp.name}-rotina.png`, fullPage: true });
    });

    await check(`${vp.name}: personalizar rotina (adicionar, desativar, remover)`, async () => {
      await page.getByRole('button', { name: 'Personalizar' }).click();
      await page.getByLabel('Novo passo').fill('Lavar pincéis');
      await page.getByRole('button', { name: 'Adicionar' }).click();
      await page.getByRole('switch', { name: /Hidratante leve/ }).uncheck();
      await page.getByRole('button', { name: 'Concluir' }).click();
      assert.ok(await page.getByRole('checkbox', { name: /Lavar pincéis/ }).isVisible());
      assert.equal(await page.getByRole('checkbox', { name: /Hidratante leve/ }).count(), 0);
      await page.reload();
      await page.getByRole('button', { name: 'Personalizar' }).click();
      await page.getByRole('button', { name: 'Remover Lavar pincéis' }).click();
      await page.getByRole('switch', { name: /Hidratante leve/ }).check();
      await page.getByRole('button', { name: 'Concluir' }).click();
      assert.equal(await page.getByRole('checkbox', { name: /Lavar pincéis/ }).count(), 0);
    });

    await check(`${vp.name}: diário salva e aparece no histórico`, async () => {
      await page.goto(BASE + '/app/diario');
      await page.getByRole('button', { name: 'Dormi bem' }).click();
      await page.getByRole('radio', { name: 'Mais oleosa' }).check();
      await page.getByRole('button', { name: 'Dia de estresse' }).click();
      await page.getByLabel('Anotação livre').fill('Testa mais oleosa.');
      await page.reload();
      assert.equal(await page.getByLabel('Anotação livre').inputValue(), 'Testa mais oleosa.');
      assert.equal(await page.getByRole('button', { name: 'Dormi bem' }).getAttribute('aria-pressed'), 'true');
      assert.ok(await page.getByText('“Testa mais oleosa.”').isVisible());
      await page.getByRole('button', { name: 'Dia anterior' }).click();
      assert.equal(await page.getByLabel('Anotação livre').inputValue(), '');
      await page.screenshot({ path: `${SHOTS}${vp.name}-diario.png`, fullPage: true });
    });

    await check(`${vp.name}: biblioteca, artigo com fontes e produtos`, async () => {
      await page.goto(BASE + '/app/biblioteca');
      await page.getByRole('button', { name: 'Estilo de vida', exact: true }).click();
      await page.getByRole('link', { name: /Alimentação e acne/ }).click();
      await page.getByRole('heading', { name: 'Fontes' }).waitFor();
      const ext = await page.locator('article a[target="_blank"]').count();
      assert.ok(ext >= 3, `esperava fontes externas, achou ${ext}`);
      await page.screenshot({ path: `${SHOTS}${vp.name}-artigo.png`, fullPage: true });
      await page.goto(BASE + '/app/produtos');
      await page.getByRole('heading', { name: 'Protetor solar' }).waitFor();
      await page.goto(BASE + '/app/biblioteca/nao-existe');
      await page.getByText('Artigo não encontrado').waitFor();
    });

    await check(`${vp.name}: navegação principal leva a todas as telas`, async () => {
      await page.goto(BASE + '/app');
      const nav = page.locator(vp.name === 'mobile' ? '.app-nav' : '.desktop-nav');
      for (const [label, path] of [['Rotina', '/app/rotina'], ['Diário', '/app/diario'], ['Aprender', '/app/biblioteca'], ['Perfil', '/app/perfil'], ['Início', '/app']]) {
        await nav.getByRole('link', { name: label }).click();
        await page.waitForURL((u) => u.pathname === path);
      }
    });

    await check(`${vp.name}: perfil mostra privacidade e apaga dados`, async () => {
      await page.goto(BASE + '/app/perfil');
      await page.screenshot({ path: `${SHOTS}${vp.name}-perfil.png`, fullPage: true });
      const [file] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Exportar meus dados' }).click(),
      ]);
      assert.match(file.suggestedFilename(), /^pele-em-foco-\d{4}-\d{2}-\d{2}\.json$/);
      await page.getByRole('button', { name: 'Apagar todos os dados' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Apagar tudo' }).click();
      await page.waitForURL('**/app/boas-vindas');
      const stored = await page.evaluate(() => localStorage.getItem('pele-em-foco:v1'));
      assert.equal(stored, null, 'localStorage deveria estar vazio');
    });

    await check(`${vp.name}: sem erros no console`, async () => {
      assert.deepEqual(errors, []);
    });
    await ctx.close();
  }
} finally {
  await browser.close();
  stopServer();
}

for (const r of results) console.log(r.join(' — '));
const failed = results.filter((r) => r[0] !== 'ok').length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
process.exit(failed ? 1 : 0);
