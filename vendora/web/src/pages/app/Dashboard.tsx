import { ArrowRight, Camera, FileDown, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, MarketplaceChip, PageHeader, Skeleton } from '../../components/ui';
import { api, type ListingSummary } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate } from '../../lib/format';

interface Usage {
  last30Days: Partial<Record<'analysis' | 'generation' | 'image_process' | 'export', number>>;
  totals: { listings: number; savedOrExported: number; analysesByStatus: Record<string, number> };
}

export function Dashboard() {
  const { user, meta } = useAuth();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [recent, setRecent] = useState<ListingSummary[] | null>(null);

  useEffect(() => {
    api.get<Usage>('/api/usage').then(setUsage).catch(() => setUsage(null));
    api.get<{ listings: ListingSummary[] }>('/api/listings').then((r) => setRecent(r.listings.slice(0, 5))).catch(() => setRecent([]));
  }, []);

  const stats = [
    { label: 'Fotos analisadas (30 dias)', value: usage?.last30Days.analysis ?? 0, icon: Camera },
    { label: 'Textos gerados (30 dias)', value: usage?.last30Days.generation ?? 0, icon: Sparkles },
    { label: 'Imagens editadas (30 dias)', value: usage?.last30Days.image_process ?? 0, icon: Wand2 },
    { label: 'Exportações (30 dias)', value: usage?.last30Days.export ?? 0, icon: FileDown },
  ];

  return (
    <>
      <PageHeader
        title={`Olá, ${user?.name.split(' ')[0]}`}
        subtitle={
          meta?.ai.provider === 'anthropic'
            ? `IA ativa: ${meta.ai.model}.`
            : 'IA não configurada: os textos são montados só com os dados do produto, sem reescrita.'
        }
        actions={
          <Link to="/app/novo" className="btn-primary">
            Novo anúncio <ArrowRight className="size-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-5">
            <Icon className="size-4 text-violet-brand" />
            {usage ? <p className="mt-3 font-display text-3xl font-bold">{value}</p> : <Skeleton className="mt-3 h-9 w-12" />}
            <p className="mt-1 text-xs text-ink-500">{label}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Anúncios recentes</h2>
          {recent && recent.length > 0 && (
            <Link to="/app/historico" className="text-sm font-medium text-violet-brand hover:underline">
              Ver histórico
            </Link>
          )}
        </div>
        {recent === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title="Seu primeiro anúncio começa com uma foto"
            action={
              <Link to="/app/novo" className="btn-primary">
                Criar anúncio
              </Link>
            }
          >
            Envie fotos do produto. A IA identifica o que é, escreve título e descrição no padrão do canal escolhido e prepara as fotos
            com fundo branco. O que a foto não mostra aparece numa lista para você confirmar.
          </EmptyState>
        ) : (
          <ul className="card divide-y divide-ink-100">
            {recent.map((l) => (
              <li key={l.id}>
                <Link to={`/app/anuncios/${l.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-ink-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {l.sourceDomain ?? 'Cadastro manual'} · {formatDate(l.updatedAt)}
                    </p>
                  </div>
                  <MarketplaceChip id={l.marketplace} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
