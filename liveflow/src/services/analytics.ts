import { addDays, format, parseISO, startOfDay, subDays } from 'date-fns';
import type { AnalyticsRow, ID } from '@/types/domain';
import { groupBy, safeDivide, sum } from '@/lib/utils';

export type RangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  /** yyyy-MM-dd inclusive */
  from: string;
  /** yyyy-MM-dd inclusive */
  to: string;
}

export function presetToRange(preset: Exclude<RangePreset, 'custom'>, now = new Date()): DateRange {
  const to = format(now, 'yyyy-MM-dd');
  const days = { today: 0, '7d': 6, '30d': 29, '90d': 89 }[preset];
  return { from: format(subDays(startOfDay(now), days), 'yyyy-MM-dd'), to };
}

/** Período imediatamente anterior, com o mesmo tamanho (para variação %). */
export function previousRange(range: DateRange): DateRange {
  const from = parseISO(range.from);
  const to = parseISO(range.to);
  const len = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return {
    from: format(subDays(from, len), 'yyyy-MM-dd'),
    to: format(subDays(from, 1), 'yyyy-MM-dd'),
  };
}

export const inRange = (row: Pick<AnalyticsRow, 'date'>, r: DateRange) => row.date >= r.from && row.date <= r.to;

export interface Totals {
  views: number;
  clicks: number;
  conversions: number;
  units: number;
  revenue: number;
  commission: number;
  cost: number;
  /** cliques / visualizações */
  ctr: number;
  /** pedidos / cliques */
  conversionRate: number;
  /** (comissão − custo) / custo; null quando não há custo registrado */
  roi: number | null;
}

export function computeTotals(rows: AnalyticsRow[]): Totals {
  const views = sum(rows, (r) => r.views);
  const clicks = sum(rows, (r) => r.clicks);
  const conversions = sum(rows, (r) => r.conversions);
  const commission = sum(rows, (r) => Number(r.commission));
  const cost = sum(rows, (r) => Number(r.cost));
  return {
    views,
    clicks,
    conversions,
    units: sum(rows, (r) => r.units_sold),
    revenue: sum(rows, (r) => Number(r.revenue)),
    commission,
    cost,
    ctr: safeDivide(clicks, views),
    conversionRate: safeDivide(conversions, clicks),
    roi: cost > 0 ? (commission - cost) / cost : null,
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

export interface DailyPoint {
  date: string;
  label: string;
  views: number;
  clicks: number;
  conversions: number;
  units: number;
  revenue: number;
  commission: number;
}

/** Série diária contínua (dias sem dados viram zero). */
export function dailySeries(rows: AnalyticsRow[], range: DateRange): DailyPoint[] {
  const byDate = groupBy(rows.filter((r) => inRange(r, range)), (r) => r.date);
  const out: DailyPoint[] = [];
  for (let d = parseISO(range.from); format(d, 'yyyy-MM-dd') <= range.to; d = addDays(d, 1)) {
    const key = format(d, 'yyyy-MM-dd');
    const t = computeTotals(byDate.get(key) ?? []);
    out.push({
      date: key,
      label: format(d, 'dd/MM'),
      views: t.views,
      clicks: t.clicks,
      conversions: t.conversions,
      units: t.units,
      revenue: t.revenue,
      commission: t.commission,
    });
  }
  return out;
}

export interface RankingItem {
  id: ID;
  totals: Totals;
}

export function rankBy(
  rows: AnalyticsRow[],
  dimension: 'product_id' | 'video_id' | 'live_id',
  metric: keyof Pick<Totals, 'revenue' | 'units' | 'conversions' | 'views' | 'clicks' | 'commission'> = 'revenue',
  limit = 5,
): RankingItem[] {
  const groups = groupBy(rows, (r) => r[dimension]);
  return [...groups.entries()]
    .map(([id, list]) => ({ id, totals: computeTotals(list) }))
    .sort((a, b) => b.totals[metric] - a.totals[metric])
    .slice(0, limit);
}
