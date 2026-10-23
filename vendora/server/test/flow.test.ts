import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/context';
import { clearRobotsCache } from '../src/modules/extraction/robots';
import { fakeFetcher, makeApp, resetDb, sessionCookie } from './helpers';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const PAGE = 'https://www.lojadetestes.com.br/produto/garrafa';
const BLOCKED = 'https://www.lojadetestes.com.br/produto/bloqueado';

let app: FastifyInstance;
let ctx: AppContext;
let cookie: string;
let otherCookie: string;

beforeAll(async () => {
  clearRobotsCache();
  const img1 = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#203040' } }).jpeg().toBuffer();
  const fetcher = fakeFetcher({
    [PAGE]: { body: fixture('jsonld-product.html') },
    [BLOCKED]: { status: 403, body: 'Forbidden' },
    'https://www.lojadetestes.com.br/img/garrafa-1.jpg': { contentType: 'image/jpeg', body: img1 },
    'https://cdn.lojadetestes.com.br/garrafa-2.jpg': { contentType: 'text/html', body: '<html>não é imagem</html>' },
  });
  ({ app, ctx } = await makeApp({ fetcher }));
  await resetDb(ctx);
  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { name: 'Vendedora Teste', email: 'teste@vendora.test', password: 'senha-forte-123' },
  });
  expect(reg.statusCode).toBe(201);
  cookie = sessionCookie(reg);
  const other = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { name: 'Outra Pessoa', email: 'outra@vendora.test', password: 'outra-senha-123' },
  });
  otherCookie = sessionCookie(other);
});

afterAll(async () => {
  await app.close();
  await ctx.db.$disconnect();
});

const api = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown, as = cookie) =>
  app.inject({ method, url, payload: payload as never, headers: { cookie: as } });

describe('autenticação', () => {
  it('exige sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/listings' });
    expect(res.statusCode).toBe(401);
  });
  it('não revela se o e-mail existe e recusa senha errada', async () => {
    const a = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'teste@vendora.test', password: 'errada' } });
    const b = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'naoexiste@vendora.test', password: 'errada' } });
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json().error.message).toBe(b.json().error.message);
  });
  it('recusa e-mail duplicado e senha curta', async () => {
    const dup = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Fulano', email: 'teste@vendora.test', password: 'senha-forte-123' },
    });
    expect(dup.statusCode).toBe(409);
    const short = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { name: 'Fulano', email: 'f@vendora.test', password: '123' } });
    expect(short.statusCode).toBe(400);
  });
  it('bloqueia requisições de outra origem (CSRF)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/products/analyze',
      payload: { url: PAGE },
      headers: { cookie, origin: 'https://site-malicioso.com' },
    });
    expect(res.statusCode).toBe(403);
  });
  it('aceita a mesma origem em qualquer domínio do app (aliases da Vercel)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'teste@vendora.test', password: 'senha-forte-123' },
      headers: { origin: 'https://vendora-ai-kaynan3.vercel.app', host: 'vendora-ai-kaynan3.vercel.app' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('fluxo principal: colar link → analisar → imagens → gerar → editar → exportar', () => {
  let productId: string;
  let listingId: string;
  let originalId: string;

  it('analisa a página e marca a origem de cada campo', async () => {
    const res = await api('POST', '/api/products/analyze', { url: PAGE });
    expect(res.statusCode).toBe(201);
    const { product, extraction } = res.json();
    expect(extraction.ok).toBe(true);
    expect(product.status).toBe('extracted');
    expect(product.data.brand).toBe('Termix');
    expect(product.fieldStatus.brand).toBe('confirmed');
    expect(product.fieldStatus.features).toBe('missing');
    productId = product.id;
  });

  it('URL interna é recusada (SSRF)', async () => {
    const res = await api('POST', '/api/products/analyze', { url: 'http://169.254.169.254/latest/meta-data' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('blocked_url');
  });

  it('importa imagens como originais e relata a que falhou', async () => {
    const res = await api('POST', `/api/products/${productId}/images/import`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results.filter((r: { ok: boolean }) => r.ok)).toHaveLength(1);
    expect(body.results.find((r: { ok: boolean }) => !r.ok).error).toMatch(/não é uma imagem/);
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0].kind).toBe('original');
    originalId = body.assets[0].id;
  });

  it('edita a imagem gerando uma cópia e preserva a original', async () => {
    const before = await ctx.db.asset.findUniqueOrThrow({ where: { id: originalId } });
    const originalBytes = await ctx.storage.get(before.storageKey);
    const res = await api('POST', `/api/assets/${originalId}/edit`, {
      operations: { whiteBackground: true, brightness: 10, output: { size: 1200, format: 'jpeg' } },
    });
    expect(res.statusCode).toBe(201);
    const edited = res.json().asset;
    // 800×600 → quadrado de 1200 com borda branca; o produto não é ampliado.
    expect(edited).toMatchObject({ kind: 'edited', parentId: originalId, width: 1200, height: 1200 });
    expect((await ctx.storage.get(before.storageKey)).equals(originalBytes)).toBe(true);

    const file = await app.inject({ method: 'GET', url: edited.url });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
    const forged = await app.inject({ method: 'GET', url: edited.url.replace(/sig=[^&]+/, 'sig=AAAA') });
    expect(forged.statusCode).toBe(403);

    const v = await api('GET', `/api/assets/${edited.id}/validate?marketplace=mercado_livre`);
    expect(v.json().publishable).toBe(true);
    expect(v.json().issues).toEqual([]);
    const orig = await api('GET', `/api/assets/${originalId}/validate?marketplace=mercado_livre`);
    expect(orig.json().issues.map((i: { message: string }) => i.message).join(' ')).toMatch(/quadradas/);
    expect((await api('POST', `/api/assets/${edited.id}/main`)).statusCode).toBe(200);
  });

  it('remoção de fundo sem credencial responde de forma explícita', async () => {
    const res = await api('POST', `/api/assets/${originalId}/remove-background`);
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('bg_not_configured');
  });

  it('gera o anúncio para o Mercado Livre respeitando o limite do canal', async () => {
    const res = await api('POST', '/api/listings', { productId, marketplace: 'mercado_livre' });
    expect(res.statusCode).toBe(201);
    const { listing, rules } = res.json();
    expect(listing.source).toBe('basic');
    expect(listing.content.title.length).toBeLessThanOrEqual(rules.titleMax);
    expect(listing.content.title).toContain('TX-500');
    expect(listing.content.missingInfo.map((m: { field: string }) => m.field)).toContain('Categoria');
    listingId = listing.id;
  });

  it('o mesmo produto gera perfis diferentes para outro canal', async () => {
    const res = await api('POST', '/api/listings', { productId, marketplace: 'shopee' });
    expect(res.json().rules.titleMax).toBe(100);
  });

  it('o vendedor edita o texto: vira nova versão e as anteriores ficam', async () => {
    const current = (await api('GET', `/api/listings/${listingId}`)).json().listing.content;
    const res = await api('PUT', `/api/listings/${listingId}/content`, {
      content: { ...current, title: 'Garrafa Térmica Termix TX-500 Inox 500 ml Preta' },
    });
    expect(res.statusCode).toBe(200);
    const { listing } = res.json();
    expect(listing.currentVersion).toBe(2);
    expect(listing.source).toBe('user');
    expect(listing.versions).toHaveLength(2);
  });

  it('regenera só o título e preserva a descrição editada', async () => {
    const before = (await api('GET', `/api/listings/${listingId}`)).json().listing.content;
    await api('PUT', `/api/listings/${listingId}/content`, { content: { ...before, description: 'Descrição do vendedor.' } });
    const res = await api('POST', `/api/listings/${listingId}/regenerate`, { part: 'title' });
    expect(res.statusCode).toBe(200);
    expect(res.json().listing.content.description).toBe('Descrição do vendedor.');
    expect(res.json().listing.currentVersion).toBe(4);
  });

  it('restaura uma versão anterior', async () => {
    const res = await api('POST', `/api/listings/${listingId}/versions/1/restore`);
    expect(res.json().listing.currentVersion).toBe(5);
    expect(res.json().listing.content.description).not.toBe('Descrição do vendedor.');
  });

  it('salva e exporta em JSON, TXT e ZIP', async () => {
    expect((await api('POST', `/api/listings/${listingId}/save`)).json().listing.status).toBe('saved');
    const json = await api('GET', `/api/listings/${listingId}/export?format=json`);
    expect(json.headers['content-disposition']).toMatch(/attachment/);
    const exported = json.json();
    expect(exported.notice).toMatch(/publicação automática não está ativa/);
    expect(exported.images).toHaveLength(2);
    const txt = await api('GET', `/api/listings/${listingId}/export?format=txt`);
    expect(txt.body).toMatch(/^ANÚNCIO — Mercado Livre/);
    const zip = await api('GET', `/api/listings/${listingId}/export?format=zip`);
    expect(zip.statusCode).toBe(200);
    expect(zip.rawPayload.subarray(0, 2).toString()).toBe('PK');
  });

  it('publicação automática responde que não está implementada', async () => {
    const res = await api('POST', `/api/listings/${listingId}/publish`);
    expect(res.statusCode).toBe(501);
  });

  it('histórico e indicadores', async () => {
    const list = (await api('GET', '/api/listings')).json();
    expect(list.listings).toHaveLength(2);
    const usage = (await api('GET', '/api/usage')).json();
    expect(usage.last30Days.analysis).toBeGreaterThanOrEqual(1);
    expect(usage.last30Days.generation).toBe(3);
    expect(usage.last30Days.export).toBe(3);
  });

  it('outro usuário não acessa os dados', async () => {
    expect((await api('GET', `/api/listings/${listingId}`, undefined, otherCookie)).statusCode).toBe(404);
    expect((await api('GET', `/api/products/${productId}`, undefined, otherCookie)).statusCode).toBe(404);
    expect((await api('POST', `/api/assets/${originalId}/edit`, { operations: { output: {} } }, otherCookie)).statusCode).toBe(404);
    expect((await api('GET', '/api/listings', undefined, otherCookie)).json().listings).toHaveLength(0);
  });
});

describe('falha de extração → importação manual', () => {
  let failedId: string;

  it('registra a falha com o motivo e sem dados', async () => {
    const res = await api('POST', '/api/products/analyze', { url: BLOCKED });
    const { product, extraction } = res.json();
    expect(extraction).toMatchObject({ ok: false, code: 'site_blocked' });
    expect(product.status).toBe('failed');
    expect(product.data.title).toBeNull();
    failedId = product.id;
  });

  it('não gera anúncio sem dados', async () => {
    const res = await api('POST', '/api/listings', { productId: failedId, marketplace: 'tiktok_shop' });
    expect(res.statusCode).toBe(422);
  });

  it('o vendedor completa os dados e então gera', async () => {
    const patch = await api('PATCH', `/api/products/${failedId}`, {
      data: { title: 'Caneca de Porcelana 300ml Branca', brand: 'Porcelana Teste' },
    });
    expect(patch.json().product).toMatchObject({ status: 'manual', fieldStatus: { title: 'user', brand: 'user' } });
    const res = await api('POST', '/api/listings', { productId: failedId, marketplace: 'tiktok_shop' });
    expect(res.statusCode).toBe(201);
  });

  it('cadastro 100% manual', async () => {
    const res = await api('POST', '/api/products/manual', {
      title: 'Luminária de Mesa LED',
      brand: 'Lumi',
      specifications: [{ name: 'Potência', value: '8 W' }],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().product.fieldStatus).toMatchObject({ title: 'user', specifications: 'user', model: 'missing' });
  });
});

describe('configurações e integrações', () => {
  it('ajusta o limite de título do canal', async () => {
    const res = await api('PUT', '/api/settings/marketplaces/mercado_livre', { titleMaxLength: 80 });
    expect(res.json().rules.titleMax).toBe(80);
    const bad = await api('PUT', '/api/settings/marketplaces/mercado_livre', { titleMaxLength: 2 });
    expect(bad.statusCode).toBe(400);
  });

  it('mostra o estado real das integrações', async () => {
    const { integrations } = (await api('GET', '/api/integrations')).json();
    expect(integrations.find((i: { id: string }) => i.id === 'mercado_livre').capabilities).toEqual({
      authorization: 'needs_credentials',
      publish: 'not_implemented',
      status: 'not_implemented',
    });
    expect((await api('POST', '/api/integrations/shopee/connect')).statusCode).toBe(501);
    expect((await api('POST', '/api/integrations/mercado_livre/connect')).statusCode).toBe(503);
  });

  it('callback do OAuth recusa state inválido', async () => {
    const res = await api('GET', '/api/integrations/mercado_livre/callback?code=x&state=forjado');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('status=invalid_state');
  });

  it('excluir a conta apaga tudo', async () => {
    const res = await api('DELETE', '/api/account', undefined, otherCookie);
    expect(res.statusCode).toBe(200);
    expect(await ctx.db.user.count({ where: { email: 'outra@vendora.test' } })).toBe(0);
  });
});
