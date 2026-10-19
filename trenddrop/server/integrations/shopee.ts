// Shopee Affiliate Open API (GraphQL) — programa de afiliados Shopee Brasil.
// Endpoint BR: https://open-api.affiliate.shopee.com.br/graphql
//
// Autenticação: header
//   Authorization: SHA256 Credential={AppId}, Timestamp={unix}, Signature={sha256(AppId + Timestamp + Payload + Secret)}
// onde Payload é exatamente o corpo JSON enviado.
//
// Query usada: productOfferV2 (keyword, sortType, page, limit). sortType 2 =
// ITEM_SOLD_DESC (mais vendidos), 1 = relevância. O campo `sales` é a
// quantidade vendida informada pela Shopee na API de afiliados; a fonte não
// documenta o período, por isso o rótulo é "vendas informadas", e não
// "vendas oficiais no período".
//
// Exige conta aprovada no programa de afiliados e credenciais da Open API.

import { createHash } from 'node:crypto';
import { priceStats } from '../../shared/analysis.js';
import type { MarketSearchResult, Metric, Product } from '../../shared/types.js';
import { serverEnv } from '../env.js';
import { ApiError, cached, fetchJson, notConfigured } from '../http.js';

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';
const SOURCE = 'Shopee Affiliate API';

export function isShopeeConfigured() {
  return Boolean(serverEnv.shopeeAppId && serverEnv.shopeeSecret);
}

export function shopeeSignature(appId: string, timestamp: number, payload: string, secret: string) {
  return createHash('sha256').update(`${appId}${timestamp}${payload}${secret}`).digest('hex');
}

interface OfferNode {
  itemId: number | string;
  productName: string;
  priceMin?: string | number | null;
  priceMax?: string | number | null;
  sales?: number | null;
  imageUrl?: string | null;
  productLink?: string | null;
  offerLink?: string | null;
  shopName?: string | null;
  ratingStar?: string | number | null;
  commissionRate?: string | number | null;
  productCatIds?: number[] | null;
}

async function gql<T>(query: string): Promise<T> {
  const { shopeeAppId: appId, shopeeSecret: secret } = serverEnv;
  if (!appId || !secret) throw notConfigured('shopee', 'Shopee não configurada: defina SHOPEE_AFFILIATE_APP_ID e SHOPEE_AFFILIATE_SECRET no servidor.');
  const payload = JSON.stringify({ query });
  const ts = Math.floor(Date.now() / 1000);
  const res = await fetchJson<{ data?: T; errors?: { message: string }[] }>(
    ENDPOINT,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${shopeeSignature(appId, ts, payload, secret)}`,
      },
      body: payload,
    },
    'Shopee Affiliate API',
  );
  if (res.errors?.length) throw new ApiError(502, 'upstream_error', `Shopee: ${res.errors[0].message}`);
  if (!res.data) throw new ApiError(502, 'upstream_error', 'Shopee retornou resposta sem dados.');
  return res.data;
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function nodeToProduct(n: OfferNode, now: string, similar: number[]): Product {
  const price = num(n.priceMin);
  const metrics: Metric[] = [];
  if (typeof n.sales === 'number') {
    metrics.push({ kind: 'vendas_informadas', value: n.sales, detail: 'vendas informadas pela API de afiliados Shopee (período não especificado pela fonte)', official: true });
  }
  const rating = num(n.ratingStar);
  if (rating) metrics.push({ kind: 'avaliacao', value: rating, detail: 'nota média (0–5)', official: true });
  return {
    id: `shopee:${n.itemId}`,
    externalId: String(n.itemId),
    name: n.productName,
    imageUrl: n.imageUrl ?? null,
    category: null,
    marketplace: 'shopee',
    sourceName: SOURCE,
    sourceUrl: n.productLink ?? n.offerLink ?? null,
    price,
    priceHistory: price ? [{ date: now, price }] : [],
    metrics,
    trend: [],
    trendTerm: null,
    growthPct: null,
    competition: null,
    similarPrices: similar,
    quality: 'oficial',
    updatedAt: now,
    transient: true,
  };
}

export async function searchShopee(keyword: string, sort: 'relevancia' | 'vendas' = 'relevancia'): Promise<MarketSearchResult> {
  return cached(`shopee:${keyword.toLowerCase()}:${sort}`, 30 * 60_000, async () => {
    const sortType = sort === 'vendas' ? 2 : 1;
    const query = `{ productOfferV2(keyword: ${JSON.stringify(keyword)}, sortType: ${sortType}, page: 1, limit: 30) { nodes { itemId productName priceMin priceMax sales imageUrl productLink offerLink shopName ratingStar commissionRate productCatIds } } }`;
    const data = await gql<{ productOfferV2: { nodes: OfferNode[] } }>(query);
    const nodes = data.productOfferV2?.nodes ?? [];
    const now = new Date().toISOString();
    const prices = nodes.map((n) => num(n.priceMin)).filter((p): p is number => p != null);
    return {
      source: 'shopee',
      query: keyword,
      fetchedAt: now,
      total: null, // a API de afiliados não informa o total de anúncios
      competition: null,
      priceStats: priceStats(prices),
      products: nodes.map((n) => nodeToProduct(n, now, prices)),
    };
  });
}
