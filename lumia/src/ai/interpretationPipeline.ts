/**
 * Orquestrador do pipeline de interpretação (pré-processado).
 *
 *  ● Analisando cena        → multimodalAnalyzer
 *  ● Identificando diálogo  → speechEngine (WebVTT)
 *  ● Identificando personagens → speakerEngine
 *  ● Detectando emoção      → emotionEngine
 *  ● Identificando sons     → multimodalAnalyzer (sons)
 *  ● Interpretando contexto → contextEngine
 *  ● Gerando Libras         → librasEngine
 *  ● Validando              → qualityEngine (+ revisões humanas salvas)
 *  ● Sincronizando avatar   → timelineEngine
 *
 * Todas as etapas são código real rodando no navegador. O que é SIMULADO é a
 * entrada de duas delas (análise de cena escrita à mão e plano de glosas
 * escrito à mão) — ver TODO: FUTURE AI INTEGRATION nos respectivos módulos.
 */
import type { InterpretationUnit, ReviewRecord, SceneAnalysis, SpeakerResult, TimedCue } from './types';
import type { CatalogItem, SignLanguageCode } from '@/types/content';
import { analyzeContent, sceneAt } from './multimodalAnalyzer';
import { loadTranscript, stripStageDirections } from './speechEngine';
import { identifySpeaker } from './speakerEngine';
import { classifyEmotion } from './emotionEngine';
import { buildContext } from './contextEngine';
import { represent } from './librasEngine';
import { checkQuality } from './qualityEngine';
import { buildTimeline, type InterpretationTimeline, type SegmentInput } from '@/avatar/timelineEngine';
import { INTERPRETATION_PLANS } from '@/data/demoInterpretation';
import { DEMO_TRANSCRIPTS } from '@/data/demoTranscript';

export type PipelineStage =
  | 'scene'
  | 'dialogue'
  | 'speakers'
  | 'emotion'
  | 'sounds'
  | 'context'
  | 'libras'
  | 'quality'
  | 'sync'
  | 'active';

export const STAGE_LABEL: Record<PipelineStage, string> = {
  scene: 'Analisando cena',
  dialogue: 'Identificando diálogo',
  speakers: 'Identificando personagens',
  emotion: 'Detectando emoção',
  sounds: 'Identificando sons',
  context: 'Interpretando contexto',
  libras: 'Gerando Libras',
  quality: 'Validando qualidade',
  sync: 'Sincronizando avatar',
  active: 'Interpretação ativa',
};

export const STAGES: PipelineStage[] = ['scene', 'dialogue', 'speakers', 'emotion', 'sounds', 'context', 'libras', 'quality', 'sync', 'active'];

export interface PipelineResult {
  analysis: SceneAnalysis;
  dialogue: TimedCue[];
  timeline: InterpretationTimeline;
  loci: Record<string, 'left' | 'right' | 'center'>;
  speakerByCue: Record<string, SpeakerResult>;
  elapsedMs: number;
}

export interface PipelineOptions {
  language?: SignLanguageCode;
  reviews?: Record<string, ReviewRecord>;
  onStage?: (stage: PipelineStage, detail: string) => void | Promise<void>;
}

export class PipelineUnavailableError extends Error {}

export async function runInterpretationPipeline(item: CatalogItem, opts: PipelineOptions = {}): Promise<PipelineResult> {
  const t0 = performance.now();
  const language = opts.language ?? 'pt-BR-LIBRAS';
  let waited = 0; // tempo gasto pela interface exibindo etapas — não conta como processamento
  const stage = async (s: PipelineStage, d: string) => {
    const a = performance.now();
    await opts.onStage?.(s, d);
    waited += performance.now() - a;
  };
  const sources = DEMO_TRANSCRIPTS[item.id];
  const plan = INTERPRETATION_PLANS[item.id];
  if (!sources || !plan) {
    throw new PipelineUnavailableError(`Ainda não existe interpretação pré-processada para "${item.title}".`);
  }

  await stage('scene', 'Carregando análise pré-processada (mock)');
  const [dialogueRaw, soundCues] = await Promise.all([loadTranscript(sources.dialogue), loadTranscript(sources.sounds)]);
  const analysis = analyzeContent(item.id, soundCues);

  await stage('dialogue', `${dialogueRaw.length} falas no WebVTT`);
  const dialogue = dialogueRaw;

  await stage('speakers', `${analysis.characters.map((c) => c.name).join(', ') || '—'}`);
  const speakerByCue: Record<string, SpeakerResult> = {};
  const recent: string[] = [];
  for (const cue of dialogue) {
    const r = identifySpeaker(cue, analysis.characters, sceneAt(analysis, cue.start), recent);
    speakerByCue[cue.id] = r;
    if (r.speakerId) recent.push(r.speakerId);
  }

  // Unidades de interpretação: falas + sons importantes + eventos visuais/textos do plano
  const units: InterpretationUnit[] = [];
  for (const pu of plan.units) {
    if (pu.source.kind === 'dialogue') {
      const cue = dialogue.find((c) => c.id === pu.source.id);
      if (cue) units.push({ id: cue.id, kind: 'dialogue', start: cue.start, end: cue.end, text: cue.text, cue });
    } else if (pu.source.kind === 'sound') {
      const s = analysis.sounds.find((x) => x.id === pu.source.id);
      if (s) units.push({ id: `snd-${s.id}`, kind: 'sound', start: s.start, end: s.end, text: `[${s.label}]`, sound: s });
    } else {
      const v = analysis.visualEvents.find((x) => x.id === pu.source.id);
      const [ws, we] = pu.window ?? [v?.t ?? 0, v?.end ?? 0];
      if (v) units.push({ id: `vis-${v.id}`, kind: pu.source.kind, start: ws, end: we, text: v.label, visual: v });
    }
  }
  const glossFor = (u: InterpretationUnit) => {
    const pu = plan.units.find((p) => p.source.kind === u.kind && (u.kind === 'dialogue' ? p.source.id === u.id : u.id.endsWith(`-${p.source.id}`)));
    return pu?.gloss ?? null;
  };

  await stage('emotion', 'Texto + clima da cena + sons recentes');
  const emotions = units.map((u) => classifyEmotion(u, sceneAt(analysis, u.start), analysis.sounds));

  const important = analysis.sounds.filter((s) => s.importance !== 'low');
  await stage('sounds', `${analysis.sounds.length} eventos sonoros · ${important.length} importantes`);

  await stage('context', 'Falante, ouvinte, cena e intenção');
  const contexts = units.map((u, i) => {
    const sp: SpeakerResult = u.cue ? speakerByCue[u.cue.id] : { speakerId: null, listenerId: null, confidence: 1, method: 'unknown' };
    return buildContext(u, sceneAt(analysis, u.start), sp, emotions[i]);
  });

  await stage('libras', `${units.length} unidades → representação linguística`);
  const inputs: SegmentInput[] = units.map((u, i) => {
    const review = opts.reviews?.[`${item.id}:${u.id}`];
    const unitForRep = u.kind === 'dialogue' ? { ...u, text: stripStageDirections(u.text) || u.text } : u;
    const rep = represent(unitForRep, contexts[i], review?.glossOverride ?? glossFor(u), language, review?.glossOverride ? 'human-edit' : undefined);
    rep.sourceText = u.text;
    return {
      unit: u,
      context: contexts[i],
      representation: rep,
      review,
      makeQuality: (timing) => checkQuality(rep, contexts[i], timing),
    };
  });

  await stage('quality', 'Confiança, avisos e status de revisão');
  await stage('sync', 'Agendando sinais na linha do tempo do vídeo');
  const timeline = buildTimeline(item.id, language, inputs);
  const loci = Object.fromEntries(analysis.characters.map((c) => [c.id, c.locus]));

  await stage('active', `${timeline.signs.length} sinais sincronizados`);
  return { analysis, dialogue, timeline, loci, speakerByCue, elapsedMs: performance.now() - t0 - waited };
}

/** Pipeline curto para uma frase avulsa (laboratório / ao vivo). */
export function interpretSentence(text: string, opts: { emotion?: import('./types').Emotion; speaker?: string; listener?: string; start?: number } = {}) {
  const start = opts.start ?? 0.3;
  const unit: InterpretationUnit = { id: 'lab', kind: 'dialogue', start, end: start + Math.max(1.2, text.length * 0.06), text };
  const emo = opts.emotion
    ? { emotion: opts.emotion, intensity: opts.emotion === 'neutral' ? 0.4 : 0.8, confidence: 0.9, evidence: ['contexto informado manualmente'] }
    : classifyEmotion(unit, undefined, []);
  const ctx = buildContext(unit, undefined, { speakerId: opts.speaker ?? null, listenerId: opts.listener ?? null, confidence: opts.speaker ? 0.9 : 0.3, method: opts.speaker ? 'visual-context' : 'unknown' }, emo);
  const rep = represent(unit, ctx, null);
  const timeline = buildTimeline('lab', 'pt-BR-LIBRAS', [{ unit, context: ctx, representation: rep, makeQuality: (timing) => checkQuality(rep, ctx, timing) }]);
  return { unit, context: ctx, representation: rep, timeline };
}
