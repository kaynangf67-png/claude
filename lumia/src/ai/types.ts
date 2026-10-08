/**
 * Tipos compartilhados pelo pipeline:
 *
 * VÍDEO → ANÁLISE MULTIMODAL → ENTENDIMENTO DA CENA → PERSONAGENS → DIÁLOGO
 *       → SONS → EMOÇÕES → CONTEXTO → REPRESENTAÇÃO EM LIBRAS → VALIDAÇÃO
 *       → ANIMAÇÃO DO AVATAR → INTERPRETAÇÃO SINCRONIZADA
 */
import type { InterpretationStatus, SignLanguageCode } from '@/types/content';

export type Emotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'fear'
  | 'surprise'
  | 'confused'
  | 'excited'
  | 'urgent'
  | 'romantic'
  | 'threatening';

export const EMOTION_LABEL: Record<Emotion, string> = {
  neutral: 'neutro',
  happy: 'alegre',
  sad: 'triste',
  angry: 'com raiva',
  fear: 'com medo',
  surprise: 'surpreso',
  confused: 'confuso',
  excited: 'animado',
  urgent: 'urgente',
  romantic: 'romântico',
  threatening: 'ameaçador',
};

export type SoundType =
  | 'DOOR_SLAM'
  | 'DOOR_CREAK'
  | 'PHONE_RING'
  | 'SIREN'
  | 'EXPLOSION'
  | 'GUNSHOT'
  | 'CRYING'
  | 'LAUGHTER'
  | 'SCREAM'
  | 'FOOTSTEPS'
  | 'DOORBELL'
  | 'KNOCK'
  | 'MUSIC_TENSE'
  | 'MUSIC_SOFT'
  | 'SUDDEN_SILENCE'
  | 'RAIN'
  | 'CLICK'
  | 'HEARTBEAT_BASS'
  | 'IMPACT'
  | 'NOISE';

export interface TimedCue {
  id: string;
  start: number;
  end: number;
  text: string;
  /** Nome do <v Falante> no WebVTT, quando existir. */
  voice?: string;
}

export interface SoundEvent {
  id: string;
  start: number;
  end: number;
  type: SoundType;
  label: string;
  importance: 'low' | 'medium' | 'high';
}

export interface VisualEvent {
  id: string;
  t: number;
  end: number;
  code: string; // ex.: WOMAN_TURNS_AROUND
  label: string;
  importance: 'low' | 'medium' | 'high';
  /** true quando o diálogo NÃO explica a ação — precisa ser interpretada. */
  notInDialogue: boolean;
}

export type Rect = [x0: number, y0: number, x1: number, y1: number];

/** Áreas do quadro que o intérprete não deve cobrir (rostos, ações, textos). */
export interface RegionOfInterest {
  id: string;
  start: number;
  end: number;
  rect: Rect; // normalizado 0..1 sobre a imagem do vídeo
  kind: 'face' | 'action' | 'text' | 'object';
  label: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  voiceTag: string; // nome usado no <v> do WebVTT
  onScreen: boolean;
  /** Ponto no espaço de sinalização usado como referência (loci). */
  locus: 'left' | 'right' | 'center';
  color: string;
}

export interface SceneSegment {
  id: string;
  start: number;
  end: number;
  shot: string;
  environment: 'INDOOR' | 'OUTDOOR' | 'TITLE_CARD' | 'ABSTRACT';
  location: string;
  description: string;
  characters: string[];
  mood: Emotion;
  tension: number; // 0..1
  context: string; // ex.: PHONE_CALL
}

export interface SceneAnalysis {
  contentId: string;
  producedBy: { engine: string; mode: 'pre-processed-mock' | 'live-model'; note: string };
  characters: Character[];
  scenes: SceneSegment[];
  visualEvents: VisualEvent[];
  regions: RegionOfInterest[];
  sounds: SoundEvent[];
}

/** Formato do "SCENE UNDERSTANDING" exibido no player (ver item 11 do briefing). */
export interface SceneUnderstanding {
  time: number;
  sceneId: string;
  sceneChanged: boolean;
  speaker: string | null;
  listener: string | null;
  emotion: Emotion;
  environment: string;
  location: string;
  sound: string | null;
  music: string | null;
  visual_event: string | null;
  dialogue: string | null;
  context: string;
}

export interface EmotionResult {
  emotion: Emotion;
  intensity: number;
  confidence: number;
  evidence: string[];
}

export interface SpeakerResult {
  speakerId: string | null;
  listenerId: string | null;
  confidence: number;
  method: 'transcript-voice-tag' | 'visual-context' | 'unknown';
}

/** Unidade de interpretação: uma fala, um som importante, um evento visual ou texto na tela. */
export interface InterpretationUnit {
  id: string;
  kind: 'dialogue' | 'sound' | 'visual' | 'text';
  start: number;
  end: number;
  text: string;
  cue?: TimedCue;
  sound?: SoundEvent;
  visual?: VisualEvent;
}

export interface ContextFrame {
  unitId: string;
  sceneId: string;
  speaker: SpeakerResult;
  emotion: EmotionResult;
  context: string; // ex.: URGENT_WARNING
  environment: string;
  whisper: boolean;
  question: 'wh' | 'yn' | null;
  imperative: boolean;
}

// --------------------------------------------------------------------------
// Representação linguística (LIBRAS LANGUAGE ENGINE)
// --------------------------------------------------------------------------

/** Marcadores não manuais — parte da gramática, não "enfeite". */
export type NonManualMarker = 'topic' | 'wh' | 'yn' | 'neg' | 'intensifier' | 'whisper' | 'exclamation';

export interface SignToken {
  gloss: string;
  kind: 'lexical' | 'fingerspell' | 'classifier' | 'pointing' | 'pause';
  markers: NonManualMarker[];
  /** Existe no léxico do motor de animação? */
  known: boolean;
  letters?: string;
}

export interface SignRepresentation {
  unitId: string;
  language: SignLanguageCode;
  sourceText: string;
  tokens: SignToken[];
  structure: 'declarative' | 'topic-comment' | 'wh-question' | 'yes-no-question' | 'imperative' | 'negation' | 'sound-description' | 'visual-description';
  roleShift: string | null; // personagem incorporado pelo intérprete
  expression: Emotion;
  intensity: number; // 0..1 → amplitude dos sinais
  speed: number; // multiplicador de velocidade
  signingSpace: number; // 1 = normal; <1 = sinalização contida (ex.: sussurro)
  origin: 'authored-demo' | 'rule-based' | 'human-edit';
  notes: string[];
}

export interface QualityReport {
  confidence: number;
  warnings: { code: string; message: string }[];
  suggestedStatus: InterpretationStatus;
}

export interface ReviewRecord {
  status: InterpretationStatus;
  reviewer?: string;
  role?: 'Intérprete de Libras' | 'Pessoa surda' | 'Especialista' | 'Revisor linguístico';
  at?: string;
  note?: string;
  glossOverride?: string;
}
