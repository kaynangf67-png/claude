import { describe, expect, it } from 'vitest';
import { captionPadding, computeAvatarLayout, overlapArea, type LayoutInput } from '@/components/avatarLayout';
import { DEFAULT_PREFS } from '@/services/accessibilityService';
import type { RegionOfInterest } from '@/ai/types';

const base = (over: Partial<LayoutInput> = {}): LayoutInput => ({
  W: 1280,
  H: 720,
  prefs: DEFAULT_PREFS,
  bottomReserve: 100,
  immersive: false,
  videoRect: { x: 0, y: 0, w: 1280, h: 720 },
  rois: [],
  ...over,
});

describe('posicionamento do intérprete', () => {
  it('começa no canto inferior direito, acima dos controles, proporção 4:5', () => {
    const l = computeAvatarLayout(base());
    expect(l.side).toBe('right');
    expect(l.x + l.w).toBeLessThanOrEqual(1280);
    expect(l.y + l.h).toBeLessThanOrEqual(720 - 100 + 0.01);
    expect(l.h / l.w).toBeCloseTo(1.25, 2);
  });

  it('em qualquer tamanho e tela, fica dentro do player e fora da faixa de controles', () => {
    for (const [W, H] of [[390, 219], [768, 432], [1280, 720], [1920, 1080], [844, 390]]) {
      for (const size of ['S', 'M', 'L'] as const) {
        for (const pos of ['bottom-right', 'bottom-left'] as const) {
          const l = computeAvatarLayout(base({ W, H, bottomReserve: W < 860 ? 76 : 100, prefs: { ...DEFAULT_PREFS, interpreterSize: size, interpreterPosition: pos } }));
          expect(l.x).toBeGreaterThanOrEqual(0);
          expect(l.y).toBeGreaterThanOrEqual(0);
          expect(l.x + l.w).toBeLessThanOrEqual(W);
          expect(l.y + l.h).toBeLessThanOrEqual(H - (W < 860 ? 76 : 100) + 0.01);
        }
      }
    }
  });

  it('troca de canto para não cobrir uma ação importante', () => {
    const roi: RegionOfInterest = { id: 'r', start: 0, end: 1, rect: [0.55, 0.42, 1, 1], kind: 'action', label: 'mão pegando o telefone' };
    const l = computeAvatarLayout(base({ rois: [roi] }));
    expect(l.side).toBe('left');
    expect(l.autoMovedFor).toBe('mão pegando o telefone');
  });

  it('respeita a escolha do usuário de não desviar', () => {
    const roi: RegionOfInterest = { id: 'r', start: 0, end: 1, rect: [0.55, 0.42, 1, 1], kind: 'action', label: 'x' };
    const l = computeAvatarLayout(base({ rois: [roi], prefs: { ...DEFAULT_PREFS, avoidImportantRegions: false } }));
    expect(l.side).toBe('right');
  });

  it('posição personalizada é limitada ao player', () => {
    const l = computeAvatarLayout(base({ prefs: { ...DEFAULT_PREFS, interpreterPosition: 'custom', customPosition: { x: 0.98, y: 0.98 } } }));
    expect(l.x + l.w).toBeLessThanOrEqual(1280);
    expect(l.y + l.h).toBeLessThanOrEqual(620.01);
  });

  it('legendas nunca ficam embaixo do intérprete', () => {
    const l = computeAvatarLayout(base());
    const pad = captionPadding(l, 1280, 720);
    const captionArea = { x: pad.left, y: 520, w: 1280 - pad.left - pad.right, h: 80 };
    expect(overlapArea(captionArea, l)).toBe(0);
  });
});
