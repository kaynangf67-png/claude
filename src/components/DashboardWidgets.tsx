import { AlertTriangle, ArrowRight, MessageCircle, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatBRL, formatBRLShort } from '../lib/format';

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = 'slate',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  accent?: 'brand' | 'orange' | 'blue' | 'slate';
}) {
  const accents = {
    brand: 'bg-brand-50 text-brand-700',
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="card min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-snug text-slate-500 sm:text-sm">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${accents[accent]}`}>{icon}</span>
      </div>
      <p className="num mt-2 truncate text-xl font-extrabold tracking-tight text-ink sm:text-[28px]">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function RoiCard({
  revenue,
  recovered,
  openValue,
  planPrice = 79,
}: {
  revenue: number;
  recovered: number;
  openValue: number;
  planPrice?: number;
}) {
  const multiple = revenue / planPrice;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 p-6 text-white shadow-lift sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 right-24 size-56 rounded-full bg-brand-300/20 blur-2xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <p className="text-sm font-semibold text-brand-100">Quanto o RecuperaAI recuperou para você?</p>
          <p className="num mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{formatBRL(revenue)}</p>
          <p className="mt-3 max-w-md text-sm text-brand-50/90">
            Esse é o dinheiro que poderia ter sido perdido sem o follow-up.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 backdrop-blur-sm">
            <p className="text-xs text-brand-100">Clientes recuperados</p>
            <p className="num mt-0.5 text-2xl font-extrabold">{recovered}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 backdrop-blur-sm">
            <p className="text-xs text-brand-100">Retorno sobre o plano</p>
            <p className="num mt-0.5 text-2xl font-extrabold">
              {multiple >= 1 ? `${multiple.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}x` : '—'}
            </p>
            <p className="text-[11px] text-brand-100/80">vs. R$ {planPrice}/mês</p>
          </div>
          <Link
            to="/app/recuperar"
            className="group col-span-2 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-brand-800 transition hover:bg-brand-50"
          >
            <span>
              <span className="block text-xs font-medium text-slate-500">Ainda dá para recuperar</span>
              <span className="num text-lg font-extrabold">{formatBRLShort(openValue)}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              Recuperar <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

const FUNNEL_COLORS = ['#6ee7b7', '#10b981', '#047857'];

export function RecoveryFunnel({
  leads,
  followups,
  recovered,
  revenue,
  openValue,
}: {
  leads: number;
  followups: number;
  recovered: number;
  revenue: number;
  openValue: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = [
    { label: 'Leads identificados', value: leads, note: 'conversas com interesse de compra' },
    { label: 'Follow-ups enviados', value: followups, note: 'clientes que receberam follow-up' },
    { label: 'Clientes recuperados', value: recovered, note: 'voltaram e compraram' },
  ];
  const max = Math.max(1, leads);
  const potential = revenue + openValue;
  const revenueShare = potential > 0 ? revenue / potential : 0;

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Funil de recuperação</h2>
          <p className="text-sm text-slate-500">Do interesse à venda recuperada</p>
        </div>
        <TrendingUp className="size-5 text-brand-600" />
      </div>

      <div className="space-y-3.5">
        {rows.map((r, i) => {
          const pct = r.value / max;
          const share = leads ? Math.round((r.value / leads) * 100) : 0;
          return (
            <div
              key={r.label}
              className="relative"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${r.label}: ${r.value} (${share}% dos leads)`}
            >
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-700">{r.label}</span>
                <span className="num font-bold text-ink">
                  {r.value}
                  {i > 0 && <span className="ml-1.5 text-xs font-medium text-slate-400">{share}%</span>}
                </span>
              </div>
              <div className="h-3 rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(pct * 100, r.value ? 2 : 0)}%`, background: FUNNEL_COLORS[i] }}
                />
              </div>
              {hover === i && (
                <div className="animate-fade-in pointer-events-none absolute -top-9 right-0 z-10 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lift">
                  <span className="num font-semibold">{r.value}</span> {r.note}
                  {i > 0 && <span className="text-slate-300"> · {share}% dos leads</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span className="font-medium text-slate-700">Receita recuperada</span>
          <span className="num font-extrabold text-brand-700">{formatBRL(revenue)}</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100" title={`${Math.round(revenueShare * 100)}% do valor em oportunidades`}>
          <div className="h-3 rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${revenueShare * 100}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          <span className="num">{Math.round(revenueShare * 100)}%</span> de{' '}
          <span className="num">{formatBRLShort(potential)}</span> em oportunidades identificadas
        </p>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const steps = [
    { icon: MessageCircle, tone: 'bg-slate-100 text-slate-600', title: 'Cliente', text: 'pergunta preço no WhatsApp' },
    { icon: AlertTriangle, tone: 'bg-orange-50 text-orange-600', title: 'Oportunidade perdida', text: '“vou pensar” e some' },
    { icon: Sparkles, tone: 'bg-brand-50 text-brand-700', title: 'Follow-up com IA', text: 'mensagem natural, na hora certa' },
    { icon: Wallet, tone: 'bg-blue-50 text-blue-600', title: 'Venda recuperada', text: 'dinheiro que voltou pro caixa' },
  ];
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex items-center gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200/80">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${s.tone}`} aria-hidden>
            <s.icon className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold leading-tight text-ink">
              {i + 1}. {s.title}
            </span>
            <span className="block text-xs leading-tight text-slate-500">{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
