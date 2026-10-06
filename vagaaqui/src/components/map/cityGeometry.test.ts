import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { generateCity } from '../../world/cityGenerator';
import { buildBuildingGeometry, buildFlatGeometry, buildRoadGeometry, buildSidewalkGeometry, convexHull } from './cityGeometry';

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

  it('calçadas e cruzamentos ficam voltados para cima', () => {
    const city = generateCity();
    expect(faceNormals(buildSidewalkGeometry(city)).every(({ n }) => n.y > 0.99)).toBe(true);
    expect(convexHull([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 2, z: 1 }, { x: 4, z: 4 }, { x: 0, z: 4 }])).toHaveLength(4);
  });

  it('marcas de vaga pintadas coincidem com as vagas da simulação', () => {
    const city = generateCity();
    const g = buildRoadGeometry(city);
    const slotsAttr = g.getAttribute('aSlots');
    const roadAttr = g.getAttribute('aRoad');
    // primeiro trecho com vagas: o início pintado deve ser o limite da primeira vaga (centro - 3 m)
    const firstSlot = city.slots[0];
    const edge = city.edges.get(firstSlot.edgeId)!;
    const edgeIndex = [...city.edges.values()].indexOf(edge);
    const start = slotsAttr.getX(edgeIndex * 4);
    expect(roadAttr.getX(edgeIndex * 4)).toBeLessThan(start);
    expect(Math.abs(start - (firstSlot.s - 3))).toBeLessThan(1e-6);
  });
});
