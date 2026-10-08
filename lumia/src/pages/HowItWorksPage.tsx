import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, MicOff, Play } from 'lucide-react';
import { interpretSentence } from '@/ai/interpretationPipeline';
import { EMOTION_LABEL, type Emotion } from '@/ai/types';
import { formatGloss } from '@/ai/librasEngine';
import { MicrophoneLiveSession, speechRecognitionSupported } from '@/ai/liveInterpretation';
import { EXPRESSION_LABEL } from '@/avatar/expressionEngine';
import { Disclaimer, StatusChip } from '@/components/ui';
import { Footer } from '@/components/Footer';

const AvatarViewer = lazy(() => import('@/components/AvatarViewer'));

const ARCH: Array<[string, string, 'real' | 'mock' | 'futuro', string]> = [
  ['VÍDEO', 'HTML5 <video> · renditions 720p/360p', 'real', 'components/VideoPlayer.tsx'],
  ['ANÁLISE MULTIMODAL', 'Cenas, eventos visuais, regiões importantes', 'mock', 'ai/multimodalAnalyzer.ts'],
  ['ENTENDIMENTO DA CENA', 'SCENE UNDERSTANDING por instante', 'real', 'ai/multimodalAnalyzer.ts'],
  ['IDENTIFICAÇÃO DOS PERSONAGENS', 'Tag de voz WebVTT → contexto visual', 'real', 'ai/speakerEngine.ts'],
  ['TRANSCRIÇÃO DO DIÁLOGO', 'WebVTT sincronizado (ASR futuro)', 'real', 'ai/speechEngine.ts'],
  ['IDENTIFICAÇÃO DE SONS', 'Faixa de sons → eventos tipados', 'real', 'ai/multimodalAnalyzer.ts'],
  ['IDENTIFICAÇÃO DE EMOÇÕES', 'Regras: texto + clima + sons', 'real', 'ai/emotionEngine.ts'],
  ['CONTEXTO', 'Falante, ouvinte, intenção', 'real', 'ai/contextEngine.ts'],
  ['REPRESENTAÇÃO EM LIBRAS', 'Glosas + marcadores não manuais', 'mock', 'ai/librasEngine.ts'],
  ['VALIDAÇÃO', 'Qualidade automática + revisão humana', 'real', 'ai/qualityEngine.ts · /estudio'],
  ['ANIMAÇÃO DO AVATAR', 'IK, configurações de mão, rosto ARKit', 'real', 'avatar/animationEngine.ts'],
  ['INTERPRETAÇÃO EM TEMPO REAL', 'Sincronia por video.currentTime', 'real', 'avatar/timelineEngine.ts'],
];

const STATUS_TXT = { real: 'Implementado', mock: 'Dados simulados', futuro: 'Integração futura' };

const SPEAKERS = [
  { id: 'homem', label: 'Homem', locus: 'right' as const },
  { id: 'mulher', label: 'Mulher', locus: 'left' as const },
  { id: 'narrador', label: 'Narração', locus: 'center' as const },
];

function Lab() {
  const [text, setText] = useState('Você não deveria estar aqui.');
  const [emotion, setEmotion] = useState<Emotion>('threatening');
  const [speaker, setSpeaker] = useState('homem');
  const [res, setRes] = useState(() => interpretSentence('Você não deveria estar aqui.', { emotion: 'threatening', speaker: 'homem', listener: 'mulher' }));
  const startRef = useRef(performance.now());
  const [live, setLive] = useState(false);
  const [interim, setInterim] = useState('');
  const [liveErr, setLiveErr] = useState<string | null>(null);
  const session = useRef<MicrophoneLiveSession | null>(null);
  const [mountAvatar, setMountAvatar] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // só carrega o 3D quando o laboratório aparece na tela
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setMountAvatar(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => () => session.current?.stop(), []);

  const run = (s = text, e = emotion) => {
    const r = interpretSentence(s, { emotion: e, speaker, listener: speaker === 'homem' ? 'mulher' : 'homem' });
    setRes(r);
    startRef.current = performance.now();
  };
  const loci = useMemo(() => Object.fromEntries(SPEAKERS.map((s) => [s.id, s.locus])), []);
  const rep = res.representation;
  const seg = res.timeline.segments[0];
  // repete a frase em loop (com pausa) para quem chega ao laboratório depois
  const loopLen = (seg?.signEnd ?? 2) + 1.6;
  const labTime = () => ((performance.now() - startRef.current) / 1000) % loopLen;

  const toggleLive = () => {
    if (live) {
      session.current?.stop();
      setLive(false);
      return;
    }
    setLiveErr(null);
    const s = new MicrophoneLiveSession(
      {
        onInterim: setInterim,
        onFinal: (t, r) => {
          setInterim('');
          setText(t);
          setRes(r);
          startRef.current = performance.now();
        },
        onError: (m) => {
          setLiveErr(m);
          setLive(false);
        },
        onEnd: () => setLive(false),
      },
      undefined,
    );
    session.current = s;
    s.start('pt-BR');
    setLive(true);
  };

  return (
    <div className="split">
      <div>
        <div className="field">
          <label htmlFor="lab-text">Frase em português</label>
          <textarea id="lab-text" className="input" value={text} onChange={(e) => setText(e.target.value)} rows={2} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="lab-emo">Contexto emocional</label>
            <select id="lab-emo" className="input" value={emotion} onChange={(e) => setEmotion(e.target.value as Emotion)}>
              {(Object.keys(EMOTION_LABEL) as Emotion[]).map((k) => (
                <option key={k} value={k}>
                  {k} — {EMOTION_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="lab-spk">Quem fala</label>
            <select id="lab-spk" className="input" value={speaker} onChange={(e) => setSpeaker(e.target.value)}>
              {SPEAKERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <button className="btn btn-libras" onClick={() => run()}>
            <Play size={17} fill="currentColor" /> Interpretar
          </button>
          <button className="btn btn-ghost" onClick={toggleLive} disabled={!speechRecognitionSupported() && !live} title={speechRecognitionSupported() ? 'Usa o reconhecimento de fala do navegador' : 'Navegador sem Web Speech API'}>
            {live ? <MicOff size={17} /> : <Mic size={17} />} {live ? 'Parar ao vivo' : 'Ao vivo (microfone)'}
          </button>
        </div>
        {!speechRecognitionSupported() && <p className="muted" style={{ fontSize: 12.5 }}>Modo ao vivo indisponível neste navegador (requer Web Speech API — Chrome/Edge).</p>}
        {live && <p className="chip chip-ok" style={{ height: 'auto', padding: '6px 12px' }}>● Ouvindo… {interim && `“${interim}”`}</p>}
        {liveErr && <p className="form-error">{liveErr}</p>}

        <div className="panel" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>SIGN LANGUAGE REPRESENTATION</strong>
            {seg && <StatusChip status={seg.status} />}
          </div>
          <div className="gloss-box" style={{ fontSize: 20 }}>
            {rep.tokens.map((t, i) => (
              <span key={i} className="tok on">
                {t.kind === 'fingerspell' ? t.letters?.split('').join('-') : t.gloss}
                {t.markers.length > 0 && <sup>{t.markers.join(',')}</sup>}
              </span>
            ))}
          </div>
          <pre className="code">{`INPUT:     "${rep.sourceText}"
CONTEXT:   ${emotion} · speaker=${speaker} · listener=${speaker === 'homem' ? 'mulher' : 'homem'}
GLOSAS:    ${formatGloss(rep.tokens)}
ESTRUTURA: ${rep.structure}
EXPRESSÃO: ${EXPRESSION_LABEL[rep.expression]} · intensidade ${Math.round(rep.intensity * 100)}%
CORPO:     incorporação=${rep.roleShift ?? '—'} · espaço=${rep.signingSpace.toFixed(2)} · velocidade=${rep.speed.toFixed(2)}×
ORIGEM:    motor de regras (AI_GENERATED → controle de qualidade)`}</pre>
          <ul className="note-list">
            {rep.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {seg?.quality.warnings.map((w) => (
              <li key={w.code} style={{ color: 'var(--warn)' }}>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div ref={stageRef} className="lab-stage">
        {mountAvatar && (
          <Suspense fallback={<div className="interp-loading">Carregando intérprete 3D…</div>}>
            <AvatarViewer getTime={labTime} timeline={res.timeline} loci={loci} expressiveness={1} fpsCap={45} />
          </Suspense>
        )}
        <div className="interp-gloss">
          <span>{formatGloss(rep.tokens)}</span>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="page" id="conteudo">
      <section className="container" style={{ maxWidth: 1200 }}>
        <p className="eyebrow">Como funciona</p>
        <h1 className="serif" style={{ fontSize: 'clamp(44px,7vw,100px)', margin: '8px 0 18px', lineHeight: 0.95 }}>
          Não queremos apenas traduzir palavras.
          <br />
          <em className="gradient-text">Queremos tornar a história compreensível.</em>
        </h1>
        <p className="muted" style={{ fontSize: 19, maxWidth: 760 }}>
          Português sinalizado não é Libras. Uma boa interpretação precisa saber quem fala, com quem, em que tom, o que aconteceu antes — e o que a imagem mostra
          sem que ninguém diga.
        </p>
      </section>

      <section className="section" style={{ paddingTop: 50 }}>
        <h2 className="section-title" style={{ marginBottom: 18 }}>
          A IA analisa
        </h2>
        <div className="pillars">
          {[
            ['🎬', 'Imagem', 'Ações, ambiente, texto na tela'],
            ['🗣️', 'Diálogo', 'Transcrição sincronizada'],
            ['🔊', 'Sons', 'Eventos que mudam a cena'],
            ['😨', 'Emoções', 'Voz, palavras, clima'],
            ['👤', 'Personagens', 'Quem fala com quem'],
            ['📖', 'Contexto', 'O sentido da cena'],
          ].map(([e, t, d]) => (
            <div className="pillar" key={t}>
              <span className="em" aria-hidden>
                {e}
              </span>
              <strong>{t}</strong>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="flow">
          {[
            ['IA entende', 'Funde imagem, som, diálogo e emoção num entendimento da cena.'],
            ['IA traduz', 'Gera uma representação linguística em Libras — com gramática, não palavra por palavra.'],
            ['IA valida', 'Controle de qualidade automático e revisão de intérpretes e pessoas surdas.'],
            ['Avatar interpreta', 'Mãos, rosto, olhar e corpo, sincronizados com o vídeo.'],
          ].map(([t, d], i) => (
            <div className="flow-step" key={t}>
              <div className="n">0{i + 1}</div>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <h2 className="section-title" style={{ textAlign: 'center', marginBottom: 8 }}>
          Arquitetura do pipeline
        </h2>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 26 }}>
          Cada etapa existe no código. Onde ainda não há IA real, os dados são simulados e marcados como tal.
        </p>
        <div className="arch">
          {ARCH.map(([name, desc, st, file], i) => (
            <div key={name}>
              <div className="arch-node">
                <div>
                  <strong>{name}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {desc} · <code>{file}</code>
                  </div>
                </div>
                <span className={`chip ${st === 'real' ? 'chip-ok' : st === 'mock' ? 'chip-warn' : 'chip-mock'}`}>{STATUS_TXT[st]}</span>
              </div>
              {i < ARCH.length - 1 && <div className="arch-arrow">↓</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="split">
          <div>
            <h2 className="section-title" style={{ marginBottom: 10 }}>
              Um exemplo de cena
            </h2>
            <p className="muted">
              Uma mulher caminha. Uma porta bate atrás dela. Ela olha para trás, assustada. Um homem aparece e diz: “Você não deveria estar aqui.” O sistema não olha só
              o texto:
            </p>
            <pre className="code">{`SCENE:
  speaker:       MAN
  emotion:       THREATENING
  environment:   INDOOR
  sound:         DOOR_SLAM
  visual_event:  WOMAN_TURNS_AROUND
  dialogue:      "Você não deveria estar aqui."
  context:       THREATENING_CONFRONTATION`}</pre>
          </div>
          <div>
            <h2 className="section-title" style={{ marginBottom: 10 }}>
              Qualidade e confiança
            </h2>
            <pre className="code">{`AI TRANSLATION
      ↓
QUALITY CHECK        (confiança, avisos, ritmo)
      ↓
HUMAN VALIDATION     (intérpretes, pessoas surdas,
      ↓               especialistas, revisores)
APPROVED SIGN SEQUENCE

Status: AI GENERATED → REVIEW REQUIRED
        → HUMAN VERIFIED → PUBLISHED`}</pre>
            <p className="muted" style={{ fontSize: 14 }}>
              Nenhuma IA produz hoje interpretação perfeita em 100% dos casos. Por isso, conteúdo só é publicado como “validado” depois de revisão humana —{' '}
              <Link to="/estudio" style={{ color: 'var(--amber)' }}>
                veja o Estúdio de validação
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }} id="laboratorio">
        <p className="eyebrow">Laboratório</p>
        <h2 className="serif" style={{ fontSize: 'clamp(34px,4.5vw,60px)', margin: '6px 0 10px' }}>
          Experimente o motor de Libras
        </h2>
        <p className="muted" style={{ maxWidth: 760, marginBottom: 24 }}>
          Escreva uma frase, escolha o contexto e veja a mesma frase virar estruturas diferentes. Este laboratório usa o motor de <strong>regras</strong> (transparente e
          conservador) — sinais desconhecidos são soletrados. É uma demonstração de arquitetura, não um tradutor validado.
        </p>
        <Lab />
        <div style={{ marginTop: 20 }}>
          <Disclaimer />
        </div>
      </section>

      <section className="section manifesto" style={{ isolation: 'isolate' }}>
        <div className="glow" />
        <p className="eyebrow">LUMIA</p>
        <h2>O intérprete de IA para filmes.</h2>
        <p>Não queremos apenas traduzir o que é dito. Queremos ajudar todos a viver a história.</p>
      </section>
      <Footer />
    </main>
  );
}
