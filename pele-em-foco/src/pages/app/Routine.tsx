import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Moon, Plus, Sun, Trash2 } from 'lucide-react';
import { Notice, ProgressBar, StepChecklist, Switch } from '../../components/ui';
import { progress, stepsFor } from '../../lib/routine';
import { useStore } from '../../lib/store';
import type { Period } from '../../lib/types';

const LABEL: Record<Period, string> = { manha: 'Manhã', noite: 'Noite' };

export function Routine() {
  const { data, today, day, toggleStep, setStepEnabled, addCustomStep, removeStep } = useStore();
  const [params, setParams] = useSearchParams();
  const initial: Period = params.get('periodo') === 'noite' || (!params.get('periodo') && new Date().getHours() >= 17) ? 'noite' : 'manha';
  const [period, setPeriod] = useState<Period>(initial);
  const [editing, setEditing] = useState(false);
  const [newStep, setNewStep] = useState('');
  const entry = day(today);
  const p = progress(data.routine, entry, period);

  const choose = (next: Period) => {
    setPeriod(next);
    setParams({ periodo: next }, { replace: true });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!newStep.trim()) return;
    addCustomStep(period, newStep);
    setNewStep('');
  };

  return (
    <div className="stack-lg">
      <header className="page-title">
        <p className="eyebrow">Hoje</p>
        <h1>Sua rotina</h1>
        <p>Marque o que você fez. Fica salvo neste aparelho.</p>
      </header>

      <div className="row between wrap">
        <div className="tabs" role="tablist" aria-label="Período">
          {(['manha', 'noite'] as Period[]).map((key) => (
            <button key={key} role="tab" aria-selected={period === key} aria-controls="painel-rotina" onClick={() => choose(key)}>
              {key === 'manha' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />} {LABEL[key]}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          {editing ? 'Concluir' : 'Personalizar'}
        </button>
      </div>

      <section id="painel-rotina" role="tabpanel" aria-label={`Rotina da ${LABEL[period].toLowerCase()}`} className="card stack">
        {editing ? (
          <>
            <p className="small muted" style={{ marginBottom: 0 }}>Ative ou desative passos. Passos que você criou podem ser removidos.</p>
            <div>
              {data.routine.filter((s) => s.period === period).map((s) => (
                <div key={s.id} className="row" style={{ alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <Switch id={`step-${s.id}`} label={s.label} description={s.custom ? 'Passo personalizado' : s.hint} checked={s.enabled} onChange={(v) => setStepEnabled(s.id, v)} />
                  </div>
                  {s.custom && (
                    <button className="btn btn-ghost" aria-label={`Remover ${s.label}`} onClick={() => removeStep(s.id)}><Trash2 size={18} aria-hidden="true" /></button>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={submit} className="row" style={{ alignItems: 'stretch' }}>
              <label htmlFor="novo-passo" className="sr-only">Novo passo</label>
              <input id="novo-passo" className="input" placeholder="Ex.: Lavar pincéis de maquiagem" maxLength={60} value={newStep} onChange={(e) => setNewStep(e.target.value)} />
              <button className="btn btn-secondary" type="submit" disabled={!newStep.trim()}><Plus size={18} aria-hidden="true" /> Adicionar</button>
            </form>
          </>
        ) : (
          <>
            <div className="row between">
              <strong>{LABEL[period]}</strong>
              <span className="small muted">{p.done} de {p.total}</span>
            </div>
            <ProgressBar value={p.done} total={p.total} label={`Progresso da ${LABEL[period].toLowerCase()}`} />
            <StepChecklist steps={stepsFor(data.routine, period)} done={entry.done} onToggle={(id) => toggleStep(today, id)} />
            {p.complete && <Notice>Rotina da {LABEL[period].toLowerCase()} concluída. Bom trabalho.</Notice>}
          </>
        )}
      </section>

      <section className="card-beige stack">
        <h2 style={{ fontSize: 'var(--text-md)' }}>Lembretes do guia</h2>
        <ul style={{ marginBottom: 0, paddingLeft: '1.2rem' }} className="small">
          <li>Um produto novo por vez, com teste em pequena área antes.</li>
          <li>Ardor forte, vermelhidão intensa ou descamação excessiva: pare e busque orientação.</li>
          {data.preferences.hasTreatment && <li>Tratamento indicado: siga a quantidade e a frequência orientadas por quem indicou.</li>}
          <li>Dê tempo: tratamentos para acne costumam levar de 6 a 8 semanas para mostrar efeito.</li>
        </ul>
      </section>
    </div>
  );
}
