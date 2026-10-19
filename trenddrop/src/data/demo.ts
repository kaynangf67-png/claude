// Dados FICTÍCIOS do modo demonstração. Nenhum número aqui representa
// mercado real. Todos os produtos têm quality = 'demo' e o app exibe um
// aviso permanente enquanto este modo estiver ativo.
import { growthFromSeries } from '@shared/analysis';
import type { CompetitionLevel, Marketplace, Metric, Product, TrendPoint } from '@shared/types';
import type { FeeMap } from './types';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface Spec {
  name: string;
  category: string;
  marketplace: Marketplace;
  price: number;
  cost: number;
  slope: number; // tendência ao longo do período
  base: number;
  competition: CompetitionLevel;
  listings: number;
  metrics: (r: () => number) => Metric[];
  updatedHoursAgo: number;
}

const sales = (n: number): Metric => ({ kind: 'vendas_informadas', value: n, detail: 'vendas (fictício)', official: false });
const rank = (n: number): Metric => ({ kind: 'ranking_mais_vendidos', value: n, detail: 'posição no ranking da categoria (fictício)', official: false });
const views = (n: number): Metric => ({ kind: 'visualizacoes', value: n, detail: 'visualizações em vídeos (fictício)', official: false });
const likes = (n: number): Metric => ({ kind: 'curtidas', value: n, detail: 'curtidas em vídeos (fictício)', official: false });

const SPECS: Spec[] = [
  { name: 'Mini liquidificador portátil USB', category: 'Cozinha', marketplace: 'mercadolivre', price: 89.9, cost: 38, slope: 0.9, base: 40, competition: 'media', listings: 3200, metrics: () => [rank(3)], updatedHoursAgo: 3 },
  { name: 'Seladora a vácuo doméstica', category: 'Cozinha', marketplace: 'shopee', price: 119.9, cost: 52, slope: 0.6, base: 35, competition: 'media', listings: 2100, metrics: () => [sales(4800)], updatedHoursAgo: 5 },
  { name: 'Escova removedora de pelos para pets', category: 'Pets', marketplace: 'tiktok', price: 49.9, cost: 14, slope: 1.4, base: 20, competition: 'baixa', listings: 380, metrics: () => [views(1250000), likes(84000)], updatedHoursAgo: 8 },
  { name: 'Garrafa térmica inteligente com display', category: 'Casa', marketplace: 'shopee', price: 69.9, cost: 29, slope: 0.3, base: 55, competition: 'alta', listings: 9800, metrics: () => [sales(12500)], updatedHoursAgo: 2 },
  { name: 'Luminária de lua 3D', category: 'Decoração', marketplace: 'mercadolivre', price: 79.9, cost: 31, slope: -0.4, base: 60, competition: 'alta', listings: 7600, metrics: () => [rank(11)], updatedHoursAgo: 20 },
  { name: 'Fonte bebedouro automática para gatos', category: 'Pets', marketplace: 'mercadolivre', price: 129.9, cost: 58, slope: 0.8, base: 30, competition: 'media', listings: 1400, metrics: () => [rank(6)], updatedHoursAgo: 4 },
  { name: 'Massageador cervical elétrico', category: 'Saúde e beleza', marketplace: 'tiktok', price: 139.9, cost: 61, slope: 1.1, base: 25, competition: 'baixa', listings: 420, metrics: () => [views(890000), likes(51000)], updatedHoursAgo: 30 },
  { name: 'Organizador de geladeira acrílico (kit 6)', category: 'Casa', marketplace: 'shopee', price: 59.9, cost: 22, slope: 0.5, base: 28, competition: 'media', listings: 2600, metrics: () => [sales(7300)], updatedHoursAgo: 6 },
  { name: 'Corretor de postura ajustável', category: 'Saúde e beleza', marketplace: 'mercadolivre', price: 54.9, cost: 18, slope: -0.8, base: 50, competition: 'alta', listings: 11200, metrics: () => [], updatedHoursAgo: 72 },
  { name: 'Projetor de galáxia com bluetooth', category: 'Decoração', marketplace: 'tiktok', price: 149.9, cost: 72, slope: 0.2, base: 45, competition: 'media', listings: 1900, metrics: () => [views(430000), likes(22000)], updatedHoursAgo: 12 },
  { name: 'Cortador de legumes espiral 5 em 1', category: 'Cozinha', marketplace: 'shopee', price: 44.9, cost: 16, slope: 0.1, base: 38, competition: 'alta', listings: 6400, metrics: () => [sales(9100)], updatedHoursAgo: 7 },
  { name: 'Coleira GPS para pets', category: 'Pets', marketplace: 'mercadolivre', price: 189.9, cost: 96, slope: 1.2, base: 15, competition: 'baixa', listings: 310, metrics: () => [rank(14)], updatedHoursAgo: 9 },
  { name: 'Mop giratório compacto', category: 'Casa', marketplace: 'mercadolivre', price: 99.9, cost: 47, slope: 0, base: 42, competition: 'alta', listings: 8800, metrics: () => [rank(2)], updatedHoursAgo: 1 },
  { name: 'Kit skincare facial com rolo de jade', category: 'Saúde e beleza', marketplace: 'shopee', price: 64.9, cost: 21, slope: 0.7, base: 22, competition: 'baixa', listings: 470, metrics: () => [sales(1800)], updatedHoursAgo: 15 },
];

const DAY = 86_400_000;

export function demoProducts(now = Date.now()): Product[] {
  return SPECS.map((s, i) => {
    const r = rng(i + 7);
    const trend: TrendPoint[] = Array.from({ length: 90 }, (_, d) => {
      const t = d / 89;
      const v = s.base * (1 + s.slope * t) + Math.sin(d / 3.5) * 4 + (r() - 0.5) * 8;
      return { date: new Date(now - (89 - d) * DAY).toISOString().slice(0, 10), value: Math.max(1, Math.min(100, Math.round(v))) };
    });
    const priceHistory = Array.from({ length: 8 }, (_, k) => ({
      date: new Date(now - (7 - k) * 7 * DAY).toISOString(),
      price: Math.round(s.price * (1 + (r() - 0.5) * 0.12 + (k === 7 ? 0 : 0.03)) * 100) / 100,
    }));
    priceHistory[7].price = s.price;
    const similar = Array.from({ length: 12 }, () => Math.round(s.price * (0.75 + r() * 0.6) * 100) / 100);
    return {
      id: `demo-${i + 1}`,
      name: s.name,
      imageUrl: null,
      category: s.category,
      marketplace: s.marketplace,
      sourceName: 'Demonstração (dados fictícios)',
      sourceUrl: null,
      externalId: `demo-${i + 1}`,
      price: s.price,
      priceHistory,
      metrics: s.metrics(r),
      trendTerm: s.name.toLowerCase(),
      trend,
      growthPct: growthFromSeries(trend.slice(-30)),
      competition: {
        level: s.competition,
        sample: s.listings,
        method: `Demonstração: ${s.listings.toLocaleString('pt-BR')} anúncios fictícios. Em dados reais, usa o total de anúncios da busca oficial.`,
      },
      similarPrices: similar,
      supplierCost: s.cost,
      supplierUrl: null, // nunca inventamos links de fornecedor
      quality: 'demo',
      updatedAt: new Date(now - s.updatedHoursAgo * 3600_000).toISOString(),
    } satisfies Product;
  });
}

/** Tarifas de EXEMPLO para a demonstração — não são as tarifas reais dos marketplaces. */
export const DEMO_FEES: FeeMap = {
  mercadolivre: { commissionPct: 12, fixedFee: 6, extraFeesPct: 0, shipping: 0, otherCosts: 3, taxPct: 6, notes: 'Exemplo do modo demonstração. Confira a tabela vigente.' },
  shopee: { commissionPct: 14, fixedFee: 4, extraFeesPct: 0, shipping: 0, otherCosts: 3, taxPct: 6, notes: 'Exemplo do modo demonstração. Confira a tabela vigente.' },
  tiktok: { commissionPct: 10, fixedFee: 0, extraFeesPct: 0, shipping: 0, otherCosts: 3, taxPct: 6, notes: 'Exemplo do modo demonstração. Confira a tabela vigente.' },
};

/** Séries FICTÍCIAS para o Radar no modo demonstração. */
export function demoTrends(terms: string[], period: '7d' | '30d' | '90d' | '12m'): import('@shared/types').TrendsResult {
  const len = { '7d': 7 * 24 / 4, '30d': 30, '90d': 90, '12m': 52 }[period];
  const step = { '7d': 4 * 3600_000, '30d': DAY, '90d': DAY, '12m': 7 * DAY }[period];
  const now = Date.now();
  const series = terms.map((term) => {
    const seed = [...term].reduce((s, c) => s + c.charCodeAt(0), 0);
    const r = rng(seed);
    const slope = (r() - 0.35) * 1.6;
    const base = 20 + r() * 40;
    const points = Array.from({ length: len }, (_, i) => {
      const t = i / (len - 1);
      const v = base * (1 + slope * t) + Math.sin(i / 2.5) * 5 + (r() - 0.5) * 10;
      return { date: new Date(now - (len - 1 - i) * step).toISOString(), value: Math.max(0, Math.min(100, Math.round(v))) };
    });
    return { term, points, growthPct: growthFromSeries(points), average: Math.round(points.reduce((s, p) => s + p.value, 0) / points.length) };
  });
  const r = rng(terms.join('').length + 3);
  const states = ['São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Paraná', 'Santa Catarina', 'Rio Grande do Sul', 'Bahia', 'Goiás', 'Pernambuco', 'Ceará'];
  const ufs = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'GO', 'PE', 'CE'];
  return {
    source: 'serpapi',
    geo: 'BR',
    period,
    fetchedAt: new Date().toISOString(),
    series,
    regions: states.map((name, i) => ({ code: `BR-${ufs[i]}`, name, value: Math.round(100 - i * 7 - r() * 6) })),
    related: terms[0]
      ? [
          { query: `${terms[0]} barato`, value: '+180%', kind: 'rising' as const },
          { query: `${terms[0]} recarregável`, value: '+120%', kind: 'rising' as const },
          { query: `melhor ${terms[0]}`, value: '100', kind: 'top' as const },
          { query: `${terms[0]} preço`, value: '74', kind: 'top' as const },
        ]
      : [],
  };
}
