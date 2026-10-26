import type { ReactNode } from 'react';
import type { FilterReason, FilterRole, FilterStatus, ScenarioState } from '../core/types';

export const SCENARIO_LABEL: Record<ScenarioState, string> = {
  FAVORAVEL: 'Favorável',
  DESFAVORAVEL: 'Desfavorável',
  AGUARDAR: 'Aguardar',
  NAO_AVALIAVEL: 'Não avaliável',
};

export const STATUS_LABEL: Record<FilterStatus, string> = {
  favoravel: 'Favorável',
  desfavoravel: 'Desfavorável',
  pendente: 'Pendente',
  nao_avaliavel: 'Não avaliável',
};

export const ROLE_LABEL: Record<FilterRole, string> = {
  contexto_positivo: 'Contexto',
  nao_entrada: 'Não entrada',
  informativo: 'Informativo',
};

export const REASON_LABEL: Record<FilterReason, string> = {
  parametro_nao_definido: 'parâmetro não definido',
  criterio_nao_atendido: 'critério não atendido',
  aguardando_confirmacao: 'aguardando',
  dados_insuficientes: 'dados insuficientes',
  requer_candle_em_formacao: 'requer candle em formação',
  condicao_detectada: 'condição detectada',
  condicao_ausente: 'condição ausente',
  criterio_atendido: 'critério atendido',
  informativo: 'informativo',
};

type Tone = 'pos' | 'neg' | 'warn' | 'mute' | 'info';

const TONE_TEXT: Record<Tone, string> = {
  pos: 'text-pos', neg: 'text-neg', warn: 'text-warn', mute: 'text-muted', info: 'text-info',
};
const TONE_DOT: Record<Tone, string> = {
  pos: 'bg-pos', neg: 'bg-neg', warn: 'bg-warn', mute: 'bg-faint', info: 'bg-info',
};

export const scenarioTone = (s: ScenarioState): Tone =>
  ({ FAVORAVEL: 'pos', DESFAVORAVEL: 'neg', AGUARDAR: 'warn', NAO_AVALIAVEL: 'mute' } as const)[s];
export const statusTone = (s: FilterStatus): Tone =>
  ({ favoravel: 'pos', desfavoravel: 'neg', pendente: 'warn', nao_avaliavel: 'mute' } as const)[s];

export function Dot({ tone }: { tone: Tone }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} />;
}

/** Estado sempre com texto + ponto: a cor nunca é o único indicador. */
export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${TONE_TEXT[tone]}`}>
      <Dot tone={tone} />
      {children}
    </span>
  );
}

export function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-block whitespace-nowrap rounded border border-line px-1.5 py-px text-[11px] text-muted">
      {children}
    </span>
  );
}

export function Panel({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-surface ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-semibold tracking-wide text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Btn({
  children, onClick, variant = 'default', disabled, type = 'button', title,
}: {
  children: ReactNode; onClick?: () => void; variant?: 'default' | 'primary' | 'ghost' | 'danger';
  disabled?: boolean; type?: 'button' | 'submit'; title?: string;
}) {
  const styles = {
    default: 'border-line bg-raised hover:border-faint text-ink',
    primary: 'border-pos/60 bg-pos/15 hover:bg-pos/25 text-ink',
    ghost: 'border-transparent hover:bg-raised text-muted hover:text-ink',
    danger: 'border-neg/50 bg-neg/10 hover:bg-neg/20 text-ink',
  }[variant];
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${styles}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-muted">
      <span>{label}</span>
      {children}
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export const RISK_NOTICE =
  'Análise técnica não garante resultados. Operações de curto prazo podem resultar em perdas financeiras, inclusive do capital total. ' +
  'Esta ferramenta é informativa: não executa operações e não está conectada a nenhuma corretora.';
