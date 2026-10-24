import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { looksBlocked, parseProductPage } from '../src/modules/extraction/parse';
import { clearRobotsCache } from '../src/modules/extraction/robots';
import { extractProduct, type ExtractionDeps } from '../src/modules/extraction/service';
import { fakeFetcher } from './helpers';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const PAGE = 'https://www.lojadetestes.com.br/produto/garrafa';

const deps = (routes: Parameters<typeof fakeFetcher>[0], extra: Partial<ExtractionDeps> = {}): ExtractionDeps => ({
  fetcher: fakeFetcher(routes),
  userAgent: 'VendoraBot/0.1',
  timeoutMs: 1000,
  maxBytes: 1024 * 1024,
  respectRobots: true,
  ...extra,
});

beforeEach(() => clearRobotsCache());

describe('parseProductPage', () => {
  it('extrai JSON-LD com @graph, marca, modelo, preço, imagens e especificações', () => {
    const r = parseProductPage(fixture('jsonld-product.html'), PAGE)!;
    expect(r.method).toBe('json-ld');
    expect(r.data.title).toBe('Garrafa Térmica Inox 500ml TX-500');
    expect(r.data.brand).toBe('Termix');
    expect(r.data.model).toBe('TX-500');
    expect(r.data.gtin).toBe('7890000000001');
    expect(r.data.price).toEqual({ amount: 89.9, currency: 'BRL' });
    expect(r.data.description).toBe('Garrafa térmica de aço inox com parede dupla.\nMantém a temperatura por até 12 horas.');
    expect(r.data.images).toEqual([
      'https://www.lojadetestes.com.br/img/garrafa-1.jpg',
      'https://cdn.lojadetestes.com.br/garrafa-2.jpg',
    ]);
    expect(r.data.specifications).toEqual(
      expect.arrayContaining([
        { name: 'Capacidade', value: '500 ml' },
        { name: 'Cor', value: 'Preta' },
        { name: 'Peso', value: '350 g' },
      ]),
    );
    expect(r.fieldStatus.title).toBe('confirmed');
    expect(r.fieldStatus.features).toBe('missing');
  });

  it('usa microdata quando não há JSON-LD', () => {
    const r = parseProductPage(fixture('microdata.html'), 'https://loja.com/m100')!;
    expect(r.method).toBe('microdata');
    expect(r.data.brand).toBe('Clikx');
    expect(r.data.price).toEqual({ amount: 59.9, currency: 'BRL' });
    expect(r.data.images).toEqual(['https://loja.com/m100.png']);
  });

  it('com só Open Graph, marca os campos como inferidos e não inventa marca', () => {
    const r = parseProductPage(fixture('og-only.html'), 'https://loja.com/c')!;
    expect(r.method).toBe('opengraph');
    expect(r.fieldStatus.title).toBe('inferred');
    expect(r.data.brand).toBeNull();
    expect(r.fieldStatus.brand).toBe('missing');
  });

  it('detecta páginas de captcha', () => {
    expect(looksBlocked(fixture('captcha.html'))).toBe(true);
    expect(looksBlocked(fixture('jsonld-product.html'))).toBe(false);
  });
});

describe('extractProduct', () => {
  it('lê a página quando permitido', async () => {
    const r = await extractProduct(PAGE, deps({ [PAGE]: { body: fixture('jsonld-product.html') } }));
    expect(r.ok && r.quality).toBe('extracted');
  });

  it('respeita robots.txt e não busca a página', async () => {
    const d = deps({
      'https://www.lojadetestes.com.br/robots.txt': { contentType: 'text/plain', body: 'User-agent: *\nDisallow: /produto/' },
      [PAGE]: { body: fixture('jsonld-product.html') },
    });
    const r = await extractProduct(PAGE, d);
    expect(r).toMatchObject({ ok: false, code: 'robots_disallowed' });
    expect((d.fetcher as unknown as { calls: string[] }).calls).not.toContain(PAGE);
  });

  it('informa bloqueio (403) sem fingir que analisou', async () => {
    const r = await extractProduct(PAGE, deps({ [PAGE]: { status: 403, body: 'Forbidden' } }));
    expect(r).toMatchObject({ ok: false, code: 'site_blocked' });
  });

  it('informa captcha', async () => {
    const r = await extractProduct(PAGE, deps({ [PAGE]: { body: fixture('captcha.html') } }));
    expect(r).toMatchObject({ ok: false, code: 'site_blocked' });
  });

  it('recusa conteúdo que não é HTML', async () => {
    const r = await extractProduct(PAGE, deps({ [PAGE]: { contentType: 'application/pdf', body: '%PDF' } }));
    expect(r).toMatchObject({ ok: false, code: 'not_html' });
  });

  it('página sem dados de produto', async () => {
    const r = await extractProduct(PAGE, deps({ [PAGE]: { body: '<html><body>oi</body></html>' } }));
    expect(r).toMatchObject({ ok: false, code: 'no_product_data' });
  });

  it('URL interna é recusada antes de qualquer acesso', async () => {
    await expect(extractProduct('http://169.254.169.254/latest', deps({}))).rejects.toMatchObject({ code: 'blocked_url' });
  });
});
