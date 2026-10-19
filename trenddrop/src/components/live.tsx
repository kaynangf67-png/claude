import { Link, useNavigate } from 'react-router-dom';
import { BookmarkPlus, Check, ExternalLink, FlaskConical, PlugZap, ServerCrash } from 'lucide-react';
import { productInsight } from '@shared/analysis';
import type { Product } from '@shared/types';
import { ApiRequestError } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { useApp } from '@/state/app';
import { feeFor, useCatalog, useSaveProduct } from '@/state/hooks';
import { rememberProducts } from '@/state/transient';
import { CompetitionBadge, MarketplaceBadge, MetricChip, ProductImage, QualityBadge, SupplierActions } from './product';
import { Button, Card, ErrorState, Notice } from './ui';

/** Mostra erro de integração; "não configurada" vira orientação + demo. */
export function IntegrationError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { setDemo, mode } = useApp();
  if (error instanceof ApiRequestError && error.notConfigured) {
    return (
      <Notice tone="amber" icon={<PlugZap className="h-4 w-4 text-warn" />}>
        <p className="font-medium text-ink">Integração não configurada</p>
        <p className="mt-0.5">{error.message}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link to="/configuracoes"><Button size="sm">Ver como configurar</Button></Link>
          {mode !== 'demo' && <Button size="sm" variant="ghost" onClick={() => setDemo(true)}><FlaskConical className="h-3.5 w-3.5" /> Explorar com dados de demonstração</Button>}
        </div>
      </Notice>
    );
  }
  if (error instanceof ApiRequestError && error.code === 'network') {
    return (
      <Notice tone="red" icon={<ServerCrash className="h-4 w-4 text-down" />}>
        <p className="font-medium text-ink">Backend indisponível</p>
        <p className="mt-0.5">{error.message}</p>
      </Notice>
    );
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}

export function MonitorButton({ product }: { product: Product }) {
  const save = useSaveProduct();
  const catalog = useCatalog();
  const navigate = useNavigate();
  const { mode } = useApp();
  const already = catalog.data?.find((p) => p.marketplace === product.marketplace && p.externalId && p.externalId === product.externalId);
  if (already)
    return (
      <Button size="sm" variant="ghost" onClick={() => navigate(`/produto/${already.id}`)}>
        <Check className="h-3.5 w-3.5 text-brand-2" /> Monitorado
      </Button>
    );
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={save.isPending}
      disabled={mode === 'demo'}
      title={mode === 'demo' ? 'Saia da demonstração para monitorar dados reais' : undefined}
      onClick={() => save.mutate(product)}
    >
      <BookmarkPlus className="h-3.5 w-3.5" /> Monitorar
    </Button>
  );
}

/** Lista de resultados ao vivo (ainda não salvos). */
export function LiveResults({ products, fetchedAt, sourceLabel, indicatorNote }: { products: Product[]; fetchedAt: string; sourceLabel: string; indicatorNote?: string }) {
  const catalog = useCatalog();
  rememberProducts(products);
  return (
    <div>
      <p className="mb-3 text-xs text-ink-3">
        {products.length} resultado(s) · origem: <strong className="text-ink-2">{sourceLabel}</strong> · consultado em {dateTime(fetchedAt)}
        {indicatorNote && <> · {indicatorNote}</>}
      </p>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {products.map((p) => {
          const insight = productInsight(p, feeFor(catalog.fees, p.marketplace), catalog.settings?.targetMarginPct);
          return (
            <Card key={p.id} className="flex flex-col p-4 animate-fade-in">
              <div className="flex gap-3">
                <ProductImage p={p} className="h-20 w-20 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap gap-1">
                    <MarketplaceBadge m={p.marketplace} />
                    <QualityBadge q={p.quality} />
                  </div>
                  <Link to={`/produto/${encodeURIComponent(p.id)}`} className="line-clamp-2 text-sm font-medium text-ink hover:text-brand-2">{p.name}</Link>
                  <p className="mt-0.5 text-xs text-ink-3">{p.category ?? 'Categoria não informada'}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold tabular">{money(p.price)}</span>
                <CompetitionBadge level={p.competition?.level} title={p.competition?.method} />
                {insight.score.score != null && <span className="text-xs text-ink-3">Oport. {insight.score.score}</span>}
              </div>
              {p.metrics.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{p.metrics.map((m, i) => <MetricChip key={i} m={m} />)}</div>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <MonitorButton product={p} />
                {p.sourceUrl && (
                  <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /> Ver anúncio</Button>
                  </a>
                )}
              </div>
              <div className="mt-3 border-t border-line pt-3">
                <SupplierActions product={p} compact />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
