import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Radar, Store, TrendingUp } from 'lucide-react';
import { COMPETITION_LABEL } from '@shared/analysis';
import { api } from '@/lib/api';
import { dateTime, money, number } from '@/lib/format';
import { useCatalog } from '@/state/hooks';
import { IntegrationError, LiveResults } from '@/components/live';
import { CategoryBreakdown, MonitoredSection, SearchBar } from '@/components/marketplace';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Select, Skeleton } from '@/components/ui';

const GROUP_LABEL = { crescimento: 'Maior crescimento', mais_buscadas: 'Mais buscadas', populares: 'Populares' } as const;

export default function MercadoLivre() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const navigate = useNavigate();
  const catalog = useCatalog();
  const search = useQuery({ queryKey: ['ml-search', q], queryFn: () => api.mlSearch(q), enabled: Boolean(q), retry: 0, staleTime: 10 * 60_000 });
  const trends = useQuery({ queryKey: ['ml-trends', cat], queryFn: () => api.mlTrends(cat || undefined), retry: 0, staleTime: 60 * 60_000 });
  const categories = useQuery({ queryKey: ['ml-categories'], queryFn: api.mlCategories, retry: 0, staleTime: 24 * 3600_000 });

  return (
    <div>
      <PageHeader
        eyebrow="API oficial Mercado Livre"
        title="Mercado Livre"
        description="Pesquise anúncios, compare preços e veja a concorrência estimada pelo total de anúncios. As tendências do ML são buscas em alta — não vendas."
      />

      <Card className="p-4 sm:p-5">
        <SearchBar onSearch={setQ} loading={search.isFetching} placeholder="Ex.: seladora a vácuo, mini liquidificador portátil…" />
        {search.data && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Anúncios encontrados" value={number(search.data.total)} />
            <Stat label="Concorrência estimada" value={search.data.competition ? COMPETITION_LABEL[search.data.competition.level] : '—'} title={search.data.competition?.method} />
            <Stat label="Preço mediano" value={money(search.data.priceStats?.median)} />
            <Stat label="Faixa de preço" value={search.data.priceStats ? `${money(search.data.priceStats.min)} – ${money(search.data.priceStats.max)}` : '—'} />
          </div>
        )}
      </Card>

      <div className="mt-4">
        {!q ? null : search.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-56" />)}</div>
        ) : search.error ? (
          <IntegrationError error={search.error} onRetry={() => search.refetch()} />
        ) : search.data && search.data.products.length === 0 ? (
          <Card><EmptyState title="Nenhum anúncio encontrado" description={`O Mercado Livre não retornou resultados para "${q}".`} /></Card>
        ) : search.data ? (
          <LiveResults products={search.data.products} fetchedAt={search.data.fetchedAt} sourceLabel="API Mercado Livre" indicatorNote="preço e categoria oficiais; vendas só quando a API informa" />
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Buscas em alta no Mercado Livre"
            subtitle={trends.data ? `Atualização semanal pelo ML · consultado em ${dateTime(trends.data.fetchedAt)}` : 'Ranking oficial de buscas (/trends)'}
            icon={<TrendingUp className="h-4 w-4 text-brand-2" />}
            action={
              <Select aria-label="Categoria" className="h-8 w-44 text-xs" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Todas as categorias</option>
                {categories.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            }
          />
          <div className="p-4 sm:p-5">
            {trends.isLoading ? (
              <Skeleton className="h-40" />
            ) : trends.error ? (
              <IntegrationError error={trends.error} onRetry={() => trends.refetch()} />
            ) : trends.data?.keywords.length ? (
              <div className="grid gap-5 md:grid-cols-3">
                {(['crescimento', 'mais_buscadas', 'populares'] as const).map((g) => (
                  <div key={g}>
                    <h4 className="mb-2 text-xs font-semibold text-ink-2">{GROUP_LABEL[g]}</h4>
                    <ul className="space-y-1">
                      {trends.data!.keywords.filter((k) => k.group === g).map((k) => (
                        <li key={k.position} className="group flex items-center gap-1.5 text-sm">
                          <span className="w-5 text-xs text-ink-3 tabular">{k.position}</span>
                          <button className="flex-1 truncate text-left text-ink-2 hover:text-brand-2" onClick={() => setQ(k.keyword)} title="Pesquisar no Mercado Livre">{k.keyword}</button>
                          <button className="rounded p-1 text-ink-3 opacity-60 hover:text-brand-2 group-hover:opacity-100" title="Analisar no Radar Google Trends" onClick={() => navigate(`/radar?termos=${encodeURIComponent(k.keyword)}`)}>
                            <Radar className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Sem tendências retornadas" />
            )}
            <p className="mt-4 text-[11px] text-ink-3"><Badge>Buscas</Badge> Indica o que as pessoas procuram no ML. Não é quantidade vendida.</p>
          </div>
        </Card>
        <CategoryBreakdown items={(catalog.data ?? []).filter((p) => p.marketplace === 'mercadolivre')} />
      </div>

      <MonitoredSection marketplace="mercadolivre" />
      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-3"><Store className="h-3.5 w-3.5" /> Dados obtidos da API oficial com o token do app configurado no servidor.</p>
    </div>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2" title={title}>
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="truncate text-sm font-semibold text-ink tabular">{value}</div>
    </div>
  );
}
