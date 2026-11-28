"use client";

import { audioBufferToWav, processAudio } from "./audio";
import { canvasToBlob, renderSticker, type Drawable } from "./image";
import type { AnimationStyle, AudioSettings, ImageSettings, StickerOutput, VideoBackground } from "./types";
import { canRecordVideo, exportStickerVideo } from "./video";
import { encodeWebp } from "./webp";

export interface GenerateInput {
  source: Drawable;
  transparent: boolean;
  imageSettings: ImageSettings;
  audio: AudioBuffer;
  audioSettings: AudioSettings;
  animation: AnimationStyle;
  background: VideoBackground;
  onProgress: (p: number, label: string) => void;
}

export interface GenerateResult {
  output: StickerOutput;
  stickerCanvas: HTMLCanvasElement;
  videoError?: string;
}

/** Pipeline completo: imagem → WebP/PNG, áudio → WAV, animação + áudio → vídeo. */
export async function generateSticker(i: GenerateInput): Promise<GenerateResult> {
  i.onProgress(0.04, "Montando a figurinha…");
  await tick();
  const canvas = renderSticker(i.source, i.imageSettings, { transparent: i.transparent });

  i.onProgress(0.12, "Convertendo para WebP (formato do WhatsApp)…");
  const sticker = await encodeWebp(canvas);
  const png = await canvasToBlob(canvas, "image/png");

  i.onProgress(0.25, "Processando o áudio…");
  const processed = await processAudio(i.audio, i.audioSettings);
  const audio = audioBufferToWav(processed);

  const output: StickerOutput = { sticker, png, audio, duration: processed.duration };
  let videoError: string | undefined;

  if (canRecordVideo()) {
    i.onProgress(0.3, "Gravando a figurinha falante…");
    try {
      const { blob, mime } = await exportStickerVideo({
        sticker: canvas,
        audio: processed,
        animation: i.animation,
        background: i.background,
        onProgress: (p) => i.onProgress(0.3 + p * 0.65, `Gravando a figurinha falante… ${Math.round(p * 100)}%`),
      });
      output.video = blob;
      output.videoMime = mime;
      if (!mime.includes("mp4"))
        videoError =
          "Seu navegador gerou o vídeo em WebM, que o WhatsApp pode não aceitar. Para um MP4 compatível, use o Chrome ou o Safari atualizados — ou envie “Foto + áudio juntos”.";
    } catch (e) {
      console.error("[video]", e);
      videoError = "Não foi possível gravar o vídeo com som neste navegador. A figurinha e o áudio foram gerados normalmente.";
    }
  } else {
    videoError = "Este navegador não grava vídeo. Você ainda pode enviar a figurinha e o áudio juntos.";
  }
  i.onProgress(1, "Pronto!");
  return { output, stickerCanvas: canvas, videoError };
}

const tick = () => new Promise((r) => setTimeout(r, 16));
