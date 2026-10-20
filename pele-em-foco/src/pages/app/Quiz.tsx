import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, RotateCcw, Stethoscope } from 'lucide-react';
import { Notice } from '../../components/ui';
import { RequireAccess } from '../../components/guards';
import { ALERTS, buildResult, emptyAnswers, isComplete, type Oiliness, type QuizAnswers, type Sensitivity } from '../../lib/quiz';

function Choice<T extends string | boolean>({ name, legend, options, value, onChange }: {
  name: string; legend: ReactNode; options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void;
}) {
  return (
    <fieldset className="card stack">
      <legend className="quiz-legend">{legend}</legend>
      <div className="option-grid">
        {options.map((o) => (
          <label key={String(o.value)} className="option">
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const YES_NO = [{ value: true, label: 'Sim' }, { value: false, label: 'Não' }];

function QuizInner() {
  const [a, setA] = useState<QuizAnswers>(emptyAnswers);
  const [done, setDone] = useState(false);
  const set = <K extends keyof QuizAnswers>(k: K, v: QuizAnswers[K]) => setA((x) => ({ ...x, [k]: v }));
  const toggleAlert = (v: string) => set('alerts', a.alerts.includes(v) ? a.alerts.filter((x) => x !== v) : [...a.alerts, v]);

  const restart = () => {
    setA(emptyAnswers());
    setDone(false);
    window.scrollTo(0, 0);
  };

  if (done) {
    const r = buildResult(a);
    return (
      <div className="stack-lg">
        <header className="page-title">
          <p className="eyebrow">Questionário de rotina</p>
          <h1>Suas sugestões</h1>
          <p>Com base no que você percebe da sua pele. Não é uma avaliação médica.</p>
        </header>

        {r.seeDermatologist && (
          <section className="card-forest stack" aria-labelledby="derm">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <Stethoscope aria-hidden="true" />
              <div className="stack">
                <h2 id="derm" className="h3">Procure um dermatologista</h2>
                <p style={{ marginBottom: 0, color: 'var(--pf-sage-soft)' }}>
                  Você marcou um ou mais sinais que merecem avaliação profissional. Nesses casos, os tratamentos que funcionam dependem de um médico, e quanto antes, menor o risco de marcas. Os cuidados básicos abaixo continuam valendo, mas não substituem a consulta.
                </p>
                <Link to="/app/aprender/quando-procurar-dermatologista" className="btn btn-secondary" style={{ alignSelf: 'flex-start', background: 'var(--pf-ivory)' }}>
                  Como encontrar atendimento <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="produtos" className="stack">
          <h2 id="produtos" className="h3">Tipos de produto para a sua rotina</h2>
          <div className="grid grid-2">
            {r.suggestions.map((s) => (
              <div key={s.title} className="card stack">
                <h3 style={{ fontSize: 'var(--text-md)' }}>{s.title}</h3>
                <p className="small" style={{ marginBottom: 0 }}>{s.text}</p>
                {s.category && (
                  <Link to={`/app/aprender/guia-de-produtos#cat-${s.category}`} className="small row link-cue">
                    Ver no guia de produtos <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="card-beige stack" aria-labelledby="habitos">
          <h2 id="habitos" className="h3">Hábitos que ajudam</h2>
          <ul className="small" style={{ marginBottom: 0, paddingLeft: '1.2rem' }}>
            {r.habits.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </section>

        <Notice>
          Estas sugestões são gerais e educativas. Elas não avaliam a gravidade da sua acne nem indicam tratamento. Suas respostas não foram salvas.
        </Notice>

        <div className="row wrap">
          <Link to="/app/rotina" className="btn btn-primary">Ir para minha rotina</Link>
          <button className="btn btn-ghost" onClick={restart}><RotateCcw size={16} aria-hidden="true" /> Refazer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <Link to="/app/aprender" className="btn btn-ghost" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
        <ArrowLeft size={18} aria-hidden="true" /> Aprender
      </Link>
      <header className="page-title">
        <p className="eyebrow">Questionário de rotina</p>
        <h1>Que tipo de produto combina com a sua rotina?</h1>
        <p>6 perguntas sobre o que você percebe no dia a dia. Não usa foto, não faz diagnóstico e não salva suas respostas.</p>
      </header>

      <Choice<Oiliness>
        name="oleosidade" legend="1. Ao longo do dia, sua pele costuma ficar…" value={a.oiliness} onChange={(v) => set('oiliness', v)}
        options={[
          { value: 'rosto-todo', label: 'Brilhosa no rosto todo' },
          { value: 'zona-t', label: 'Brilhosa só na testa, nariz e queixo' },
          { value: 'equilibrada', label: 'Nem oleosa nem seca' },
          { value: 'seca', label: 'Seca ou repuxando' },
        ]}
      />
      <Choice<Sensitivity>
        name="sensibilidade" legend="2. Produtos novos costumam arder, coçar ou deixar a pele vermelha?" value={a.sensitivity} onChange={(v) => set('sensitivity', v)}
        options={[{ value: 'sim', label: 'Sim' }, { value: 'as-vezes', label: 'Às vezes' }, { value: 'nao', label: 'Não' }]}
      />
      <Choice<boolean> name="maquiagem" legend="3. Você usa maquiagem com frequência?" value={a.makeup} onChange={(v) => set('makeup', v)} options={YES_NO} />
      <Choice<boolean> name="suor" legend="4. Sua rotina tem muito suor ou atrito no rosto (treino, calor, capacete, boné, máscara)?" value={a.sweat} onChange={(v) => set('sweat', v)} options={YES_NO} />
      <Choice<boolean> name="barba" legend="5. Você faz barba?" value={a.shaves} onChange={(v) => set('shaves', v)} options={YES_NO} />

      <fieldset className="card stack">
        <legend className="quiz-legend">6. Algum destes acontece com você? <span className="muted small">(marque quantos quiser, ou nenhum)</span></legend>
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {ALERTS.map((o) => (
            <label key={o.value} className="checkbox-row">
              <input type="checkbox" checked={a.alerts.includes(o.value)} onChange={() => toggleAlert(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button className="btn btn-primary btn-lg" disabled={!isComplete(a)} onClick={() => { setDone(true); window.scrollTo(0, 0); }}>
        Ver minhas sugestões
      </button>
      {!isComplete(a) && <p className="xs muted" style={{ marginTop: 'calc(-1 * var(--space-4))' }}>Responda as perguntas 1 a 5 para continuar.</p>}
    </div>
  );
}

export function Quiz() {
  return <RequireAccess><QuizInner /></RequireAccess>;
}
