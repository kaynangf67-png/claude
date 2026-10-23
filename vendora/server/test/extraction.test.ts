import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { fetchMercadoLivreItem, mercadoLivreItemId } from '../src/modules/extraction/mercadolivre';
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
  mlApiUrl: 'https://api.mercadolibre.com',
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

describe('Mercado Livre', () => {
  it('reconhece IDs de anúncio', () => {
    expect(mercadoLivreItemId(new URL('https://produto.mercadolivre.com.br/MLB-1234567890-garrafa-_JM'))).toBe('MLB1234567890');
    expect(mercadoLivreItemId(new URL('https://www.mercadolivre.com.br/garrafa/p/MLB123456'))).toBeNull();
    expect(mercadoLivreItemId(new URL('https://www.outraloja.com/MLB-1234567890'))).toBeNull();
  });

  it('mapeia a resposta da API de itens', async () => {
    const api = 'https://api.mercadolibre.com';
    const fetcher = fakeFetcher({
      [`${api}/items/MLB1`]: {
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'MLB1',
          title: 'Garrafa Termix TX-500',
          price: 89.9,
          currency_id: 'BRL',
          category_id: 'MLB1234',
          attributes: [
            { id: 'BRAND', name: 'Marca', value_name: 'Termix' },
            { id: 'MODEL', name: 'Modelo', value_name: 'TX-500' },
            { id: 'CAPACITY', name: 'Capacidade', value_name: '500 mL' },
          ],
          pictures: [{ secure_url: 'https://http2.mlstatic.com/D_1.jpg' }],
        }),
      },
      [`${api}/items/MLB1/description`]: { contentType: 'application/json', body: '{"plain_text":"Garrafa de inox."}' },
    });
    const r = (await fetchMercadoLivreItem('MLB1', 'tok', api, fetcher, { timeoutMs: 1000, userAgent: 'x' }))!;
    expect(r.data).toMatchObject({ brand: 'Termix', model: 'TX-500', description: 'Garrafa de inox.' });
    expect(r.data.specifications).toEqual([{ name: 'Capacidade', value: '500 mL' }]);
    expect(r.fieldStatus.gtin).toBe('missing');
  });
});
