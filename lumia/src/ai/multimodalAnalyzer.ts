/**
 * AI MULTIMODAL MOVIE ANALYZER
 *
 * Entrada (futura): VIDEO + AUDIO + TRANSCRIPT + TIMECODES + SCENE INFORMATION
 * Saída: SceneAnalysis (cenas, personagens, eventos visuais, sons, regiões
 * importantes do quadro) → base do SCENE UNDERSTANDING.
 *
 * Perguntas que o analisador responde para cada instante:
 *   1. Quem está falando?            6. Existem sons importantes?
 *   2. O que está sendo falado?      7. Existe música relevante?
 *   3. Onde a pessoa está?           8. Existe uma mudança de cena?
 *   4. O que está acontecendo?       9. Existe ação importante que o diálogo não explica?
 *   5. Qual é a emoção?             10. Qual é o contexto da conversa?
 *
 * TODO: FUTURE AI INTEGRATION — o que deve ser conectado aqui:
 *   - detecção de cortes/cenas (shot boundary detection) sobre o vídeo;
 *   - modelo visão-linguagem amostrando quadros (ex.: 1–2 fps) para descrever
 *     ambiente, ações e texto na tela (OCR);
 *   - classificador de eventos sonoros (porta, telefone, sirene, tiro, choro,
 *     risada, gritos, passos, campainha, música, silêncio repentino…);
 *   - detecção/rastreamento de rostos → regiões que o intérprete não deve cobrir;
 *   - fusão temporal de tudo acima no formato SceneAnalysis.
 *   Esse processamento roda no backend (GPU), uma vez por título, e o resultado
 *   é versionado junto da interpretação. NESTE PROTÓTIPO, a análise vem de
 *   data/demoSceneAnalysis.ts (escrita à mão) + WebVTT de sons — está marcado
 *   na UI como "pré-processado (mock)".
 */
import type { SceneAnalysis, SceneSegment, SceneUnderstanding, SoundEvent, SoundType, TimedCue } from './types';
import { SCENE_ANALYSES } from '@/data/demoSceneAnalysis';
import { splitSoundCue } from './speechEngine';

const HIGH: SoundType[] = ['DOOR_SLAM', 'PHONE_RING', 'SUDDEN_SILENCE', 'KNOCK', 'GUNSHOT', 'EXPLOSION', 'SIREN', 'SCREAM', 'DOORBELL'];
const LOW: SoundType[] = ['RAIN', 'FOOTSTEPS', 'HEARTBEAT_BASS', 'CLICK', 'MUSIC_SOFT', 'IMPACT'];

export function soundEventsFromCues(cues: TimedCue[]): SoundEvent[] {
  return cues.map((c) => {
    const { code, label } = splitSoundCue(c.text);
    const type = (code ?? 'NOISE') as SoundType;
    return {
      id: c.id,
      start: c.start,
      end: c.end,
      type,
      label,
      importance: HIGH.includes(type) ? 'high' : LOW.includes(type) ? 'low' : 'medium',
    };
  });
}

export function analyzeContent(contentId: string, soundCues: TimedCue[]): SceneAnalysis {
  const base = SCENE_ANALYSES[contentId];
  if (!base) {
    // Sem análise: devolvemos um esqueleto honesto em vez de inventar dados.
    return {
      contentId,
      producedBy: { engine: 'none', mode: 'pre-processed-mock', note: 'Nenhuma análise disponível para este título.' },
      characters: [],
      scenes: [],
      visualEvents: [],
      regions: [],
      sounds: soundEventsFromCues(soundCues),
    };
  }
  return { ...base, sounds: soundEventsFromCues(soundCues) };
}

export function sceneAt(analysis: SceneAnalysis, t: number): SceneSegment | undefined {
  return analysis.scenes.find((s) => t >= s.start && t < s.end) ?? analysis.scenes[analysis.scenes.length - 1];
}

/** SCENE UNDERSTANDING em um instante — o painel "Análise da cena" do player. */
export function understandingAt(analysis: SceneAnalysis, dialogue: TimedCue[], t: number, speakerOf: (cue: TimedCue) => { speaker: string | null; listener: string | null }, emotionAt: (t: number) => SceneUnderstanding['emotion']): SceneUnderstanding {
  const scene = sceneAt(analysis, t);
  const cue = dialogue.find((c) => t >= c.start && t < c.end) ?? null;
  const sounds = analysis.sounds.filter((s) => t >= s.start && t < s.end && s.type !== 'MUSIC_TENSE' && s.type !== 'MUSIC_SOFT');
  const music = analysis.sounds.find((s) => t >= s.start && t < s.end && (s.type === 'MUSIC_TENSE' || s.type === 'MUSIC_SOFT'));
  const visual = analysis.visualEvents.filter((v) => t >= v.t && t < v.end).pop();
  const who = cue ? speakerOf(cue) : { speaker: null, listener: null };
  return {
    time: t,
    sceneId: scene?.id ?? '—',
    sceneChanged: scene ? t - scene.start < 1.2 && scene.start > 0 : false,
    speaker: who.speaker,
    listener: who.listener,
    emotion: emotionAt(t),
    environment: scene?.environment ?? '—',
    location: scene?.location ?? '—',
    sound: sounds.length ? sounds.map((s) => s.type).join(' + ') : null,
    music: music ? music.type : null,
    visual_event: visual?.code ?? null,
    dialogue: cue ? cue.text : null,
    context: scene?.context ?? '—',
  };
}
