/**
 * Painéis "Análise da cena" (SCENE UNDERSTANDING) e "Interpretação em Libras"
 * — tornam visível o que a IA considerou em cada instante.
 */
import { Brain, Hand } from 'lucide-react';
import type { PipelineResult } from '@/ai/interpretationPipeline';
import { understandingAt } from '@/ai/multimodalAnalyzer';
import { EMOTION_LABEL } from '@/ai/types';
import { activeSignAt, segmentAt } from '@/avatar/timelineEngine';
import { EXPRESSION_LABEL } from '@/avatar/expressionEngine';
import { formatGloss } from '@/ai/librasEngine';
import { MockChip, StatusChip } from './ui';

export function SceneInsight({ pipeline, t }: { pipeline: PipelineResult | null; t: number }) {
  if (!pipeline) {
    return (
      <section className="wpanel" aria-label="Análise da cena">
        <div className="wpanel-head">
          <h3>
            <Brain size={17} /> Análise da cena
          </h3>
        </div>
        <p className="muted">Preparando a análise…</p>
      </section>
    );
  }
  const { analysis, dialogue, timeline, speakerByCue } = pipeline;
  const nameOf = (id: string | null) => (id ? analysis.characters.find((c) => c.id === id)?.name.toUpperCase() ?? id : null);
  const u = understandingAt(
    analysis,
    dialogue,
    t,
    (cue) => ({ speaker: nameOf(speakerByCue[cue.id]?.speakerId ?? null), listener: nameOf(speakerByCue[cue.id]?.listenerId ?? null) }),
    (tt) => segmentAt(timeline, tt, 0.4)?.context.emotion.emotion ?? analysis.scenes.find((s) => tt >= s.start && tt < s.end)?.mood ?? 'neutral',
  );
  const seg = segmentAt(timeline, t, 0.4);
  const rows: Array<[string, string | null, boolean?]> = [
    ['speaker', u.speaker, true],
    ['listener', u.listener],
    ['emotion', `${u.emotion.toUpperCase()} (${EMOTION_LABEL[u.emotion]})`, u.emotion !== 'neutral'],
    ['environment', u.environment],
    ['location', u.location],
    ['sound', u.sound, true],
    ['music', u.music],
    ['visual_event', u.visual_event, true],
    ['dialogue', u.dialogue ? `"${u.dialogue}"` : null, true],
    ['context', seg?.context.context ?? u.context],
    ['scene_change', u.sceneChanged ? `SIM → ${u.sceneId}` : 'não'],
  ];
  return (
    <section className="wpanel" aria-label="Análise da cena">
      <div className="wpanel-head">
        <h3>
          <Brain size={17} /> Análise da cena
        </h3>
        <MockChip>Análise pré-processada (mock)</MockChip>
      </div>
      <div className="scene-json" aria-live="off">
        <div className="k">SCENE {u.sceneId}:</div>
        {rows.map(([k, v, hl]) => (
          <div key={k}>
            <span className="k">{k}: </span>
            <span className={`v ${v === null ? 'null' : hl ? 'hl' : ''}`}>{v ?? 'null'}</span>
          </div>
        ))}
      </div>
      {seg && (
        <ul className="note-list">
          {seg.context.emotion.evidence.slice(0, 3).map((e) => (
            <li key={e}>Emoção — {e}</li>
          ))}
          <li>
            Falante — {seg.context.speaker.method === 'transcript-voice-tag' ? 'tag de voz do WebVTT' : seg.context.speaker.method === 'visual-context' ? 'contexto visual' : 'não identificado'} ({Math.round(seg.context.speaker.confidence * 100)}%)
          </li>
        </ul>
      )}
    </section>
  );
}

export function LibrasPanel({ pipeline, t, librasOn }: { pipeline: PipelineResult | null; t: number; librasOn: boolean }) {
  const seg = pipeline ? segmentAt(pipeline.timeline, t, 0.6) : undefined;
  const sign = pipeline ? activeSignAt(pipeline.timeline, t) : undefined;
  const signs = pipeline && seg ? pipeline.timeline.signs.filter((s) => s.segmentIndex === pipeline.timeline.segments.indexOf(seg)) : [];
  return (
    <section className="wpanel" aria-label="Interpretação em Libras">
      <div className="wpanel-head">
        <h3>
          <Hand size={17} /> Interpretação em Libras
        </h3>
        {seg && <StatusChip status={seg.status} />}
      </div>
      {!librasOn && <p className="muted" style={{ marginTop: 0 }}>Ative 🤟 Libras no player para ver o intérprete. A representação abaixo continua visível.</p>}
      {seg ? (
        <>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {seg.unit.kind === 'dialogue' ? 'Fala' : seg.unit.kind === 'sound' ? 'Som' : seg.unit.kind === 'text' ? 'Texto na tela' : 'Evento visual'}: {seg.unit.text}
          </div>
          <div className="gloss-box" aria-live="off">
            {signs.map((s) => (
              <span key={s.index} className={`tok ${sign?.index === s.index ? 'on' : t > s.end ? 'done' : ''}`}>
                {s.token.kind === 'fingerspell' ? s.token.letters?.split('').join('-') : s.token.gloss}
                {s.token.markers.length > 0 && <sup>{s.token.markers.join(',')}</sup>}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <span className="chip">Estrutura: {seg.representation.structure}</span>
            <span className="chip">Expressão: {EXPRESSION_LABEL[seg.representation.expression]}</span>
            <span className="chip">Intensidade {Math.round(seg.representation.intensity * 100)}%</span>
            {seg.representation.roleShift && <span className="chip chip-libras">Incorporação: {seg.representation.roleShift}</span>}
            {seg.speedFactor > 1.01 && <span className="chip chip-warn">ritmo {seg.speedFactor.toFixed(2)}×</span>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
            <span className="muted">Confiança do controle de qualidade</span>
            <strong>{Math.round(seg.quality.confidence * 100)}%</strong>
          </div>
          <div className="meter">
            <span style={{ width: `${seg.quality.confidence * 100}%` }} />
          </div>
          <ul className="note-list">
            {seg.quality.warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
          <code style={{ display: 'block', marginTop: 10, fontSize: 11.5, color: 'var(--muted)' }}>{formatGloss(seg.representation.tokens)}</code>
        </>
      ) : (
        <p className="muted">Aguardando a próxima fala, som ou evento importante…</p>
      )}
    </section>
  );
}
