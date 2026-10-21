import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ExternalLink, RotateCcw, Stethoscope } from 'lucide-react';
import { Notice, ProgressBar } from '../../components/ui';
import { LESION_ART, MARKS_ART, SKIN_ART } from '../../components/TesteIllustrations';
import { AppDetails, AppOffer } from './Landing';
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

      <AppOffer
        eyebrow={derm ? 'Para acompanhar a pele até e depois da consulta' : 'Para montar e manter a sua rotina'}
        text={derm
          ? 'O diário registra como a pele está e o que você usa, para mostrar ao dermatologista. A rotina em checklist ajuda a manter os cuidados que ele indicar. O app não substitui o tratamento.'
          : 'Sua rotina de manhã e de noite em checklist, um diário para acompanhar como a pele reage, artigos com fontes e um guia para escolher produtos sem cair em promessa.'}
      />

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

      <AppDetails />
    </div>
  );
}

/** Abertura da página inicial: apresenta o problema antes do teste. */
function Intro({ onStart }: { onStart: () => void }) {
  return (
    <section className="hero">
      <div className="container narrow stack-lg">
        <p className="eyebrow">Teste grátis · 1 minuto · sem foto</p>
        <h1 className="display">Você já gastou com produto para acne <span className="italic-accent">e a pele continua igual?</span></h1>
        <p className="lead">
          Um vídeo diz que leite causa espinha, outro diz que não. Sérum, ácido, esfoliante, dica caseira com limão. Na maioria das vezes, o que falta não é
          mais um produto: é saber do que a sua pele precisa e manter uma rotina simples todos os dias.
        </p>
        <div className="card stack">
          <p style={{ margin: 0 }}><strong>Marque as imagens que parecem com a sua pele e descubra:</strong></p>
          <ul className="icon-list small" style={{ margin: 0 }}>
            <li><Check size={18} aria-hidden="true" /> o que a sua rotina precisa</li>
            <li><Check size={18} aria-hidden="true" /> que tipo de produto procurar e o que evitar</li>
            <li><Check size={18} aria-hidden="true" /> quando é hora de procurar um dermatologista</li>
          </ul>
        </div>
        <div className="row wrap" style={{ gap: 'var(--space-4)', alignItems: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={onStart}>Começar o teste <ArrowRight size={18} aria-hidden="true" /></button>
          <Link to="/conhecer" className="small">Pular e conhecer o app</Link>
        </div>
        <p className="xs muted" style={{ margin: 0 }}>
          6 perguntas. Não pedimos e-mail nem foto, e suas respostas não saem do seu navegador. Conteúdo educativo: não é diagnóstico.
        </p>
      </div>
    </section>
  );
}

export function Teste() {
  const [a, setA] = useState<TesteAnswers>(emptyTeste);
  const [i, setI] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const list = steps(a);
  const step = list[Math.min(i, list.length - 1)];
  const last = i >= list.length - 1;

  // Ao trocar de pergunta, volta ao topo e leva o foco ao título (teclado e leitor de tela).
  useEffect(() => {
    window.scrollTo(0, 0);
    if (done) document.getElementById('resultado')?.focus({ preventScroll: true });
    else if (started) headingRef.current?.focus({ preventScroll: true });
  }, [i, done, started]);

  const restart = () => { setA(emptyTeste()); setI(0); setDone(false); };

  if (!started) return <Intro onStart={() => setStarted(true)} />;

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
          </>
        )}
      </div>
    </section>
  );
}
