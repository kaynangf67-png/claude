"use client";

import { AUDIO_SOURCE_MAX_SECONDS } from "./limits";
import type { AudioSettings } from "./types";
import { encodeWav } from "./wav";

let ctx: AudioContext | null = null;

/** AudioContext compartilhado. Deve ser "acordado" dentro de um gesto do usuário (iOS). */
export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

export async function unlockAudio(): Promise<AudioContext> {
  const c = getAudioContext();
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* ignora */
    }
  }
  return c;
}

export class AudioDecodeError extends Error {}

export async function decodeAudio(blob: Blob): Promise<AudioBuffer> {
  const data = await blob.arrayBuffer();
  const c = getAudioContext();
  let buffer: AudioBuffer;
  try {
    buffer = await new Promise<AudioBuffer>((resolve, reject) => {
      // Forma com callbacks: funciona também no Safari antigo.
      const p = c.decodeAudioData(data, resolve, reject);
      if (p && typeof p.then === "function") p.then(resolve, reject);
    });
  } catch {
    throw new AudioDecodeError(
      "Não conseguimos ler este áudio. Ele pode estar corrompido ou em um formato que seu navegador não reproduz. Tente MP3, M4A ou WAV.",
    );
  }
  if (buffer.duration < 0.2) throw new AudioDecodeError("O áudio é curto demais (mínimo de 0,2 segundo).");
  if (buffer.duration > AUDIO_SOURCE_MAX_SECONDS)
    throw new AudioDecodeError("O áudio é longo demais. Use um arquivo de até 10 minutos.");
  return buffer;
}

const OUT_RATE = 44100;
const FADE = 0.012;

/** Aplica corte, volume e micro fade (sem estalos) e devolve um AudioBuffer mono. */
export async function processAudio(source: AudioBuffer, settings: AudioSettings): Promise<AudioBuffer> {
  const start = Math.max(0, settings.trimStart);
  const end = Math.min(source.duration, settings.trimEnd > start ? settings.trimEnd : source.duration);
  const duration = Math.max(0.05, end - start);
  const length = Math.ceil(duration * OUT_RATE);
  const OfflineCtor =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const off = new OfflineCtor(1, length, OUT_RATE);
  const src = off.createBufferSource();
  src.buffer = source;
  const gain = off.createGain();
  const v = Math.max(0, settings.volume);
  const fade = Math.min(FADE, duration / 4);
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(v, fade);
  gain.gain.setValueAtTime(v, Math.max(fade, duration - fade));
  gain.gain.linearRampToValueAtTime(0, duration);
  src.connect(gain);
  gain.connect(off.destination);
  src.start(0, start, duration);
  return await off.startRendering();
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  return new Blob([encodeWav(channels, buffer.sampleRate)], { type: "audio/wav" });
}

/** Mistura todos os canais em um só (para forma de onda). */
export function monoSamples(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buffer.numberOfChannels;
  }
  return out;
}

/** Envelope de volume (RMS) por quadro: usado para sincronizar a animação com a voz. */
export function computeEnvelope(buffer: AudioBuffer, fps = 60): Float32Array {
  const data = monoSamples(buffer);
  const frames = Math.max(1, Math.ceil(buffer.duration * fps));
  const hop = buffer.sampleRate / fps;
  const env = new Float32Array(frames);
  let max = 0;
  for (let f = 0; f < frames; f++) {
    const s = Math.floor(f * hop);
    const e = Math.min(data.length, Math.floor((f + 1) * hop));
    let sum = 0;
    for (let i = s; i < e; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / Math.max(1, e - s));
    env[f] = rms;
    if (rms > max) max = rms;
  }
  if (max > 0) for (let f = 0; f < frames; f++) env[f] = Math.min(1, env[f] / max);
  // Suavização (ataque rápido, soltura lenta)
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    const v = env[f];
    prev = v > prev ? v * 0.7 + prev * 0.3 : v * 0.18 + prev * 0.82;
    env[f] = prev;
  }
  return env;
}

export function envelopeAt(env: Float32Array | null, t: number, fps = 60): number {
  if (!env || env.length === 0 || t < 0) return 0;
  const i = Math.floor(t * fps);
  return i < env.length ? env[i] : 0;
}

/** Toca um AudioBuffer e devolve um controlador simples. */
export function playBuffer(
  buffer: AudioBuffer,
  opts: { offset?: number; duration?: number; volume?: number; onEnded?: () => void } = {},
) {
  const c = getAudioContext();
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.value = opts.volume ?? 1;
  src.connect(gain);
  gain.connect(c.destination);
  const startedAt = c.currentTime;
  const offset = opts.offset ?? 0;
  let stopped = false;
  src.onended = () => {
    if (!stopped) opts.onEnded?.();
    stopped = true;
  };
  if (opts.duration !== undefined) src.start(0, offset, opts.duration);
  else src.start(0, offset);
  return {
    get elapsed() {
      return c.currentTime - startedAt;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        src.stop();
      } catch {
        /* já parado */
      }
      src.disconnect();
    },
  };
}

export type PlaybackHandle = ReturnType<typeof playBuffer>;

/** Escolhe o melhor formato de gravação suportado pelo navegador. */
export function pickRecorderMime(kind: "audio" | "video"): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates =
    kind === "audio"
      ? ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
      : [
          // MP4 só com H.264 + AAC explícitos: é o que o WhatsApp e o iPhone reproduzem.
          "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
          "video/mp4;codecs=avc1.4D401E,mp4a.40.2",
          "video/mp4;codecs=avc1,mp4a",
          "video/mp4;codecs=avc1",
          "video/webm;codecs=vp8,opus",
          "video/webm;codecs=vp9,opus",
          "video/webm",
          // Safari antigo só anuncia "video/mp4" (e grava H.264).
          "video/mp4",
        ];
  return candidates.find((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });
}

export function extensionForMime(mime: string): string {
  if (mime.includes("mp4")) return mime.startsWith("audio") ? "m4a" : "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "bin";
}
