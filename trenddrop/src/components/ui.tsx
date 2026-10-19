import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'supplier';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-2 font-semibold shadow-[0_0_0_1px_rgba(74,222,128,.35),0_8px_24px_-12px_rgba(34,197,94,.6)]',
  secondary: 'bg-surface-3 text-ink hover:bg-line-strong border border-line-strong',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-3',
  danger: 'bg-down/10 text-down hover:bg-down/20 border border-down/30',
  supplier:
    'bg-gradient-to-r from-brand to-emerald-400 text-brand-ink font-bold tracking-wide uppercase hover:brightness-110 shadow-[0_8px_28px_-10px_rgba(34,197,94,.75)]',
};
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-sm gap-2',
  icon: 'h-9 w-9 justify-center',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex items-center rounded-lg transition-all duration-150 select-none whitespace-nowrap active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {icon}
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = 'neutral' | 'green' | 'red' | 'amber' | 'blue' | 'violet';
const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-2 border-line-strong',
  green: 'bg-brand/10 text-brand-2 border-brand/25',
  red: 'bg-down/10 text-down border-down/25',
  amber: 'bg-warn/10 text-warn border-warn/25',
  blue: 'bg-info/10 text-info border-info/25',
  violet: 'bg-violet-400/10 text-violet-300 border-violet-400/25',
};

export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap', TONE[tone], className)}>
      {children}
    </span>
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink-2">
      {children}
      {hint && <span className="ml-1 font-normal text-ink-3">{hint}</span>}
    </label>
  );
}

const fieldBase =
  'w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 transition-colors focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20';

export function Input({ className, prefix, suffix, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & { prefix?: ReactNode; suffix?: ReactNode }) {
  if (!prefix && !suffix) return <input className={cn(fieldBase, 'h-10', className)} {...rest} />;
  return (
    <div className={cn('relative flex items-center', className)}>
      {prefix && <span className="pointer-events-none absolute left-3 text-xs text-ink-3">{prefix}</span>}
      <input className={cn(fieldBase, 'h-10', prefix ? 'pl-9' : '', suffix ? 'pr-9' : '')} {...rest} />
      {suffix && <span className="pointer-events-none absolute right-3 text-xs text-ink-3">{suffix}</span>}
    </div>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, 'h-10 appearance-none bg-[length:12px] bg-[right_.75rem_center] bg-no-repeat pr-8', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236f7a75' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldBase, 'min-h-20 py-2', props.className)} />;
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2 select-none">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-line-strong')}
      >
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      {label}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
            value === o.value ? 'bg-surface-3 text-ink shadow-sm ring-1 ring-line-strong' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-in', className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <div className="mt-1 max-w-md text-sm text-ink-3">{description}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-down/25 bg-down/5 p-4 text-sm', className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-down" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">Não foi possível carregar</p>
        <p className="mt-0.5 text-ink-2">{(error as Error)?.message ?? 'Erro desconhecido.'}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
        </Button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line-strong bg-surface shadow-2xl animate-fade-in sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[11px] font-semibold tracking-[.14em] text-brand-2 uppercase">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Notice({ tone = 'blue', icon, children, className }: { tone?: 'blue' | 'amber' | 'green' | 'red'; icon?: ReactNode; children: ReactNode; className?: string }) {
  const map = {
    blue: 'border-info/25 bg-info/5 text-ink-2',
    amber: 'border-warn/25 bg-warn/5 text-ink-2',
    green: 'border-brand/25 bg-brand/5 text-ink-2',
    red: 'border-down/25 bg-down/5 text-ink-2',
  };
  return <div className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm', map[tone], className)}>{icon && <span className="mt-0.5 shrink-0">{icon}</span>}<div className="min-w-0">{children}</div></div>;
}
