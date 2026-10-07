import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Clock, MoreHorizontal, Radio, Repeat, Timer } from 'lucide-react';
import { EmptyState } from '@/components/app/page';
import { ProductImage, VideoThumb } from '@/components/app/media';
import { LiveStatusBadge } from '@/components/app/status';
import { MetricTiles } from '@/components/app/metric-tiles';
import { LiveActionsMenu } from '@/components/app/live-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { useAnalytics, useLives, useProducts, useVideos } from '@/hooks/queries';
import { formatCurrency, formatDate, formatMinutes, formatTime } from '@/lib/format';
import { computeTotals } from '@/services/analytics';
import { getTikTokService } from '@/services/tiktok';

export default function LiveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const lives = useLives();
  const products = useProducts();
  const videos = useVideos();
  const live = lives.data?.find((l) => l.id === id);
  const day = live?.starts_at.slice(0, 10);
  const range = useMemo(() => ({ from: day ?? '1970-01-01', to: day ?? '1970-01-01' }), [day]);
  const analytics = useAnalytics(range);
  const totals = useMemo(() => computeTotals((analytics.data ?? []).filter((r) => r.live_id === id)), [analytics.data, id]);

  if (lives.isLoading) return <Skeleton className="h-64" />;
  if (!live) return <EmptyState icon={Radio} title="Live não encontrada" action={<Button asChild><Link to="/lives">Voltar</Link></Button>} className="mt-8" />;

  const product = live.product_id ? products.data?.find((p) => p.id === live.product_id) : null;
  const video = live.video_id ? videos.data?.find((v) => v.id === live.video_id) : null;
  const end = new Date(new Date(live.starts_at).getTime() + live.duration_minutes * 60_000);
  const tiktokMode = getTikTokService().mode;
  const hasMetrics = live.status === 'finished' || live.status === 'running';

  return (
    <div className="animate-in">
      <Link to="/lives" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Lives
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <LiveStatusBadge status={live.status} />
            {live.schedule_id && (
              <Link to="/automacoes" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Repeat className="size-3.5" /> Parte de uma automação
              </Link>
            )}
            {tiktokMode === 'mock' && <span className="text-xs text-muted-foreground">· Execução simulada</span>}
          </div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{live.title}</h1>
        </div>
        <LiveActionsMenu
          live={live}
          showView={false}
          trigger={
            <Button variant="outline" size="sm">
              <MoreHorizontal /> Ações
            </Button>
          }
        />
      </div>

      {live.error_message && <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{live.error_message}</p>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          {video ? <VideoThumb video={video} className="aspect-video w-full rounded-none" /> : <div className="grid aspect-video place-items-center bg-muted text-sm text-muted-foreground">Vídeo removido</div>}
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Vídeo</p>
              <p className="truncate text-sm font-medium">{video?.name ?? '—'}</p>
            </div>
            {video && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/videos?v=${video.id}`}>Assistir</Link>
              </Button>
            )}
          </div>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardContent className="grid gap-4 pt-4 sm:pt-5">
              {[
                { icon: CalendarClock, label: 'Data', value: formatDate(live.starts_at, "EEEE, dd 'de' MMMM") },
                { icon: Clock, label: 'Horário', value: `${formatTime(live.starts_at)} – ${formatTime(end)}` },
                { icon: Timer, label: 'Duração', value: formatMinutes(live.duration_minutes) },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><row.icon className="size-4" /></span>
                  <div>
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="text-sm font-medium first-letter:uppercase">{row.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Produto</CardTitle></CardHeader>
            <CardContent>
              {product ? (
                <Link to={`/produtos/${product.id}`} className="-mx-2 flex items-center gap-3 rounded-lg p-2 hover:bg-muted/60">
                  <ProductImage product={product} className="size-12" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(Number(product.promo_price ?? product.price))} · {Number(product.commission_rate)}%</p>
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">Sem produto associado.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {live.description && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
          <CardContent><p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{live.description}</p></CardContent>
        </Card>
      )}

      <h2 className="mt-6 mb-3 text-[15px] font-semibold">Resultados</h2>
      {hasMetrics ? (
        <MetricTiles totals={totals} />
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">As métricas aparecem quando a live for executada.</p>
      )}
    </div>
  );
}
