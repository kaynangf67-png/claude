/**
 * ACCESSIBILITY SERVICE — preferências do usuário que o player respeita.
 */
import type { SignLanguageCode } from '@/types/content';
import { load, save } from './storage';

export type InterpreterSize = 'S' | 'M' | 'L';
export type InterpreterPosition = 'bottom-right' | 'bottom-left' | 'custom';

export interface AccessibilityPrefs {
  interpreterEnabled: boolean; // iniciar com intérprete ligado
  interpreterSize: InterpreterSize;
  interpreterWidth: number | null; // largura personalizada (fração do player)
  interpreterPosition: InterpreterPosition;
  customPosition: { x: number; y: number } | null; // fração (canto superior esquerdo)
  avoidImportantRegions: boolean;
  captions: boolean;
  captionTrack: string; // id da faixa
  captionSize: 'S' | 'M' | 'L';
  showSpeakerNames: boolean;
  soundCues: boolean;
  emotionalDescription: boolean;
  cinemaMode: boolean;
  immersive: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  signLanguage: SignLanguageCode;
  uiLanguage: 'pt-BR' | 'en';
  showTranscript: boolean;
  diagnostics: boolean;
}

export const DEFAULT_PREFS: AccessibilityPrefs = {
  interpreterEnabled: true,
  interpreterSize: 'M',
  interpreterWidth: null,
  interpreterPosition: 'bottom-right',
  customPosition: null,
  avoidImportantRegions: true,
  captions: true,
  captionTrack: 'cc-pt',
  captionSize: 'M',
  showSpeakerNames: true,
  soundCues: true,
  emotionalDescription: true,
  cinemaMode: false,
  immersive: false,
  highContrast: false,
  reduceMotion: false,
  signLanguage: 'pt-BR-LIBRAS',
  uiLanguage: 'pt-BR',
  showTranscript: true,
  diagnostics: false,
};

export function loadPrefs(userId: string | null): AccessibilityPrefs {
  return load(`prefs:${userId ?? 'guest'}`, DEFAULT_PREFS);
}

export function savePrefs(userId: string | null, prefs: AccessibilityPrefs) {
  save(`prefs:${userId ?? 'guest'}`, prefs);
}

/** Largura do intérprete como fração da largura do player. */
export function interpreterWidthFraction(prefs: AccessibilityPrefs, playerWidth: number): number {
  if (prefs.interpreterWidth) return prefs.interpreterWidth;
  const mobile = playerWidth < 640;
  const table = mobile ? { S: 0.27, M: 0.33, L: 0.42 } : { S: 0.17, M: 0.22, L: 0.29 };
  return table[prefs.interpreterSize];
}
