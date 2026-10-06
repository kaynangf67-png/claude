import { describe, expect, it } from 'vitest';
import { headingUpRotation, screenToWorld, worldToScreen, type View2D } from './camera2d';

describe('Câmera 2D', () => {
  const v: View2D = { cx: 100, cz: -50, zoom: 3, rot: 0.7, width: 400, height: 800, anchorY: 0.68 };

  it('mundo → tela → mundo é identidade', () => {
    const p = { x: 123.4, z: -77.7 };
    const back = screenToWorld(v, worldToScreen(v, p));
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.z).toBeCloseTo(p.z, 6);
    const c = worldToScreen(v, { x: v.cx, z: v.cz });
    expect(c).toEqual({ x: 200, y: 800 * 0.68 });
  });

  it('com o rumo para cima, o que está à frente do carro aparece acima dele', () => {
    for (const heading of [0, 1, 2.5, -2]) {
      const view = { ...v, rot: headingUpRotation(heading) };
      const ahead = worldToScreen(view, { x: v.cx + Math.cos(heading) * 10, z: v.cz - Math.sin(heading) * 10 });
      expect(ahead.x).toBeCloseTo(200, 6);
      expect(ahead.y).toBeLessThan(800 * 0.68);
    }
  });
});
