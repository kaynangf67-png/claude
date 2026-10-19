// Google Trends via SerpApi (https://serpapi.com/google-trends-api).
//
// Por que não a API oficial? A Google Trends API anunciada em jul/2025 segue em
// alpha fechado (acesso por inscrição, sem chave self-service). Quando houver
// acesso, basta criar outro provedor com a mesma interface `fetchTrends`.
//
// Limitações (documentadas no README):
// - O índice é INTERESSE RELATIVO (0–100) dentro do período/termos consultados,
//   não volume de buscas e muito menos vendas.
// - TIMESERIES aceita até 5 termos; GEO_MAP_0 e RELATED_QUERIES aceitam 1.
// - Cada chamada consome créditos do plano SerpApi; por isso há cache.

import { averageOf, growthFromSeries } from '../../shared/analysis.js';
import type { RegionInterest, RelatedQuery, TrendPeriod, TrendSeries, TrendsResult } from '../../shared/types.js';
import { serverEnv } from '../env.js';
import { ApiError, cached, fetchJson, notConfigured } from '../http.js';

const SERPAPI_URL = 'https://serpapi.com/search.json';

export const PERIOD_TO_SERPAPI: Record<TrendPeriod, string> = {
  '7d': 'now 7-d',
  '30d': 'today 1-m',
  '90d': 'today 3-m',
  '12m': 'today 12-m',
};

interface SerpTimeseries {
  interest_over_time?: {
    timeline_data?: { timestamp: string; values: { query: string; extracted_value?: number; value?: string }[] }[];
  };
  error?: string;
}
interface SerpGeo {
  interest_by_region?: { geo?: string; location: string; extracted_value?: number; value?: string }[];
  error?: string;
}
interface SerpRelated {
  related_queries?: {
    top?: { query: string; value?: string; extracted_value?: number }[];
    rising?: { query: string; value?: string; extracted_value?: number }[];
  };
  error?: string;
}

export function isTrendsConfigured() {
  return Boolean(serverEnv.serpApiKey);
}

async function serp<T extends { error?: string }>(params: Record<string, string>): Promise<T> {
  const key = serverEnv.serpApiKey;
  if (!key) throw notConfigured('google_trends', 'Google Trends não configurado: defina SERPAPI_KEY no servidor.');
  const qs = new URLSearchParams({ engine: 'google_trends', hl: 'pt-BR', tz: '180', ...params, api_key: key });
  const data = await fetchJson<T>(`${SERPAPI_URL}?${qs}`, { timeoutMs: 25000 }, 'SerpApi (Google Trends)');
  // SerpApi devolve {error: "..."} para buscas sem resultado — não é falha.
  if (data.error && !/hasn't returned any results/i.test(data.error)) {
    throw new ApiError(502, 'upstream_error', `SerpApi: ${data.error}`);
  }
  return data;
}

export function parseTimeseries(data: SerpTimeseries, terms: string[]): TrendSeries[] {
  const timeline = data.interest_over_time?.timeline_data ?? [];
  return terms.map((term, idx) => {
    const points = timeline.map((row) => {
      const v = row.values.find((x) => x.query.toLowerCase() === term.toLowerCase()) ?? row.values[idx];
      const value = v?.extracted_value ?? Number(String(v?.value ?? '0').replace('<1', '0'));
      return { date: new Date(Number(row.timestamp) * 1000).toISOString(), value: Number.isFinite(value) ? value : 0 };
    });
    return { term, points, growthPct: growthFromSeries(points), average: averageOf(points) };
  });
}

export function parseRegions(data: SerpGeo): RegionInterest[] {
  return (data.interest_by_region ?? [])
    .map((r) => ({ code: r.geo ?? r.location, name: r.location, value: r.extracted_value ?? Number(r.value ?? 0) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => b.value - a.value);
}

export function parseRelated(data: SerpRelated): RelatedQuery[] {
  const rq = data.related_queries ?? {};
  return [
    ...(rq.rising ?? []).slice(0, 15).map((r) => ({ query: r.query, value: r.value ?? String(r.extracted_value ?? ''), kind: 'rising' as const })),
    ...(rq.top ?? []).slice(0, 15).map((r) => ({ query: r.query, value: r.value ?? String(r.extracted_value ?? ''), kind: 'top' as const })),
  ];
}

export async function fetchTrends(opts: {
  terms: string[];
  period: TrendPeriod;
  geo?: string;
  details?: boolean; // regiões + consultas relacionadas do primeiro termo
}): Promise<TrendsResult> {
  const terms = [...new Set(opts.terms.map((t) => t.trim()).filter(Boolean))].slice(0, 5);
  if (!terms.length) throw new ApiError(400, 'bad_request', 'Informe ao menos um termo.');
  if (terms.some((t) => t.includes(','))) throw new ApiError(400, 'bad_request', 'Termos não podem conter vírgula.');
  const geo = opts.geo ?? 'BR';
  const date = PERIOD_TO_SERPAPI[opts.period];
  if (!date) throw new ApiError(400, 'bad_request', 'Período inválido.');
  const key = `trends:${geo}:${date}:${terms.join('|').toLowerCase()}:${opts.details ? 1 : 0}`;

  return cached(key, 60 * 60 * 1000, async () => {
    const [ts, geoMap, related] = await Promise.all([
      serp<SerpTimeseries>({ q: terms.join(','), geo, date, data_type: 'TIMESERIES' }),
      opts.details ? serp<SerpGeo>({ q: terms[0], geo, date, data_type: 'GEO_MAP_0' }).catch(() => ({}) as SerpGeo) : null,
      opts.details ? serp<SerpRelated>({ q: terms[0], geo, date, data_type: 'RELATED_QUERIES' }).catch(() => ({}) as SerpRelated) : null,
    ]);
    return {
      source: 'serpapi' as const,
      geo,
      period: opts.period,
      fetchedAt: new Date().toISOString(),
      series: parseTimeseries(ts, terms),
      regions: geoMap ? parseRegions(geoMap) : [],
      related: related ? parseRelated(related) : [],
    };
  });
}
