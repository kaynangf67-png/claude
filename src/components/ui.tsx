import { CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useToasts } from '../lib/store';

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-flex size-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v4h4" />
          <path d="M9 12.5l2 2 4-4.5" />
        </svg>
      </span>
      {!compact && (
        <span className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
          Recupera<span className={light ? 'text-brand-300' : 'text-brand-600'}>AI</span>
        </span>
      )}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`animate-pop-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">{title}</div>
          <button onClick={onClose} className="btn-ghost -mr-2 -mt-1 p-2" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
      {toasts.map((t) => (
        <div key={t.id} className="animate-pop-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lift">
          {t.tone === 'info' ? (
            <Info className="mt-0.5 size-5 shrink-0 text-sky-300" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-400" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs text-slate-300">{t.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>
    </div>
  );
}
