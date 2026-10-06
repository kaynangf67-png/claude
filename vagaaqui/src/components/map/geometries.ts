import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Carro em duas malhas que compartilham as mesmas matrizes de instância:
 *  - carroceria: recebe a cor de cada carro (instanceColor)
 *  - partes escuras: vidros, rodas e para-choques
 * Frente para +X, comprimento 4,4 m, largura 1,8 m.
 */
function merge(parts: THREE.BufferGeometry[]) {
  const nonIndexed = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(nonIndexed);
  parts.forEach((p) => p.dispose());
  nonIndexed.forEach((p) => p.dispose());
  return merged!;
}

export function createCarBodyGeometry() {
  // carroceria baixa e cabine mais estreita, com cantos arredondados
  const lower = new RoundedBoxGeometry(4.4, 0.62, 1.8, 2, 0.18);
  lower.translate(0, 0.58, 0);
  const cabin = new RoundedBoxGeometry(2.35, 0.55, 1.62, 2, 0.2);
  cabin.translate(-0.25, 1.12, 0);
  return merge([lower, cabin]);
}

export function createCarDarkGeometry() {
  // vidros levemente maiores que a cabine (aparecem nas laterais, frente e traseira)
  const glass = new THREE.BoxGeometry(2.1, 0.4, 1.66);
  glass.translate(-0.25, 1.14, 0);
  const wheels: THREE.BufferGeometry[] = [];
  for (const x of [1.38, -1.38]) {
    for (const z of [0.82, -0.82]) {
      const w = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12);
      w.rotateX(Math.PI / 2);
      w.translate(x, 0.33, z);
      wheels.push(w);
    }
  }
  const bumperF = new THREE.BoxGeometry(0.08, 0.16, 1.5);
  bumperF.translate(2.21, 0.42, 0);
  const bumperR = bumperF.clone();
  bumperR.translate(-4.42, 0, 0);
  return merge([glass, ...wheels, bumperF, bumperR]);
}

let body: THREE.BufferGeometry | null = null;
let dark: THREE.BufferGeometry | null = null;
export const sharedCarBody = () => (body ??= createCarBodyGeometry());
export const sharedCarDark = () => (dark ??= createCarDarkGeometry());

/** Cores de carros reais (predominam prata, branco, preto e cinza no Brasil). */
export const CAR_COLORS = ['#c4c8ce', '#e9eaec', '#1c1e22', '#6f747c', '#9aa0a8', '#7a1d24', '#1f3d68', '#e3e4e6', '#3a3d42', '#b9b2a6'];
