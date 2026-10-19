// Tipos compartilhados entre frontend (src/) e backend (server/).

export type Marketplace = 'mercadolivre' | 'shopee' | 'tiktok' | 'manual';

export const MARKETPLACES: Marketplace[] = ['mercadolivre', 'tiktok', 'shopee'];

export const MARKETPLACE_LABEL: Record<Marketplace, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  tiktok: 'TikTok Shop',
  manual: 'Cadastro manual',
};

/**
 * Qualidade/origem do dado.
 * - oficial: API oficial da plataforma (ex.: API do Mercado Livre, Shopee Affiliate API).
 * - terceiro: serviço intermediário autorizado (ex.: SerpApi para Google Trends).
 * - manual: digitado/importado pelo usuário.
 * - demo: fictício, apenas para demonstração.
 */
export type DataQuality = 'oficial' | 'terceiro' | 'manual' | 'demo';

export const QUALITY_LABEL: Record<DataQuality, string> = {
  oficial: 'Fonte oficial',
  terceiro: 'Serviço intermediário',
  manual: 'Informado manualmente',
  demo: 'Demonstração (fictício)',
};

/**
 * Tipos de indicador. Só os três primeiros podem ser apresentados como "vendas".
 * Visualizações, curtidas, buscas e interesse relativo NÃO são vendas.
 */
export type MetricKind =
  | 'vendas_oficiais' // quantidade vendida informada pela própria plataforma
  | 'vendas_informadas' // quantidade vendida informada por API de afiliados/terceiro
  | 'ranking_mais_vendidos' // posição em ranking oficial de mais vendidos (sem quantidade)
  | 'buscas' // ranking de buscas na plataforma
  | 'interesse_relativo' // índice 0–100 do Google Trends
  | 'visualizacoes'
  | 'curtidas'
  | 'avaliacao'
  | 'estimativa';

export const SALES_METRICS: MetricKind[] = ['vendas_oficiais', 'vendas_informadas', 'ranking_mais_vendidos'];

export const METRIC_LABEL: Record<MetricKind, string> = {
  vendas_oficiais: 'Vendas (oficial)',
  vendas_informadas: 'Vendas informadas',
  ranking_mais_vendidos: 'Ranking de mais vendidos',
  buscas: 'Buscas na plataforma',
  interesse_relativo: 'Interesse relativo (Google Trends)',
  visualizacoes: 'Visualizações',
  curtidas: 'Curtidas',
  avaliacao: 'Avaliação',
  estimativa: 'Estimativa',
};

export interface Metric {
  kind: MetricKind;
  value: number;
  /** Texto curto que explica o número, ex.: "vendidos (total do anúncio)". */
  detail?: string;
  period?: string;
  official: boolean;
}

export type CompetitionLevel = 'baixa' | 'media' | 'alta';

export interface Competition {
  level: CompetitionLevel;
  /** Explicação da metodologia usada para chegar ao nível. */
  method: string;
  sample?: number;
}

export interface PricePoint {
  date: string; // ISO
  price: number;
}

export interface TrendPoint {
  date: string; // ISO (dia)
  value: number; // 0–100 (Google Trends) ou valor normalizado
}

export interface Product {
  id: string;
  name: string;
  imageUrl?: string | null;
  category?: string | null;
  marketplace: Marketplace;
  /** Nome legível da fonte, ex.: "API Mercado Livre". */
  sourceName: string;
  sourceUrl?: string | null;
  externalId?: string | null;
  price?: number | null;
  priceHistory: PricePoint[];
  metrics: Metric[];
  trendTerm?: string | null;
  trend: TrendPoint[];
  growthPct?: number | null;
  competition?: Competition | null;
  similarPrices: number[];
  /** Custo no fornecedor (informado pelo usuário). */
  supplierCost?: number | null;
  supplierUrl?: string | null;
  quality: DataQuality;
  updatedAt: string; // ISO
  /** true quando o produto ainda não foi salvo no catálogo (resultado de busca ao vivo). */
  transient?: boolean;
  /** true quando vem do catálogo compartilhado (gravado pelo backend; só leitura). */
  shared?: boolean;
}

export type TrendPeriod = '7d' | '30d' | '90d' | '12m';

export const TREND_PERIOD_LABEL: Record<TrendPeriod, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  '12m': 'Últimos 12 meses',
};

export interface TrendSeries {
  term: string;
  points: TrendPoint[];
  growthPct: number | null;
  average: number | null;
}

export interface RegionInterest {
  code: string; // ex.: BR-SP
  name: string;
  value: number;
}

export interface RelatedQuery {
  query: string;
  value: string; // "+250%", "Aumento repentino" ou "100"
  kind: 'top' | 'rising';
}

export interface TrendsResult {
  source: 'serpapi';
  geo: string;
  period: TrendPeriod;
  fetchedAt: string;
  series: TrendSeries[];
  regions: RegionInterest[];
  related: RelatedQuery[];
}

export type IntegrationId = 'google_trends' | 'mercadolivre' | 'shopee' | 'tiktok' | 'dropseller' | 'database';
export type IntegrationState = 'conectada' | 'pendente' | 'indisponivel';

export interface IntegrationStatus {
  id: IntegrationId;
  name: string;
  state: IntegrationState;
  provider: string;
  message: string;
  requires: string[];
  docsUrl?: string;
  dataAvailable: string[];
  limitations: string[];
}

export interface ApiErrorBody {
  error: string;
  code: 'not_configured' | 'bad_request' | 'upstream_error' | 'unauthorized' | 'not_found' | 'rate_limited';
  integration?: IntegrationId;
}

export interface MarketSearchResult {
  source: IntegrationId;
  query: string;
  fetchedAt: string;
  total: number | null;
  competition: Competition | null;
  priceStats: { min: number; median: number; max: number } | null;
  products: Product[];
}

export interface KeywordTrend {
  keyword: string;
  url: string;
  group: 'crescimento' | 'mais_buscadas' | 'populares';
  position: number;
}
