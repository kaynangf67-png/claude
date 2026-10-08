/**
 * CONTEXT ENGINE — junta cena, falante, ouvinte, emoção e sons recentes num
 * único ContextFrame por unidade de interpretação. É esse contexto que permite
 * que a mesma frase vire sinalizações diferentes (ex.: "Você não deveria estar
 * aqui." como aviso carinhoso × como ameaça).
 *
 * TODO: FUTURE AI INTEGRATION
 *   Um modelo de linguagem com memória da narrativa (quem é quem, o que já
 *   aconteceu, relações entre personagens) deve enriquecer este quadro.
 */
import type { ContextFrame, EmotionResult, InterpretationUnit, SceneSegment, SpeakerResult } from './types';
import { isWhisper } from './speechEngine';

export function buildContext(unit: InterpretationUnit, scene: SceneSegment | undefined, speaker: SpeakerResult, emotion: EmotionResult): ContextFrame {
  const whisper = isWhisper(unit.text);
  const isQ = unit.kind === 'dialogue' && unit.text.includes('?');
  const wh = /\b(o que|que|quem|onde|quando|como|por que|qual)\b/i.test(unit.text);
  const imperative = unit.kind === 'dialogue' && /\b(confia|saia|sai|corre|venha|espere|olhe|pare|cuidado)\b/i.test(unit.text);
  let context = scene?.context ?? 'UNKNOWN';
  if (unit.kind === 'dialogue') {
    if (emotion.emotion === 'threatening') context = 'THREATENING_CONFRONTATION';
    else if (emotion.emotion === 'urgent' && (imperative || /precisa/i.test(unit.text))) context = 'URGENT_WARNING';
    else if (whisper && emotion.emotion === 'fear') context = 'HIDDEN_DANGER';
    else if (isQ) context = 'SEEKING_INFORMATION';
  } else if (unit.kind === 'sound') {
    context = `SOUND_${unit.sound?.type ?? 'EVENT'}`;
  } else {
    context = `VISUAL_${unit.visual?.code ?? 'EVENT'}`;
  }
  return {
    unitId: unit.id,
    sceneId: scene?.id ?? '—',
    speaker,
    emotion,
    context,
    environment: scene ? `${scene.environment} · ${scene.location}` : '—',
    whisper,
    question: isQ ? (wh ? 'wh' : 'yn') : null,
    imperative,
  };
}
