"use client";

import { extensionForMime } from "./audio";
import { slugify } from "./pack";
import type { StickerRecord } from "./types";

export type ShareResult = "shared" | "cancelled" | "unsupported";

export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
}

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files });
  } catch {
    return false;
  }
}

/** Abre o menu de compartilhamento nativo (no celular aparece o WhatsApp). */
export async function shareFiles(files: File[], text?: string): Promise<ShareResult> {
  if (!canShareFiles(files)) return "unsupported";
  try {
    await navigator.share({ files, text });
    return "shared";
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return "cancelled";
    // Alguns navegadores recusam texto + arquivos juntos: tenta só arquivos.
    try {
      await navigator.share({ files });
      return "shared";
    } catch (e2) {
      if ((e2 as DOMException)?.name === "AbortError") return "cancelled";
      return "unsupported";
    }
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function copyImageToClipboard(png: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return true;
  } catch {
    return false;
  }
}

export function openWhatsAppText(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

export function stickerFiles(rec: Pick<StickerRecord, "name" | "output">) {
  const base = slugify(rec.name);
  const o = rec.output;
  return {
    sticker: new File([o.sticker], `${base}.webp`, { type: "image/webp" }),
    png: new File([o.png], `${base}.png`, { type: "image/png" }),
    audio: new File([o.audio], `${base}-audio.wav`, { type: "audio/wav" }),
    video: o.video
      ? new File([o.video], `${base}-com-som.${extensionForMime(o.videoMime ?? o.video.type)}`, {
          type: o.videoMime ?? o.video.type,
        })
      : undefined,
  };
}
