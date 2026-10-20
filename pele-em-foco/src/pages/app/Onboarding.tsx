import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, NotebookPen, ShieldCheck, SunMoon } from 'lucide-react';
import { Brand } from '../../components/Brand';
import { Notice, Switch } from '../../components/ui';
import { useStore } from '../../lib/store';
import { defaultPreferences } from '../../lib/storage';
import type { Preferences, SkinFeel } from '../../lib/types';

const SKIN: { value: SkinFeel; label: string }[] = [
  { value: 'oleosa', label: 'Oleosa' },
  { value: 'mista', label: 'Mista' },
  { value: 'normal', label: 'Normal' },
  { value: 'seca', label: 'Seca' },
  { value: 'nao-sei', label: 'Não sei' },
];

export function Onboarding() {
  const { data, completeOnboarding } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>({ ...defaultPreferences, ...data.preferences });

  if (data.onboardedAt) return <Navigate to="/app" replace />;

  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPrefs((p) => ({ ...p, [key]: value }));
  const finish = () => {
    completeOnboarding({ ...prefs, name: prefs.name.trim() });
    navigate('/app', { replace: true });
  };

  return (
    <main className="onboarding">
      <div className="container narrow stack-lg">
        <div className="row between">
          <Brand to="/" />
          <div className="steps-dots" aria-label={`Etapa ${step + 1} de 3`}>
            {[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}
          </div>
        </div>

        {step === 0 && (
          <section className="stack-lg" aria-labelledby="ob-1">
            <div className="stack">
              <p className="eyebrow">Bônus do e-book</p>
              <h1 id="ob-1">Seu companheiro para manter a rotina.</h1>
              <p className="lead">O guia ensina. O app ajuda você a lembrar, registrar e manter — um dia de cada vez.</p>
            </div>
            <div className="grid">
              <div className="card-flat row" style={{ alignItems: 'flex-start' }}><SunMoon aria-hidden="true" /><div><strong>Rotina de manhã e de noite</strong><p className="small muted" style={{ marginBottom: 0 }}>Checklists simples, ajustados às suas preferências.</p></div></div>
              <div className="card-flat row" style={{ alignItems: 'flex-start' }}><NotebookPen aria-hidden="true" /><div><strong>Diário da pele</strong><p className="small muted" style={{ marginBottom: 0 }}>Anotações opcionais e hábitos ao longo do tempo.</p></div></div>
              <div className="card-flat row" style={{ alignItems: 'flex-start' }}><BookOpen aria-hidden="true" /><div><strong>Biblioteca com fontes</strong><p className="small muted" style={{ marginBottom: 0 }}>Resumos dos temas do guia, com links para AAD, SBD e Ministério da Saúde.</p></div></div>
            </div>
            <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep(1)}>Começar <ArrowRight size={18} aria-hidden="true" /></button>
          </section>
        )}

        {step === 1 && (
          <section className="stack-lg" aria-labelledby="ob-2">
            <div className="stack">
              <p className="eyebrow">Antes de tudo</p>
              <h1 id="ob-2">O que este app é — e o que ele não é.</h1>
            </div>
            <div className="card stack">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <ShieldCheck aria-hidden="true" style={{ flexShrink: 0 }} />
                <div className="stack">
                  <p style={{ marginBottom: 0 }}>O Pele em Foco é <strong>educativo e de organização</strong>. Ele <strong>não faz diagnóstico</strong>, não classifica a gravidade da acne, não indica tratamento nem medicamentos e não substitui consulta com dermatologista.</p>
                  <p style={{ marginBottom: 0 }}>Acne dolorosa, persistente, que deixa manchas ou cicatrizes, ou que afeta sua autoestima, merece avaliação profissional.</p>
                </div>
              </div>
            </div>
            <Notice>
              <p><strong>Seus dados ficam neste aparelho.</strong> Não pedimos fotos do rosto nem informações de saúde. Nesta versão não há conta: tudo é salvo só no navegador que você está usando, e você pode apagar quando quiser.</p>
            </Notice>
            <label className="row" style={{ alignItems: 'flex-start', cursor: 'pointer', fontWeight: 400 }}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ width: 20, height: 20, marginTop: 3, accentColor: 'var(--color-primary)' }} />
              <span>Entendi que o app é educativo e não substitui avaliação médica.</span>
            </label>
            <div className="row between">
              <button className="btn btn-ghost" onClick={() => setStep(0)}><ArrowLeft size={18} aria-hidden="true" /> Voltar</button>
              <button className="btn btn-primary btn-lg" disabled={!accepted} onClick={() => setStep(2)}>Continuar <ArrowRight size={18} aria-hidden="true" /></button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="stack-lg" aria-labelledby="ob-3">
            <div className="stack">
              <p className="eyebrow">Preferências</p>
              <h1 id="ob-3">Vamos montar sua rotina básica.</h1>
              <p className="muted">Tudo é opcional e pode ser mudado depois em Perfil.</p>
            </div>
            <div className="field">
              <label htmlFor="name">Como prefere ser chamado(a)? <span className="muted small">(opcional)</span></label>
              <input id="name" className="input" value={prefs.name} maxLength={40} autoComplete="nickname" onChange={(e) => set('name', e.target.value)} />
            </div>
            <fieldset>
              <legend>Como você sente sua pele no dia a dia?</legend>
              <div className="option-grid">
                {SKIN.map((o) => (
                  <label key={o.value} className="option">
                    <input type="radio" name="skin" value={o.value} checked={prefs.skinFeel === o.value} onChange={() => set('skinFeel', o.value)} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
              <p className="xs muted" style={{ marginTop: 'var(--space-2)' }}>É só uma percepção sua, para personalizar dicas. Não é uma classificação médica.</p>
            </fieldset>
            <div className="card-flat" style={{ paddingBlock: 'var(--space-2)' }}>
              <Switch id="makeup" label="Uso maquiagem" description="Inclui “remover maquiagem” na rotina da noite." checked={prefs.usesMakeup} onChange={(v) => set('usesMakeup', v)} />
              <Switch id="shave" label="Faço barba" description="Inclui um lembrete de barbear com cuidado." checked={prefs.shaves} onChange={(v) => set('shaves', v)} />
              <Switch id="treat" label="Uso um tratamento indicado por profissional" description="Inclui o passo “tratamento indicado” à noite." checked={prefs.hasTreatment} onChange={(v) => set('hasTreatment', v)} />
            </div>
            <div className="row between">
              <button className="btn btn-ghost" onClick={() => setStep(1)}><ArrowLeft size={18} aria-hidden="true" /> Voltar</button>
              <button className="btn btn-primary btn-lg" onClick={finish}>Criar minha rotina</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
