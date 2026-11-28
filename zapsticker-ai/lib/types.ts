export type AnimationStyle = "pulse" | "bounce" | "wobble" | "shake" | "float" | "none";
export type VideoBackground = "green" | "dark" | "light" | "gradient";
export type BgRemovalMode = "ai" | "solid";

export interface CropState {
  /** Multiplicador sobre o encaixe "conter" (1 = imagem inteira visível). */
  zoom: number;
  /** Deslocamento em fração da área útil (−1…1). */
  x: number;
  y: number;
  /** Rotação em graus (múltiplos de 90). */
  rotation: number;
}

export interface ImageSettings {
  crop: CropState;
  removeBg: boolean;
  bgMode: BgRemovalMode;
  border: boolean;
  borderWidth: number;
}

export interface AudioSettings {
  trimStart: number;
  trimEnd: number;
  /** Ganho linear: 1 = 100%. */
  volume: number;
}

export interface StickerOutput {
  /** Figurinha WebP 512×512 (formato do WhatsApp). */
  sticker: Blob;
  /** PNG 512×512 com transparência (copiar / compatibilidade). */
  png: Blob;
  /** Áudio processado (cortado + volume) em WAV. */
  audio: Blob;
  /** "Figurinha falante": vídeo com a animação e o som. */
  video?: Blob;
  videoMime?: string;
  duration: number;
}

export interface EditorSource {
  image?: Blob;
  imageName?: string;
  /** Recorte com fundo removido (cache). */
  cutout?: Blob;
  cutoutMode?: BgRemovalMode;
  imageSettings: ImageSettings;
  audio?: Blob;
  audioName?: string;
  audioSettings: AudioSettings;
  animation: AnimationStyle;
  videoBackground: VideoBackground;
  name: string;
}

export interface StickerRecord extends EditorSource {
  id: string;
  createdAt: number;
  updatedAt: number;
  output: StickerOutput;
}

export interface DraftRecord extends EditorSource {
  editingId?: string;
  /** Houve mudanças depois da última geração. */
  dirty?: boolean;
  step: 1 | 2 | 3;
  savedAt: number;
}

export type HistoryAction = "created" | "updated" | "shared" | "downloaded" | "deleted" | "exported";

export interface HistoryEntry {
  id?: number;
  stickerId: string;
  stickerName: string;
  action: HistoryAction;
  detail?: string;
  at: number;
}

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  crop: { zoom: 1, x: 0, y: 0, rotation: 0 },
  removeBg: false,
  bgMode: "ai",
  border: true,
  borderWidth: 14,
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { trimStart: 0, trimEnd: 0, volume: 1 };
