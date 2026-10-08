/**
 * SPEECH ENGINE — transcrição sincronizada.
 *
 * Hoje: lê a transcrição oficial em WebVTT (com <v Falante>), que é a fonte
 * mais confiável para conteúdo pré-processado.
 *
 * TODO: FUTURE AI INTEGRATION
 *   Para conteúdo sem legenda, conectar aqui um modelo de reconhecimento de
 *   fala (ASR) com marcação de tempo por palavra, rodando no backend de
 *   processamento, e devolver TimedCue[] no mesmo formato.
 *   Para o modo ao vivo, ver ai/liveInterpretation.ts (Web Speech API).
 */
import type { TimedCue } from './types';
import { loadWebVTT } from '@/services/videoService';

export async function loadTranscript(src: string): Promise<TimedCue[]> {
  return loadWebVTT(src);
}

/** Lê o identificador de tipo "[DOOR_SLAM]" do início de um cue de sons. */
export function splitSoundCue(text: string): { code: string | null; label: string } {
  const m = text.match(/^\[([A-Z_]+)\]\s*(.*)$/s);
  return m ? { code: m[1], label: m[2].trim() } : { code: null, label: text };
}

export function isWhisper(text: string): boolean {
  return /\((sussurrando|sussurra|whispering)\)/i.test(text);
}

export function stripStageDirections(text: string): string {
  return text.replace(/\(([^)]*)\)\s*/g, '').trim();
}
