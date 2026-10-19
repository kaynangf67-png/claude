// API oficial do Mercado Livre (https://developers.mercadolivre.com.br).
//
// Endpoints usados (todos GET com "Authorization: Bearer <access_token>"):
// - /sites/MLB/search?q=          busca de anúncios (preço, categoria, link)
// - /trends/MLB[/{categoria}]     50 buscas em alta (10 que mais crescem, 20 mais
//                                 buscadas, 20 populares). Atualização semanal.
//                                 São BUSCAS, não vendas.
// - /highlights/MLB/category/{id} ranking oficial "Mais vendidos" (top 20) da
//                                 categoria. Traz a POSIÇÃO, não a quantidade.
// - /items?ids=, /products/{id}   detalhes dos itens do ranking
// - /sites/MLB/categories, /categories/{id}
//
// Autenticação: OAuth 2.0 (authorization_code). O access token dura ~6h e é
// renovado com o refresh token, que é de uso único: a cada renovação o ML
// devolve um novo refresh token. Ele é persistido em integration_secrets
// (Supabase, acessível só com service role). Sem banco, fica em memória e o
// ML_REFRESH_TOKEN do ambiente precisa ser atualizado manualmente se a
// função reiniciar depois de uma renovação.

import { competitionFromListings, priceStats } from '../../shared/analysis';
import type { KeywordTrend, MarketSearchResult, Metric, Product } from '../../shared/types';
import { serverEnv } from '../env';
import { ApiError, cached, fetchJson, notConfigured } from '../http';
import { readSecret, writeSecret } from '../db';

const API = 'https://api.mercadolibre.com';
const SOURCE = 'API Mercado Livre';

let memoryToken: { token: string; expires: number } | null = null;
let memoryRefresh: string | null = null;

export function isMercadoLivreConfigured() {
  return Boolean(serverEnv.mlAccessToken || (serverEnv.mlClientId && serverEnv.mlClientSecret && serverEnv.mlRefreshToken));
}

async function accessToken(): Promise<string> {
  if (memoryToken && memoryToken.expires > Date.now() + 60_000) return memoryToken.token;
  const { mlClientId, mlClientSecret, mlRefreshToken, mlAccessToken } = serverEnv;
  if (mlClientId && mlClientSecret && mlRefreshToken) {
    const refresh = memoryRefresh ?? (await readSecret('mercadolivre', 'refresh_token')) ?? mlRefreshToken;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: mlClientId,
      client_secret: mlClientSecret,
      refresh_token: refresh,
    });
    const data = await fetchJson<{ access_token: string; expires_in: number; refresh_token?: string }>(
      `${API}/oauth/token`,
      { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body },
      'Mercado Livre (OAuth)',
    );
    memoryToken = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
    if (data.refresh_token && data.refresh_token !== refresh) {
      memoryRefresh = data.refresh_token;
      await writeSecret('mercadolivre', 'refresh_token', data.refresh_token);
    }
    return data.access_token;
  }
  if (mlAccessToken) return mlAccessToken;
  throw notConfigured('mercadolivre', 'Mercado Livre não configurado: defina ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REFRESH_TOKEN no servidor.');
}

async function ml<T>(path: string): Promise<T> {
  const token = await accessToken();
  return fetchJson<T>(`${API}${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } }, 'Mercado Livre');
}

interface MlSearchItem {
  id: string;
  title: string;
  price: number;
  thumbnail?: string;
  permalink?: string;
  category_id?: string;
  sold_quantity?: number;
  condition?: string;
}

async function categoryName(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  try {
    return await cached(`ml:cat:${id}`, 24 * 3600_000, async () => (await ml<{ name: string }>(`/categories/${id}`)).name);
  } catch {
    return null;
  }
}

const hiRes = (url?: string) => (url ? url.replace(/^http:/, 'https:').replace(/-I\.jpg$/, '-O.jpg') : null);

function toProduct(it: MlSearchItem, extra: { category: string | null; metrics?: Metric[]; similar: number[]; competition?: MarketSearchResult['competition']; now: string }): Product {
  const metrics: Metric[] = [...(extra.metrics ?? [])];
  // O ML deixou de expor sold_quantity em muitos contextos; só usamos quando vier.
  if (typeof it.sold_quantity === 'number' && it.sold_quantity > 0) {
    metrics.push({ kind: 'vendas_oficiais', value: it.sold_quantity, detail: 'vendidos no anúncio (informado pelo Mercado Livre)', official: true });
  }
  return {
    id: `ml:${it.id}`,
    externalId: it.id,
    name: it.title,
    imageUrl: hiRes(it.thumbnail),
    category: extra.category,
    marketplace: 'mercadolivre',
    sourceName: SOURCE,
    sourceUrl: it.permalink ?? null,
    price: it.price ?? null,
    priceHistory: it.price ? [{ date: extra.now, price: it.price }] : [],
    metrics,
    trend: [],
    trendTerm: null,
    growthPct: null,
    competition: extra.competition ?? null,
    similarPrices: extra.similar,
    quality: 'oficial',
    updatedAt: extra.now,
    transient: true,
  };
}

export async function searchMercadoLivre(q: string, category?: string): Promise<MarketSearchResult> {
  return cached(`ml:search:${q.toLowerCase()}:${category ?? ''}`, 30 * 60_000, async () => {
    const qs = new URLSearchParams({ q, limit: '30' });
    if (category) qs.set('category', category);
    const data = await ml<{ paging?: { total?: number }; results: MlSearchItem[] }>(`/sites/MLB/search?${qs}`);
    const now = new Date().toISOString();
    const prices = data.results.map((r) => r.price).filter(Boolean);
    const competition = competitionFromListings(data.paging?.total ?? null, 'Mercado Livre');
    const cats = new Map<string, string | null>();
    await Promise.all([...new Set(data.results.map((r) => r.category_id).filter(Boolean))].slice(0, 8).map(async (id) => cats.set(id!, await categoryName(id))));
    return {
      source: 'mercadolivre',
      query: q,
      fetchedAt: now,
      total: data.paging?.total ?? null,
      competition,
      priceStats: priceStats(prices),
      products: data.results.map((it) => toProduct(it, { category: cats.get(it.category_id ?? '') ?? null, similar: prices, competition, now })),
    };
  });
}

export async function mercadoLivreTrends(category?: string): Promise<KeywordTrend[]> {
  const path = category ? `/trends/MLB/${encodeURIComponent(category)}` : '/trends/MLB';
  return cached(`ml:trends:${category ?? ''}`, 6 * 3600_000, async () => {
    const rows = await ml<{ keyword: string; url: string }[]>(path);
    return rows.map((r, i) => ({
      keyword: r.keyword,
      url: r.url,
      position: i + 1,
      // Ordem documentada pelo ML: 10 que mais cresceram, 20 mais buscadas, 20 populares.
      group: i < 10 ? 'crescimento' : i < 30 ? 'mais_buscadas' : 'populares',
    }));
  });
}

export async function mercadoLivreCategories(): Promise<{ id: string; name: string }[]> {
  return cached('ml:categories', 24 * 3600_000, () => ml<{ id: string; name: string }[]>('/sites/MLB/categories'));
}

interface Highlight {
  id: string;
  position: number;
  type: 'ITEM' | 'PRODUCT' | 'USER_PRODUCT' | string;
}

export async function mercadoLivreBestSellers(category: string): Promise<{ category: string; categoryName: string | null; fetchedAt: string; products: Product[]; skipped: number }> {
  if (!/^MLB\d+$/.test(category)) throw new ApiError(400, 'bad_request', 'Categoria inválida (ex.: MLB1574).');
  return cached(`ml:best:${category}`, 6 * 3600_000, async () => {
    const data = await ml<{ content?: Highlight[] }>(`/highlights/MLB/category/${category}`);
    const content = (data.content ?? []).slice(0, 20);
    const catName = await categoryName(category);
    const now = new Date().toISOString();
    const rankMetric = (pos: number): Metric => ({
      kind: 'ranking_mais_vendidos',
      value: pos,
      detail: `posição no ranking oficial de mais vendidos${catName ? ` em ${catName}` : ''}`,
      official: true,
    });

    const products: Product[] = [];
    const items = content.filter((c) => c.type === 'ITEM');
    if (items.length) {
      const multi = await ml<{ code: number; body: MlSearchItem }[]>(`/items?ids=${items.map((i) => i.id).join(',')}&attributes=id,title,price,thumbnail,permalink,category_id,sold_quantity`);
      for (const row of multi) {
        if (row.code !== 200) continue;
        const pos = items.find((i) => i.id === row.body.id)?.position ?? 0;
        products.push(toProduct(row.body, { category: catName, metrics: [rankMetric(pos)], similar: [], now }));
      }
    }
    const catalog = content.filter((c) => c.type === 'PRODUCT').slice(0, 10);
    await Promise.all(
      catalog.map(async (c) => {
        try {
          const p = await ml<{ id: string; name: string; pictures?: { url: string }[]; permalink?: string; buy_box_winner?: { price?: number } | null }>(`/products/${c.id}`);
          products.push(
            toProduct(
              { id: p.id, title: p.name, price: p.buy_box_winner?.price ?? 0, thumbnail: p.pictures?.[0]?.url, permalink: p.permalink, category_id: category },
              { category: catName, metrics: [rankMetric(c.position)], similar: [], now },
            ),
          );
        } catch {
          /* item de catálogo indisponível: ignorado */
        }
      }),
    );
    products.sort((a, b) => (a.metrics[0]?.value ?? 99) - (b.metrics[0]?.value ?? 99));
    for (const p of products) if (!p.price) p.price = null;
    return { category, categoryName: catName, fetchedAt: now, products, skipped: content.length - products.length };
  });
}
