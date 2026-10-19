import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useCatalog } from '@/state/hooks';
import { IntegrationError, LiveResults } from '@/components/live';
import { CategoryBreakdown, MonitoredSection, SearchBar } from '@/components/marketplace';
import { Card, EmptyState, Notice, PageHeader, Segmented, Skeleton } from '@/components/ui';

export default function Shopee() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'relevancia' | 'vendas'>('vendas');
  const catalog = useCatalog();
  const search = useQuery({ queryKey: ['shopee', q, sort], queryFn: () => api.shopeeSearch(q, sort), enabled: Boolean(q), retry: 0, staleTime: 10 * 60_000 });

  return (
    <div>
      <PageHeader
        eyebrow="Shopee Affiliate Open API"
        title="Shopee"
        description="Pesquise ofertas, compare preços e veja as vendas informadas pela API de afiliados da Shopee."
        actions={<Segmented value={sort} onChange={setSort} options={[{ value: 'vendas', label: 'Mais vendidos' }, { value: 'relevancia', label: 'Relevância' }]} />}
      />
      <Notice tone="blue" className="mb-4">
        O campo de vendas vem da própria Shopee, mas a fonte não documenta o período (total ou recente). Por isso aparece como “vendas informadas”. A API não informa o total de anúncios, então não há estimativa de concorrência aqui.
      </Notice>
      <Card className="p-4 sm:p-5">
        <SearchBar onSearch={setQ} loading={search.isFetching} placeholder="Ex.: organizador de geladeira, acessórios para pets…" />
        {search.data?.priceStats && (
          <p className="mt-3 text-xs text-ink-3">
            Preço mínimo {money(search.data.priceStats.min)} · mediano {money(search.data.priceStats.median)} · máximo {money(search.data.priceStats.max)}
          </p>
        )}
      </Card>
      <div className="mt-4">
        {!q ? null : search.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-56" />)}</div>
        ) : search.error ? (
          <IntegrationError error={search.error} onRetry={() => search.refetch()} />
        ) : search.data && search.data.products.length === 0 ? (
          <Card><EmptyState title="Nenhuma oferta encontrada" description={`A Shopee não retornou ofertas para "${q}".`} /></Card>
        ) : search.data ? (
          <LiveResults products={search.data.products} fetchedAt={search.data.fetchedAt} sourceLabel="Shopee Affiliate API" />
        ) : null}
      </div>
      <div className="mt-6">
        <CategoryBreakdown items={(catalog.data ?? []).filter((p) => p.marketplace === 'shopee')} />
      </div>
      <MonitoredSection marketplace="shopee" />
    </div>
  );
}
