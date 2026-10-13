import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-card',
  secondary: 'bg-panel text-ink ring-1 ring-line-strong hover:bg-canvas',
  ghost: 'text-ink-soft hover:bg-canvas hover:text-ink',
  danger: 'bg-panel text-danger ring-1 ring-line-strong hover:bg-danger-soft',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('grid size-8 shrink-0 place-items-center rounded-md text-ink-soft transition-colors hover:bg-canvas hover:text-ink disabled:opacity-40', className)}
      {...props}
    />
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  className?: string;
}

export function Field({ label, required, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">*</span>
        ) : (
          <span className="text-xs font-normal text-ink-faint">(opcional)</span>
        )}
      </label>
      {children(id, error || hint ? hintId : undefined)}
      {error ? (
        <p id={hintId} className="mt-1.5 text-[13px] text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[13px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const control = 'w-full rounded-lg bg-panel px-3 text-sm text-ink ring-1 ring-line-strong outline-none transition-shadow placeholder:text-ink-faint focus:ring-2 focus:ring-accent aria-[invalid=true]:ring-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, 'h-10', className)} {...props} />;
});

/** Campo de senha com botão para mostrar/ocultar o que foi digitado. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn(control, 'h-10 pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-ink-faint hover:text-ink"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-20 py-2 leading-relaxed', className)} {...props} />;
});

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, 'h-10 pr-8', className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-xl bg-panel shadow-card ring-1 ring-line', className)}>{children}</section>;
}

export function CardHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
const TONES: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-soft ring-line',
  accent: 'bg-accent-soft text-accent ring-accent/15',
  ok: 'bg-ok-soft text-ok ring-ok/15',
  warn: 'bg-warn-soft text-warn ring-warn/20',
  danger: 'bg-danger-soft text-danger ring-danger/15',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-soft" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">{icon}</div>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-soft">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'accent', title, children, icon }: { tone?: Tone; title?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className={cn('flex gap-3 rounded-lg px-4 py-3 text-sm ring-1 ring-inset', TONES[tone])} role={tone === 'danger' ? 'alert' : undefined}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(title && 'mt-0.5', 'text-ink-soft [&_a]:font-medium [&_a]:text-accent [&_a]:underline')}>{children}</div>
      </div>
    </div>
  );
}

/** Modal com <dialog> nativo: Esc fecha e o foco fica preso. */
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn('m-auto w-[calc(100vw-2rem)] rounded-xl bg-panel p-0 text-ink shadow-pop', wide ? 'max-w-2xl' : 'max-w-md')}
      aria-labelledby="dialog-title"
    >
      {open && (
        <>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 id="dialog-title" className="text-[15px] font-semibold">{title}</h2>
            <IconButton label="Fechar" onClick={onClose}>
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
