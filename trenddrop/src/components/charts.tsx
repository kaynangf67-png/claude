import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { longDate, money, shortDate } from '@/lib/format';

export const SERIES_COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa'];

const axis = { stroke: 'var(--color-ink-3)', fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: 'var(--color-surface-2)', border: '1px solid var(--color-line-strong)', borderRadius: 10, fontSize: 12, color: 'var(--color-ink)' },
  labelStyle: { color: 'var(--color-ink-2)', marginBottom: 4 },
  itemStyle: { padding: 0 },
};

/** Várias séries 0–100 (interesse relativo) no mesmo eixo. */
export function MultiTrendChart({ series, height = 280 }: { series: { name: string; points: { date: string; value: number }[] }[]; height?: number }) {
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const rows = dates.map((d) => {
    const row: Record<string, number | string> = { date: d };
    for (const s of series) {
      const pt = s.points.find((p) => p.date === d);
      if (pt) row[s.name] = pt.value;
    }
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={28} {...axis} />
        <YAxis domain={[0, 100]} {...axis} />
        <Tooltip {...tooltipStyle} labelFormatter={(l) => longDate(String(l))} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
        {series.map((s, i) => (
          <Line key={s.name} type="monotone" dataKey={s.name} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TrendArea({ points, height = 240, label = 'Interesse' }: { points: { date: string; value: number }[]; height?: number; label?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#22c55e" stopOpacity={0.35} />
            <stop offset="1" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={28} {...axis} />
        <YAxis domain={[0, 100]} {...axis} />
        <Tooltip {...tooltipStyle} labelFormatter={(l) => longDate(String(l))} formatter={(v) => [v, label]} />
        <Area type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PriceChart({ points, height = 200 }: { points: { date: string; price: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={28} {...axis} />
        <YAxis tickFormatter={(v) => `R$${v}`} domain={['auto', 'auto']} width={56} {...axis} />
        <Tooltip {...tooltipStyle} labelFormatter={(l) => new Date(String(l)).toLocaleString('pt-BR')} formatter={(v) => [money(Number(v)), 'Preço']} />
        <Line type="stepAfter" dataKey="price" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2.5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
