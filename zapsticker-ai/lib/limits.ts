export const STICKER_SIZE = 512;
export const TRAY_SIZE = 96;
/** Limite do WhatsApp para figurinha estática. */
export const STICKER_MAX_BYTES = 100 * 1024;
export const TRAY_MAX_BYTES = 50 * 1024;

export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 20 * 1024 * 1024;
export const AUDIO_SOURCE_MAX_SECONDS = 10 * 60;
export const CLIP_MAX_SECONDS = 30;
export const CLIP_MIN_SECONDS = 0.5;
export const RECORD_MAX_SECONDS = 30;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".webm", ".flac", ".mp4", ".caf"];

export const PACK_MIN = 3;
export const PACK_MAX = 30;

function ext(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function validateImageFile(file: { name: string; type: string; size: number }): string | null {
  const okType = IMAGE_TYPES.includes(file.type) || IMAGE_EXTENSIONS.includes(ext(file.name));
  if (!okType) return "Formato de imagem não suportado. Use JPG, PNG ou WEBP.";
  if (file.size > IMAGE_MAX_BYTES) return `A imagem tem ${formatBytes(file.size)}. O limite é ${formatBytes(IMAGE_MAX_BYTES)}.`;
  if (file.size === 0) return "O arquivo de imagem está vazio.";
  return null;
}

export function validateAudioFile(file: { name: string; type: string; size: number }): string | null {
  const okType = file.type.startsWith("audio/") || file.type === "video/mp4" || file.type === "video/webm" || AUDIO_EXTENSIONS.includes(ext(file.name));
  if (!okType) return "Formato de áudio não suportado. Use MP3, WAV, M4A, AAC, OGG ou OPUS.";
  if (file.size > AUDIO_MAX_BYTES) return `O áudio tem ${formatBytes(file.size)}. O limite é ${formatBytes(AUDIO_MAX_BYTES)}.`;
  if (file.size === 0) return "O arquivo de áudio está vazio.";
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0").replace(".", ",")}`;
}

/** Garante um trecho válido dentro do áudio e do limite de duração. */
export function clampTrim(start: number, end: number, duration: number): { start: number; end: number } {
  let s = Math.max(0, Math.min(start, duration));
  let e = Math.max(0, Math.min(end, duration));
  if (e < s) [s, e] = [e, s];
  if (e - s > CLIP_MAX_SECONDS) e = s + CLIP_MAX_SECONDS;
  if (e - s < CLIP_MIN_SECONDS) {
    e = Math.min(duration, s + CLIP_MIN_SECONDS);
    s = Math.max(0, e - CLIP_MIN_SECONDS);
  }
  return { start: round3(s), end: round3(e) };
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
