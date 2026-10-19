import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseRegions, parseRelated, parseTimeseries, PERIOD_TO_SERPAPI } from './integrations/googleTrends';
import { nodeToProduct, shopeeSignature } from './integrations/shopee';
import { handleApi } from './router';
import { integrationStatus } from './status';

describe('Google Trends (SerpApi)', () => {
  it('mapeia os períodos suportados', () => {
    expect(PERIOD_TO_SERPAPI).toEqual({ '7d': 'now 7-d', '30d': 'today 1-m', '90d': 'today 3-m', '12m': 'today 12-m' });
  });
  it('converte timeline em séries por termo com crescimento', () => {
    const data = {
      interest_over_time: {
        timeline_data: [10, 10, 20, 20, 30, 30].map((v, i) => ({
          timestamp: String(1_700_000_000 + i * 86400),
          values: [
            { query: 'a', extracted_value: v },
            { query: 'b', extracted_value: 50 },
          ],
        })),
      },
    };
    const [a, b] = parseTimeseries(data, ['a', 'b']);
    expect(a.points).toHaveLength(6);
    expect(a.growthPct).toBe(200);
    expect(b.growthPct).toBe(0);
  });
  it('ordena regiões e separa consultas relacionadas', () => {
    expect(parseRegions({ interest_by_region: [{ geo: 'BR-RJ', location: 'Rio', extracted_value: 40 }, { geo: 'BR-SP', location: 'SP', extracted_value: 100 }] })[0].code).toBe('BR-SP');
    const rel = parseRelated({ related_queries: { rising: [{ query: 'x', value: '+300%' }], top: [{ query: 'y', value: '100' }] } });
    expect(rel.map((r) => r.kind)).toEqual(['rising', 'top']);
  });
});

describe('Shopee', () => {
  it('assina com sha256(appId + timestamp + payload + secret)', () => {
    const expected = createHash('sha256').update('123' + '1700000000' + '{"query":"{}"}' + 'segredo').digest('hex');
    expect(shopeeSignature('123', 1700000000, '{"query":"{}"}', 'segredo')).toBe(expected);
  });
  it('rotula vendas como "informadas", nunca como oficiais no período', () => {
    const p = nodeToProduct({ itemId: 1, productName: 'X', priceMin: '19.90', sales: 321 }, '2026-01-01T00:00:00Z', []);
    expect(p.price).toBe(19.9);
    expect(p.metrics[0]).toMatchObject({ kind: 'vendas_informadas', value: 321 });
  });
});

describe('API', () => {
  it('status nunca expõe valores de segredo', async () => {
    process.env.SERPAPI_KEY = 'super-secreta';
    const body = await (await handleApi(new Request('http://x/api/status'), 'status')).text();
    expect(body).not.toContain('super-secreta');
    delete process.env.SERPAPI_KEY;
  });
  it('sem credenciais responde 503 not_configured', async () => {
    const res = await handleApi(new Request('http://x/api/trends?terms=seladora&period=30d'), 'trends');
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('not_configured');
  });
  it('valida parâmetros', async () => {
    expect((await handleApi(new Request('http://x/api/trends?terms=a|b|c|d|e|f'), 'trends')).status).toBe(400);
    expect((await handleApi(new Request('http://x/api/trends?terms=a&period=2y'), 'trends')).status).toBe(400);
    expect((await handleApi(new Request('http://x/api/trends?terms=a&geo=US'), 'trends')).status).toBe(400);
  });
  it('sync exige CRON_SECRET', async () => {
    process.env.CRON_SECRET = 's';
    expect((await handleApi(new Request('http://x/api/sync'), 'sync')).status).toBe(401);
    delete process.env.CRON_SECRET;
  });
  it('TikTok Shop aparece como indisponível (sem API de mercado)', () => {
    expect(integrationStatus().find((i) => i.id === 'tiktok')!.state).toBe('indisponivel');
  });
});
