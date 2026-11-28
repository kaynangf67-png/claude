"use client";

import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import { createCanvas, ctx2d, downscale, type Drawable } from "./image";

let segmenterPromise: Promise<ImageSegmenter> | null = null;

async function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/vendor/mediapipe");
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/models/selfie_segmenter.tflite", delegate: "CPU" },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    })();
    segmenterPromise.catch(() => {
      segmenterPromise = null;
    });
  }
  return segmenterPromise;
}

/**
 * Remove o fundo com IA (MediaPipe Selfie Segmenter, roda 100% no aparelho).
 * Otimizado para pessoas e retratos.
 */
export async function removeBackgroundAI(src: Drawable): Promise<HTMLCanvasElement> {
  const segmenter = await getSegmenter();
  const base = downscale(src, 1024);
  const result = segmenter.segment(base);
  const masks = result.confidenceMasks ?? [];
  const mask = masks.length > 1 ? masks[masks.length - 1] : masks[0];
  if (!mask) throw new Error("Sem máscara");
  const conf = mask.getAsFloat32Array();
  const mw = mask.width,
    mh = mask.height;

  // Garante que "1" = pessoa comparando centro x cantos.
  const at = (fx: number, fy: number) => conf[Math.min(mh - 1, Math.floor(fy * mh)) * mw + Math.min(mw - 1, Math.floor(fx * mw))];
  const center = (at(0.5, 0.5) + at(0.5, 0.4) + at(0.45, 0.55) + at(0.55, 0.55)) / 4;
  const corners = (at(0.02, 0.02) + at(0.98, 0.02) + at(0.02, 0.98) + at(0.98, 0.98)) / 4;
  const invert = corners > center;

  // Máscara "indecisa" (muitos pixels entre 25% e 75%) = provavelmente não há pessoa.
  let unsure = 0;
  for (let i = 0; i < conf.length; i++) if (conf[i] > 0.25 && conf[i] < 0.75) unsure++;
  if (unsure / conf.length > 0.2) {
    result.close?.();
    throw new Error("Não encontramos uma pessoa nesta foto. Tente o modo “Fundo liso” ou outra imagem.");
  }

  const maskCanvas = createCanvas(mw, mh);
  const mx = ctx2d(maskCanvas);
  const md = mx.createImageData(mw, mh);
  for (let i = 0; i < conf.length; i++) {
    let v = invert ? 1 - conf[i] : conf[i];
    // smoothstep para borda limpa e macia
    v = Math.min(1, Math.max(0, (v - 0.35) / 0.3));
    v = v * v * (3 - 2 * v);
    md.data[i * 4 + 3] = Math.round(v * 255);
  }
  mx.putImageData(md, 0, 0);
  result.close?.();

  const out = createCanvas(base.width, base.height);
  const ox = ctx2d(out);
  ox.drawImage(base, 0, 0);
  ox.globalCompositeOperation = "destination-in";
  ox.imageSmoothingQuality = "high";
  ox.drawImage(maskCanvas, 0, 0, out.width, out.height);
  return out;
}
