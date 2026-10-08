/**
 * SPEAKER IDENTIFICATION ENGINE — quem está falando (e com quem).
 *
 * Ordem de evidências implementada:
 *   1. Tag de voz do WebVTT (<v Marina>) → confiança alta.
 *   2. Contexto visual: único personagem em cena → confiança média.
 *   3. Desconhecido.
 *
 * O ouvinte é inferido como o outro participante da conversa na mesma cena
 * (em "A Ligação": Daniel ↔ Marina ao telefone).
 *
 * TODO: FUTURE AI INTEGRATION
 *   - diarização de áudio (quem fala quando) e embeddings de voz por personagem;
 *   - rastreamento facial + detecção de movimento labial (falante em quadro);
 *   - fusão com o elenco do catálogo para nomear os personagens.
 */
import type { Character, SceneSegment, SpeakerResult, TimedCue } from './types';

export function identifySpeaker(cue: TimedCue, characters: Character[], scene: SceneSegment | undefined, recentSpeakers: string[]): SpeakerResult {
  const byVoice = cue.voice ? characters.find((c) => c.voiceTag.toLowerCase() === cue.voice!.toLowerCase()) : undefined;
  let speakerId: string | null = null;
  let confidence = 0.3;
  let method: SpeakerResult['method'] = 'unknown';
  if (byVoice) {
    speakerId = byVoice.id;
    confidence = 0.97;
    method = 'transcript-voice-tag';
  } else if (scene && scene.characters.length === 1) {
    speakerId = scene.characters[0];
    confidence = 0.6;
    method = 'visual-context';
  }
  const listenerId =
    [...recentSpeakers].reverse().find((s) => s !== speakerId) ??
    characters.find((c) => c.id !== speakerId && (scene?.characters.includes(c.id) || !c.onScreen))?.id ??
    null;
  return { speakerId, listenerId: listenerId === speakerId ? null : listenerId, confidence, method };
}
