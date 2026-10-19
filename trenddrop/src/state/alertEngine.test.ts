import { describe, expect, it } from 'vitest';
import { productInsight } from '@shared/analysis';
import type { Product } from '@shared/types';
import type { Alert } from '@/data/types';
import { evaluateAlerts } from './alertEngine';
import type { EnrichedProduct } from './hooks';

const fees = { commissionPct: 10, fixedFee: 0, extraFeesPct: 0, shipping: 0, otherCosts: 0, taxPct: 0 };
function prod(over: Partial<Product> = {}): EnrichedProduct {
  const p: Product = {
    id: 'p1', name: 'Produto', marketplace: 'mercadolivre', sourceName: 's', priceHistory: [{ date: '2026-01-01', price: 100 }, { date: '2026-01-02', price: 80 }],
    metrics: [], trend: [], similarPrices: [], quality: 'oficial', updatedAt: new Date().toISOString(), price: 80, supplierCost: 40, growthPct: 30, category: 'Casa', ...over,
  };
  return { ...p, insight: productInsight(p, fees), favorite: false };
}
const alert = (over: Partial<Alert>): Alert => ({ id: 'a', type: 'interest_increase', productId: 'p1', category: null, threshold: 20, active: true, lastTriggeredAt: null, createdAt: '2020-01-01T00:00:00Z', ...over });

describe('evaluateAlerts', () => {
  it('dispara por interesse, margem e preço', () => {
    const p = prod();
    expect(evaluateAlerts([alert({})], [p])).toHaveLength(1);
    expect(evaluateAlerts([alert({ type: 'margin_reached', threshold: 30 })], [p])).toHaveLength(1); // margem 40%
    expect(evaluateAlerts([alert({ type: 'price_change', threshold: 15 })], [p])).toHaveLength(1); // -20%
  });
  it('respeita limite, inatividade e intervalo de 24h', () => {
    const p = prod();
    expect(evaluateAlerts([alert({ threshold: 50 })], [p])).toHaveLength(0);
    expect(evaluateAlerts([alert({ active: false })], [p])).toHaveLength(0);
    expect(evaluateAlerts([alert({ lastTriggeredAt: new Date().toISOString() })], [p])).toHaveLength(0);
  });
  it('nova oportunidade por categoria', () => {
    const p = prod();
    expect(evaluateAlerts([alert({ type: 'new_opportunity', productId: null, category: 'Casa', threshold: 50 })], [p])).toHaveLength(1);
    expect(evaluateAlerts([alert({ type: 'new_opportunity', productId: null, category: 'Pets', threshold: 50 })], [p])).toHaveLength(0);
  });
});
