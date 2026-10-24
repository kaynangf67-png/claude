import { History, Trash2 } from 'lucide-react';
import { MARKETPLACE_IDS, type MarketplaceId } from '@vendora/shared/marketplaces';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, MarketplaceChip, PageHeader, Skeleton, Spinner } from '../../components/ui';
import { api, ApiError, type ListingSummary } from '../../lib/api';
import { formatDate, MARKETPLACE_STYLE } from '../../lib/format';
import { useToast } from '../../lib/toast';

const STATUS: Record<ListingSummary['status'], string> = { draft: 'Rascunho', saved: 'Salvo', exported: 'Exportado' };

export function HistoryPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<MarketplaceId | ''>('');
  const [items, setItems] = useState<ListingSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (after?: string) => {
      const q = new URLSearchParams();
      if (filter) q.set('marketplace', filter);
      if (after) q.set('cursor', after);
      const r = await api.get<{ listings: ListingSummary[]; nextCursor: string | null }>(`/api/listings?${q}`);
      setItems((prev) => (after && prev ? [...prev, ...r.listings] : r.listings));
      setCursor(r.nextCursor);
    },
    [filter],
  );

  useEffect(() => {
    setItems(null);
    load().catch((e) => toast('error', e instanceof ApiError ? e.message : 'Falha ao carregar.'));
  }, [load, toast]);

  async function remove(id: string) {
    if (!confirm('Excluir este anúncio e todas as versões? As imagens do produto continuam até a política de retenção.')) return;
    try {
      await api.del(`/api/listings/${id}`);
      setItems((prev) => prev?.filter((x) => x.id !== id) ?? null);
      toast('success', 'Anúncio excluído.');
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'Falha ao excluir.');
    }
  }

  return (
    <>
      <PageHeader title="Histórico" subtitle="Todos os anúncios gerados, com as versões editadas." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['', ...MARKETPLACE_IDS] as const).map((id) => (
          <button
            key={id || 'all'}
            onClick={() => setFilter(id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === id ? 'border-ink-950 bg-ink-950 text-ink-50' : 'border-ink-200 bg-surface text-ink-700 hover:border-ink-300'
            }`}
          >
            {id ? MARKETPLACE_STYLE[id].label : 'Todos'}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<History className="size-5" />}
          title={filter ? 'Nenhum anúncio para este canal' : 'Nenhum anúncio ainda'}
          action={
            <Link to="/app/novo" className="btn-primary">
              Criar anúncio
            </Link>
          }
        >
          Os anúncios gerados aparecem aqui automaticamente. Cada edição vira uma versão que você pode restaurar.
        </EmptyState>
      ) : (
        <>
          <ul className="card divide-y divide-ink-100">
            {items.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-4">
                <Link to={`/app/anuncios/${l.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium hover:text-accent">{l.title}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {l.sourceDomain ?? 'Cadastro manual'} · {STATUS[l.status]} · v{l.currentVersion} · {formatDate(l.updatedAt)}
                  </p>
                </Link>
                <MarketplaceChip id={l.marketplace} />
                <button className="btn-ghost px-2" aria-label="Excluir anúncio" onClick={() => remove(l.id)}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          {cursor && (
            <div className="mt-4 flex justify-center">
              <button
                className="btn-secondary"
                disabled={loadingMore}
                onClick={async () => {
                  setLoadingMore(true);
                  await load(cursor).finally(() => setLoadingMore(false));
                }}
              >
                {loadingMore && <Spinner />} Carregar mais
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
