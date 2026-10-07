import * as THREE from 'three';
import { sidewalkWidth } from './mapStyle';
import type { Vec2 } from '../../types';
import { PARKING, type Building, type CityData, type CityEdge } from '../../world/cityTypes';

export { sidewalkWidth };

/** Largura da faixa de estacionamento junto ao meio-fio (m). */
export const PARKING_LANE = 2.4;

/** Faixas de rolamento e de estacionamento de um trecho (para pintar a sinalização). */
export function laneLayout(e: CityEdge) {
  const left = e.curbParking && e.routable && (e.parkingSides?.left ?? true) ? PARKING_LANE : 0;
  const right = e.curbParking && e.routable && (e.parkingSides?.right ?? true) ? PARKING_LANE : 0;
  const travel = Math.max(2.8, e.width - left - right);
  const lanes = e.oneway ? Math.max(1, Math.round(travel / 3.3)) : Math.max(1, Math.round(travel / 2 / 3.3));
  return { left, right, lanes };
}

/** Largura da calçada por classe da via. */

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
  const lane: number[] = []; // faixas por sentido (ou total, se mão única), estacionamento esq./dir.
  const slots: number[] = []; // início e fim (ao longo) da área de vagas demarcadas
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
    const layout = laneLayout(e);
    // mesma regra de generateCurbSlots (cityTypes): margens junto aos cruzamentos
    const margin = (deg: number) => (deg >= 3 ? e.width / 2 + PARKING.junctionClearance : deg === 1 ? 2 : 1);
    const slotStart = margin(degA);
    const slotCount = Math.max(0, Math.floor((e.length - margin(degB) - slotStart) / PARKING.slotLength));
    const slotEnd = slotCount > 0 ? slotStart + slotCount * PARKING.slotLength : -1;
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
      lane.push(layout.lanes, layout.left, layout.right, layout.lanes, layout.left, layout.right);
      slots.push(slotStart, slotEnd, slotStart, slotEnd);
    }
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  // Cruzamentos: polígono convexo pelas "bocas" das ruas, com o mesmo asfalto (sem sinalização)
  for (const n of city.nodes.values()) {
    if (n.edges.length < 3) continue;
    const pts: Vec2[] = [];
    for (const eid of n.edges) {
      const e = city.edges.get(eid)!;
      const out = e.a === n.id ? 1 : -1; // direção saindo do nó
      const dx = e.dir.x * out;
      const dz = e.dir.z * out;
      const trim = Math.min(halfWidthAt(n.id, e.id) + 0.4, e.length / 2);
      const hw = e.width / 2;
      const cx = n.position.x + dx * trim;
      const cz = n.position.z + dz * trim;
      pts.push({ x: cx - dz * hw, z: cz + dx * hw }, { x: cx + dz * hw, z: cz - dx * hw });
    }
    const hull = convexHull(pts);
    if (hull.length < 3) continue;
    const base = positions.length / 3;
    for (const p of hull) {
      positions.push(p.x, y, p.z);
      road.push(0, 0, 1000);
      extra.push(-1, -1, 1);
      lane.push(1, 0, 0);
      slots.push(-1, -1);
    }
    for (const i of triangulate(hull)) indices.push(base + i);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('aRoad', new THREE.Float32BufferAttribute(road, 3));
  g.setAttribute('aExtra', new THREE.Float32BufferAttribute(extra, 3));
  g.setAttribute('aLane', new THREE.Float32BufferAttribute(lane, 3));
  g.setAttribute('aSlots', new THREE.Float32BufferAttribute(slots, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/** Fecho convexo (cadeia monótona de Andrew). */
export function convexHull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  if (pts.length < 3) return pts;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Calçadas: faixa mais larga que a via, sob o asfalto, com discos nos cruzamentos. */
export function buildSidewalkGeometry(city: CityData, y = 0.03) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const e of city.edges.values()) {
    const pa = city.nodes.get(e.a)!.position;
    const hw = e.width / 2 + sidewalkWidth(e);
    const nx = -e.dir.z * hw;
    const nz = e.dir.x * hw;
    const base = positions.length / 3;
    for (const s of [0, e.length]) {
      const cx = pa.x + e.dir.x * s;
      const cz = pa.z + e.dir.z * s;
      positions.push(cx - nx, y, cz - nz, cx + nx, y, cz + nz);
    }
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const discs = buildJunctionGeometry(city, y, (e) => e.width / 2 + sidewalkWidth(e), 2);
  const dp = discs.getAttribute('position').array as Float32Array;
  const offset = positions.length / 3;
  positions.push(...dp);
  for (const i of discs.getIndex()!.array) indices.push(i + offset);
  discs.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/** Discos nos nós: preenchem cruzamentos e as emendas das curvas. */
export function buildJunctionGeometry(
  city: CityData,
  y = 0.055,
  radiusOf: (e: CityEdge) => number = (e) => e.width / 2,
  maxDegree = 2,
) {
  const positions: number[] = [];
  const indices: number[] = [];
  const SEG = 14;
  for (const n of city.nodes.values()) {
    let r = 0;
    for (const eid of n.edges) r = Math.max(r, radiusOf(city.edges.get(eid)!));
    // cruzamentos (grau ≥ 3) são preenchidos por polígonos próprios; aqui só curvas e pontas
    if (r <= 0 || n.edges.length > maxDegree) continue;
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
  // atributos neutros para usar o shader do asfalto (sem sinalização)
  const n = positions.length / 3;
  g.setAttribute('aRoad', new THREE.Float32BufferAttribute(new Array(n).fill([0, 0, 1000]).flat(), 3));
  g.setAttribute('aExtra', new THREE.Float32BufferAttribute(new Array(n).fill([-1, -1, 1]).flat(), 3));
  g.setAttribute('aLane', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0]).flat(), 3));
  g.setAttribute('aSlots', new THREE.Float32BufferAttribute(new Array(n).fill([-1, -1]).flat(), 2));
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
