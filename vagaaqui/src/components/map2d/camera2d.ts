import type { Vec2 } from '../../types';

/**
 * Câmera do mapa 2D: centro no mundo (m), zoom (px por metro), rotação (rad)
 * e a altura da tela onde fica o centro (0..1; 0,68 = carro mais embaixo, mais rua à frente).
 * Mundo: x leste, z sul. Tela: x direita, y para baixo.
 */
export interface View2D {
  cx: number;
  cz: number;
  zoom: number;
  rot: number;
  width: number;
  height: number;
  anchorY: number;
}

export function worldToScreen(v: View2D, p: Vec2) {
  const dx = p.x - v.cx;
  const dz = p.z - v.cz;
  const c = Math.cos(v.rot);
  const s = Math.sin(v.rot);
  return { x: v.width / 2 + (dx * c - dz * s) * v.zoom, y: v.height * v.anchorY + (dx * s + dz * c) * v.zoom };
}

export function screenToWorld(v: View2D, p: { x: number; y: number }): Vec2 {
  const sx = (p.x - v.width / 2) / v.zoom;
  const sy = (p.y - v.height * v.anchorY) / v.zoom;
  const c = Math.cos(v.rot);
  const s = Math.sin(v.rot);
  return { x: v.cx + sx * c + sy * s, z: v.cz - sx * s + sy * c };
}

/** Aplica a câmera ao contexto do canvas (desenho em coordenadas do mundo). */
export function applyView(ctx: CanvasRenderingContext2D, v: View2D, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(v.width / 2, v.height * v.anchorY);
  ctx.scale(v.zoom, v.zoom);
  ctx.rotate(v.rot);
  ctx.translate(-v.cx, -v.cz);
}

/** Rotação que deixa o rumo do carro apontando para cima na tela. */
export function headingUpRotation(heading: number) {
  return heading - Math.PI / 2;
}

/** Retângulo do mundo visível (com margem), para descartar o que está fora da tela. */
export function visibleBounds(v: View2D, margin = 20) {
  const corners = [
    screenToWorld(v, { x: 0, y: 0 }),
    screenToWorld(v, { x: v.width, y: 0 }),
    screenToWorld(v, { x: 0, y: v.height }),
    screenToWorld(v, { x: v.width, y: v.height }),
  ];
  return {
    minX: Math.min(...corners.map((c) => c.x)) - margin,
    maxX: Math.max(...corners.map((c) => c.x)) + margin,
    minZ: Math.min(...corners.map((c) => c.z)) - margin,
    maxZ: Math.max(...corners.map((c) => c.z)) + margin,
  };
}

export function angleLerp(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
