// Conversão entre o modelo Product e as colunas de public.products.
import type { Product } from './types';

export interface ProductRow {
  id: string;
  owner_id: string | null;
  marketplace: Product['marketplace'];
  source_name: string;
  source_url: string | null;
  external_id: string | null;
  name: string;
  image_url: string | null;
  category: string | null;
  price: number | null;
  metrics: Product['metrics'];
  trend_term: string | null;
  trend: Product['trend'];
  growth_pct: number | null;
  competition: Product['competition'];
  similar_prices: number[];
  quality: Product['quality'];
  updated_at: string;
}

export function productToRow(p: Product, ownerId: string | null): Omit<ProductRow, 'id'> {
  return {
    owner_id: ownerId,
    marketplace: p.marketplace,
    source_name: p.sourceName,
    source_url: p.sourceUrl ?? null,
    external_id: p.externalId ?? null,
    name: p.name,
    image_url: p.imageUrl ?? null,
    category: p.category ?? null,
    price: p.price ?? null,
    metrics: p.metrics,
    trend_term: p.trendTerm ?? null,
    trend: p.trend,
    growth_pct: p.growthPct ?? null,
    competition: p.competition ?? null,
    similar_prices: p.similarPrices.slice(0, 50),
    quality: p.quality,
    updated_at: p.updatedAt,
  };
}

export function rowToProduct(r: ProductRow, priceHistory: Product['priceHistory'] = []): Product {
  return {
    id: r.id,
    name: r.name,
    imageUrl: r.image_url,
    category: r.category,
    marketplace: r.marketplace,
    sourceName: r.source_name,
    sourceUrl: r.source_url,
    externalId: r.external_id,
    price: r.price == null ? null : Number(r.price),
    priceHistory,
    metrics: r.metrics ?? [],
    trendTerm: r.trend_term,
    trend: r.trend ?? [],
    growthPct: r.growth_pct == null ? null : Number(r.growth_pct),
    competition: r.competition,
    similarPrices: (r.similar_prices ?? []).map(Number),
    quality: r.quality,
    updatedAt: r.updated_at,
    shared: r.owner_id === null,
  };
}
