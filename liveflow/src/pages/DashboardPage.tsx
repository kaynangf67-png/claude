import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Clapperboard,
  DollarSign,
  Eye,
  MousePointerClick,
  Package,
  Plus,
  Radio,
  ShoppingBag,
  Sparkles,
  Upload,
  Workflow,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { PageHeader, SectionTitle, EmptyState } from '@/components/app/page';
import { StatCard } from '@/components/app/stat-card';
import { LiveStatusBadge } from '@/components/app/status';
import { ProductImage } from '@/components/app/media';
import { PerformanceChart, type SeriesKey } from '@/components/charts/performance-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useAnalytics, useLives, useNotifications, useProducts, useProfile, useVideos } from '@/hooks/queries';
import { useDemoSeed } from '@/hooks/use-demo-seed';
import { formatCompact, formatCurrency, formatDate, formatNumber, formatRelative, formatTime } from '@/lib/format';
import { computeTotals, dailySeries, inRange, percentChange, presetToRange, previousRange, rankBy } from '@/services/analytics';
import type { NotificationType } from '@/types/domain';

const ACTIVITY_ICON: Record<NotificationType, typeof Activity> = {
  product_created: Package,
  video_uploaded: Upload,
  live_created: Radio,
  live_scheduled: CalendarClock,
  live_cancelled: XCircle,
  automation_created: Workflow,
  live_error: AlertTriangle,
  system: Activity,
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function DashboardPage() {
  const { data: profile } = useProfile();
  const range = useMemo(() => presetToRange('7d'), []);
  const prev = useMemo(() => previousRange(range), [range]);
  const wide = useMemo(() => ({ from: prev.from, to: range.to }), [prev, range]);
  const analytics = useAnalytics(wide);
  const products = useProducts();
  const videos = useVideos();
  const lives = useLives();
  const notifications = useNotifications();
  const seed = useDemoSeed();
  const [metric, setMetric] = useState<SeriesKey>('views');

  const rows = useMemo(() => analytics.data ?? [], [analytics.data]);
  const current = useMemo(() => computeTotals(rows.filter((r) => inRange(r, range))), [rows, range]);
  const previous = useMemo(() => computeTotals(rows.filter((r) => inRange(r, prev))), [rows, prev]);
  const series = useMemo(() => dailySeries(rows, range), [rows, range]);
  const productMap = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data]);

  const allLives = lives.data ?? [];
  const running = allLives.filter((l) => l.status === 'running');
  const upcoming = allLives.filter((l) => l.status === 'scheduled' && new Date(l.starts_at) > new Date()).slice(0, 5);
  const activeProducts = (products.data ?? []).filter((p) => p.status === 'active').length;
  const availableVideos = (videos.data ?? []).filter((v) => v.status !== 'archived').length;
  const top = rankBy(rows.filter((r) => inRange(r, range)), 'product_id', 'revenue', 4);
  const loading = analytics.isLoading;
  const empty = !products.isLoading && (products.data ?? []).length === 0;

  const name = profile?.full_name?.split(' ')[0];

  return (
    <div className="animate-in">
      <PageHeader
        title={`${greeting()}${name ? `, ${name}` : ''}`}
        description="Resumo da sua operação nos últimos 7 dias."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/videos">
                <Upload /> Enviar vídeo
              </Link>
            </Button>
            <Button asChild variant="brand" size="sm">
              <Link to="/lives/nova">
                <Plus /> Nova live
              </Link>
            </Button>
          </>
        }
      />

      {empty && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span className="brand-gradient grid size-11 shrink-0 place-items-center rounded-xl text-white">
              <Sparkles className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-medium">Sua conta está vazia</p>
              <p className="text-sm text-muted-foreground">Carregue dados fictícios para ver o LiveFlow funcionando, ou comece cadastrando um produto.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/produtos">Cadastrar produto</Link>
              </Button>
              <Button onClick={() => seed.mutate()} loading={seed.isPending}>
                Usar dados de demonstração
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Faturamento estimado" value={formatCurrency(current.revenue)} icon={DollarSign} change={percentChange(current.revenue, previous.revenue)} hint="vs. 7 dias ant." loading={loading} />
        <StatCard label="Vendas" value={formatNumber(current.units)} icon={ShoppingBag} change={percentChange(current.units, previous.units)} loading={loading} accent="pink" />
        <StatCard label="Cliques" value={formatCompact(current.clicks)} icon={MousePointerClick} change={percentChange(current.clicks, previous.clicks)} loading={loading} accent="teal" />
        <StatCard label="Visualizações" value={formatCompact(current.views)} icon={Eye} change={percentChange(current.views, previous.views)} loading={loading} accent="amber" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Lives ativas', value: running.length, icon: Radio, to: '/lives', live: running.length > 0 },
          { label: 'Lives programadas', value: allLives.filter((l) => l.status === 'scheduled').length, icon: CalendarClock, to: '/agenda' },
          { label: 'Produtos ativos', value: activeProducts, icon: Package, to: '/produtos' },
          { label: 'Vídeos disponíveis', value: availableVideos, icon: Clapperboard, to: '/videos' },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted/50">
            <span className="relative grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground">
              <s.icon className="size-4" />
              {s.live && <span className="absolute -top-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-destructive ring-2 ring-card" />}
            </span>
            <div className="min-w-0">
              <p className="tabular text-lg leading-tight font-semibold">{s.value}</p>
              <p className="text-xs leading-tight text-muted-foreground">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Performance dos últimos 7 dias</CardTitle>
              <CardDescription>
                {formatDate(range.from, 'dd/MM')} – {formatDate(range.to, 'dd/MM')}
              </CardDescription>
            </div>
            <Tabs value={metric} onValueChange={(v) => setMetric(v as SeriesKey)}>
              <TabsList className="max-w-full overflow-x-auto scrollbar-none">
                <TabsTrigger value="views">Visualizações</TabsTrigger>
                <TabsTrigger value="clicks">Cliques</TabsTrigger>
                <TabsTrigger value="conversions">Conversões</TabsTrigger>
                <TabsTrigger value="units">Vendas</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>{loading ? <Skeleton className="h-[260px] w-full" /> : <PerformanceChart data={series} series={[metric]} />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos em destaque</CardTitle>
            <Link to="/analytics" className="text-xs font-medium text-primary hover:underline">
              Ver ranking
            </Link>
          </CardHeader>
          <CardContent className="grid gap-1">
            {top.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sem vendas no período.</p>}
            {top.map((t, i) => {
              const p = productMap.get(t.id);
              if (!p) return null;
              const max = top[0].totals.revenue || 1;
              return (
                <Link key={t.id} to={`/produtos/${p.id}`} className="flex items-center gap-3 rounded-lg p-2 -mx-2 hover:bg-muted/60">
                  <ProductImage product={p} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <span className="tabular shrink-0 text-sm font-semibold">{formatCurrency(t.totals.revenue)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full brand-gradient" style={{ width: `${(t.totals.revenue / max) * 100}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">#{i + 1}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionTitle
            action={
              <Link to="/agenda" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Abrir agenda <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            Próximas Lives
          </SectionTitle>
          <Card className="overflow-hidden">
            {lives.isLoading ? (
              <div className="grid gap-2 p-4">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : upcoming.length === 0 && running.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nenhuma live programada" description="Transforme um vídeo em live e programe o horário." action={<Button asChild size="sm"><Link to="/lives/nova">Criar live</Link></Button>} className="m-4 border-0" />
            ) : (
              <ul className="divide-y">
                {[...running, ...upcoming].slice(0, 6).map((l) => {
                  const p = l.product_id ? productMap.get(l.product_id) : null;
                  return (
                    <li key={l.id}>
                      <Link to={`/lives/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5">
                        <div className="w-12 shrink-0 text-center">
                          <p className="text-[11px] uppercase text-muted-foreground">{formatDate(l.starts_at, 'EEE')}</p>
                          <p className="tabular text-lg leading-tight font-semibold">{formatDate(l.starts_at, 'dd')}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {p?.name ?? 'Sem produto'} · {formatTime(l.starts_at)}
                          </p>
                        </div>
                        <LiveStatusBadge status={l.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <SectionTitle>Atividade recente</SectionTitle>
          <Card>
            <CardContent className="pt-4 sm:pt-5">
              {(notifications.data ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Suas ações aparecerão aqui.</p>
              ) : (
                <ol className="relative grid gap-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border">
                  {(notifications.data ?? []).slice(0, 6).map((n) => {
                    const Icon = ACTIVITY_ICON[n.type] ?? Activity;
                    return (
                      <li key={n.id} className="relative flex gap-3">
                        <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground">
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{formatRelative(n.created_at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
