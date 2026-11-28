"use client";

import { STICKER_SIZE } from "./limits";
import type { ImageSettings } from "./types";

export type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export class ImageLoadError extends Error {}

export async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode().catch(
      () =>
        new Promise<void>((resolve, reject) => {
          if (img.complete && img.naturalWidth) return resolve();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("load"));
        }),
    );
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("empty");
    return img;
  } catch {
    throw new ImageLoadError("Não conseguimos abrir esta imagem. O arquivo pode estar corrompido ou em um formato incompatível.");
  } finally {
    // A imagem já foi decodificada; liberar a URL depois de um tempo.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

export function sizeOf(d: Drawable): { w: number; h: number } {
  if (d instanceof HTMLImageElement) return { w: d.naturalWidth, h: d.naturalHeight };
  return { w: d.width, h: d.height };
}

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext("2d", { willReadFrequently: false });
  if (!x) throw new Error("Canvas 2D indisponível neste navegador.");
  return x;
}

/** Copia a imagem para um canvas limitado a `max` px no maior lado. */
export function downscale(src: Drawable, max: number): HTMLCanvasElement {
  const { w, h } = sizeOf(src);
  const s = Math.min(1, max / Math.max(w, h));
  const c = createCanvas(w * s, h * s);
  const x = ctx2d(c);
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))), type, quality);
  });
}

/** Recorta o canvas às bordas visíveis (alfa) com uma pequena folga. */
export function trimTransparent(src: HTMLCanvasElement, padRatio = 0.03): HTMLCanvasElement {
  const x = src.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = src;
  const d = x.getImageData(0, 0, w, h).data;
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let xx = 0; xx < w; xx++) {
      if (d[(y * w + xx) * 4 + 3] > 16) {
        if (xx < minX) minX = xx;
        if (xx > maxX) maxX = xx;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return src;
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * padRatio);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const out = createCanvas(maxX - minX + 1, maxY - minY + 1);
  ctx2d(out).drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Remoção de fundo liso: inunda a partir das bordas tudo o que tiver cor
 * parecida com o fundo e cria uma transição suave na borda.
 */
export function removeSolidBackground(src: Drawable, tolerance = 42): HTMLCanvasElement {
  const c = downscale(src, 1024);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = c;
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;

  // Cor de fundo: mediana das bordas.
  const rs: number[] = [],
    gs: number[] = [],
    bs: number[] = [];
  const sample = (px: number, py: number) => {
    const i = (py * w + px) * 4;
    rs.push(d[i]);
    gs.push(d[i + 1]);
    bs.push(d[i + 2]);
  };
  const step = Math.max(1, Math.floor(Math.min(w, h) / 64));
  for (let i = 0; i < w; i += step) {
    sample(i, 0);
    sample(i, h - 1);
  }
  for (let j = 0; j < h; j += step) {
    sample(0, j);
    sample(w - 1, j);
  }
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  const br = med(rs),
    bg = med(gs),
    bb = med(bs);

  const dist = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const dr = d[i] - br,
      dg = d[i + 1] - bg,
      db = d[i + 2] - bb;
    dist[p] = Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) * 1.6;
  }

  const bgMask = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (p: number) => {
    if (!bgMask[p] && dist[p] < tolerance) {
      bgMask[p] = 1;
      stack.push(p);
    }
  };
  for (let i = 0; i < w; i++) {
    push(i);
    push((h - 1) * w + i);
  }
  for (let j = 0; j < h; j++) {
    push(j * w);
    push(j * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const px = p % w,
      py = (p / w) | 0;
    if (px > 0) push(p - 1);
    if (px < w - 1) push(p + 1);
    if (py > 0) push(p - w);
    if (py < h - 1) push(p + w);
  }

  // Borda suave: pixels de primeiro plano vizinhos ao fundo ganham alfa parcial.
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (bgMask[p]) {
      d[i + 3] = 0;
      continue;
    }
    const px = p % w,
      py = (p / w) | 0;
    const nearBg =
      (px > 0 && bgMask[p - 1]) || (px < w - 1 && bgMask[p + 1]) || (py > 0 && bgMask[p - w]) || (py < h - 1 && bgMask[p + w]);
    if (nearBg) {
      const a = Math.min(1, Math.max(0, (dist[p] - tolerance * 0.6) / (tolerance * 1.2)));
      d[i + 3] = Math.round(d[i + 3] * (0.35 + 0.65 * a));
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

/** Proporção de pixels visíveis (para detectar remoção que apagou tudo). */
export function opaqueRatio(c: HTMLCanvasElement): number {
  const s = downscale(c, 128);
  const d = s.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, s.width, s.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 32) n++;
  return n / (s.width * s.height);
}

export interface RenderOptions {
  size?: number;
  /** Se a fonte tem transparência (fundo removido). */
  transparent: boolean;
}

/**
 * Renderiza a figurinha final: recorte/zoom/rotação, cantos arredondados
 * para fotos e contorno branco estilo WhatsApp.
 */
export function renderSticker(src: Drawable, settings: ImageSettings, opts: RenderOptions): HTMLCanvasElement {
  const size = opts.size ?? STICKER_SIZE;
  const k = size / STICKER_SIZE;
  const border = settings.border ? settings.borderWidth * k : 0;
  // Margem recomendada pelo WhatsApp (~16px) + espaço do contorno.
  const pad = Math.round(8 * k + border);
  const inner = size - pad * 2;
  const { crop } = settings;

  const content = createCanvas(size, size);
  const cx = ctx2d(content);
  cx.imageSmoothingQuality = "high";

  if (!opts.transparent) {
    const r = inner * 0.14;
    cx.save();
    roundRect(cx, pad, pad, inner, inner, r);
    cx.clip();
  }

  const { w, h } = sizeOf(src);
  const rotated = Math.abs(crop.rotation % 180) === 90;
  const sw = rotated ? h : w;
  const sh = rotated ? w : h;
  const contain = Math.min(inner / sw, inner / sh);
  const scale = contain * crop.zoom;
  cx.translate(size / 2 + crop.x * inner, size / 2 + crop.y * inner);
  cx.rotate((crop.rotation * Math.PI) / 180);
  cx.drawImage(src, (-w * scale) / 2, (-h * scale) / 2, w * scale, h * scale);
  cx.setTransform(1, 0, 0, 1, 0, 0);
  if (!opts.transparent) cx.restore();

  if (!settings.border) return content;

  const out = createCanvas(size, size);
  const ox = ctx2d(out);
  // Silhueta branca
  const sil = createCanvas(size, size);
  const sx = ctx2d(sil);
  sx.drawImage(content, 0, 0);
  sx.globalCompositeOperation = "source-in";
  sx.fillStyle = "#ffffff";
  sx.fillRect(0, 0, size, size);

  // Sombra discreta para destacar a figurinha em fundos claros.
  ox.save();
  ox.shadowColor = "rgba(0,0,0,0.28)";
  ox.shadowBlur = 6 * k;
  ox.shadowOffsetY = 2 * k;
  ox.drawImage(sil, 0, 0);
  ox.restore();

  const steps = Math.max(16, Math.round(border * 2.2));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ox.drawImage(sil, Math.cos(a) * border, Math.sin(a) * border);
  }
  // Preenche o miolo (buracos pequenos dentro da silhueta)
  for (let r = border * 0.5; r > 0; r -= Math.max(1, border / 3)) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ox.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  ox.drawImage(content, 0, 0);
  return out;
}

export function roundRect(x: CanvasRenderingContext2D, left: number, top: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(left + r, top);
  x.arcTo(left + w, top, left + w, top + h, r);
  x.arcTo(left + w, top + h, left, top + h, r);
  x.arcTo(left, top + h, left, top, r);
  x.arcTo(left, top, left + w, top, r);
  x.closePath();
}

/** Zoom que faz a imagem preencher toda a área útil (modo "cobrir"). */
export function coverZoom(src: Drawable, rotation: number): number {
  const { w, h } = sizeOf(src);
  const rotated = Math.abs(rotation % 180) === 90;
  const sw = rotated ? h : w;
  const sh = rotated ? w : h;
  return Math.max(sw, sh) / Math.min(sw, sh);
}
