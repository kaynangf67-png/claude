/**
 * EMOTION ENGINE — estado emocional de cada fala/evento.
 *
 * Implementado (regras transparentes, cada uma vira "evidência"):
 *   - léxico do texto (agora, precisa, rápido → urgência; sussurro → medo…);
 *   - pontuação (! e ?);
 *   - clima da cena e tensão (vindos do analisador multimodal);
 *   - sons recentes (porta batendo, batidas → medo/surpresa).
 *
 * A saída controla expressão facial, postura, intensidade e velocidade dos
 * sinais (ver avatar/expressionEngine.ts e ai/librasEngine.ts).
 *
 * TODO: FUTURE AI INTEGRATION
 *   - reconhecimento de emoção pela PROSÓDIA da voz (áudio);
 *   - reconhecimento de expressão facial dos personagens (vídeo);
 *   - modelo de linguagem para ironia/subtexto.
 */
import type { Emotion, EmotionResult, InterpretationUnit, SceneSegment, SoundEvent } from './types';
import { isWhisper } from './speechEngine';

const LEXICON: Array<[RegExp, Emotion, number, string]> = [
  [/\b(agora|rápido|depressa|precisa sair|corre|saia)\b/i, 'urgent', 0.75, 'palavras de urgência'],
  [/\bconfia\b/i, 'urgent', 0.6, 'pedido insistente'],
  [/\b(não deveria|vai se arrepender|cuidado com)\b/i, 'threatening', 0.7, 'construção de ameaça'],
  [/\b(socorro|medo|alguém na porta)\b/i, 'fear', 0.7, 'referência a perigo'],
  [/\b(obrigad[oa]|que bom|adorei|feliz|para todos|viva)\b/i, 'happy', 0.55, 'vocabulário positivo'],
  [/\b(triste|saudade|perdi|sinto muito)\b/i, 'sad', 0.6, 'vocabulário de tristeza'],
  [/\b(te amo|meu amor|querid[oa])\b/i, 'romantic', 0.6, 'vocabulário afetivo'],
  [/\b(odeio|cala a boca|chega)\b/i, 'angry', 0.65, 'vocabulário de raiva'],
  [/\b(o que aconteceu|como assim|não entendi)\b/i, 'confused', 0.6, 'busca de explicação'],
];

const SOUND_EMOTION: Partial<Record<SoundEvent['type'], [Emotion, number]>> = {
  DOOR_SLAM: ['surprise', 0.8],
  KNOCK: ['fear', 0.8],
  SUDDEN_SILENCE: ['fear', 0.65],
  GUNSHOT: ['fear', 0.95],
  EXPLOSION: ['fear', 0.95],
  SCREAM: ['fear', 0.9],
  SIREN: ['urgent', 0.7],
  PHONE_RING: ['neutral', 0.45],
  LAUGHTER: ['happy', 0.6],
  CRYING: ['sad', 0.7],
  DOOR_CREAK: ['neutral', 0.35],
};

export function classifyEmotion(unit: InterpretationUnit, scene: SceneSegment | undefined, recentSounds: SoundEvent[]): EmotionResult {
  const evidence: string[] = [];
  const scores = new Map<Emotion, number>();
  const add = (e: Emotion, v: number, why: string) => {
    scores.set(e, Math.max(scores.get(e) ?? 0, v));
    evidence.push(why);
  };
  if (unit.kind === 'sound' && unit.sound) {
    const s = SOUND_EMOTION[unit.sound.type];
    if (s) add(s[0], s[1], `som: ${unit.sound.label}`);
  }
  if (unit.kind !== 'sound') {
    for (const [re, e, v, why] of LEXICON) if (re.test(unit.text)) add(e, v, why);
    if (isWhisper(unit.text)) add('fear', 0.85, 'fala sussurrada');
    if (/!/.test(unit.text)) add('excited', 0.4, 'exclamação');
  }
  if (scene) {
    const moodWeight = 0.35 + scene.tension * 0.35;
    if (scene.mood !== 'neutral') add(scene.mood, moodWeight, `clima da cena: ${scene.context}`);
  }
  const lastSound = recentSounds.filter((s) => s.end <= unit.start + 0.5 && unit.start - s.end < 4).pop();
  if (lastSound) {
    const s = SOUND_EMOTION[lastSound.type];
    if (s && s[0] !== 'neutral') add(s[0], s[1] * 0.6, `som recente: ${lastSound.label}`);
  }
  if (unit.kind === 'dialogue' && /\?/.test(unit.text) && (scene?.tension ?? 0) > 0.6) add('confused', 0.62, 'pergunta em cena tensa');

  let best: Emotion = 'neutral';
  let bestScore = 0.3;
  for (const [e, v] of scores) {
    if (v > bestScore) {
      best = e;
      bestScore = v;
    }
  }
  if (!evidence.length) evidence.push('sem pistas emocionais fortes');
  const intensity = Math.min(1, 0.35 + bestScore * 0.6 + (scene?.tension ?? 0) * 0.15);
  const confidence = Math.min(0.9, 0.4 + 0.12 * evidence.length);
  return { emotion: best, intensity, confidence, evidence };
}
