/**
 * Posicionamento do intérprete (função pura, testada em avatarLayout.test.ts).
 *
 * Garantias:
 *  - fica sempre dentro do player;
 *  - nunca invade a faixa dos controles (reserva inferior);
 *  - proporção 4:5 — espaço vertical e horizontal para mãos, braços, rosto e
 *    tronco (o enquadramento 3D ainda afasta a câmera se uma mão sair do quadro);
 *  - com "evitar elementos importantes", troca de canto se o canto escolhido
 *    cobrir um rosto, uma ação ou um texto marcado pela análise da cena.
 */
import type { RegionOfInterest } from '@/ai/types';
import type { AccessibilityPrefs } from '@/services/accessibilityService';
import { interpreterWidthFraction } from '@/services/accessibilityService';

export const AVATAR_ASPECT = 1.25; // altura / largura

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutInput {
  W: number;
  H: number;
  prefs: Pick<AccessibilityPrefs, 'interpreterSize' | 'interpreterWidth' | 'interpreterPosition' | 'customPosition' | 'avoidImportantRegions'>;
  bottomReserve: number;
  immersive: boolean;
  videoRect: Box;
  rois: RegionOfInterest[];
}

export interface LayoutOutput extends Box {
  side: 'left' | 'right';
  autoMovedFor: string | null;
}

export function overlapArea(a: Box, b: Box): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

export function roiToBox(r: RegionOfInterest, v: Box): Box {
  const [x0, y0, x1, y1] = r.rect;
  return { x: v.x + x0 * v.w, y: v.y + y0 * v.h, w: (x1 - x0) * v.w, h: (y1 - y0) * v.h };
}

export function computeAvatarLayout(i: LayoutInput): LayoutOutput {
  const { W, H } = i;
  if (i.immersive) {
    const w = W * 0.36;
    return { x: W - w, y: 0, w, h: H - i.bottomReserve, side: 'right', autoMovedFor: null };
  }
  const margin = W < 640 ? 10 : 16;
  let w = W * interpreterWidthFraction(i.prefs as AccessibilityPrefs, W);
  let h = w * AVATAR_ASPECT;
  const maxH = Math.max(80, H - i.bottomReserve - margin * 2) * 0.92;
  if (h > maxH) {
    h = maxH;
    w = h / AVATAR_ASPECT;
  }
  const bottomY = H - h - i.bottomReserve;
  const clampBox = (x: number, y: number): Box => ({
    x: Math.max(margin, Math.min(W - w - margin, x)),
    y: Math.max(margin, Math.min(bottomY, y)),
    w,
    h,
  });
  if (i.prefs.interpreterPosition === 'custom' && i.prefs.customPosition) {
    const b = clampBox(i.prefs.customPosition.x * W, i.prefs.customPosition.y * H);
    return { ...b, side: b.x + w / 2 > W / 2 ? 'right' : 'left', autoMovedFor: null };
  }
  const right = clampBox(W - w - margin, bottomY);
  const left = clampBox(margin, bottomY);
  const preferred = i.prefs.interpreterPosition === 'bottom-left' ? left : right;
  const other = preferred === right ? left : right;
  if (i.prefs.avoidImportantRegions && i.rois.length) {
    const boxes = i.rois.map((r) => ({ r, b: roiToBox(r, i.videoRect) }));
    const hit = boxes.find(({ b }) => overlapArea(preferred, b) > 0.12 * w * h);
    if (hit) {
      const otherHit = boxes.some(({ b }) => overlapArea(other, b) > 0.12 * w * h);
      if (!otherHit) return { ...other, side: other === right ? 'right' : 'left', autoMovedFor: hit.r.label };
    }
  }
  return { ...preferred, side: preferred === right ? 'right' : 'left', autoMovedFor: null };
}

/** Ajuste das legendas para que nunca fiquem embaixo do intérprete. */
export function captionPadding(avatar: Box | null, W: number, H: number): { left: number; right: number } {
  if (!avatar || avatar.y + avatar.h < H * 0.55) return { left: 16, right: 16 };
  const center = avatar.x + avatar.w / 2;
  return center > W / 2 ? { left: 16, right: W - avatar.x + 12 } : { left: avatar.x + avatar.w + 12, right: 16 };
}
