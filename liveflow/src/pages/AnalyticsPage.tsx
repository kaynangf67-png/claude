import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, CircleDollarSign, Eye, MousePointerClick, Percent, ShoppingBag, ShoppingCart, Target, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/app/page';
import { StatCard } from '@/components/app/stat-card';
import { ProductImage, VideoThumb } from '@/components/app/media';
import { PerformanceChart, SeriesLegend } from '@/components/charts/performance-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useAnalytics, useLives, useProducts, useVideos } from '@/hooks/queries';
import { formatCompact, formatCurrency, formatDate, formatNumber, formatPercent } from '@/lib/format';
import { computeTotals, dailySeries, inRange, percentChange, presetToRange, previousRange, rankBy, type DateRange, type RangePreset } from '@/services/analytics';

function Ranking<T extends { id: string }>({
  title,
  items,
  thumb,
  label,
  href,
  metric,
}: {
  title: string;
  items: { item: T; value: number; secondary: string }[];
  thumb?: (item: T) => React.ReactNode;
  label: (item: T) => string;
  href: (item: T) => string;
  metric: (v: number) => string;
}) {
  const max = items[0]?.value || 1;
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-1">
        {items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>}
        {items.map(({ item, value, secondary }, i) => (
          <Link key={item.id} to={href(item)} className="-mx-2 flex items-center gap-3 rounded-lg p-2 hover:bg-muted/60">
            <span className="tabular w-3 shrink-0 text-xs font-semibold text-muted-foreground">{i + 1}</span>
            {thumb?.(item)}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={label(item)}>{label(item)}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full brand-gradient" style={{ width: `${(value / max) * 100}%` }} />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="tabular text-sm font-semibold">{metric(value)}</p>
              <p className="text-[11px] text-muted-foreground">{secondary}</p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [custom, setCustom] = useState<DateRange>(() => presetToRange('30d'));
  const range = useMemo(() => (preset === 'custom' ? custom : presetToRange(preset)), [preset, custom]);
  const prev = useMemo(() => previousRange(range), [range]);
  const analytics = useAnalytics({ from: prev.from, to: range.to });
  const products = useProducts();
  const videos = useVideos();
  const lives = useLives();

  const rows = useMemo(() => analytics.data ?? [], [analytics.data]);
  const cur = useMemo(() => rows.filter((r) => inRange(r, range)), [rows, range]);
  const t = useMemo(() => computeTotals(cur), [cur]);
  const p = useMemo(() => computeTotals(rows.filter((r) => inRange(r, prev))), [rows, prev]);
  const series = useMemo(() => dailySeries(cur, range), [cur, range]);
  const loading = analytics.isLoading;

  const productMap = new Map((products.data ?? []).map((x) => [x.id, x]));
  const videoMap = new Map((videos.data ?? []).map((x) => [x.id, x]));
  const liveMap = new Map((lives.data ?? []).map((x) => [x.id, x]));

  const topProducts = rankBy(cur, 'product_id', 'units', 5).flatMap((r) => {
    const item = productMap.get(r.id);
    return item ? [{ item, value: r.totals.units, secondary: formatCurrency(r.totals.revenue) }] : [];
  });
  const topVideos = rankBy(cur, 'video_id', 'revenue', 5).flatMap((r) => {
    const item = videoMap.get(r.id);
    return item ? [{ item, value: r.totals.revenue, secondary: `CTR ${formatPercent(r.totals.ctr)}` }] : [];
  });
  const topLives = rankBy(cur.filter((r) => r.live_id), 'live_id', 'revenue', 5).flatMap((r) => {
    const item = liveMap.get(r.id);
    return item ? [{ item, value: r.totals.revenue, secondary: `${formatDate(item.starts_at, 'dd/MM')} · ${formatNumber(r.totals.conversions)} pedidos` }] : [];
  });

  return (
    <div className="animate-in">
      <PageHeader
        title="Analytics"
        description={`${formatDate(range.from)} – ${formatDate(range.to)} · comparado ao período anterior`}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Tabs value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
              <TabsList className="max-w-full overflow-x-auto scrollbar-none">
                <TabsTrigger value="today">Hoje</TabsTrigger>
                <TabsTrigger value="7d">7 dias</TabsTrigger>
                <TabsTrigger value="30d">30 dias</TabsTrigger>
                <TabsTrigger value="90d">90 dias</TabsTrigger>
                <TabsTrigger value="custom">Personalizado</TabsTrigger>
              </TabsList>
            </Tabs>
            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <Input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className="w-38" aria-label="De" />
                <span className="text-muted-foreground">–</span>
                <Input type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className="w-38" aria-label="Até" />
              </div>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Visualizações" value={formatCompact(t.views)} icon={Eye} change={percentChange(t.views, p.views)} loading={loading} accent="amber" />
        <StatCard label="Cliques" value={formatCompact(t.clicks)} icon={MousePointerClick} change={percentChange(t.clicks, p.clicks)} loading={loading} accent="teal" />
        <StatCard label="CTR" value={formatPercent(t.ctr, 2)} icon={Percent} change={percentChange(t.ctr, p.ctr)} loading={loading} />
        <StatCard label="Conversões" value={formatNumber(t.conversions)} icon={ShoppingCart} change={percentChange(t.conversions, p.conversions)} loading={loading} accent="pink" />
        <StatCard label="Taxa de conversão" value={formatPercent(t.conversionRate, 2)} icon={Target} change={percentChange(t.conversionRate, p.conversionRate)} loading={loading} accent="teal" />
        <StatCard label="Vendas" value={formatNumber(t.units)} icon={ShoppingBag} change={percentChange(t.units, p.units)} loading={loading} accent="pink" />
        <StatCard label="Faturamento" value={formatCurrency(t.revenue)} icon={CircleDollarSign} change={percentChange(t.revenue, p.revenue)} loading={loading} />
        <StatCard label="Comissão" value={formatCurrency(t.commission)} icon={BadgePercent} change={percentChange(t.commission, p.commission)} loading={loading} accent="amber" />
        <StatCard label="ROI" value={t.roi == null ? '—' : formatPercent(t.roi, 0)} icon={TrendingUp} hint={t.roi == null ? 'sem custos registrados' : `custo ${formatCurrency(t.cost)}`} loading={loading} accent="teal" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div><CardTitle>Faturamento e comissão</CardTitle><CardDescription>Por dia</CardDescription></div>
            <SeriesLegend series={['revenue', 'commission']} />
          </CardHeader>
          <CardContent><PerformanceChart data={series} series={['revenue', 'commission']} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div><CardTitle>Funil de engajamento</CardTitle><CardDescription>Cliques e conversões por dia</CardDescription></div>
            <SeriesLegend series={['clicks', 'conversions']} />
          </CardHeader>
          <CardContent><PerformanceChart data={series} series={['clicks', 'conversions']} /></CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-[15px] font-semibold">Rankings do período</h2>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Ranking
          title="Produtos mais vendidos"
          items={topProducts}
          metric={(v) => `${formatNumber(v)} un.`}
          label={(item) => item.name}
          href={(item) => `/produtos/${item.id}`}
          thumb={(item) => <ProductImage product={item} className="size-9" />}
        />
        <Ranking
          title="Vídeos com melhor desempenho"
          items={topVideos}
          metric={formatCurrency}
          label={(item) => item.name}
          href={(item) => `/videos?v=${item.id}`}
          thumb={(item) => <VideoThumb video={item} className="aspect-video w-14" showDuration={false} />}
        />
        <Ranking
          title="Lives com melhor desempenho"
          items={topLives}
          metric={formatCurrency}
          label={(item) => `${item.title}`}
          href={(item) => `/lives/${item.id}`}
        />
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Definições: CTR = cliques ÷ visualizações · Taxa de conversão = pedidos ÷ cliques · ROI = (comissão − custo) ÷ custo.
      </p>
    </div>
  );
}
