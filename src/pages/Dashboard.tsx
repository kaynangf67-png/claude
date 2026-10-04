import { ArrowRight, BellRing, HandCoins, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, TempBadge } from '../components/Badges';
import { HowItWorks, RecoveryFunnel, RoiCard, StatCard } from '../components/DashboardWidgets';
import { RecoverModal } from '../components/RecoverModal';
import { PageHeader } from '../components/ui';
import { byPriority } from '../lib/analyze';
import { formatBRL, formatBRLShort, relativeTime } from '../lib/format';
import { computeMetrics, withAnalysis } from '../lib/metrics';
import { useAppState } from '../lib/store';

export function Dashboard() {
  const { business, leads, user } = useAppState();
  const [openLead, setOpenLead] = useState<string | null>(null);
  const items = useMemo(() => withAnalysis(leads, business!), [leads, business]);
  const m = computeMetrics(items);
  const priorities = [...m.open].sort(byPriority).slice(0, 4);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <>
      <PageHeader
        title={`${greet}${user && user.name !== 'Você' ? `, ${user.name.split(' ')[0]}` : ''}! 👋`}
        subtitle={
          m.openCount > 0 ? (
            <>
              Você tem <strong className="text-ink">{m.openCount} clientes</strong> que demonstraram interesse e ainda não
              compraram — <strong className="text-brand-700">{formatBRLShort(m.openValue)}</strong> em jogo.
            </>
          ) : (
            'Nenhuma venda escapando agora. Cadastre ou simule novas conversas em Leads.'
          )
        }
        actions={
          <Link to="/app/recuperar" className="btn-primary">
            <HandCoins className="size-4" /> Recuperar vendas
          </Link>
        }
      />

      <div className="mb-6">
        <HowItWorks />
      </div>

      <RoiCard revenue={m.recoveredRevenue} recovered={m.recoveredCount} openValue={m.openValue} />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Receita recuperada"
          value={formatBRL(m.recoveredRevenue)}
          hint="vendas que voltaram"
          icon={<Trophy className="size-[18px]" />}
          accent="brand"
        />
        <StatCard
          label="Clientes potenciais"
          value={m.openCount}
          hint={`${formatBRLShort(m.openValue)} em aberto`}
          icon={<Users className="size-[18px]" />}
          accent="slate"
        />
        <StatCard
          label="Follow-ups pendentes"
          value={m.pendingFollowups}
          hint="precisam de ação hoje"
          icon={<BellRing className="size-[18px]" />}
          accent="orange"
        />
        <StatCard
          label="Clientes recuperados"
          value={m.recoveredCount}
          hint="compraram após follow-up"
          icon={<HandCoins className="size-[18px]" />}
          accent="blue"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
        <RecoveryFunnel
          leads={m.leadsIdentified}
          followups={m.followupsSentLeads}
          recovered={m.recoveredCount}
          revenue={m.recoveredRevenue}
          openValue={m.openValue}
        />

        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink">Prioridades de hoje</h2>
              <p className="text-sm text-slate-500">Quem a IA recomenda contatar primeiro</p>
            </div>
            <Link to="/app/recuperar" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              Ver todos <ArrowRight className="size-4" />
            </Link>
          </div>
          {priorities.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Tudo em dia por aqui. 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {priorities.map(({ lead, analysis }) => (
                <li key={lead.id}>
                  <button
                    onClick={() => setOpenLead(lead.id)}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-slate-50"
                  >
                    <Avatar name={lead.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{lead.name}</p>
                        <TempBadge temperature={analysis.temperature} />
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {analysis.recommendedAction} · {relativeTime(analysis.lastInteraction)}
                      </p>
                    </div>
                    <span className="num text-sm font-bold text-ink">{formatBRLShort(lead.value)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <RecoverModal leadId={openLead} onClose={() => setOpenLead(null)} />
    </>
  );
}
