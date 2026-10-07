import type { PointOfInterest, Vec2, ZoneId } from '../types';

/**
 * Modelo de cidade independente da origem dos dados.
 * Preenchido pelo OpenStreetMap (world/osm) ou pela grade procedural de reserva
 * (world/cityGenerator). Todo o resto do app — rotas, vagas, simulação e 3D — só
 * conhece este formato.
 */

export interface CityNode {
  id: string;
  position: Vec2;
  edges: string[];
}

/** Trecho reto de rua entre dois nós. Ruas curvas viram vários trechos. */
export interface CityEdge {
  id: string;
  a: string;
  b: string;
  street: string;
  length: number;
  /** vetor unitário de a para b */
  dir: Vec2;
  /** mão única: só pode ser percorrido de a para b */
  oneway: boolean;
  /** largura total da via (m) */
  width: number;
  /** classe da via no OSM (residential, primary, …) */
  highway: string;
  /** permite estacionar no meio-fio (tags do OSM ou heurística por classe da via) */
  curbParking: boolean;
  /** lados com estacionamento quando o OSM informa (direita/esquerda de a→b) */
  parkingSides?: { right: boolean; left: boolean };
  /** pertence à maior componente fortemente conexa (dá para ir e voltar) */
  routable: boolean;
}

export interface Building {
  /** contorno em sentido anti-horário visto de cima */
  footprint: Vec2[];
  h: number;
  zone: ZoneId;
  /** área (m²) — usada para descartar prédios pequenos em aparelhos fracos */
  area: number;
  /** altura veio do OSM (height/levels) ou foi estimada */
  measured: boolean;
}

export type AreaKind = 'park' | 'beach' | 'water' | 'lot' | 'plaza';

export interface CityArea {
  kind: AreaKind;
  polygon: Vec2[];
  name?: string;
}

export interface CurbSlot {
  id: string;
  edgeId: string;
  /** +1 lado direito de a→b, -1 lado esquerdo */
  side: 1 | -1;
  s: number;
  position: Vec2;
  heading: number;
}

export interface LotDef {
  id: string;
  name: string;
  center: Vec2;
  polygon: Vec2[];
  capacity: number;
  /** capacidade veio da tag capacity do OSM */
  capacityMeasured: boolean;
  pricePerHour: number;
  entryEdgeId: string;
  entryS: number;
  entrySide: 1 | -1;
}

/** Quarteirão da grade procedural (o OSM não tem esse conceito). */
export interface CityBlock {
  id: string;
  center: Vec2;
  size: number;
  kind: 'buildings' | 'park' | 'lot';
}

export interface StreetName {
  name: string;
  position: Vec2;
}

export interface CityData {
  source: 'osm' | 'procedural';
  /** texto de atribuição obrigatório para dados do OSM */
  attribution: string | null;
  nodes: Map<string, CityNode>;
  edges: Map<string, CityEdge>;
  buildings: Building[];
  areas: CityArea[];
  coastlines: Vec2[][];
  blocks: CityBlock[];
  slots: CurbSlot[];
  lots: LotDef[];
  pois: PointOfInterest[];
  streetNames: StreetName[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** posição inicial do carro do usuário */
  start: { edgeId: string; s: number };
  zoneAt: (p: Vec2) => ZoneId;
  /** data de captura dos dados (OSM) */
  fetchedAt?: string;
}

export const PARKING = {
  /** distância do meio-fio até o centro da vaga */
  curbInset: 1.25,
  slotLength: 6,
  /** distância mínima de um cruzamento (além da metade da largura) */
  junctionClearance: 7,
};

export function laneOffset(edge: CityEdge) {
  return edge.oneway ? 0 : edge.width / 4;
}

export function parkingOffset(edge: CityEdge) {
  return edge.width / 2 - PARKING.curbInset;
}

export function edgePoint(city: CityData, edge: CityEdge, s: number, lateral = 0): Vec2 {
  const a = city.nodes.get(edge.a)!.position;
  // lado direito de a→b: (-dir.z, dir.x)
  return {
    x: a.x + edge.dir.x * s - edge.dir.z * lateral,
    z: a.z + edge.dir.z * s + edge.dir.x * lateral,
  };
}

/** Pode seguir pela aresta saindo do nó `from`? (respeita mão única) */
export function canTraverse(edge: CityEdge, from: string) {
  return !edge.oneway || edge.a === from;
}

export function polygonArea(poly: Vec2[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
}

export function polygonCentroid(poly: Vec2[]): Vec2 {
  let x = 0;
  let z = 0;
  for (const p of poly) {
    x += p.x;
    z += p.z;
  }
  return { x: x / poly.length, z: z / poly.length };
}

export function pointInPolygon(p: Vec2, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function distanceToPolyline(p: Vec2, line: Vec2[]) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)));
  }
  return best;
}

/** Gera vagas de meio-fio em todas as ruas que permitem estacionar. */
export function generateCurbSlots(city: Pick<CityData, 'nodes' | 'edges'>, skip?: (edge: CityEdge, side: 1 | -1) => boolean) {
  const slots: CurbSlot[] = [];
  for (const edge of city.edges.values()) {
    if (!edge.curbParking || !edge.routable) continue;
    const margin = (nodeId: string) => {
      const degree = city.nodes.get(nodeId)!.edges.length;
      return degree >= 3 ? edge.width / 2 + PARKING.junctionClearance : degree === 1 ? 2 : 1;
    };
    const start = margin(edge.a);
    const end = edge.length - margin(edge.b);
    const count = Math.floor((end - start) / PARKING.slotLength);
    if (count <= 0) continue;
    const offset = parkingOffset(edge);
    const pa = city.nodes.get(edge.a)!.position;
    for (const side of [1, -1] as const) {
      if (skip?.(edge, side)) continue;
      if (edge.parkingSides && !(side === 1 ? edge.parkingSides.right : edge.parkingSides.left)) continue;
      for (let k = 0; k < count; k++) {
        const s = start + PARKING.slotLength * (k + 0.5);
        slots.push({
          id: `${edge.id}:${side}:${k}`,
          edgeId: edge.id,
          side,
          s,
          position: {
            x: pa.x + edge.dir.x * s - edge.dir.z * side * offset,
            z: pa.z + edge.dir.z * s + edge.dir.x * side * offset,
          },
          heading: Math.atan2(-edge.dir.z, edge.dir.x),
        });
      }
    }
  }
  return slots;
}

/** Monta o mapa de nós/arestas a partir de nós e trechos, ligando as listas de adjacência. */
export function linkGraph(
  nodes: Map<string, CityNode>,
  segments: Omit<CityEdge, 'length' | 'dir'>[],
): Map<string, CityEdge> {
  const edges = new Map<string, CityEdge>();
  for (const seg of segments) {
    const pa = nodes.get(seg.a)!.position;
    const pb = nodes.get(seg.b)!.position;
    const length = Math.hypot(pb.x - pa.x, pb.z - pa.z);
    if (length < 0.5) continue;
    edges.set(seg.id, { ...seg, length, dir: { x: (pb.x - pa.x) / length, z: (pb.z - pa.z) / length } });
    nodes.get(seg.a)!.edges.push(seg.id);
    nodes.get(seg.b)!.edges.push(seg.id);
  }
  return edges;
}
