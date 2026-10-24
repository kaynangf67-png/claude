import type { FieldStatus, MarketplaceId } from '@vendora/shared';
import { Check, Copy, Info, Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { copyText, MARKETPLACE_STYLE } from '../lib/format';
import { useToast } from '../lib/toast';

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-display text-[17px] font-bold tracking-tight text-ink-950">
      <span className="grid size-8 place-items-center rounded-lg bg-accent">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path d="M9 10l7 13 7-13" fill="none" stroke="#0f1402" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      Vendora <span className="font-medium text-ink-500">AI</span>
    </Link>
  );
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden />;
}

export function MarketplaceChip({ id }: { id: MarketplaceId }) {
  const s = MARKETPLACE_STYLE[id];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.chip}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const STATUS_STYLE: Record<FieldStatus, { label: string; cls: string; hint: string }> = {
  confirmed: {
    label: 'Confirmado',
    cls: 'bg-emerald-400/10 text-emerald-200 border-emerald-400/30',
    hint: 'Veio de dados estruturados ou da API oficial do marketplace.',
  },
  inferred: {
    label: 'A confirmar',
    cls: 'bg-amber-400/10 text-amber-200 border-amber-400/30',
    hint: 'Identificado pela IA nas fotos (ou em metadados genéricos). Confirme antes de publicar.',
  },
  user: { label: 'Informado por você', cls: 'bg-blue-400/10 text-blue-200 border-blue-400/30', hint: 'Preenchido ou corrigido por você.' },
  missing: { label: 'Não encontrado', cls: 'bg-ink-100 text-ink-500 border-ink-200', hint: 'Este dado não estava disponível.' },
};

export function FieldStatusBadge({ status }: { status: FieldStatus | undefined }) {
  const s = STATUS_STYLE[status ?? 'missing'];
  return (
    <span title={s.hint} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        try {
          await copyText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          toast('error', 'Não foi possível copiar. Selecione o texto e copie manualmente.');
        }
      }}
    >
      {done ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
      {done ? 'Copiado' : label}
    </button>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-2 max-w-md text-sm text-ink-500">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error'; children: ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-red-400/30 bg-red-400/10 text-red-200'
      : tone === 'warning'
        ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
        : 'border-blue-400/30 bg-blue-400/10 text-blue-200';
  return (
    <div className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm ${cls}`} role={tone === 'error' ? 'alert' : undefined}>
      <Info className="mt-0.5 size-4 shrink-0 opacity-70" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink-100 ${className}`} />;
}
