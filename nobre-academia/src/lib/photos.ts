import manifest from '../photos.json';

export interface PhotoInfo {
  name: string;
  widths: number[];
  ratio: number;
}

const photos = manifest as Record<string, { widths: number[]; ratio: number }>;

/** Retorna a foto processada por `npm run fotos`, ou null se ainda não existir. */
export function getPhoto(name: string | undefined): PhotoInfo | null {
  if (!name || !photos[name]) return null;
  return { name, ...photos[name] };
}

export function srcSet(photo: PhotoInfo, format: 'avif' | 'webp'): string {
  return photo.widths.map((w) => `/fotos/${photo.name}-${w}.${format} ${w}w`).join(', ');
}

export function largestSrc(photo: PhotoInfo): string {
  return `/fotos/${photo.name}-${photo.widths[photo.widths.length - 1]}.webp`;
}
