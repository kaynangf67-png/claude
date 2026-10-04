import { CalendarClock, HandCoins, Sparkles, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, TempBadge } from '../components/Badges';
import { RecoverModal } from '../components/RecoverModal';
import { EmptyState, PageHeader } from '../components/ui';
import { byPriority } from '../lib/analyze';
import { formatBRLShort, relativeTime } from '../lib/format';
import { computeMetrics, withAnalysis } from '../lib/metrics';
import { useAppState } from '../lib/store';

export function Recover() {
  const { business, leads } = useAppState();
  const [openLead, setOpenLead] = useState<string | null>(null);
  const items = useMemo(() => withAnalysis(leads, business!), [leads, business]);
  const m = computeMetrics(items);
  const list = [...m.open].sort(byPriority);

  return (
    <>
      <PageHeader title="Recuperar vendas" subtitle="Clientes que demonstraram interesse e ainda não compraram, por prioridade." />

      {list.length === 0 ? (
        <EmptyState icon={<HandCoins className="size-7" />} title="Nenhuma venda escapando agora">
          Quando um cliente pedir preço e parar de responder, ele aparece aqui com o follow-up pronto.
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-ink p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-300">
                <Sparkles className="size-6" />
              </span>
              <div>
                <p className="text-lg font-bold leading-snug sm:text-xl">
                  Encontramos {list.length} {list.length === 1 ? 'cliente que demonstrou' : 'clientes que demonstraram'} interesse e
                  ainda não {list.length === 1 ? 'comprou' : 'compraram'}.
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {m.pendingFollowups} {m.pendingFollowups === 1 ? 'precisa' : 'precisam'} de ação agora. Clique em um cliente para ver o
                  motivo e o follow-up sugerido.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10 sm:text-right">
              <p className="text-xs text-slate-400">Potencial a recuperar</p>
              <p className="num text-2xl font-extrabold text-brand-300">{formatBRLShort(m.openValue)}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
            {list.map(({ lead, analysis }) => {
              const actionable = analysis.canFollowUp || analysis.urgency === 'agora';
              return (
                <article key={lead.id} className="card flex flex-col p-5 transition hover:shadow-lift">
                  <div className="flex items-start gap-3">
                    <Avatar name={lead.name} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-ink">{lead.name}</h3>
                      <p className="truncate text-sm text-slate-500">{lead.productName}</p>
                    </div>
                    <TempBadge temperature={analysis.temperature} long />
                  </div>

                  <p className="num mt-4 text-3xl font-extrabold tracking-tight text-ink">{formatBRLShort(lead.value)}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarClock className="size-3.5" /> Última conversa: {relativeTime(analysis.lastInteraction)}
                  </p>

                  <div className="mt-4 flex-1 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                    <p className="font-semibold text-ink">{analysis.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-slate-600">{analysis.keyReason}</p>
                    {analysis.needsHuman && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-700">
                        <UserRound className="size-3.5" /> Atendimento humano recomendado
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className={`text-xs font-semibold ${actionable ? 'text-orange-600' : 'text-slate-400'}`}>
                      {analysis.recommendedAction}
                    </span>
                  </div>
                  <button
                    onClick={() => setOpenLead(lead.id)}
                    className={`mt-3 w-full ${actionable ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    <HandCoins className="size-4" /> Recuperar cliente
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}

      <RecoverModal leadId={openLead} onClose={() => setOpenLead(null)} />
    </>
  );
}
