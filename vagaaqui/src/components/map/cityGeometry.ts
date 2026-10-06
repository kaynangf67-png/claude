import * as THREE from 'three';
import type { Vec2 } from '../../types';
import type { Building, CityData } from '../../world/cityTypes';

/**
 * Geometrias da cidade montadas a partir do CityData (OSM ou procedural).
 * Tudo é mesclado em poucos BufferGeometry → poucas draw calls, mesmo com
 * milhares de prédios e trechos de rua.
 */

/** Ruas: um quadrilátero por trecho, recortado nos cruzamentos, com atributos para o shader. */
export function buildRoadGeometry(city: CityData, y = 0.06) {
  const positions: number[] = [];
  const road: number[] = []; // along, across, halfWidth
  const extra: number[] = []; // início da faixa de pedestres no início/fim (-1 = nenhuma), mão única
  const indices: number[] = [];

  const halfWidthAt = (nodeId: string, except: string) => {
    let w = 0;
    for (const eid of city.nodes.get(nodeId)!.edges) if (eid !== except) w = Math.max(w, city.edges.get(eid)!.width / 2);
    return w;
  };

  for (const e of city.edges.values()) {
    const pa = city.nodes.get(e.a)!.position;
    const degA = city.nodes.get(e.a)!.edges.length;
    const degB = city.nodes.get(e.b)!.edges.length;
    // recorta o trecho dentro do cruzamento (o disco do cruzamento preenche)
    const trimA = degA >= 3 ? halfWidthAt(e.a, e.id) + 0.4 : 0;
    const trimB = degB >= 3 ? halfWidthAt(e.b, e.id) + 0.4 : 0;
    const s0 = Math.min(trimA, e.length / 2);
    const s1 = Math.max(e.length - trimB, e.length / 2);
    if (s1 - s0 < 0.3) continue;
    const hw = e.width / 2;
    const nx = -e.dir.z * hw;
    const nz = e.dir.x * hw;
    const base = positions.length / 3;
    for (const s of [s0, s1]) {
      const cx = pa.x + e.dir.x * s;
      const cz = pa.z + e.dir.z * s;
      positions.push(cx - nx, y, cz - nz, cx + nx, y, cz + nz);
      road.push(s, -hw, hw, s, hw, hw);
      const zebraA = degA >= 3 ? s0 + 0.6 : -1;
      const zebraB = degB >= 3 ? s1 - 0.6 : -1;
      extra.push(zebraA, zebraB, e.oneway ? 1 : 0, zebraA, zebraB, e.oneway ? 1 : 0);
    }
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('aRoad', new THREE.Float32BufferAttribute(road, 3));
  g.setAttribute('aExtra', new THREE.Float32BufferAttribute(extra, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/** Discos nos nós: preenchem cruzamentos e as emendas das curvas. */
export function buildJunctionGeometry(city: CityData, y = 0.055) {
  const positions: number[] = [];
  const indices: number[] = [];
  const SEG = 14;
  for (const n of city.nodes.values()) {
    let r = 0;
    for (const eid of n.edges) r = Math.max(r, city.edges.get(eid)!.width / 2);
    if (r <= 0) continue;
    if (n.edges.length >= 3) r *= 1.12;
    const base = positions.length / 3;
    positions.push(n.position.x, y, n.position.z);
    for (let k = 0; k < SEG; k++) {
      const t = (k / SEG) * Math.PI * 2;
      positions.push(n.position.x + Math.cos(t) * r, y, n.position.z + Math.sin(t) * r);
      indices.push(base, base + 1 + ((k + 1) % SEG), base + 1 + k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

function signedArea(poly: Vec2[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
}

/** Triangula um polígono plano, garantindo que as faces apontem para cima (+Y). */
export function triangulate(poly: Vec2[]): number[] {
  const contour = poly.map((p) => new THREE.Vector2(p.x, p.z));
  let tris: number[][] = [];
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch {
    return [];
  }
  const out: number[] = [];
  for (const [a, b, c] of tris) {
    const pa = poly[a];
    const pb = poly[b];
    const pc = poly[c];
    // normal Y = (pc - pa) × (pb - pa) no plano xz
    const ny = (pc.x - pa.x) * (pb.z - pa.z) - (pc.z - pa.z) * (pb.x - pa.x);
    if (ny >= 0) out.push(a, b, c);
    else out.push(a, c, b);
  }
  return out;
}

/** Prédios extrudados da planta real, com atributos para janelas procedurais. */
export function buildBuildingGeometry(buildings: Building[], baseY = 0) {
  const positions: number[] = [];
  const normals: number[] = [];
  const seed: number[] = [];
  const height: number[] = [];
  const localY: number[] = [];
  const wallU: number[] = [];
  const indices: number[] = [];

  buildings.forEach((b, bi) => {
    const poly = b.footprint;
    const n = poly.length;
    if (n < 3) return;
    const ccw = signedArea(poly) > 0;
    const sd = ((bi * 0.618033) % 1) + 0.001;
    const top = baseY + b.h;
    let u = 0;
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % n];
      const len = Math.hypot(q.x - p.x, q.z - p.z);
      if (len < 0.05) continue;
      const dx = (q.x - p.x) / len;
      const dz = (q.z - p.z) / len;
      // normal externa depende do sentido do contorno
      const nx = ccw ? dz : -dz;
      const nz = ccw ? -dx : dx;
      const base = positions.length / 3;
      positions.push(p.x, baseY, p.z, q.x, baseY, q.z, q.x, top, q.z, p.x, top, p.z);
      for (let k = 0; k < 4; k++) {
        normals.push(nx, 0, nz);
        seed.push(sd);
        height.push(b.h);
      }
      localY.push(0, 0, 1, 1);
      wallU.push(u, u + len, u + len, u);
      u += len;
      // ordem escolhida para a face ficar voltada para fora
      if (ccw) indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
      else indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const roof = triangulate(poly);
    const base = positions.length / 3;
    for (const p of poly) {
      positions.push(p.x, top, p.z);
      normals.push(0, 1, 0);
      seed.push(sd);
      height.push(b.h);
      localY.push(1);
      wallU.push(0);
    }
    for (const i of roof) indices.push(base + i);
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  g.setAttribute('aHeight', new THREE.Float32BufferAttribute(height, 1));
  g.setAttribute('aLocalY', new THREE.Float32BufferAttribute(localY, 1));
  g.setAttribute('aWallU', new THREE.Float32BufferAttribute(wallU, 1));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/** Polígonos planos mesclados (parques, praias, água, estacionamentos). UV em metros/escala. */
export function buildFlatGeometry(polygons: Vec2[][], y: number, uvScale = 1) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const poly of polygons) {
    if (poly.length < 3) continue;
    const tris = triangulate(poly);
    if (!tris.length) continue;
    const base = positions.length / 3;
    for (const p of poly) {
      positions.push(p.x, y, p.z);
      uvs.push(p.x / uvScale, p.z / uvScale);
    }
    for (const i of tris) indices.push(base + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/** Faixa contínua ao longo de uma polilinha (litoral, rota). */
export function buildPolylineRibbon(lines: Vec2[][], width: number, y: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const line of lines) {
    if (line.length < 2) continue;
    const base = positions.length / 3;
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)];
      const b = line[Math.min(line.length - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const nx = (-(b.z - a.z) / len) * (width / 2);
      const nz = ((b.x - a.x) / len) * (width / 2);
      positions.push(line[i].x + nx, y, line[i].z + nz, line[i].x - nx, y, line[i].z - nz);
      if (i < line.length - 1) {
        const k = base + i * 2;
        indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}
