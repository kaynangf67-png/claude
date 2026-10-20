import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, Check, Info, Settings2 } from 'lucide-react';
import type { RoutineStep } from '../lib/types';

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'alert' | 'config'; children: ReactNode }) {
  const Icon = tone === 'alert' ? AlertTriangle : tone === 'config' ? Settings2 : Info;
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

export function StepChecklist({ steps, done, onToggle }: { steps: RoutineStep[]; done: string[]; onToggle: (id: string) => void }) {
  if (steps.length === 0) return <p className="muted small">Nenhum passo ativo. Ajuste sua rotina em “Personalizar”.</p>;
  return (
    <ul className="checklist">
      {steps.map((s) => {
        const checked = done.includes(s.id);
        return (
          <li key={s.id}>
            <button type="button" role="checkbox" aria-checked={checked} className="check" onClick={() => onToggle(s.id)}>
              <span className="check-box" aria-hidden="true">{checked && <Check size={16} strokeWidth={3} />}</span>
              <span>
                <span className="check-label">{s.label}</span>
                {s.hint && <span className="check-hint">{s.hint}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Switch({ id, label, description, checked, onChange }: { id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="switch-row">
      <label htmlFor={id} style={{ cursor: 'pointer' }}>
        <span style={{ display: 'block' }}>{label}</span>
        {description && <span className="small muted" style={{ fontWeight: 400 }}>{description}</span>}
      </label>
      <span className="switch">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span aria-hidden="true" />
      </span>
    </div>
  );
}

export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
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
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
