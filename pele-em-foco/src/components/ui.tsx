import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle, Check, Eye, EyeOff, Info, Loader2, Settings2 } from 'lucide-react';

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'alert' | 'config' | 'success'; children: ReactNode }) {
  const Icon = tone === 'alert' ? AlertTriangle : tone === 'config' ? Settings2 : tone === 'success' ? Check : Info;
  return (
    <div className={`notice ${tone === 'info' ? '' : tone}`} role={tone === 'alert' ? 'alert' : undefined}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/** Aviso visível de configuração pendente — some quando o valor é preenchido. */
export function ConfigPending({ children }: { children: ReactNode }) {
  return (
    <Notice tone="config">
      <strong>A configurar antes do lançamento:</strong> {children}
    </Notice>
  );
}

export function ProgressBar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <Loader2 size={20} className="spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon" aria-hidden="true">{icon}</div>}
      <h2>{title}</h2>
      {children && <div className="muted small">{children}</div>}
      {action}
    </div>
  );
}

/** Mensagem de status curta (salvo / erro) anunciada a leitores de tela. */
export function useFlash(timeout = 2500) {
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (text: string, tone: 'ok' | 'error' = 'ok') => {
    window.clearTimeout(timer.current);
    setMsg({ text, tone });
    if (tone === 'ok') timer.current = window.setTimeout(() => setMsg(null), timeout);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const node = (
    <div aria-live="polite" className="flash-slot">
      {msg && <p className={`flash ${msg.tone}`} role={msg.tone === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
    </div>
  );
  return { show, clear: () => setMsg(null), node };
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

export function Field({ label, error, hint, id, type, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [error ? `${inputId}-erro` : null, hint ? `${inputId}-dica` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className={isPassword ? 'input-with-action' : undefined}>
        <input
          id={inputId}
          className={`input ${error ? 'invalid' : ''}`}
          type={isPassword && show ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {isPassword && (
          <button type="button" className="input-action" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show}>
            {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
      {hint && <span id={`${inputId}-dica`} className="xs muted">{hint}</span>}
      {error && <span id={`${inputId}-erro`} className="field-error">{error}</span>}
    </div>
  );
}

export function SubmitButton({ busy, children, busyLabel = 'Aguarde…', className = 'btn btn-primary btn-lg btn-block', disabled }: { busy: boolean; children: ReactNode; busyLabel?: string; className?: string; disabled?: boolean }) {
  return (
    <button type="submit" className={className} disabled={busy || disabled} aria-busy={busy}>
      {busy ? (<><Loader2 size={18} className="spin" aria-hidden="true" /> {busyLabel}</>) : children}
    </button>
  );
}

export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel, busy = false }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className="confirm" onCancel={onCancel} aria-labelledby="confirm-title">
      <div className="stack">
        <h2 id="confirm-title" style={{ fontSize: 'var(--text-lg)' }}>{title}</h2>
        <div className="muted">{children}</div>
        <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" aria-hidden="true" /> : null} {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
