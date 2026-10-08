import * as THREE from 'three';
import type { Vec3 } from '../signEngine';

export type Side = 'R' | 'L';

/** Sinal do eixo X do mundo para cada lado (avatar olha para +Z; a mão direita fica em -X). */
export const SIDE_X: Record<Side, number> = { R: -1, L: 1 };

/** Converte do referencial ipsilateral do sinalizador para o referencial do corpo. */
export function toBody(v: Vec3, side: Side, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(v[0] * SIDE_X[side], v[1], v[2]);
}

const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

/** Quaternion da mão: Y local = direção dos dedos, Z local = normal da palma. */
export function handBasis(fingers: THREE.Vector3, palm: THREE.Vector3, out = new THREE.Quaternion()): THREE.Quaternion {
  _y.copy(fingers).normalize();
  _z.copy(palm).addScaledVector(_y, -palm.dot(_y));
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

/**
 * IK analítico de dois ossos (ombro → cotovelo → punho).
 * Retorna a posição do cotovelo e ajusta `wrist` se o alvo estiver fora de alcance.
 */
export function solveTwoBone(shoulder: THREE.Vector3, wrist: THREE.Vector3, a: number, b: number, pole: THREE.Vector3, outElbow = new THREE.Vector3()): THREE.Vector3 {
  const dir = _x.subVectors(wrist, shoulder);
  let d = dir.length();
  const minD = Math.abs(a - b) + 1e-3;
  const maxD = a + b - 1e-3;
  if (d > maxD) {
    dir.multiplyScalar(maxD / d);
    wrist.copy(shoulder).add(dir);
    d = maxD;
  } else if (d < minD) {
    dir.multiplyScalar(minD / Math.max(d, 1e-5));
    wrist.copy(shoulder).add(dir);
    d = minD;
  }
  dir.normalize();
  const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const perp = _y.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0);
  perp.normalize();
  return outElbow.copy(shoulder).addScaledVector(dir, a * cosA).addScaledVector(perp, a * sinA);
}

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

/** Posiciona um segmento (capsule alinhada a +Y) entre dois pontos. */
export function placeSegment(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  _d.subVectors(to, from);
  const len = _d.length();
  obj.position.copy(from).addScaledVector(_d, 0.5);
  if (len > 1e-6) obj.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
  return len;
}

/** Suavização exponencial independente de FPS. */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}
