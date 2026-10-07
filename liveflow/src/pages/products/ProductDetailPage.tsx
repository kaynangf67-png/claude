import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Package, Pencil, Send, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/app/page';
import { ProductImage, VideoThumb } from '@/components/app/media';
import { LiveStatusBadge, ProductStatusBadge, VideoStatusBadge } from '@/components/app/status';
import { MetricTiles } from '@/components/app/metric-tiles';
import { ProductDialog } from '@/components/app/product-dialog';
import { PerformanceChart, SeriesLegend } from '@/components/charts/performance-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { useAnalytics, useLives, useProducts, useVideos } from '@/hooks/queries';
import { formatCurrency, formatDateTime, formatPercent } from '@/lib/format';
import { computeTotals, dailySeries, presetToRange } from '@/services/analytics';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const products = useProducts();
  const videos = useVideos();
  const lives = useLives();
  const range = useMemo(() => presetToRange('30d'), []);
  const analytics = useAnalytics(range);
  const [editing, setEditing] = useState(false);

  const product = products.data?.find((p) => p.id === id);
  const rows = useMemo(() => (analytics.data ?? []).filter((r) => r.product_id === id), [analytics.data, id]);
  const totals = useMemo(() => computeTotals(rows), [rows]);
  const series = useMemo(() => dailySeries(rows, range), [rows, range]);
  const relatedVideos = (videos.data ?? []).filter((v) => v.product_id === id);
  const relatedLives = (lives.data ?? []).filter((l) => l.product_id === id).sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  if (products.isLoading) return <Skeleton className="h-64" />;
  if (!product) {
    return <EmptyState icon={Package} title="Produto não encontrado" action={<Button asChild><Link to="/produtos">Voltar para produtos</Link></Button>} className="mt-8" />;
  }

  const finalPrice = Number(product.promo_price ?? product.price);
  const commissionValue = finalPrice * (Number(product.commission_rate) / 100);

  return (
    <div className="animate-in">
      <Link to="/produtos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Produtos
      </Link>

      <Card className="mb-6 p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row">
          <ProductImage product={product} className="aspect-square w-full rounded-xl sm:size-36" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <ProductStatusBadge status={product.status} />
                  {product.category && <span className="text-xs text-muted-foreground">{product.category}</span>}
                  {product.sku && <span className="text-xs text-muted-foreground">· SKU {product.sku}</span>}
                </div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{product.name}</h1>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil /> Editar
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/ia/roteiros?produto=${product.id}`}>
                    <Sparkles /> Roteiro
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link to={`/publicacoes?nova=1&produto=${product.id}`}>
                    <Send /> Programar publicação
                  </Link>
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Preço</p>
                <p className="tabular text-lg font-semibold">
                  {formatCurrency(finalPrice)}
                  {product.promo_price != null && <span className="ml-2 text-sm font-normal text-muted-foreground line-through">{formatCurrency(Number(product.price))}</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Comissão</p>
                <p className="tabular text-lg font-semibold">
                  {Number(product.commission_rate)}% <span className="text-sm font-normal text-muted-foreground">({formatCurrency(commissionValue)}/venda)</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa de conversão (30d)</p>
                <p className="tabular text-lg font-semibold">{formatPercent(totals.conversionRate)}</p>
              </div>
            </div>
            {product.description && <p className="mt-4 max-w-3xl text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{product.description}</p>}
            {product.product_url && (
              <a href={product.product_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                Abrir página do produto <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </Card>

      <h2 className="mb-3 text-[15px] font-semibold">Performance · últimos 30 dias</h2>
      <MetricTiles totals={totals} />
      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Cliques e conversões</CardTitle>
            <CardDescription>Comissão no período: {formatCurrency(totals.commission)}</CardDescription>
          </div>
          <SeriesLegend series={['clicks', 'conversions']} />
        </CardHeader>
        <CardContent>
          <PerformanceChart data={series} series={['clicks', 'conversions']} height={220} />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vídeos relacionados</CardTitle>
            <span className="text-xs text-muted-foreground">{relatedVideos.length}</span>
          </CardHeader>
          <CardContent className="grid gap-2">
            {relatedVideos.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum vídeo associado.</p>}
            {relatedVideos.map((v) => (
              <Link key={v.id} to={`/videos?v=${v.id}`} className="-mx-2 flex items-center gap-3 rounded-lg p-2 hover:bg-muted/60">
                <VideoThumb video={v} className="aspect-video w-24" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.usage_count} {v.usage_count === 1 ? 'uso' : 'usos'}</p>
                </div>
                <VideoStatusBadge status={v.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Lives relacionadas</CardTitle>
            <span className="text-xs text-muted-foreground">{relatedLives.length}</span>
          </CardHeader>
          <CardContent className="grid gap-1">
            {relatedLives.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma live com este produto.</p>}
            {relatedLives.slice(0, 8).map((l) => (
              <Link key={l.id} to={`/lives/${l.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-muted/60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(l.starts_at)}</p>
                </div>
                <LiveStatusBadge status={l.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <ProductDialog open={editing} onOpenChange={setEditing} product={product} />
    </div>
  );
}
