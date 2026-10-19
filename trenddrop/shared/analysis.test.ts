import { describe, expect, it } from 'vitest';
import {
  buildSupplierSearchUrl,
  calculateProfit,
  competitionFromListings,
  growthFromSeries,
  opportunityScore,
  priceForMargin,
} from './analysis';

const base = { supplierCost: 40, commissionPct: 12, fixedFee: 6, extraFeesPct: 0, shipping: 10, otherCosts: 4, taxPct: 6 };

describe('calculateProfit', () => {
  it('aplica a fórmula lucro = preço − custo − taxas − frete − outros', () => {
    const r = calculateProfit({ ...base, salePrice: 100 });
    // taxas: 12 (comissão) + 6 (fixa) = 18; impostos: 6
    expect(r.fees).toBe(18);
    expect(r.taxes).toBe(6);
    expect(r.totalCost).toBe(40 + 18 + 6 + 10 + 4);
    expect(r.profit).toBe(22);
    expect(r.marginPct).toBe(22);
  });

  it('preço mínimo zera o lucro', () => {
    const be = priceForMargin(base, 0)!;
    expect(calculateProfit({ ...base, salePrice: be }).profit).toBeCloseTo(0, 1);
  });

  it('preço para margem alvo entrega a margem', () => {
    const p = priceForMargin(base, 25)!;
    expect(calculateProfit({ ...base, salePrice: p }).marginPct).toBeCloseTo(25, 0);
  });

  it('retorna null quando percentuais tornam a margem impossível', () => {
    expect(priceForMargin({ ...base, commissionPct: 90 }, 20)).toBeNull();
  });

  it('margem é null com preço zero', () => {
    expect(calculateProfit({ ...base, salePrice: 0 }).marginPct).toBeNull();
  });
});

describe('growthFromSeries', () => {
  const s = (vals: number[]) => vals.map((value, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, value }));
  it('compara o último terço com o primeiro', () => {
    expect(growthFromSeries(s([10, 10, 20, 20, 30, 30]))).toBe(200);
  });
  it('null com poucos pontos', () => {
    expect(growthFromSeries(s([1, 2]))).toBeNull();
  });
  it('null quando a base é zero e há interesse depois (crescimento indefinido)', () => {
    expect(growthFromSeries(s([0, 0, 5, 5, 9, 9]))).toBeNull();
  });
});

describe('competitionFromListings', () => {
  it('classifica pelos limites documentados', () => {
    expect(competitionFromListings(100, 'X')!.level).toBe('baixa');
    expect(competitionFromListings(1000, 'X')!.level).toBe('media');
    expect(competitionFromListings(9000, 'X')!.level).toBe('alta');
    expect(competitionFromListings(null, 'X')).toBeNull();
  });
});

describe('opportunityScore', () => {
  it('não mostra indicador com cobertura insuficiente', () => {
    const s = opportunityScore({ growthPct: null, marginPct: null, competition: null, quality: 'oficial' });
    expect(s.score).toBeNull();
    expect(s.label).toBe('Sem dados');
  });
  it('dados de demonstração nunca recebem pontos de qualidade', () => {
    const real = opportunityScore({ growthPct: 60, marginPct: 40, competition: 'baixa', quality: 'oficial' });
    const demo = opportunityScore({ growthPct: 60, marginPct: 40, competition: 'baixa', quality: 'demo' });
    expect(real.score).toBe(100);
    expect(demo.score).toBe(85);
  });
  it('renormaliza pesos quando falta margem', () => {
    const s = opportunityScore({ growthPct: 60, marginPct: null, competition: 'baixa', quality: 'oficial' });
    expect(s.score).toBe(100);
    expect(s.coverage).toBe(70);
  });
});

describe('buildSupplierSearchUrl', () => {
  it('exige {q} e http(s)', () => {
    expect(buildSupplierSearchUrl('https://fornecedor.exemplo/busca?q={q}', 'seladora a vácuo')).toBe(
      'https://fornecedor.exemplo/busca?q=seladora%20a%20v%C3%A1cuo',
    );
    expect(buildSupplierSearchUrl('https://fornecedor.exemplo/busca', 'x')).toBeNull();
    expect(buildSupplierSearchUrl('javascript:alert({q})', 'x')).toBeNull();
    expect(buildSupplierSearchUrl('', 'x')).toBeNull();
  });
});
