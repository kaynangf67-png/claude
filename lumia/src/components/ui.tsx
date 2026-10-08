import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { InterpretationStatus } from '@/types/content';
import { STATUS_LABEL } from '@/types/content';

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const STATUS_CLASS: Record<InterpretationStatus | 'PLANNED' | 'NOT_AVAILABLE', string> = {
  AI_GENERATED: 'chip-libras',
  REVIEW_REQUIRED: 'chip-warn',
  HUMAN_VERIFIED: 'chip-ok',
  PUBLISHED: 'chip-ok',
  PLANNED: 'chip-mock',
  NOT_AVAILABLE: 'chip-mock',
};

export function StatusChip({ status }: { status: InterpretationStatus | 'PLANNED' | 'NOT_AVAILABLE' }) {
  const label = status === 'PLANNED' ? 'Planejado' : status === 'NOT_AVAILABLE' ? 'Indisponível' : STATUS_LABEL[status];
  return <span className={`chip ${STATUS_CLASS[status]}`}>{label}</span>;
}

export function MockChip({ children = 'Simulado (mock)' }: { children?: ReactNode }) {
  return (
    <span className="chip chip-mock" title="Dados simulados — a integração real com IA ainda não existe neste protótipo.">
      {children}
    </span>
  );
}

export const DISCLAIMER =
  'Protótipo experimental de acessibilidade. A interpretação automática pode conter erros. Conteúdos publicados como interpretação validada deverão passar por revisão linguística adequada.';

export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <p className={`disclaimer ${className}`}>
      <AlertTriangle size={15} />
      <span>{DISCLAIMER}</span>
    </p>
  );
}

export function Maturity({ r }: { r: string }) {
  return (
    <span className="maturity" data-r={r} title={r === 'L' ? 'Livre para todos os públicos' : `Não recomendado para menores de ${r} anos`}>
      {r}
    </span>
  );
}
