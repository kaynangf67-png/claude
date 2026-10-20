import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ExternalLink, RotateCcw, Stethoscope } from 'lucide-react';
import { CheckoutButton } from '../../components/CheckoutButton';
import { Notice, ProgressBar } from '../../components/ui';
import { LESION_ART, MARKS_ART, SKIN_ART } from '../../components/TesteIllustrations';
import { BONUS_DAYS, launch } from '../../config/launch';
import {
  buildTesteResult, emptyTeste, stepDone, steps, TESTE_ALERTS,
  type Lesion, type Marks, type Sensitivity, type SkinType, type StepId, type TesteAnswers,
} from '../../lib/teste';

function Pick({ type, name, checked, onChange, art, title, hint }: {
  type: 'radio' | 'checkbox'; name: string; checked: boolean; onChange: () => void; art?: ReactNode; title: string; hint?: string;
}) {
  return (
    <label className="pick">
      <input type={type} name={name} checked={checked} onChange={onChange} />
      <span className="pick-body">
        {art && <span aria-hidden="true">{art}</span>}
        <span className="pick-text"><strong>{title}</strong>{hint && <span className="xs muted">{hint}</span>}</span>
        <span className="pick-check" aria-hidden="true"><Check size={14} /></span>
      </span>
    </label>
  );
}

const QUESTIONS: Record<StepId, string> = {
  skin: 'Ao longo do dia, como sua pele fica?',
  lesions: 'O que mais aparece na sua pele?',
  amount: 'Quantas costumam aparecer?',
  marks: 'As espinhas deixam alguma marca?',
  sensitivity: 'Produtos novos costumam arder, coçar ou deixar a pele vermelha?',
  alerts: 'Algum destes acontece com você?',
};

function StepBody({ step, a, setA }: { step: StepId; a: TesteAnswers; setA: (f: (x: TesteAnswers) => TesteAnswers) => void }) {
  const one = <K extends keyof TesteAnswers>(k: K, v: TesteAnswers[K]) => setA((x) => ({ ...x, [k]: v }));
  switch (step) {
    case 'skin': {
      const opts: [SkinType, string, string][] = [
        ['oleosa', 'Brilhosa no rosto todo', 'Oleosidade na testa, nariz, queixo e bochechas'],
        ['mista', 'Brilhosa só no meio do rosto', 'Testa, nariz e queixo; bochechas normais'],
        ['normal', 'Nem oleosa nem seca', 'Quase sem brilho e sem repuxar'],
        ['seca', 'Seca ou repuxando', 'Às vezes descama ou fica áspera'],
      ];
      return <div className="pick-grid">{opts.map(([v, t, h]) => <Pick key={v} type="radio" name="skin" checked={a.skin === v} onChange={() => one('skin', v)} art={SKIN_ART[v]} title={t} hint={h} />)}</div>;
    }
    case 'lesions': {
      const opts: [Lesion, string, string][] = [
        ['cravos', 'Cravos', 'Pontinhos pretos ou brancos, sem inflamar'],
        ['espinhas', 'Espinhas pequenas vermelhas', 'Bolinhas avermelhadas, sem pus'],
        ['pus', 'Espinhas com pus', 'Vermelhas, com a ponta branca ou amarelada'],
        ['carocos', 'Caroços profundos', 'Grandes, doloridos, por baixo da pele'],
      ];
      const toggle = (v: Lesion) => setA((x) => ({ ...x, noLesions: false, lesions: x.lesions.includes(v) ? x.lesions.filter((l) => l !== v) : [...x.lesions, v] }));
      return (
        <>
          <p className="small muted">Marque tudo o que se parece com a sua pele.</p>
          <div className="pick-grid">
            {opts.map(([v, t, h]) => <Pick key={v} type="checkbox" name="lesions" checked={a.lesions.includes(v)} onChange={() => toggle(v)} art={LESION_ART[v]} title={t} hint={h} />)}
            <Pick type="checkbox" name="lesions" checked={a.noLesions} onChange={() => setA((x) => ({ ...x, lesions: [], noLesions: !x.noLesions, amount: null }))} art={LESION_ART.nenhuma} title="Quase nada" hint="Raramente aparece alguma" />
          </div>
        </>
      );
    }
    case 'amount': {
      const opts: [TesteAnswers['amount'] & string, string, string][] = [
        ['poucas', 'Poucas', 'Uma ou outra, de vez em quando'],
        ['varias', 'Várias', 'Quase sempre tem alguma no rosto'],
        ['muitas', 'Muitas', 'Espalhadas pelo rosto, ou também no peito e nas costas'],
      ];
      return <div className="pick-grid pick-grid-text">{opts.map(([v, t, h]) => <Pick key={v} type="radio" name="amount" checked={a.amount === v} onChange={() => one('amount', v)} title={t} hint={h} />)}</div>;
    }
    case 'marks': {
      const opts: [Marks, string, string][] = [
        ['nao', 'Não deixam', 'A pele volta ao normal'],
        ['manchas', 'Manchas', 'Planas, avermelhadas ou escuras, que demoram a sumir'],
        ['cicatrizes', 'Cicatrizes', 'Pequenos buracos ou afundamentos na pele'],
      ];
      return <div className="pick-grid">{opts.map(([v, t, h]) => <Pick key={v} type="radio" name="marks" checked={a.marks === v} onChange={() => one('marks', v)} art={MARKS_ART[v]} title={t} hint={h} />)}</div>;
    }
    case 'sensitivity': {
      const opts: [Sensitivity, string][] = [['sim', 'Sim, com frequência'], ['as-vezes', 'Às vezes'], ['nao', 'Não']];
      return <div className="pick-grid pick-grid-text">{opts.map(([v, t]) => <Pick key={v} type="radio" name="sensitivity" checked={a.sensitivity === v} onChange={() => one('sensitivity', v)} title={t} />)}</div>;
    }
    case 'alerts': {
      const toggle = (v: string) => setA((x) => ({ ...x, noAlerts: false, alerts: x.alerts.includes(v) ? x.alerts.filter((y) => y !== v) : [...x.alerts, v] }));
      return (
        <div className="pick-grid pick-grid-text">
          {TESTE_ALERTS.map((o) => <Pick key={o.value} type="checkbox" name="alerts" checked={a.alerts.includes(o.value)} onChange={() => toggle(o.value)} title={o.label} />)}
          <Pick type="checkbox" name="alerts" checked={a.noAlerts} onChange={() => setA((x) => ({ ...x, alerts: [], noAlerts: !x.noAlerts }))} title="Nenhum destes" />
        </div>
      );
    }
  }
}

const PROFILE_COPY = {
  basico: {
    title: 'Uma rotina básica e constante é o melhor começo para você.',
    text: 'Pelo que você marcou, o caminho é organizar limpeza, hidratação e protetor solar todos os dias, e dar tempo para a pele responder. Se em 2 a 3 meses não houver melhora, procure um dermatologista.',
  },
  acompanhar: {
    title: 'Comece pela rotina básica e acompanhe de perto.',
    text: 'Espinhas inflamadas com frequência costumam responder a cuidados básicos bem feitos, mas nem sempre. Organize a rotina, registre como a pele reage e, se em 6 a 8 semanas não melhorar, ou se aparecerem caroços ou marcas, procure um dermatologista.',
  },
  dermatologista: {
    title: 'O seu primeiro passo é um dermatologista.',
    text: 'Você marcou sinais que os cuidados de farmácia sozinhos não resolvem. Nesses casos o tratamento que funciona costuma precisar de receita, e começar cedo reduz o risco de marcas. Pelo SUS, a Unidade Básica de Saúde (UBS) pode encaminhar você para a dermatologia.',
  },
} as const;

function Result({ a, restart }: { a: TesteAnswers; restart: () => void }) {
  const r = buildTesteResult(a);
  const copy = PROFILE_COPY[r.profile];
  const derm = r.profile === 'dermatologista';
  return (
    <div className="stack-lg">
      <header className="stack">
        <p className="eyebrow">Seu resultado</p>
        <h1 tabIndex={-1} id="resultado">{copy.title}</h1>
        <p className="lead">{copy.text}</p>
      </header>

      {derm && (
        <section className="card-forest stack" aria-labelledby="por-que">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Stethoscope aria-hidden="true" />
            <div className="stack">
              <h2 id="por-que" className="h3">Por que procurar avaliação</h2>
              <ul className="small" style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--pf-sage-soft)' }}>
                {r.reasons.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="card stack" aria-labelledby="precisa">
        <h2 id="precisa" className="h3">{derm ? 'Enquanto isso, o básico que protege a pele' : 'O que a sua rotina precisa'}</h2>
        <ul className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>{r.needs.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      <section className="card-forest stack-lg teste-offer" aria-labelledby="oferta">
        <div className="stack">
          <p className="eyebrow" style={{ color: 'var(--pf-sage-soft)' }}>{derm ? 'Para chegar preparado(a) à consulta' : 'Para montar e manter a sua rotina'}</p>
          <h2 id="oferta">Guia Pele em Foco + {BONUS_DAYS} dias de app</h2>
          <p style={{ color: 'var(--pf-sage-soft)', marginBottom: 0 }}>
            {derm
              ? 'O guia explica os tipos de lesão, os sinais de alerta e como chegar preparado(a) à consulta. O app ajuda a registrar a evolução para mostrar ao médico. Ele não substitui o tratamento.'
              : 'O passo a passo da rotina de manhã e de noite, como ler rótulos e comparar produtos, e o que é mito. O app lembra você da rotina e guarda um diário da pele.'}
          </p>
        </div>
        <ul className="hero-points small teste-points">
          <li><Check size={16} aria-hidden="true" /> E-book em PDF, 12 capítulos + glossário</li>
          <li><Check size={16} aria-hidden="true" /> App de rotina e diário por {BONUS_DAYS} dias</li>
          <li><Check size={16} aria-hidden="true" /> {launch.refundDays} dias para pedir reembolso</li>
        </ul>
        <div className="row wrap" style={{ gap: 'var(--space-4)', alignItems: 'center' }}>
          {launch.priceLabel && <p className="price">{launch.priceLabel}</p>}
          <CheckoutButton label="Quero o guia" />
        </div>
        <Link to="/#conteudo-do-guia" className="small" style={{ color: 'var(--pf-ivory)' }}>Ver o que tem dentro do guia</Link>
      </section>

      {r.kits.length > 0 && (
        <section className="stack" aria-labelledby="kit">
          <h2 id="kit" className="h3">Opcional: um kit pronto para o seu tipo de pele</h2>
          <div className="grid grid-2">
            {r.kits.map((k) => (
              <div key={k.id} className="card-flat stack">
                <div><strong>{k.name}</strong><div className="small muted">{k.brand}</div></div>
                {k.purpose && <p className="small" style={{ marginBottom: 0 }}>{k.purpose}</p>}
                <a href={k.url} target="_blank" rel={k.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
                  Ver o kit <ExternalLink size={16} aria-hidden="true" />
                </a>
              </div>
            ))}
          </div>
          <p className="xs muted" style={{ marginBottom: 0 }}>Link de afiliado: o Pele em Foco pode receber comissão se você comprar por ele, sem custo extra para você. Confira a composição do kit na página antes de comprar.</p>
        </section>
      )}

      <Notice>
        Este teste é educativo. Ele não avalia a gravidade da acne, não faz diagnóstico e não indica tratamento. Suas respostas ficaram só no seu navegador: nada foi salvo ou enviado.
      </Notice>
      <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={restart}><RotateCcw size={16} aria-hidden="true" /> Refazer o teste</button>
    </div>
  );
}

export function Teste() {
  const [a, setA] = useState<TesteAnswers>(emptyTeste);
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const list = steps(a);
  const step = list[Math.min(i, list.length - 1)];
  const last = i >= list.length - 1;

  // Ao trocar de pergunta, volta ao topo e leva o foco ao título (teclado e leitor de tela).
  useEffect(() => {
    window.scrollTo(0, 0);
    if (done) document.getElementById('resultado')?.focus({ preventScroll: true });
    else if (i > 0) headingRef.current?.focus({ preventScroll: true });
  }, [i, done]);

  const restart = () => { setA(emptyTeste()); setI(0); setDone(false); };

  return (
    <section className="section">
      <div className="container narrow stack-lg">
        {done ? <Result a={a} restart={restart} /> : (
          <>
            <div className="stack">
              <p className="eyebrow">Teste de rotina · grátis · sem foto</p>
              <ProgressBar value={i + 1} total={list.length} label={`Pergunta ${i + 1} de ${list.length}`} />
              <p className="xs muted" style={{ marginBottom: 0 }}>Pergunta {i + 1} de {list.length}</p>
            </div>
            <div role="group" aria-labelledby="pergunta" className="stack-lg">
              <h1 ref={headingRef} id="pergunta" tabIndex={-1} className="h2" style={{ margin: 0 }}>{QUESTIONS[step]}</h1>
              <StepBody step={step} a={a} setA={setA} />
            </div>
            <div className="row between">
              {i > 0
                ? <button className="btn btn-ghost" onClick={() => setI(i - 1)}><ArrowLeft size={16} aria-hidden="true" /> Voltar</button>
                : <span />}
              <button className="btn btn-primary btn-lg" disabled={!stepDone(a, step)} onClick={() => (last ? setDone(true) : setI(i + 1))}>
                {last ? 'Ver meu resultado' : 'Continuar'} <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
            {i === 0 && <p className="xs muted">Leva cerca de 1 minuto. Não pedimos e-mail nem foto, e suas respostas não saem do seu navegador.</p>}
          </>
        )}
      </div>
    </section>
  );
}
