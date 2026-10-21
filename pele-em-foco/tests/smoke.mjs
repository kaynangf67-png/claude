// Teste ponta a ponta no navegador (Playwright), em celular e desktop.
// Roda contra o build de produção em MODO DEMONSTRAÇÃO (sem Supabase):
//   VITE_DEMO_MODE=true npm run build && npm run test:e2e
// As regras de acesso do banco real são testadas separadamente em `npm run test:db`.
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
    results.push(['FALHOU', name, e.message.split('\n').slice(0, 3).join(' | ')]);
  }
};
const noOverflow = async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `rolagem horizontal de ${overflow}px em ${page.url()}`);
};

try {
  for (const vp of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1366, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'pt-BR', acceptDownloads: true });
    ctx.setDefaultTimeout(8000);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const email = `ana.${vp.name}@exemplo.com`;
    const password = 'pele2026foco';
    const nav = (label) => page.locator(vp.name === 'mobile' ? '.app-nav' : '.sidebar').getByRole('link', { name: label });

    await check(`${vp.name}: página inicial apresenta o problema; /conhecer vende o app com CTA desativado sem checkout`, async () => {
      await page.goto(BASE + '/');
      await page.getByRole('heading', { level: 1, name: /gastou com produto para acne/ }).waitFor();
      await page.getByRole('button', { name: 'Começar o teste' }).waitFor();
      await noOverflow(page);
      await page.screenshot({ path: `${SHOTS}${vp.name}-inicio-site.png`, fullPage: true });
      await page.getByRole('link', { name: 'Pular e conhecer o app' }).click();
      await page.waitForURL('**/conhecer');
      await noOverflow(page);
      assert.equal(await page.getByRole('button', { name: /checkout em configuração/i }).first().getAttribute('aria-disabled'), 'true');
      await page.evaluate(() => Promise.all([...document.images].map((i) => { i.loading = 'eager'; return i.decode().catch(() => null); })));
      assert.deepEqual(await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src)), []);
      assert.ok(await page.getByText(/Acesso vitalício, pagamento único/).first().isVisible());
      assert.equal(await page.getByText(/e-book/i).count(), 0, 'não deve citar e-book');
      for (const path of ['/obrigado', '/privacidade', '/termos']) {
        await page.goto(BASE + path);
        await page.getByRole('heading', { level: 1 }).waitFor();
        await noOverflow(page);
      }
    });

    await check(`${vp.name}: teste público com imagens leva a resultado e oferta; sinais graves vão ao dermatologista`, async () => {
      await page.goto(BASE + '/');
      await page.getByRole('button', { name: 'Começar o teste' }).click();
      const next = page.getByRole('button', { name: 'Continuar' });
      assert.ok(await next.isDisabled());
      await page.getByRole('radio', { name: /Brilhosa no rosto todo/ }).check();
      await next.click();
      await page.getByRole('checkbox', { name: /^Cravos/ }).check();
      await noOverflow(page);
      await page.screenshot({ path: `${SHOTS}${vp.name}-teste-pergunta.png`, fullPage: true });
      await next.click();
      await page.getByRole('radio', { name: /^Poucas/ }).check(); await next.click();
      await page.getByRole('radio', { name: /^Não deixam/ }).check(); await next.click();
      await page.getByRole('radio', { name: 'Não', exact: true }).check(); await next.click();
      await page.getByRole('checkbox', { name: 'Nenhum destes' }).check();
      await page.getByRole('button', { name: 'Ver meu resultado' }).click();
      await page.getByRole('heading', { name: /rotina básica e constante/ }).waitFor();
      await page.getByRole('heading', { name: 'App Pele em Foco' }).waitFor();
      await page.getByRole('heading', { name: 'Perguntas frequentes' }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Por que procurar avaliação' }).count(), 0);
      await noOverflow(page);
      await page.screenshot({ path: `${SHOTS}${vp.name}-teste-resultado.png`, fullPage: true });

      await page.getByRole('button', { name: 'Refazer o teste' }).click();
      await page.goto(BASE + '/teste');
      await page.waitForURL(BASE + '/');
      await page.getByRole('button', { name: 'Começar o teste' }).click();
      await page.getByRole('radio', { name: /Seca ou repuxando/ }).check(); await next.click();
      await page.getByRole('checkbox', { name: /^Caroços profundos/ }).check(); await next.click();
      await page.getByRole('radio', { name: /^Várias/ }).check(); await next.click();
      await page.getByRole('button', { name: 'Voltar' }).click();
      assert.ok(await page.getByRole('radio', { name: /^Várias/ }).isChecked());
      await next.click();
      await page.getByRole('radio', { name: /^Cicatrizes/ }).check(); await next.click();
      await page.getByRole('radio', { name: 'Às vezes' }).check(); await next.click();
      await page.getByRole('checkbox', { name: 'Nenhum destes' }).check();
      await page.getByRole('button', { name: 'Ver meu resultado' }).click();
      await page.getByRole('heading', { name: /primeiro passo é um dermatologista/ }).waitFor();
      await page.getByRole('heading', { name: 'Por que procurar avaliação' }).waitFor();
      await page.screenshot({ path: `${SHOTS}${vp.name}-teste-dermatologista.png`, fullPage: true });
    });

    await check(`${vp.name}: rota protegida sem login vai para /entrar`, async () => {
      await page.goto(BASE + '/app/diario');
      await page.waitForURL('**/entrar');
      assert.ok(await page.getByText('Modo demonstração.').isVisible(), 'faixa do modo demonstração deveria aparecer');
    });

    await check(`${vp.name}: cadastro valida campos com mensagens em português`, async () => {
      await page.goto(BASE + '/criar-conta');
      await page.getByRole('button', { name: 'Criar conta' }).click();
      assert.ok(await page.getByText('Informe seu e-mail.').isVisible());
      assert.ok(await page.getByText('Crie uma senha.').isVisible());
      assert.ok(await page.getByText('Para continuar, confirme que entendeu o aviso.').isVisible());
      await page.getByLabel('E-mail').fill('ana@');
      await page.getByLabel('Senha', { exact: true }).fill('abc');
      await page.getByLabel('Confirme a senha').fill('abd');
      await page.getByRole('button', { name: 'Criar conta' }).click();
      assert.ok(await page.getByText('Este e-mail não parece válido.').isVisible());
      assert.ok(await page.getByText(/pelo menos 8 caracteres/).first().isVisible());
      assert.ok(await page.getByText('As senhas não são iguais.').isVisible());
      assert.equal(await page.getByLabel('E-mail').getAttribute('aria-invalid'), 'true');
      await page.screenshot({ path: `${SHOTS}${vp.name}-cadastro-erros.png`, fullPage: true });
    });

    await check(`${vp.name}: cadastro cria conta SEM acesso ao bônus`, async () => {
      await page.getByLabel(/Como prefere ser chamado/).fill('Ana');
      await page.getByLabel('E-mail').fill(email);
      await page.getByLabel('Senha', { exact: true }).fill(password);
      await page.getByLabel('Confirme a senha').fill(password);
      await page.getByRole('checkbox', { name: /Entendi que o Pele em Foco é educativo/ }).check();
      await page.getByRole('button', { name: 'Criar conta' }).click();
      await page.waitForURL(BASE + '/app');
      await page.getByRole('heading', { name: /, Ana\./ }).waitFor();
      await page.getByRole('heading', { name: 'Seu acesso ainda não está ativo' }).waitFor();
      await noOverflow(page);
      await page.screenshot({ path: `${SHOTS}${vp.name}-sem-acesso.png`, fullPage: true });
      await page.goto(BASE + '/app/rotina');
      await page.getByRole('heading', { name: 'Seu acesso ainda não está ativo' }).waitFor();
      await page.goto(BASE + '/app/aprender');
      await page.getByRole('heading', { name: 'Seu acesso ainda não está ativo' }).waitFor();
    });

    await check(`${vp.name}: acesso de demonstração libera acesso vitalício e o início mostra dados reais`, async () => {
      await page.goto(BASE + '/app');
      await page.getByRole('button', { name: 'Simular compra' }).click();
      await page.getByText('Próximo passo').waitFor();
      assert.ok(await page.getByText('0 de 6 passos').isVisible());
      assert.ok(await page.getByText('Vitalício', { exact: true }).isVisible());
      await page.screenshot({ path: `${SHOTS}${vp.name}-inicio.png`, fullPage: true });
    });

    await check(`${vp.name}: rotina marca, desfaz e persiste após recarregar`, async () => {
      await page.goto(BASE + '/app/rotina?periodo=manha');
      await page.getByRole('checkbox', { name: /Limpeza suave/ }).click();
      await page.getByText('“Limpeza suave” marcado. Salvo.').waitFor();
      await page.getByRole('checkbox', { name: /Proteção solar/ }).click();
      await page.reload();
      assert.equal(await page.getByRole('checkbox', { name: /Limpeza suave/ }).getAttribute('aria-checked'), 'true');
      assert.equal(await page.getByRole('checkbox', { name: /Hidratação/ }).getAttribute('aria-checked'), 'false');
      await page.getByRole('checkbox', { name: /Proteção solar/ }).click();
      await page.getByText('“Proteção solar” desmarcado. Salvo.').waitFor();
      await page.reload();
      assert.equal(await page.getByRole('checkbox', { name: /Proteção solar/ }).getAttribute('aria-checked'), 'false');
      await page.getByRole('tab', { name: /Noite/ }).click();
      assert.ok(await page.getByRole('checkbox', { name: /Revisão dos cuidados utilizados/ }).isVisible());
      await page.screenshot({ path: `${SHOTS}${vp.name}-rotina.png`, fullPage: true });
    });

    await check(`${vp.name}: rotina funciona pelo teclado`, async () => {
      const box = page.getByRole('checkbox', { name: /Revisão dos cuidados utilizados/ });
      await box.focus();
      await page.keyboard.press('Space');
      await page.getByText('“Revisão dos cuidados utilizados” marcado. Salvo.').waitFor();
      assert.equal(await box.getAttribute('aria-checked'), 'true');
      await page.goto(BASE + '/app');
      await page.getByText('2 de 6 passos').waitFor();
    });

    await check(`${vp.name}: diário cria, impede data duplicada, edita e apaga`, async () => {
      await page.goto(BASE + '/app/diario');
      await page.getByRole('heading', { name: 'Nenhum registro ainda' }).waitFor();
      await page.getByRole('radio', { name: 'Mais oleosa' }).check();
      await page.getByRole('button', { name: 'Oleosidade' }).click();
      await page.getByLabel('Produtos usados (opcional)').fill('Gel de limpeza');
      await page.getByLabel('Anotações (opcional)').fill('Testa mais oleosa à tarde.');
      await page.getByRole('button', { name: 'Salvar registro' }).click();
      await page.getByText('Registro salvo.').waitFor();
      await page.reload();
      await page.getByText('Testa mais oleosa à tarde.').waitFor();
      assert.ok(await page.getByText('Mais oleosa · Oleosidade').isVisible());
      await page.getByRole('button', { name: 'Salvar registro' }).click();
      assert.ok(await page.getByText(/Já existe um registro para esta data/).isVisible());
      await page.getByRole('button', { name: /^Editar registro de/ }).click();
      await page.getByLabel('Anotações (opcional)').fill('Testa oleosa, queixo ok.');
      await page.getByRole('button', { name: 'Salvar alterações' }).click();
      await page.getByText('Registro atualizado.').waitFor();
      assert.ok(await page.getByText('Testa oleosa, queixo ok.').isVisible());
      await page.screenshot({ path: `${SHOTS}${vp.name}-diario.png`, fullPage: true });
      // registro de ontem, depois apagado
      const y = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); });
      await page.getByLabel('Data').fill(y);
      await page.getByLabel('Anotações (opcional)').fill('Registro de ontem');
      await page.getByRole('button', { name: 'Salvar registro' }).click();
      await page.getByText('Registro de ontem').waitFor();
      assert.equal(await page.locator('.history-item').count(), 2);
      await page.locator('.history-item').filter({ hasText: 'Registro de ontem' }).getByRole('button', { name: /Apagar/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Apagar' }).click();
      await page.getByText('Registro apagado.').waitFor();
      assert.equal(await page.locator('.history-item').count(), 1);
    });

    await check(`${vp.name}: biblioteca busca, filtra por categoria e mostra fontes`, async () => {
      await nav('Aprender').click();
      await page.waitForURL('**/app/aprender');
      await page.getByRole('searchbox', { name: 'Buscar na biblioteca' }).fill('protetor');
      await page.getByRole('link', { name: /Protetor solar no dia a dia/ }).waitFor();
      await page.getByRole('searchbox', { name: 'Buscar na biblioteca' }).fill('xyzxyz');
      await page.getByRole('heading', { name: 'Nada encontrado' }).waitFor();
      await page.getByRole('button', { name: 'Limpar busca' }).click();
      await page.getByRole('button', { name: 'Quando procurar dermatologista', exact: true }).click();
      await page.getByRole('link', { name: /Quando procurar um dermatologista/ }).click();
      await page.getByRole('heading', { name: 'Fontes' }).waitFor();
      assert.ok((await page.locator('article a[target="_blank"]').count()) >= 3);
      await noOverflow(page);
      await page.screenshot({ path: `${SHOTS}${vp.name}-artigo.png`, fullPage: true });
    });

    await check(`${vp.name}: questionário sem foto sugere tipos de produto e alerta para dermatologista`, async () => {
      await nav('Aprender').click();
      await page.getByRole('link', { name: /Questionário de rotina/ }).click();
      await page.waitForURL('**/app/aprender/questionario');
      const submit = page.getByRole('button', { name: 'Ver minhas sugestões' });
      assert.ok(await submit.isDisabled());
      await page.getByRole('radio', { name: 'Brilhosa no rosto todo' }).check();
      await page.getByRole('group', { name: /arder, coçar/ }).getByRole('radio', { name: 'Às vezes' }).check();
      await page.getByRole('group', { name: /maquiagem/ }).getByRole('radio', { name: 'Sim' }).check();
      await page.getByRole('group', { name: /suor/ }).getByRole('radio', { name: 'Não' }).check();
      await page.getByRole('group', { name: /barba/ }).getByRole('radio', { name: 'Não' }).check();
      await page.getByRole('checkbox', { name: /profundas ou doloridas/ }).check();
      await submit.click();
      await page.getByRole('heading', { name: 'Procure um dermatologista' }).waitFor();
      await page.getByRole('heading', { name: 'Demaquilante' }).waitFor();
      await page.getByText('Suas respostas não foram salvas', { exact: false }).waitFor();
      await noOverflow(page);
      await page.screenshot({ path: `${SHOTS}${vp.name}-questionario.png`, fullPage: true });
      await page.getByRole('link', { name: 'Ver no guia de produtos' }).nth(2).click();
      await page.waitForURL('**/app/aprender/guia-de-produtos#cat-protetor');
      await page.waitForFunction(() => { const r = document.getElementById('cat-protetor')?.getBoundingClientRect(); return !!r && r.top >= 0 && r.top < 200; });
    });

    await check(`${vp.name}: bônus expirado bloqueia gravação e mantém leitura do histórico`, async () => {
      await nav('Perfil').click();
      await page.getByText(/Acesso vitalício ativo/).waitFor();
      await page.getByRole('button', { name: 'Simular acesso expirado' }).click();
      await page.getByRole('heading', { name: 'Seu acesso terminou' }).waitFor();
      await nav('Minha rotina').click();
      await page.getByRole('heading', { name: 'Seu acesso terminou' }).waitFor();
      await nav('Diário da pele').click();
      await page.getByText('Testa oleosa, queixo ok.').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Salvar registro' }).count(), 0, 'formulário não deveria aparecer');
      assert.equal(await page.getByRole('button', { name: /^Editar registro de/ }).count(), 0);
      await page.screenshot({ path: `${SHOTS}${vp.name}-expirado.png`, fullPage: true });
    });

    await check(`${vp.name}: perfil exporta, apaga dados e sai`, async () => {
      await nav('Perfil').click();
      await page.getByText(email, { exact: true }).waitFor();
      const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar meus dados' }).click()]);
      assert.match(file.suggestedFilename(), /^pele-em-foco-\d{4}-\d{2}-\d{2}\.json$/);
      await page.getByRole('button', { name: 'Apagar rotina e diário' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Apagar' }).click();
      await page.getByText('Rotina e diário apagados.').waitFor();
      await page.screenshot({ path: `${SHOTS}${vp.name}-perfil.png`, fullPage: true });
      await page.getByRole('button', { name: 'Sair da conta' }).click();
      await page.waitForURL('**/entrar');
      await page.goto(BASE + '/app/perfil');
      await page.waitForURL('**/entrar');
    });

    await check(`${vp.name}: login recusa senha errada e entra com a certa`, async () => {
      await page.getByLabel('E-mail').fill(email);
      await page.getByLabel('Senha', { exact: true }).fill('senhaerrada1');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.getByText('E-mail ou senha incorretos.').waitFor();
      await page.getByLabel('Senha', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Entrar' }).click();
      // a última tentativa de abrir /app/perfil sem sessão vira o destino após o login
      await page.waitForURL(BASE + '/app/perfil');
    });

    await check(`${vp.name}: recuperar senha explica a limitação do modo demo`, async () => {
      await nav('Perfil').click();
      await page.getByRole('button', { name: 'Sair da conta' }).click();
      await page.waitForURL('**/entrar');
      await page.goto(BASE + '/recuperar-senha');
      await page.getByLabel('E-mail da conta').fill(email);
      await page.getByRole('button', { name: 'Enviar link' }).click();
      await page.getByText(/No modo demonstração não há envio de e-mail/).waitFor();
    });

    await check(`${vp.name}: outra conta não vê os dados da primeira e conta é excluída`, async () => {
      await page.goto(BASE + '/criar-conta');
      await page.getByLabel('E-mail').fill(`bruno.${vp.name}@exemplo.com`);
      await page.getByLabel('Senha', { exact: true }).fill(password);
      await page.getByLabel('Confirme a senha').fill(password);
      await page.getByRole('checkbox', { name: /Entendi que o Pele em Foco é educativo/ }).check();
      await page.getByRole('button', { name: 'Criar conta' }).click();
      await page.waitForURL(BASE + '/app');
      await page.getByRole('heading', { name: 'Seu acesso ainda não está ativo' }).waitFor();
      await page.goto(BASE + '/app/diario');
      await page.getByRole('heading', { name: 'Nenhum registro ainda' }).waitFor();
      await page.goto(BASE + '/app/perfil');
      await page.getByRole('button', { name: 'Excluir minha conta' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Excluir conta' }).click();
      await page.waitForURL('**/entrar');
      await page.getByText('Sua conta e seus dados foram excluídos.').waitFor();
      await page.getByLabel('E-mail').fill(`bruno.${vp.name}@exemplo.com`);
      await page.getByLabel('Senha', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.getByText('E-mail ou senha incorretos.').waitFor();
    });

    await check(`${vp.name}: teclado — "pular para o conteúdo" é o primeiro foco e a navegação leva o foco ao conteúdo`, async () => {
      await page.goto(BASE + '/entrar');
      await page.getByLabel('E-mail').fill(email);
      await page.getByLabel('Senha', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.waitForURL(BASE + '/app');
      await nav('Diário da pele').click();
      await page.waitForURL('**/app/diario');
      // O foco é movido num efeito do React, logo depois da troca de URL: espera a condição em vez de ler na hora.
      await page.waitForFunction(() => document.activeElement?.id === 'conteudo', null, { timeout: 3000 }).catch(() => assert.fail('foco deveria ir para o conteúdo após navegar'));
      await page.reload();
      await page.getByRole('heading', { name: 'Suas observações' }).waitFor();
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.textContent?.slice(0, 40)}`);
      assert.equal(focused, 'A:Pular para o conteúdo');
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
