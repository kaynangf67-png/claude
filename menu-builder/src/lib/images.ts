import type { AssetPurpose } from '@/domain/types';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const MAX_FILES_PER_BATCH = 20;
export const MAX_ASSETS_PER_PROJECT = 80;
/** Lado maior após redução. Suficiente para a IA ler texto e leve para o celular. */
const MAX_SIDE = 2000;
/** Limite final por arquivo (o banco aceita até 10 MB; a API de IA, 5 MB por imagem). */
export const MAX_STORED_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'Formato não aceito. Use JPG, PNG ou WebP.';
  if (file.size > MAX_INPUT_BYTES) return 'Arquivo acima de 15 MB.';
  if (file.size === 0) return 'Arquivo vazio.';
  return null;
}

/**
 * Reduz imagens grandes (lado maior até 2000 px) antes do envio: economiza armazenamento,
 * dados móveis do cliente final e tokens de IA. Logos PNG mantêm transparência.
 */
export async function prepareImage(file: File, purpose: AssetPurpose): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 2 * 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const keepAlpha = purpose === 'logo' && file.type === 'image/png';
  const type = keepAlpha ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  if (!blob) throw new Error('Não foi possível processar a imagem.');
  return blob;
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function extensionFor(type: string): string {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
}
