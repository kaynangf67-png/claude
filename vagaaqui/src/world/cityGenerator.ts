import { createRng } from '../lib/random';
import type { PointOfInterest, Vec2, ZoneId } from '../types';

/**
 * Gera a malha urbana usada pelo MVP.
 *
 * IMPORTANTE: o traçado é procedural (grade inspirada na Praia do Canto, Vitória-ES), não
 * é a geometria real das ruas. A estrutura `CityData` foi pensada para ser preenchida
 * também por uma fonte real (ex.: OpenStreetMap/Overpass) sem mudar o restante do app:
 * routing, vagas, simulação e renderização dependem só de nós, arestas e lotes.
 */

export const GRID = {
  blocks: 8,
  blockSize: 90,
  roadWidth: 14,
  sidewalk: 4,
  /** deslocamento lateral do centro da faixa de rolamento */
  laneOffset: 2.4,
  /** deslocamento lateral da faixa de estacionamento junto ao meio-fio */
  parkingOffset: 5.6,
  slotLength: 6,
  intersectionClearance: 8,
} as const;

export const SPACING = GRID.blockSize + GRID.roadWidth;
export const CITY_SIZE = GRID.blocks * GRID.blockSize + (GRID.blocks + 1) * GRID.roadWidth;
const HALF = CITY_SIZE / 2;

export const NS_STREETS = [
  'Rua Aurora',
  'Rua das Acácias',
  'Rua Horizonte',
  'Rua dos Ipês',
  'Av. Central',
  'Rua Monte Azul',
  'Rua Marítima',
  'Rua do Farol',
  'Rua Itapoã',
];

export const EW_STREETS = [
  'Av. Norte',
  'Rua Santa Luzia',
  'Rua do Sol',
  'Rua Primavera',
  'Av. Leste-Oeste',
  'Rua Jacarandá',
  'Rua das Gaivotas',
  'Rua Coral',
  'Av. Beira-Mar',
];

export interface CityNode {
  id: string;
  i: number;
  j: number;
  position: Vec2;
  edges: string[];
}

export interface CityEdge {
  id: string;
  a: string;
  b: string;
  street: string;
  axis: 'h' | 'v';
  length: number;
  /** vetor unitário de a para b */
  dir: Vec2;
}

export interface CityBlock {
  id: string;
  i: number;
  j: number;
  center: Vec2;
  zone: ZoneId;
  kind: 'buildings' | 'park' | 'lot';
}

export interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  zone: ZoneId;
  /** maior prédio do quarteirão — mantido mesmo no modo de baixa qualidade */
  primary: boolean;
}

export interface CurbSlot {
  id: string;
  edgeId: string;
  /** +1 lado direito de a→b, -1 lado esquerdo */
  side: 1 | -1;
  /** distância (m) a partir do nó a */
  s: number;
  position: Vec2;
  heading: number;
}

export interface LotDef {
  id: string;
  name: string;
  blockId: string;
  center: Vec2;
  size: number;
  capacity: number;
  pricePerHour: number;
  entryEdgeId: string;
}

export interface CityData {
  nodes: Map<string, CityNode>;
  edges: Map<string, CityEdge>;
  blocks: CityBlock[];
  buildings: Building[];
  slots: CurbSlot[];
  lots: LotDef[];
  pois: PointOfInterest[];
  size: number;
  /** z da linha da praia (sul) */
  shoreZ: number;
}

export const streetCoord = (index: number) => -HALF + GRID.roadWidth / 2 + index * SPACING;
export const nodeId = (i: number, j: number) => `n-${i}-${j}`;

export function zoneForBlock(i: number, j: number): ZoneId {
  if (j >= 6) return 'orla';
  if (i >= 2 && i <= 5 && j >= 2 && j <= 5) return 'centro';
  if (i >= 6) return 'comercial';
  return 'residencial';
}

const LOT_BLOCKS: { i: number; j: number; name: string; capacity: number; price: number }[] = [
  { i: 4, j: 3, name: 'Estacionamento Central', capacity: 120, price: 12 },
  { i: 6, j: 5, name: 'EstacionaFácil Shopping', capacity: 260, price: 10 },
  { i: 2, j: 6, name: 'Park Orla', capacity: 80, price: 15 },
];

const PARK_BLOCKS = [
  { i: 1, j: 2 },
  { i: 5, j: 6 },
];

export function edgePoint(city: CityData, edge: CityEdge, s: number, lateral = 0): Vec2 {
  const a = city.nodes.get(edge.a)!.position;
  // lado direito de a→b: (-dir.z, dir.x)
  return {
    x: a.x + edge.dir.x * s - edge.dir.z * lateral,
    z: a.z + edge.dir.z * s + edge.dir.x * lateral,
  };
}

export function generateCity(seed = 20329): CityData {
  const rng = createRng(seed);
  const n = GRID.blocks;
  const nodes = new Map<string, CityNode>();
  const edges = new Map<string, CityEdge>();

  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      nodes.set(nodeId(i, j), {
        id: nodeId(i, j),
        i,
        j,
        position: { x: streetCoord(i), z: streetCoord(j) },
        edges: [],
      });
    }
  }

  const addEdge = (id: string, a: string, b: string, street: string, axis: 'h' | 'v') => {
    const pa = nodes.get(a)!.position;
    const pb = nodes.get(b)!.position;
    const length = Math.hypot(pb.x - pa.x, pb.z - pa.z);
    edges.set(id, { id, a, b, street, axis, length, dir: { x: (pb.x - pa.x) / length, z: (pb.z - pa.z) / length } });
    nodes.get(a)!.edges.push(id);
    nodes.get(b)!.edges.push(id);
  };

  for (let j = 0; j <= n; j++) {
    for (let i = 0; i < n; i++) addEdge(`h-${j}-${i}`, nodeId(i, j), nodeId(i + 1, j), EW_STREETS[j], 'h');
  }
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j < n; j++) addEdge(`v-${i}-${j}`, nodeId(i, j), nodeId(i, j + 1), NS_STREETS[i], 'v');
  }

  const blocks: CityBlock[] = [];
  const buildings: Building[] = [];
  const lots: LotDef[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const center = { x: streetCoord(i) + SPACING / 2, z: streetCoord(j) + SPACING / 2 };
      const zone = zoneForBlock(i, j);
      const lotDef = LOT_BLOCKS.find((l) => l.i === i && l.j === j);
      const isPark = PARK_BLOCKS.some((p) => p.i === i && p.j === j);
      const kind: CityBlock['kind'] = lotDef ? 'lot' : isPark ? 'park' : 'buildings';
      const id = `b-${i}-${j}`;
      blocks.push({ id, i, j, center, zone, kind });

      if (lotDef) {
        lots.push({
          id: `lot-${lots.length + 1}`,
          name: lotDef.name,
          blockId: id,
          center,
          size: GRID.blockSize - GRID.sidewalk * 2,
          capacity: lotDef.capacity,
          pricePerHour: lotDef.price,
          // entrada pela rua ao norte do quarteirão
          entryEdgeId: `h-${j}-${i}`,
        });
        continue;
      }
      if (isPark) continue;

      const inner = GRID.blockSize - GRID.sidewalk * 2;
      const cols = rng.int(2, 3);
      const rows = rng.int(2, 3);
      const cw = inner / cols;
      const cd = inner / rows;
      const [minH, maxH] =
        zone === 'centro' ? [28, 120] : zone === 'orla' ? [22, 85] : zone === 'comercial' ? [18, 70] : [7, 28];
      const blockBuildings: Building[] = [];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng.chance(0.1)) continue;
          const gap = rng.range(2, 5);
          const w = cw - gap;
          const d = cd - gap;
          const shape = rng.next();
          // prédios mais altos tendem a ser mais esbeltos
          const h = minH + Math.pow(shape, 2.2) * (maxH - minH);
          blockBuildings.push({
            x: center.x - inner / 2 + cw * (c + 0.5),
            z: center.z - inner / 2 + cd * (r + 0.5),
            w: Math.max(8, w * rng.range(0.75, 1)),
            d: Math.max(8, d * rng.range(0.75, 1)),
            h,
            zone,
            primary: false,
          });
        }
      }
      if (blockBuildings.length) {
        blockBuildings.reduce((a, b) => (b.h * b.w > a.h * a.w ? b : a)).primary = true;
      }
      buildings.push(...blockBuildings);
    }
  }

  // Faixas de estacionamento junto ao meio-fio em todas as ruas.
  const slots: CurbSlot[] = [];
  const city: CityData = {
    nodes,
    edges,
    blocks,
    buildings,
    slots,
    lots,
    pois: [],
    size: CITY_SIZE,
    shoreZ: HALF + 30,
  };
  for (const edge of edges.values()) {
    const start = GRID.roadWidth / 2 + GRID.intersectionClearance;
    const end = edge.length - GRID.roadWidth / 2 - GRID.intersectionClearance;
    const count = Math.floor((end - start) / GRID.slotLength);
    for (const side of [1, -1] as const) {
      // a orla não tem vagas do lado da praia
      if (edge.axis === 'h' && edge.id.startsWith(`h-${n}-`) && side === 1) continue;
      for (let k = 0; k < count; k++) {
        const s = start + GRID.slotLength * (k + 0.5);
        const position = edgePoint(city, edge, s, side * GRID.parkingOffset);
        slots.push({
          id: `${edge.id}:${side}:${k}`,
          edgeId: edge.id,
          side,
          s,
          position,
          heading: Math.atan2(-edge.dir.z, edge.dir.x),
        });
      }
    }
  }

  const blockCenter = (i: number, j: number) => blocks.find((b) => b.i === i && b.j === j)!.center;
  city.pois = [
    { id: 'poi-shopping', name: 'Shopping Atlântico', category: 'shopping', position: blockCenter(6, 4) },
    { id: 'poi-hospital', name: 'Hospital Santa Clara', category: 'hospital', position: blockCenter(3, 1) },
    { id: 'poi-praia', name: 'Praia do Farol', category: 'praia', position: { x: streetCoord(4), z: HALF + 60 } },
    { id: 'poi-univ', name: 'Campus Horizonte', category: 'universidade', position: blockCenter(0, 4) },
    { id: 'poi-rest', name: 'Restaurante Maré Alta', category: 'restaurante', position: blockCenter(3, 6) },
    { id: 'poi-torre', name: 'Torre Empresarial Aurora', category: 'escritorio', position: blockCenter(4, 2) },
    { id: 'poi-parque', name: 'Parque das Águas', category: 'parque', position: blockCenter(5, 6) },
  ];

  return city;
}

let cached: CityData | null = null;
/** A cidade é determinística; uma única instância é compartilhada pelo app. */
export function getCity(): CityData {
  if (!cached) cached = generateCity();
  return cached;
}
