"use client";

import { STICKER_MAX_BYTES } from "./limits";
import { canvasToBlob } from "./image";

type Encoder = (data: ImageData, opts?: { quality?: number; method?: number; alpha_quality?: number; exact?: number }) => Promise<ArrayBuffer>;
let encoderPromise: Promise<Encoder> | null = null;

async function getEncoder(): Promise<Encoder> {
  if (!encoderPromise) {
    encoderPromise = (async () => {
      const mod = await import("@jsquash/webp/encode");
      await mod.init({ locateFile: (path: string) => `/vendor/webp/${path}` } as never);
      return mod.default as unknown as Encoder;
    })();
    encoderPromise.catch(() => {
      encoderPromise = null;
    });
  }
  return encoderPromise;
}

/**
 * Codifica WebP respeitando um tamanho máximo (100 KB por padrão, regra do
 * WhatsApp). Usa o codificador libwebp (WASM) — funciona no iOS, onde o
 * canvas não exporta WebP — e cai para o canvas se o WASM falhar.
 */
export async function encodeWebp(canvas: HTMLCanvasElement, maxBytes = STICKER_MAX_BYTES): Promise<Blob> {
  const data = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
  try {
    const encode = await getEncoder();
    let last: ArrayBuffer | null = null;
    for (const quality of [90, 80, 70, 60, 50, 40, 30, 20]) {
      last = await encode(data, { quality, method: 4, alpha_quality: 90 });
      if (last.byteLength <= maxBytes) break;
    }
    if (last) return new Blob([last], { type: "image/webp" });
  } catch (e) {
    console.warn("[webp] WASM indisponível, usando canvas", e);
  }
  for (const q of [0.9, 0.75, 0.6, 0.45, 0.3]) {
    const b = await canvasToBlob(canvas, "image/webp", q);
    if (b.type !== "image/webp") break;
    if (b.size <= maxBytes) return b;
  }
  throw new Error("Seu navegador não consegue gerar WebP. Atualize o navegador ou use outro aparelho.");
}
