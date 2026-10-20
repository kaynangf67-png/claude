import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';
import { ProgressBar, Spinner, useFlash } from '../../components/ui';
import { RequireAccess } from '../../components/guards';
import { useBackend } from '../../app/session';
import { useAsync } from '../../app/useAsync';
import { addDays, diffDays, formatFullDate, todayKey } from '../../lib/dates';
import { dayProgress, isDone, PERIOD_LABEL, stepsFor } from '../../lib/routine';
import type { Period, RoutineCompletion } from '../../services/types';

const MAX_BACK = 30;

function RoutineInner() {
  const { data } = useBackend();
  const today = todayKey();
  const [params, setParams] = useSearchParams();
  const initial: Period = params.get('periodo') === 'noite' || (!params.get('periodo') && new Date().getHours() >= 17) ? 'noite' : 'manha';
  const [period, setPeriod] = useState<Period>(initial);
  const [date, setDate] = useState(today);
  const [pending, setPending] = useState<string | null>(null);
  const flash = useFlash();

  const state = useAsync(() => data.listCompletions(date, date), [data, date]);
  const completions = state.data ?? [];
  const p = dayProgress(completions, date, period);
  const all = dayProgress(completions, date);

  const choose = (next: Period) => {
    setPeriod(next);
    setParams({ periodo: next }, { replace: true });
  };

  const toggle = async (stepKey: string, label: string) => {
    const done = !isDone(completions, date, period, stepKey);
    const id = `${period}:${stepKey}`;
    const previous = completions;
    const next: RoutineCompletion[] = done
      ? [...completions, { completedOn: date, period, stepKey }]
      : completions.filter((c) => !(c.period === period && c.stepKey === stepKey));
    state.setData(next); // atualização otimista
    setPending(id);
    try {
      await data.setCompletion(date, period, stepKey, done);
      flash.show(done ? `“${label}” marcado. Salvo.` : `“${label}” desmarcado. Salvo.`);
    } catch (e) {
      state.setData(previous);
      flash.show(e instanceof Error ? e.message : 'Não foi possível salvar.', 'error');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="stack-lg">
      <header className="page-title">
        <p className="eyebrow">Minha rotina</p>
        <h1>Cuidados de hoje</h1>
        <p>Marque o que você fez. Toque de novo para desfazer.</p>
      </header>

      <div className="row between card-flat date-nav">
        <button className="btn btn-ghost" aria-label="Dia anterior" onClick={() => setDate(addDays(date, -1))} disabled={diffDays(date, today) >= MAX_BACK}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <strong aria-live="polite">{date === today ? 'Hoje' : formatFullDate(date)}</strong>
        <button className="btn btn-ghost" aria-label="Próximo dia" onClick={() => setDate(addDays(date, 1))} disabled={date === today}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="tabs" role="tablist" aria-label="Período">
        {(['manha', 'noite'] as Period[]).map((key) => {
          const kp = dayProgress(completions, date, key);
          return (
            <button key={key} id={`tab-${key}`} role="tab" aria-selected={period === key} aria-controls="painel-rotina" onClick={() => choose(key)}>
              {key === 'manha' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />} {PERIOD_LABEL[key]}
              <span className="tab-count">{kp.done}/{kp.total}</span>
            </button>
          );
        })}
      </div>

      <section id="painel-rotina" role="tabpanel" aria-labelledby={`tab-${period}`} className="card stack">
        {state.loading && !state.data ? (
          <Spinner />
        ) : state.error ? (
          <p className="field-error" role="alert">{state.error}</p>
        ) : (
          <>
            <div className="row between">
              <strong>{PERIOD_LABEL[period]}</strong>
              <span className="small muted">{p.done} de {p.total}</span>
            </div>
            <ProgressBar value={p.done} total={p.total} label={`Progresso da ${PERIOD_LABEL[period].toLowerCase()}`} />
            <ul className="checklist">
              {stepsFor(period).map((s) => {
                const checked = isDone(completions, date, period, s.key);
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      className="check"
                      disabled={pending === `${period}:${s.key}`}
                      onClick={() => void toggle(s.key, s.label)}
                    >
                      <span className="check-box" aria-hidden="true">{checked && <Check size={16} strokeWidth={3} />}</span>
                      <span>
                        <span className="check-label">{s.label}</span>
                        <span className="check-hint">{s.hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {all.done === 0 && <p className="small muted" style={{ marginBottom: 0 }}>Nenhum passo marcado {date === today ? 'hoje' : 'neste dia'} ainda. Comece pelo primeiro.</p>}
            {p.complete && <p className="small" style={{ marginBottom: 0 }}><Check size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Rotina da {PERIOD_LABEL[period].toLowerCase()} completa.</p>}
          </>
        )}
        {flash.node}
      </section>

      <section className="card-beige stack">
        <h2 className="h3" style={{ fontSize: 'var(--text-md)' }}>Lembretes</h2>
        <ul className="small" style={{ marginBottom: 0, paddingLeft: '1.2rem' }}>
          <li>Esta lista organiza hábitos básicos. Completar os passos não garante melhora da acne — cada pele responde de um jeito.</li>
          <li>Se um profissional indicou um tratamento, siga a orientação dele sobre horário e frequência.</li>
          <li>Ardor forte, vermelhidão intensa ou descamação excessiva: suspenda o produto novo e procure orientação.</li>
        </ul>
      </section>
    </div>
  );
}

export function Routine() {
  return <RequireAccess><RoutineInner /></RequireAccess>;
}
