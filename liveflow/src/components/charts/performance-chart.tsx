import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompact, formatCurrency, formatNumber } from '@/lib/format';
import type { DailyPoint } from '@/services/analytics';

export type SeriesKey = 'views' | 'clicks' | 'conversions' | 'units' | 'revenue' | 'commission';

export const SERIES: Record<SeriesKey, { label: string; color: string; currency?: boolean }> = {
  views: { label: 'Visualizações', color: 'var(--chart-1)' },
  clicks: { label: 'Cliques', color: 'var(--chart-2)' },
  conversions: { label: 'Conversões', color: 'var(--chart-3)' },
  units: { label: 'Vendas', color: 'var(--chart-4)' },
  revenue: { label: 'Faturamento', color: 'var(--chart-1)', currency: true },
  commission: { label: 'Comissão', color: 'var(--chart-3)', currency: true },
};

export function PerformanceChart({ data, series, height = 260 }: { data: DailyPoint[]; series: SeriesKey[]; height?: number }) {
  const currency = series.some((s) => SERIES[s].currency);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s} id={`grad-${s}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES[s].color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={SERIES[s].color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} minTickGap={16} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={currency ? 68 : 52}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickFormatter={(v: number) => (currency ? `R$${formatCompact(v)}` : formatCompact(v))}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border)' }}
            contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)' }}
            labelStyle={{ color: 'var(--muted-foreground)', marginBottom: 4 }}
            formatter={(value, name) => {
              const key = name as SeriesKey;
              const n = Number(value);
              return [SERIES[key]?.currency ? formatCurrency(n) : formatNumber(n), SERIES[key]?.label ?? String(name)];
            }}
          />
          {series.map((s) => (
            <Area key={s} type="monotone" dataKey={s} stroke={SERIES[s].color} strokeWidth={2} fill={`url(#grad-${s})`} dot={false} activeDot={{ r: 4 }} animationDuration={500} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeriesLegend({ series }: { series: SeriesKey[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {series.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: SERIES[s].color }} />
          {SERIES[s].label}
        </span>
      ))}
    </div>
  );
}
