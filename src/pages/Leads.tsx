import { ArrowLeft, ChevronRight, Plus, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Avatar, FollowupBadge, STATUS_META, StatusBadge, TempBadge } from '../components/Badges';
import { ChatView } from '../components/ChatView';
import { DiagnosisCard, FollowupComposer } from '../components/FollowupComposer';
import { NewLeadDialog } from '../components/NewLeadDialog';
import { EmptyState, PageHeader } from '../components/ui';
import { analyzeLead } from '../lib/analyze';
import { formatBRLShort, formatPhone, normalize, relativeTime } from '../lib/format';
import { withAnalysis } from '../lib/metrics';
import { actions, useAppState } from '../lib/store';
import type { LeadStatus } from '../lib/types';

type Filter = 'todos' | LeadStatus;

export function Leads() {
  const { business, leads } = useAppState();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('todos');
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const items = useMemo(() => withAnalysis(leads, business!), [leads, business]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: items.length };
    for (const i of items) c[i.lead.status] = (c[i.lead.status] ?? 0) + 1;
    return c;
  }, [items]);

  const q = normalize(query);
  const visible = items
    .filter((i) => filter === 'todos' || i.lead.status === filter)
    .filter((i) => !q || normalize(`${i.lead.name} ${i.lead.productName} ${i.lead.phone}`).includes(q))
    .sort((a, b) => new Date(b.analysis.lastInteraction).getTime() - new Date(a.analysis.lastInteraction).getTime());

  const filters: Filter[] = ['todos', 'novo', 'interessado', 'followup', 'recuperado', 'perdido'];

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Todas as conversas, com status, temperatura e valor potencial."
        actions={
          <button className="btn-primary" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> Novo lead
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                filter === f ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {f === 'todos' ? 'Todos' : `${STATUS_META[f].emoji} ${STATUS_META[f].label}`}
              <span className="num ml-1.5 opacity-60">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar cliente ou produto" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<Users className="size-7" />} title="Nenhum lead aqui">
          {leads.length === 0 ? (
            <>
              Cadastre um lead e simule a conversa, ou{' '}
              <button className="font-semibold text-brand-700 hover:underline" onClick={() => actions.loadDemoLeads()}>
                carregue os dados de exemplo
              </button>
              .
            </>
          ) : (
            'Tente outro filtro ou busca.'
          )}
        </EmptyState>
      ) : (
        <>
          {/* Tabela desktop */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Cliente</th>
                  <th className="px-3 py-3 font-semibold">Interesse</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Temperatura</th>
                  <th className="px-3 py-3 text-right font-semibold">Valor potencial</th>
                  <th className="px-3 py-3 font-semibold">Follow-up</th>
                  <th className="px-3 py-3 font-semibold">Última interação</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(({ lead, analysis }) => (
                  <tr key={lead.id} onClick={() => navigate(`/app/leads/${lead.id}`)} className="cursor-pointer transition hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={lead.name} size="sm" />
                        <div className="min-w-0">
                          <Link to={`/app/leads/${lead.id}`} className="block truncate font-semibold text-ink" onClick={(e) => e.stopPropagation()}>
                            {lead.name}
                          </Link>
                          <span className="num text-xs text-slate-500">{formatPhone(lead.phone)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3.5 text-slate-700">{lead.productName}</td>
                    <td className="px-3 py-3.5"><StatusBadge status={lead.status} /></td>
                    <td className="px-3 py-3.5"><TempBadge temperature={analysis.temperature} /></td>
                    <td className="num px-3 py-3.5 text-right font-bold text-ink">{formatBRLShort(lead.value)}</td>
                    <td className="px-3 py-3.5"><FollowupBadge analysis={analysis} sent={lead.followupsSent} /></td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-slate-500">{relativeTime(analysis.lastInteraction)}</td>
                    <td className="pr-4 text-slate-300"><ChevronRight className="size-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <ul className="space-y-3 md:hidden">
            {visible.map(({ lead, analysis }) => (
              <li key={lead.id}>
                <Link to={`/app/leads/${lead.id}`} className="card block p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={lead.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{lead.name}</p>
                      <p className="truncate text-xs text-slate-500">{lead.productName}</p>
                    </div>
                    <span className="num font-bold text-ink">{formatBRLShort(lead.value)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={lead.status} />
                    <TempBadge temperature={analysis.temperature} />
                    <FollowupBadge analysis={analysis} sent={lead.followupsSent} />
                    <span className="ml-auto text-xs text-slate-400">{relativeTime(analysis.lastInteraction)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <NewLeadDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}

export function LeadDetail() {
  const { id } = useParams();
  const { business, leads } = useAppState();
  const navigate = useNavigate();
  const lead = leads.find((l) => l.id === id);
  if (!lead || !business) return <Navigate to="/app/leads" replace />;
  const analysis = analyzeLead(lead, business);

  return (
    <>
      <Link to="/app/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Leads
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={lead.name} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{lead.name}</h1>
            <p className="num text-sm text-slate-500">
              {formatPhone(lead.phone)} · {lead.productName} · <strong className="text-ink">{formatBRLShort(lead.value)}</strong>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={lead.status} />
          <TempBadge temperature={analysis.temperature} long />
          <select
            aria-label="Alterar status"
            className="input w-auto py-1.5 text-xs"
            value={lead.status}
            onChange={(e) => actions.setStatus(lead.id, e.target.value as LeadStatus)}
          >
            {(Object.keys(STATUS_META) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].emoji} {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <button
            className="btn-ghost p-2"
            aria-label="Excluir lead"
            title="Excluir lead"
            onClick={() => {
              if (confirm(`Excluir o lead ${lead.name}?`)) {
                actions.deleteLead(lead.id);
                navigate('/app/leads');
              }
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
        <div className="lg:sticky lg:top-6 lg:h-[calc(100dvh-180px)]">
          <ChatView lead={lead} businessName={business.name} />
          <p className="mt-2 text-xs text-slate-500">
            Modo simulação: adicione mensagens como cliente ou empresa e veja o diagnóstico da IA mudar na hora.
          </p>
        </div>
        <div className="space-y-4">
          <DiagnosisCard lead={lead} analysis={analysis} />
          <FollowupComposer key={lead.id} lead={lead} business={business} analysis={analysis} />
          <p className="text-xs text-slate-400">Última interação {relativeTime(analysis.lastInteraction)}.</p>
        </div>
      </div>
    </>
  );
}
