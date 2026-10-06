import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { generateCity } from '../../world/cityGenerator';
import { buildBuildingGeometry, buildFlatGeometry, buildRoadGeometry } from './cityGeometry';

/** Normal geométrica de cada triângulo (regra da mão direita = face frontal no three.js). */
function faceNormals(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position');
  const idx = g.getIndex()!;
  const out: { n: THREE.Vector3; c: THREE.Vector3 }[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    out.push({ n, c: new THREE.Vector3().add(a).add(b).add(c).divideScalar(3) });
  }
  return out;
}

describe('Geometria da cidade', () => {
  const square = [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
    { x: 0, z: 10 },
  ];

  for (const [label, footprint] of [
    ['horário', square],
    ['anti-horário', square.slice().reverse()],
  ] as const) {
    it(`prédio (contorno ${label}): paredes para fora e telhado para cima`, () => {
      const g = buildBuildingGeometry([{ footprint: [...footprint], h: 20, zone: 'centro', area: 100, measured: true }]);
      for (const { n, c } of faceNormals(g)) {
        if (Math.abs(n.y) > 0.9) expect(n.y).toBeGreaterThan(0);
        else expect(n.x * (c.x - 5) + n.z * (c.z - 5)).toBeGreaterThan(0);
      }
    });
  }

  it('áreas planas e ruas ficam voltadas para cima', () => {
    const flat = buildFlatGeometry([square, square.slice().reverse()], 0);
    expect(faceNormals(flat).every(({ n }) => n.y > 0.99)).toBe(true);
    const roads = buildRoadGeometry(generateCity());
    expect(faceNormals(roads).every(({ n }) => n.y > 0.99)).toBe(true);
  });
});
