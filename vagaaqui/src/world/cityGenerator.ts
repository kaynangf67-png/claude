import { createRng } from '../lib/random';
import type { PointOfInterest, Vec2, ZoneId } from '../types';
import {
  generateCurbSlots,
  linkGraph,
  polygonArea,
  type Building,
  type CityArea,
  type CityBlock,
  type CityData,
  type CityEdge,
  type CityNode,
  type LotDef,
} from './cityTypes';

/**
 * Cidade procedural de RESERVA (grade fictícia), usada quando os dados do
 * OpenStreetMap não estão disponíveis (sem rede, Overpass fora do ar) ou com
 * VITE_MAP_SOURCE=procedural. Produz o mesmo CityData que o importador OSM.
 */

const BLOCKS = 8;
const BLOCK = 90;
const ROAD = 14;
const SIDEWALK = 4;
const SPACING = BLOCK + ROAD;
const SIZE = BLOCKS * BLOCK + (BLOCKS + 1) * ROAD;
const HALF = SIZE / 2;

export const NS_STREETS = ['Rua Aurora', 'Rua das Acácias', 'Rua Horizonte', 'Rua dos Ipês', 'Av. Central', 'Rua Monte Azul', 'Rua Marítima', 'Rua do Farol', 'Rua Itapoã'];
export const EW_STREETS = ['Av. Norte', 'Rua Santa Luzia', 'Rua do Sol', 'Rua Primavera', 'Av. Leste-Oeste', 'Rua Jacarandá', 'Rua das Gaivotas', 'Rua Coral', 'Av. Beira-Mar'];

const streetCoord = (index: number) => -HALF + ROAD / 2 + index * SPACING;
const nodeId = (i: number, j: number) => `n-${i}-${j}`;

function zoneForBlock(i: number, j: number): ZoneId {
  if (j >= 6) return 'orla';
  if (i >= 2 && i <= 5 && j >= 2 && j <= 5) return 'centro';
  if (i >= 6) return 'comercial';
  return 'residencial';
}

function blockIndexAt(v: number) {
  return Math.max(0, Math.min(BLOCKS - 1, Math.floor((v - streetCoord(0)) / SPACING)));
}

const rect = (cx: number, cz: number, w: number, d: number): Vec2[] => [
  { x: cx - w / 2, z: cz + d / 2 },
  { x: cx + w / 2, z: cz + d / 2 },
  { x: cx + w / 2, z: cz - d / 2 },
  { x: cx - w / 2, z: cz - d / 2 },
];

const LOT_BLOCKS = [
  { i: 4, j: 3, name: 'Estacionamento Central', capacity: 120, price: 12 },
  { i: 6, j: 5, name: 'EstacionaFácil Shopping', capacity: 260, price: 10 },
  { i: 2, j: 6, name: 'Park Orla', capacity: 80, price: 15 },
];
const PARK_BLOCKS = [
  { i: 1, j: 2 },
  { i: 5, j: 6 },
];

export function generateCity(seed = 20329): CityData {
  const rng = createRng(seed);
  const nodes = new Map<string, CityNode>();
  for (let i = 0; i <= BLOCKS; i++) {
    for (let j = 0; j <= BLOCKS; j++) {
      nodes.set(nodeId(i, j), { id: nodeId(i, j), position: { x: streetCoord(i), z: streetCoord(j) }, edges: [] });
    }
  }
  const base = { oneway: false, width: ROAD, highway: 'residential', curbParking: true, routable: true };
  const segments: Omit<CityEdge, 'length' | 'dir'>[] = [];
  for (let j = 0; j <= BLOCKS; j++) {
    for (let i = 0; i < BLOCKS; i++) segments.push({ ...base, id: `h-${j}-${i}`, a: nodeId(i, j), b: nodeId(i + 1, j), street: EW_STREETS[j] });
  }
  for (let i = 0; i <= BLOCKS; i++) {
    for (let j = 0; j < BLOCKS; j++) segments.push({ ...base, id: `v-${i}-${j}`, a: nodeId(i, j), b: nodeId(i, j + 1), street: NS_STREETS[i] });
  }
  const edges = linkGraph(nodes, segments);

  const blocks: CityBlock[] = [];
  const buildings: Building[] = [];
  const areas: CityArea[] = [];
  const lots: LotDef[] = [];
  const inner = BLOCK - SIDEWALK * 2;

  for (let i = 0; i < BLOCKS; i++) {
    for (let j = 0; j < BLOCKS; j++) {
      const center = { x: streetCoord(i) + SPACING / 2, z: streetCoord(j) + SPACING / 2 };
      const zone = zoneForBlock(i, j);
      const lotDef = LOT_BLOCKS.find((l) => l.i === i && l.j === j);
      const isPark = PARK_BLOCKS.some((p) => p.i === i && p.j === j);
      blocks.push({ id: `b-${i}-${j}`, center, size: BLOCK, kind: lotDef ? 'lot' : isPark ? 'park' : 'buildings' });
      if (lotDef) {
        const polygon = rect(center.x, center.z, inner, inner);
        const entryEdgeId = `h-${j}-${i}`;
        lots.push({
          id: `lot-${lots.length + 1}`,
          name: lotDef.name,
          center,
          polygon,
          capacity: lotDef.capacity,
          capacityMeasured: false,
          pricePerHour: lotDef.price,
          entryEdgeId,
          entryS: edges.get(entryEdgeId)!.length / 2,
          entrySide: 1,
        });
        areas.push({ kind: 'lot', polygon, name: lotDef.name });
        continue;
      }
      if (isPark) {
        areas.push({ kind: 'park', polygon: rect(center.x, center.z, inner, inner) });
        continue;
      }
      const cols = rng.int(2, 3);
      const rows = rng.int(2, 3);
      const cw = inner / cols;
      const cd = inner / rows;
      const [minH, maxH] = zone === 'centro' ? [28, 120] : zone === 'orla' ? [22, 85] : zone === 'comercial' ? [18, 70] : [7, 28];
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng.chance(0.1)) continue;
          const gap = rng.range(2, 5);
          const w = Math.max(8, (cw - gap) * rng.range(0.75, 1));
          const d = Math.max(8, (cd - gap) * rng.range(0.75, 1));
          const footprint = rect(center.x - inner / 2 + cw * (c + 0.5), center.z - inner / 2 + cd * (r + 0.5), w, d);
          buildings.push({ footprint, h: minH + Math.pow(rng.next(), 2.2) * (maxH - minH), zone, area: Math.abs(polygonArea(footprint)), measured: false });
        }
      }
    }
  }

  // orla ao sul: areia + mar
  const shoreZ = HALF + 30;
  areas.push({ kind: 'beach', polygon: rect(0, HALF + 45, SIZE + 400, 56) });
  areas.push({ kind: 'water', polygon: rect(0, HALF + 73 + 900, 6000, 1800) });

  const n = BLOCKS;
  const slots = generateCurbSlots({ nodes, edges }, (edge, side) => edge.id.startsWith(`h-${n}-`) && side === 1);

  const blockCenter = (i: number, j: number) => blocks.find((b) => b.id === `b-${i}-${j}`)!.center;
  const pois: PointOfInterest[] = [
    { id: 'poi-shopping', name: 'Shopping Atlântico', category: 'shopping', position: blockCenter(6, 4) },
    { id: 'poi-hospital', name: 'Hospital Santa Clara', category: 'hospital', position: blockCenter(3, 1) },
    { id: 'poi-praia', name: 'Praia do Farol', category: 'praia', position: { x: streetCoord(4), z: HALF + 60 } },
    { id: 'poi-univ', name: 'Campus Horizonte', category: 'universidade', position: blockCenter(0, 4) },
    { id: 'poi-rest', name: 'Restaurante Maré Alta', category: 'restaurante', position: blockCenter(3, 6) },
    { id: 'poi-torre', name: 'Torre Empresarial Aurora', category: 'escritorio', position: blockCenter(4, 2) },
    { id: 'poi-parque', name: 'Parque das Águas', category: 'parque', position: blockCenter(5, 6) },
  ];

  return {
    source: 'procedural',
    attribution: null,
    nodes,
    edges,
    buildings,
    areas,
    coastlines: [[{ x: -HALF - 200, z: shoreZ + 28 }, { x: HALF + 200, z: shoreZ + 28 }]],
    blocks,
    slots,
    lots,
    pois,
    streetNames: [
      ...NS_STREETS.map((name, i) => ({ name, position: { x: streetCoord(i), z: 0 } })),
      ...EW_STREETS.map((name, j) => ({ name, position: { x: 0, z: streetCoord(j) } })),
    ],
    bounds: { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF + 60 },
    start: { edgeId: 'h-5-2', s: 30 },
    zoneAt: (p) => zoneForBlock(blockIndexAt(p.x), blockIndexAt(p.z)),
  };
}
