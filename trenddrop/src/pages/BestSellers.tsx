import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Crown, ShieldCheck } from 'lucide-react';
import type { MetricKind } from '@shared/types';
import { METRIC_LABEL } from '@shared/types';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useCatalog, type EnrichedProduct } from '@/state/hooks';
import { IntegrationError, LiveResults } from '@/components/live';
import { RankList } from '@/components/lists';
import { metricText } from '@/components/product';
import { Card, CardHeader, Notice, PageHeader, Select, Skeleton } from '@/components/ui';

const SALES_KINDS: { kind: MetricKind; title: string; subtitle: string; asc: boolean }[] = [
  { kind: 'vendas_oficiais', title: 'Vendas informadas oficialmente', subtitle: 'Quantidade vendida publicada pela própria plataforma', asc: false },
  { kind: 'vendas_informadas', title: 'Vendas informadas pela fonte', subtitle: 'Ex.: API de afiliados — período nem sempre documentado', asc: false },
  { kind: 'ranking_mais_vendidos', title: 'Posição em ranking de mais vendidos', subtitle: 'Ranking oficial por categoria — informa a posição, não a quantidade', asc: true },
];

export default function BestSellers() {
  const catalog = useCatalog();
  const [cat, setCat] = useState('');
  const categories = useQuery({ queryKey: ['ml-categories'], queryFn: api.mlCategories, retry: 0, staleTime: 24 * 3600_000 });
  const best = useQuery({ queryKey: ['ml-best', cat], queryFn: () => api.mlBestSellers(cat), enabled: Boolean(cat), retry: 0, staleTime: 3600_000 });

  const by = (kind: MetricKind, asc: boolean) =>
    (catalog.data ?? [])
      .filter((p) => p.metrics.some((m) => m.kind === kind))
      .sort((a, b) => {
        const va = a.metrics.find((m) => m.kind === kind)!.value;
        const vb = b.metrics.find((m) => m.kind === kind)!.value;
        return asc ? va - vb : vb - va;
      })
      .slice(0, 10);

  return (
    <div>
      <PageHeader
        eyebrow="Somente dados verificáveis"
        title="Mais vendidos"
        description="Aqui só entram produtos com dado de venda ou ranking de vendas publicado por uma fonte. Visualizações, curtidas, buscas e Google Trends ficam de fora."
      />
      <Notice tone="green" icon={<ShieldCheck className="h-4 w-4 text-brand-2" />} className="mb-5">
        Cada tipo de dado aparece separado — não misturamos posição em ranking com quantidade vendida, nem vendas de fontes diferentes.
      </Notice>

      <div className="grid gap-4 lg:grid-cols-3">
        {SALES_KINDS.map((s) => (
          <RankList
            key={s.kind}
            title={s.title}
            subtitle={s.subtitle}
            icon={<Crown className="h-4 w-4 text-yellow-300" />}
            items={by(s.kind, s.asc) as EnrichedProduct[]}
            loading={catalog.isLoading}
            value={(p) => {
              const m = p.metrics.find((x) => x.kind === s.kind)!;
              return <span className="text-xs font-semibold text-ink tabular" title={m.detail}>{metricText(m)}</span>;
            }}
            empty={`Nenhum produto monitorado com “${METRIC_LABEL[s.kind].toLowerCase()}”.`}
          />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Ranking oficial do Mercado Livre por categoria"
          subtitle={best.data ? `${best.data.categoryName ?? best.data.category} · consultado em ${dateTime(best.data.fetchedAt)}` : 'Top 20 da categoria (endpoint /highlights)'}
          icon={<Crown className="h-4 w-4 text-yellow-300" />}
          action={
            <Select aria-label="Categoria" className="h-8 w-52 text-xs" value={cat} onChange={(e) => setCat(e.target.value)} disabled={!categories.data}>
              <option value="">Escolha uma categoria</option>
              {categories.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          }
        />
        <div className="p-4 sm:p-5">
          {categories.error ? (
            <IntegrationError error={categories.error} onRetry={() => categories.refetch()} />
          ) : !cat ? (
            <p className="text-sm text-ink-3">Escolha uma categoria para ver o ranking oficial de mais vendidos do Mercado Livre.</p>
          ) : best.isLoading ? (
            <Skeleton className="h-48" />
          ) : best.error ? (
            <IntegrationError error={best.error} onRetry={() => best.refetch()} />
          ) : best.data ? (
            <>
              <LiveResults products={best.data.products} fetchedAt={best.data.fetchedAt} sourceLabel="API Mercado Livre — ranking de mais vendidos" indicatorNote="o ranking informa posição, não quantidade" />
              {best.data.skipped > 0 && <p className="mt-3 text-xs text-ink-3">{best.data.skipped} item(ns) do ranking não puderam ser detalhados pela API e foram omitidos.</p>}
            </>
          ) : null}
        </div>
      </Card>
      <p className="mt-4 text-xs text-ink-3">
        Shopee: use a ordenação “Mais vendidos” na página <Link to="/shopee" className="text-brand-2 hover:underline">Shopee</Link>. TikTok Shop: não há fonte autorizada de vendas de terceiros.
      </p>
    </div>
  );
}
