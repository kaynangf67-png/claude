// Cliente das rotas /api (backend). Segredos ficam no servidor.
import type { ApiErrorBody, IntegrationStatus, KeywordTrend, MarketSearchResult, Product, TrendPeriod, TrendsResult } from '@shared/types';

export class ApiRequestError extends Error {
  constructor(public code: ApiErrorBody['code'] | 'network', message: string, public integration?: string) {
    super(message);
  }
  get notConfigured() {
    return this.code === 'not_configured';
  }
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { accept: 'application/json' } });
  } catch {
    throw new ApiRequestError('network', 'Sem conexão com o servidor.');
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiRequestError('network', 'Backend indisponível. Em produção, as rotas /api rodam como funções serverless.');
  }
  if (!res.ok) {
    const e = body as ApiErrorBody;
    throw new ApiRequestError(e.code ?? 'upstream_error', e.error ?? `Erro HTTP ${res.status}`, e.integration);
  }
  return body as T;
}

export const api = {
  status: () => get<{ integrations: IntegrationStatus[]; checkedAt: string }>('/api/status'),
  trends: (terms: string[], period: TrendPeriod, details = false, geo = 'BR') =>
    get<TrendsResult>(`/api/trends?${new URLSearchParams({ terms: terms.join('|'), period, geo, details: details ? '1' : '0' })}`),
  mlSearch: (q: string) => get<MarketSearchResult>(`/api/mercadolivre?${new URLSearchParams({ action: 'search', q })}`),
  mlTrends: (category?: string) =>
    get<{ fetchedAt: string; keywords: KeywordTrend[] }>(`/api/mercadolivre?${new URLSearchParams({ action: 'trends', ...(category ? { category } : {}) })}`),
  mlBestSellers: (category: string) =>
    get<{ category: string; categoryName: string | null; fetchedAt: string; products: Product[]; skipped: number }>(
      `/api/mercadolivre?${new URLSearchParams({ action: 'bestsellers', category })}`,
    ),
  mlCategories: () => get<{ categories: { id: string; name: string }[] }>('/api/mercadolivre?action=categories'),
  shopeeSearch: (q: string, sort: 'relevancia' | 'vendas') => get<MarketSearchResult>(`/api/shopee?${new URLSearchParams({ q, sort })}`),
};
