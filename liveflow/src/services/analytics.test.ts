import { describe, expect, it } from 'vitest';
import type { AnalyticsRow } from '@/types/domain';
import { computeTotals, dailySeries, percentChange, presetToRange, previousRange, rankBy } from './analytics';

const row = (p: Partial<AnalyticsRow>): AnalyticsRow => ({
  id: Math.random().toString(), user_id: 'u', created_at: '', updated_at: '',
  date: '2026-10-01', product_id: 'a', video_id: null, live_id: null,
  views: 0, clicks: 0, conversions: 0, units_sold: 0, revenue: 0, commission: 0, cost: 0, source: 'demo', ...p,
});

describe('analytics', () => {
  it('calcula CTR, conversão e ROI', () => {
    const t = computeTotals([row({ views: 1000, clicks: 50, conversions: 5, revenue: 500, commission: 60, cost: 20 })]);
    expect(t.ctr).toBeCloseTo(0.05);
    expect(t.conversionRate).toBeCloseTo(0.1);
    expect(t.roi).toBeCloseTo(2);
  });

  it('ROI é nulo sem custo e divisões por zero viram 0', () => {
    const t = computeTotals([]);
    expect(t.roi).toBeNull();
    expect(t.ctr).toBe(0);
  });

  it('série diária preenche dias vazios', () => {
    const s = dailySeries([row({ date: '2026-10-02', views: 10 })], { from: '2026-10-01', to: '2026-10-03' });
    expect(s.map((p) => p.views)).toEqual([0, 10, 0]);
  });

  it('ranking ordena pela métrica', () => {
    const r = rankBy([row({ product_id: 'a', revenue: 10 }), row({ product_id: 'b', revenue: 30 }), row({ product_id: 'a', revenue: 5 })], 'product_id');
    expect(r.map((x) => x.id)).toEqual(['b', 'a']);
    expect(r[1].totals.revenue).toBe(15);
  });

  it('períodos', () => {
    expect(presetToRange('7d', new Date(2026, 9, 7))).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(previousRange({ from: '2026-10-01', to: '2026-10-07' })).toEqual({ from: '2026-09-24', to: '2026-09-30' });
    expect(percentChange(150, 100)).toBeCloseTo(0.5);
    expect(percentChange(5, 0)).toBeNull();
  });
});
