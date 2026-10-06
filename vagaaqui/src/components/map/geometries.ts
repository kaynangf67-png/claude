import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Carro low-poly (frente para +X) usado nos carros estacionados e no trânsito. */
export function createCarGeometry() {
  const body = new THREE.BoxGeometry(4.3, 0.9, 1.85);
  body.translate(0, 0.65, 0);
  const cabin = new THREE.BoxGeometry(2.3, 0.7, 1.6);
  cabin.translate(-0.25, 1.45, 0);
  const merged = mergeGeometries([body, cabin]);
  body.dispose();
  cabin.dispose();
  return merged ?? new THREE.BoxGeometry(4.3, 1.5, 1.85);
}

let carGeometry: THREE.BufferGeometry | null = null;
export function sharedCarGeometry() {
  if (!carGeometry) carGeometry = createCarGeometry();
  return carGeometry;
}

export const CAR_COLORS = ['#c9ced8', '#2a2f3a', '#7d8696', '#e8e8ea', '#3b4a63', '#6b1f2a', '#1d3a5c', '#8a8f99'];
