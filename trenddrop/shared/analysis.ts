// Regras de análise puras e testáveis: lucro, crescimento, concorrência e
// indicador de oportunidade. Nada aqui inventa dados: entradas ausentes
// resultam em null e reduzem a "cobertura" do indicador.

import type { Competition, CompetitionLevel, DataQuality, Product, TrendPoint } from './types.js';

// ---------------------------------------------------------------------------
// Lucro
// ---------------------------------------------------------------------------

export interface ProfitInput {
  supplierCost: number; // custo do produto no DropSeller
  salePrice: number;
  commissionPct: number; // comissão do marketplace (% do preço)
  fixedFee: number; // tarifa fixa por venda (R$)
  extraFeesPct: number; // outras tarifas percentuais (ex.: antecipação, pagamento)
  shipping: number; // frete pago pelo vendedor
  otherCosts: number; // embalagem, anúncio, etc.
  taxPct: number; // impostos sobre o preço de venda
}

export interface ProfitResult {
  revenue: number;
  fees: number;
  taxes: number;
  totalCost: number;
  profit: number;
  marginPct: number | null;
  breakEvenPrice: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Soma dos percentuais que incidem sobre o preço de venda. */
function variablePct(i: ProfitInput) {
  return (i.commissionPct + i.extraFeesPct + i.taxPct) / 100;
}

/**
 * Lucro = preço − custo do fornecedor − taxas − frete − outros custos.
 * "Taxas" inclui comissão, tarifa fixa, tarifas extras e impostos.
 * Margem = lucro ÷ preço × 100.
 */
export function calculateProfit(i: ProfitInput): ProfitResult {
  const fees = i.salePrice * ((i.commissionPct + i.extraFeesPct) / 100) + i.fixedFee;
  const taxes = i.salePrice * (i.taxPct / 100);
  const totalCost = i.supplierCost + fees + taxes + i.shipping + i.otherCosts;
  const profit = i.salePrice - totalCost;
  return {
    revenue: round2(i.salePrice),
    fees: round2(fees),
    taxes: round2(taxes),
    totalCost: round2(totalCost),
    profit: round2(profit),
    marginPct: i.salePrice > 0 ? round2((profit / i.salePrice) * 100) : null,
    breakEvenPrice: priceForMargin(i, 0),
  };
}

/** Preço que entrega a margem desejada (0 = ponto de equilíbrio). null se impossível. */
export function priceForMargin(i: Omit<ProfitInput, 'salePrice'>, targetMarginPct: number): number | null {
  const fixed = i.supplierCost + i.fixedFee + i.shipping + i.otherCosts;
  const denom = 1 - variablePct({ ...i, salePrice: 0 }) - targetMarginPct / 100;
  if (denom <= 0) return null;
  return round2(fixed / denom);
}

// ---------------------------------------------------------------------------
// Estatística básica
// ---------------------------------------------------------------------------

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function priceStats(prices: number[]) {
  const v = prices.filter((x) => Number.isFinite(x) && x > 0);
  if (!v.length) return null;
  return { min: Math.min(...v), median: median(v)!, max: Math.max(...v) };
}

/**
 * Crescimento do interesse: média do último terço do período comparada à
 * média do primeiro terço. Usar terços (e não o primeiro e o último ponto)
 * reduz o efeito de picos isolados. Retorna null com menos de 3 pontos ou
 * quando a base é zero.
 */
export function growthFromSeries(points: TrendPoint[]): number | null {
  if (points.length < 3) return null;
  const third = Math.max(1, Math.floor(points.length / 3));
  const avg = (xs: TrendPoint[]) => xs.reduce((s, p) => s + p.value, 0) / xs.length;
  const first = avg(points.slice(0, third));
  const last = avg(points.slice(-third));
  if (first <= 0) return last > 0 ? null : 0;
  return Math.round(((last - first) / first) * 1000) / 10;
}

export function averageOf(points: TrendPoint[]): number | null {
  if (!points.length) return null;
  return Math.round((points.reduce((s, p) => s + p.value, 0) / points.length) * 10) / 10;
}

/** Variação percentual entre o primeiro e o último preço do histórico. */
export function priceChangePct(history: { price: number }[]): number | null {
  if (history.length < 2) return null;
  const first = history[0].price;
  const last = history[history.length - 1].price;
  if (first <= 0) return null;
  return Math.round(((last - first) / first) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Concorrência estimada
// ---------------------------------------------------------------------------

export const COMPETITION_THRESHOLDS = { low: 500, high: 5000 };

/**
 * Estimativa pela quantidade de anúncios retornados para o termo na busca
 * oficial do marketplace. É uma aproximação: não considera vendedores
 * grandes, qualidade dos anúncios nem anúncios patrocinados.
 */
export function competitionFromListings(total: number | null | undefined, sourceLabel: string): Competition | null {
  if (total == null || !Number.isFinite(total)) return null;
  const level: CompetitionLevel =
    total < COMPETITION_THRESHOLDS.low ? 'baixa' : total < COMPETITION_THRESHOLDS.high ? 'media' : 'alta';
  return {
    level,
    sample: total,
    method: `Quantidade de anúncios retornados pela busca em ${sourceLabel} (${total.toLocaleString('pt-BR')}). Menos de ${COMPETITION_THRESHOLDS.low} = baixa; até ${COMPETITION_THRESHOLDS.high.toLocaleString('pt-BR')} = média; acima = alta.`,
  };
}

export const COMPETITION_LABEL: Record<CompetitionLevel, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

// ---------------------------------------------------------------------------
// Indicador de oportunidade (0–100)
// ---------------------------------------------------------------------------

export const SCORE_WEIGHTS = { demand: 35, margin: 30, competition: 20, quality: 15 } as const;

export interface ScoreComponent {
  key: keyof typeof SCORE_WEIGHTS;
  label: string;
  weight: number;
  /** 0–1, ou null quando o dado não existe. */
  value: number | null;
  explanation: string;
}

export interface OpportunityScore {
  score: number | null;
  /** Percentual do peso total que tinha dados (0–100). */
  coverage: number;
  components: ScoreComponent[];
  label: 'Forte' | 'Boa' | 'Moderada' | 'Fraca' | 'Sem dados';
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const QUALITY_FACTOR: Record<DataQuality, number> = { oficial: 1, terceiro: 0.75, manual: 0.5, demo: 0 };

/**
 * Metodologia:
 * - Demanda (35): crescimento do interesse no período. −20% ou menos = 0; +60% ou mais = 1.
 * - Margem (30): margem estimada com o custo do fornecedor. 0% ou menos = 0; 40% ou mais = 1.
 * - Concorrência (20): baixa = 1; média = 0,5; alta = 0,15.
 * - Qualidade dos dados (15): oficial = 1; intermediário = 0,75; manual = 0,5; demonstração = 0.
 * Componentes sem dado são excluídos e os pesos restantes são renormalizados;
 * a "cobertura" informa quanto do indicador foi efetivamente calculado.
 * Com cobertura abaixo de 50%, o indicador não é exibido.
 */
export function opportunityScore(input: {
  growthPct: number | null | undefined;
  marginPct: number | null | undefined;
  competition: CompetitionLevel | null | undefined;
  quality: DataQuality;
}): OpportunityScore {
  const components: ScoreComponent[] = [
    {
      key: 'demand',
      label: 'Crescimento da procura',
      weight: SCORE_WEIGHTS.demand,
      value: input.growthPct == null ? null : clamp01((input.growthPct + 20) / 80),
      explanation:
        input.growthPct == null
          ? 'Sem série de tendência para calcular o crescimento.'
          : `Crescimento de ${input.growthPct.toLocaleString('pt-BR')}% no período.`,
    },
    {
      key: 'margin',
      label: 'Margem potencial',
      weight: SCORE_WEIGHTS.margin,
      value: input.marginPct == null ? null : clamp01(input.marginPct / 40),
      explanation:
        input.marginPct == null
          ? 'Informe o custo no fornecedor para calcular a margem.'
          : `Margem estimada de ${input.marginPct.toLocaleString('pt-BR')}%.`,
    },
    {
      key: 'competition',
      label: 'Concorrência',
      weight: SCORE_WEIGHTS.competition,
      value: input.competition == null ? null : { baixa: 1, media: 0.5, alta: 0.15 }[input.competition],
      explanation: input.competition == null ? 'Concorrência não estimada.' : `Concorrência ${COMPETITION_LABEL[input.competition].toLowerCase()}.`,
    },
    {
      key: 'quality',
      label: 'Qualidade dos dados',
      weight: SCORE_WEIGHTS.quality,
      value: QUALITY_FACTOR[input.quality],
      explanation: {
        oficial: 'Dados de API oficial.',
        terceiro: 'Dados de serviço intermediário.',
        manual: 'Dados informados manualmente.',
        demo: 'Dados fictícios de demonstração.',
      }[input.quality],
    },
  ];
  const available = components.filter((c) => c.value != null);
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const availableWeight = available.reduce((s, c) => s + c.weight, 0);
  const coverage = Math.round((availableWeight / totalWeight) * 100);
  if (coverage < 50) return { score: null, coverage, components, label: 'Sem dados' };
  const score = Math.round((available.reduce((s, c) => s + c.weight * (c.value as number), 0) / availableWeight) * 100);
  const label = score >= 75 ? 'Forte' : score >= 55 ? 'Boa' : score >= 35 ? 'Moderada' : 'Fraca';
  return { score, coverage, components, label };
}

// ---------------------------------------------------------------------------
// Visão consolidada de um produto (usada por cartões, filtros e detalhes)
// ---------------------------------------------------------------------------

export interface FeeProfile {
  commissionPct: number;
  fixedFee: number;
  extraFeesPct: number;
  shipping: number;
  otherCosts: number;
  taxPct: number;
}

export interface ProductInsight {
  profit: ProfitResult | null;
  score: OpportunityScore;
  suggestedPrice: number | null;
  breakEvenPrice: number | null;
}

export function productInsight(p: Product, fees: FeeProfile | null, targetMarginPct = 25): ProductInsight {
  const base = fees && p.supplierCost != null ? { ...fees, supplierCost: p.supplierCost } : null;
  const profit = base && p.price ? calculateProfit({ ...base, salePrice: p.price }) : null;
  const suggestedPrice = base ? priceForMargin(base, targetMarginPct) : null;
  return {
    profit,
    suggestedPrice,
    breakEvenPrice: base ? priceForMargin(base, 0) : null,
    score: opportunityScore({
      growthPct: p.growthPct,
      marginPct: profit?.marginPct,
      competition: p.competition?.level,
      quality: p.quality,
    }),
  };
}

export function hasSalesData(p: Product) {
  return p.metrics.some((m) => m.kind === 'vendas_oficiais' || m.kind === 'vendas_informadas' || m.kind === 'ranking_mais_vendidos');
}

export function salesMetric(p: Product) {
  return (
    p.metrics.find((m) => m.kind === 'vendas_oficiais') ??
    p.metrics.find((m) => m.kind === 'vendas_informadas') ??
    p.metrics.find((m) => m.kind === 'ranking_mais_vendidos') ??
    null
  );
}

/** Monta a URL de pesquisa no fornecedor a partir de um modelo com {q}. */
export function buildSupplierSearchUrl(template: string | null | undefined, query: string): string | null {
  if (!template || !template.includes('{q}')) return null;
  if (!isHttpUrl(template.replace('{q}', 'x'))) return null;
  return template.replace('{q}', encodeURIComponent(query.trim()));
}

export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
