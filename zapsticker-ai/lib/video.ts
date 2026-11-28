"use client";

import { computeEnvelope, envelopeAt, getAudioContext, pickRecorderMime } from "./audio";
import { drawStickerFrame } from "./animation";
import { createCanvas, ctx2d } from "./image";
import type { AnimationStyle, VideoBackground } from "./types";

export function canRecordVideo(): boolean {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return false;
  const c = document.createElement("canvas");
  return typeof c.captureStream === "function" && !!pickRecorderMime("video");
}

export interface VideoExportOptions {
  sticker: HTMLCanvasElement;
  audio: AudioBuffer;
  animation: AnimationStyle;
  background: VideoBackground;
  size?: number;
  fps?: number;
  onProgress?: (p: number) => void;
}

/**
 * Grava a "figurinha falante": a animação no canvas + o áudio, em tempo real,
 * com MediaRecorder. Gera MP4 (H.264/AAC) quando o navegador suporta
 * (Safari/iOS, Chrome recente) e WebM nos demais.
 */
export async function exportStickerVideo(o: VideoExportOptions): Promise<{ blob: Blob; mime: string }> {
  const mime = pickRecorderMime("video");
  if (!mime) throw new Error("Este navegador não grava vídeo.");
  const size = o.size ?? 512;
  const fps = o.fps ?? 30;
  const canvas = createCanvas(size, size);
  const ctx = ctx2d(canvas);
  const env = computeEnvelope(o.audio);
  const tail = 0.6;
  const total = o.audio.duration + tail;

  const draw = (t: number) =>
    drawStickerFrame(ctx, o.sticker, size, {
      t,
      level: envelopeAt(env, t),
      animation: o.animation,
      background: o.background,
      badge: true,
      progress: Math.min(1, t / o.audio.duration),
      playing: t < o.audio.duration,
    });
  draw(0);

  const ac = getAudioContext();
  if (ac.state === "suspended") await ac.resume();
  const dest = ac.createMediaStreamDestination();
  const src = ac.createBufferSource();
  src.buffer = o.audio;
  src.connect(dest);

  const stream = canvas.captureStream(fps);
  const audioTrack = dest.stream.getAudioTracks()[0];
  if (audioTrack) stream.addTrack(audioTrack);

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 2_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = (e) => reject((e as unknown as { error?: Error }).error ?? new Error("Falha na gravação"));
  });

  recorder.start(250);
  // Pequena espera para o gravador ficar pronto antes do som começar.
  await new Promise((r) => setTimeout(r, 120));
  const t0 = ac.currentTime + 0.05;
  src.start(t0);

  await new Promise<void>((resolve) => {
    // setInterval (e não requestAnimationFrame) para seguir gravando com a aba em segundo plano.
    const id = setInterval(() => {
      const t = Math.max(0, ac.currentTime - t0);
      draw(t);
      o.onProgress?.(Math.min(1, t / total));
      if (t >= total) {
        clearInterval(id);
        resolve();
      }
    }, 1000 / fps);
  });

  recorder.stop();
  await stopped;
  try {
    src.disconnect();
  } catch {
    /* ok */
  }
  stream.getTracks().forEach((tr) => tr.stop());
  const type = (recorder.mimeType || mime).split(";")[0];
  const blob = new Blob(chunks, { type });
  if (blob.size < 1000) throw new Error("O vídeo gerado ficou vazio.");
  return { blob, mime: type };
}
