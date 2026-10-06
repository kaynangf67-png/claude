import { latLonToWorld } from '../../lib/geo';
import type { PointOfInterest, Vec2, ZoneId } from '../../types';
import {
  distanceToPolyline,
  generateCurbSlots,
  linkGraph,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  type Building,
  type CityArea,
  type CityData,
  type CityEdge,
  type CityNode,
  type LotDef,
} from '../cityTypes';
import type { CompactOsm, LatLon, PoiCategory } from './compact';

/**
 * Constrói a cidade a partir dos dados compactos do OpenStreetMap:
 * malha viária dirigida (mão única respeitada), prédios com a planta real,
 * parques, praias, água, litoral, estacionamentos e pontos de interesse.
 */

const BASE_WIDTH: Record<string, number> = {
  motorway: 22,
  trunk: 18,
  primary: 16,
  secondary: 13,
  tertiary: 11,
  unclassified: 9,
  residential: 9,
  living_street: 7,
};
const CURB_PARKING_DEFAULT = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street']);

const project = (p: LatLon): Vec2 => latLonToWorld(p[0], p[1]);

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Douglas-Peucker: remove vértices quase colineares, mantendo os índices obrigatórios. */
function simplify(points: Vec2[], tolerance: number): number[] {
  if (points.length <= 2) return points.map((_, i) => i);
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distanceToPolyline(points[k], [points[i], points[j]]);
      if (d > maxD) {
        maxD = d;
        idx = k;
      }
    }
    if (idx >= 0 && maxD > tolerance) {
      keep[idx] = true;
      stack.push([i, idx], [idx, j]);
    }
  }
  return keep.flatMap((k, i) => (k ? [i] : []));
}

function roadWidth(h: string, lanes: number | null, width: number | null, oneway: boolean) {
  const base = BASE_WIDTH[h.replace('_link', '')] ?? 9;
  if (width) return Math.min(26, Math.max(5, width));
  if (lanes) return Math.min(26, Math.max(5, lanes * 3.2 + 3));
  const w = h.endsWith('_link') ? 7 : oneway ? base * 0.8 : base;
  return Math.max(5, w);
}

/** Maior componente fortemente conexa (Kosaraju iterativo). */
function largestScc(nodes: Map<string, CityNode>, edges: Map<string, CityEdge>) {
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    out.set(id, []);
    inc.set(id, []);
  }
  for (const e of edges.values()) {
    out.get(e.a)!.push(e.b);
    inc.get(e.b)!.push(e.a);
    if (!e.oneway) {
      out.get(e.b)!.push(e.a);
      inc.get(e.a)!.push(e.b);
    }
  }
  const order: string[] = [];
  const seen = new Set<string>();
  for (const start of nodes.keys()) {
    if (seen.has(start)) continue;
    const stack: [string, number][] = [[start, 0]];
    seen.add(start);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const next = out.get(top[0])!;
      if (top[1] < next.length) {
        const v = next[top[1]++];
        if (!seen.has(v)) {
          seen.add(v);
          stack.push([v, 0]);
        }
      } else {
        order.push(top[0]);
        stack.pop();
      }
    }
  }
  const comp = new Map<string, number>();
  let best = -1;
  let bestSize = 0;
  let c = 0;
  for (let i = order.length - 1; i >= 0; i--) {
    const root = order[i];
    if (comp.has(root)) continue;
    let size = 0;
    const stack = [root];
    comp.set(root, c);
    while (stack.length) {
      const u = stack.pop()!;
      size++;
      for (const v of inc.get(u)!) {
        if (!comp.has(v)) {
          comp.set(v, c);
          stack.push(v);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = c;
    }
    c++;
  }
  return new Set([...comp].filter(([, k]) => k === best).map(([id]) => id));
}

function estimateHeight(type: string, area: number, seed: number, nearCoast: boolean) {
  const r = hash(seed);
  if (['house', 'detached', 'semidetached_house', 'bungalow', 'garage', 'garages', 'shed', 'hut'].includes(type)) return 4 + r * 4;
  if (['apartments', 'residential'].includes(type) || (type === 'yes' && area > 250)) {
    const tall = nearCoast ? 1.6 : 1;
    return Math.min(110, (12 + Math.pow(r, 1.6) * 38) * tall);
  }
  if (['commercial', 'office', 'retail', 'hotel'].includes(type)) return 10 + r * 30;
  if (['church', 'school', 'hospital', 'university', 'public', 'civic'].includes(type)) return 9 + r * 10;
  return area < 120 ? 4 + r * 4 : 6 + r * 12;
}

export function buildCityFromOsm(data: CompactOsm): CityData {
  // ---------- malha viária ----------
  const usage = new Map<number, number>();
  for (const r of data.roads) r.nodes.forEach((id, i) => {
    const endpoint = i === 0 || i === r.nodes.length - 1;
    usage.set(id, (usage.get(id) ?? 0) + (endpoint ? 2 : 1));
  });

  const nodes = new Map<string, CityNode>();
  const ensureNode = (osmId: number, p: Vec2) => {
    const id = `o${osmId}`;
    if (!nodes.has(id)) nodes.set(id, { id, position: p, edges: [] });
    return id;
  };
  const segments: Omit<CityEdge, 'length' | 'dir'>[] = [];
  for (const road of data.roads) {
    const pts = road.g.map(project);
    const width = roadWidth(road.h, road.lanes, road.width, road.o);
    const curbParking = road.pk ? road.pk.left || road.pk.right : CURB_PARKING_DEFAULT.has(road.h) && width >= 7;
    // quebra a via nos cruzamentos e simplifica cada trecho
    let start = 0;
    for (let i = 1; i < road.nodes.length; i++) {
      const junction = (usage.get(road.nodes[i]) ?? 0) > 1 || i === road.nodes.length - 1;
      if (!junction) continue;
      const chunk = pts.slice(start, i + 1);
      const kept = simplify(chunk, 1.2).map((k) => start + k);
      for (let k = 0; k < kept.length - 1; k++) {
        const ia = kept[k];
        const ib = kept[k + 1];
        segments.push({
          id: `w${road.id}-${ia}`,
          a: ensureNode(road.nodes[ia], pts[ia]),
          b: ensureNode(road.nodes[ib], pts[ib]),
          street: road.n || 'Via sem nome',
          oneway: road.o,
          width,
          highway: road.h,
          curbParking,
          parkingSides: road.pk ?? undefined,
          routable: true,
        });
      }
      start = i;
    }
  }
  const edges = linkGraph(nodes, segments);
  for (const [id, n] of nodes) if (!n.edges.length) nodes.delete(id);
  const scc = largestScc(nodes, edges);
  for (const e of edges.values()) e.routable = scc.has(e.a) && scc.has(e.b);

  // ---------- áreas, litoral e zonas ----------
  const areas: CityArea[] = [];
  const parkingAreas: { polygon: Vec2[]; name?: string; capacity?: number; fee?: boolean }[] = [];
  const commercial: Vec2[][] = [];
  for (const a of data.areas) {
    const polygon = a.g.slice(0, -1).map(project);
    if (polygon.length < 3) continue;
    if (a.k === 'parking') {
      parkingAreas.push({ polygon, name: a.name, capacity: a.capacity, fee: a.fee });
      areas.push({ kind: 'lot', polygon, name: a.name });
    } else if (a.k === 'commercial') commercial.push(polygon);
    else areas.push({ kind: a.k, polygon, name: a.name });
  }
  const coastlines = data.coast.map((line) => line.map(project));
  const beaches = areas.filter((a) => a.kind === 'beach').map((a) => a.polygon);
  const shops = data.shops.map(project);

  const zoneCache = new Map<string, ZoneId>();
  const zoneAt = (p: Vec2): ZoneId => {
    const key = `${Math.round(p.x / 25)}:${Math.round(p.z / 25)}`;
    const hit = zoneCache.get(key);
    if (hit) return hit;
    let zone: ZoneId = 'residencial';
    const nearCoast =
      coastlines.some((l) => distanceToPolyline(p, l) < 200) ||
      beaches.some((b) => pointInPolygon(p, b) || distanceToPolyline(p, [...b, b[0]]) < 200);
    if (nearCoast) zone = 'orla';
    else {
      let density = 0;
      for (const s of shops) if (Math.abs(s.x - p.x) < 180 && Math.abs(s.z - p.z) < 180) density++;
      if (density >= 14) zone = 'centro';
      else if (density >= 5 || commercial.some((poly) => pointInPolygon(p, poly))) zone = 'comercial';
    }
    zoneCache.set(key, zone);
    return zone;
  };

  // ---------- prédios ----------
  const buildings: Building[] = [];
  data.buildings.forEach((b, i) => {
    let footprint = b.g.slice(0, -1).map(project);
    if (footprint.length < 3) return;
    let area = polygonArea(footprint);
    // anti-horário visto de cima (x leste, z sul) ⇒ área positiva nesta convenção
    if (area < 0) {
      footprint = footprint.reverse();
      area = -area;
    }
    if (area < 12) return;
    const c = polygonCentroid(footprint);
    const zone = zoneAt(c);
    const measured = b.height != null || b.levels != null;
    const h = b.height ?? (b.levels != null ? b.levels * 3.1 + 1 : estimateHeight(b.type, area, i + 1, zone === 'orla'));
    buildings.push({ footprint, h: Math.max(3, Math.min(250, h)), zone, area, measured });
  });

  // ---------- estacionamentos (lotes) ----------
  const routableEdges = [...edges.values()].filter((e) => e.routable);
  const nearestEdge = (p: Vec2) => {
    let best = { edge: routableEdges[0], s: 0, d: Infinity, side: 1 as 1 | -1 };
    for (const e of routableEdges) {
      const a = nodes.get(e.a)!.position;
      const s = Math.max(0, Math.min(e.length, (p.x - a.x) * e.dir.x + (p.z - a.z) * e.dir.z));
      const q = { x: a.x + e.dir.x * s, z: a.z + e.dir.z * s };
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < best.d) {
        // lado: produto vetorial entre a direção e o vetor até o ponto
        const cross = e.dir.x * (p.z - q.z) - e.dir.z * (p.x - q.x);
        best = { edge: e, s, d, side: cross >= 0 ? 1 : -1 };
      }
    }
    return best;
  };
  const lots: LotDef[] = parkingAreas
    .map((pa) => ({ ...pa, area: Math.abs(polygonArea(pa.polygon)) }))
    .filter((pa) => pa.area > 600 || (pa.name && pa.area > 250))
    .sort((a, b) => b.area - a.area)
    .slice(0, 6)
    .flatMap((pa, i) => {
      if (!routableEdges.length) return [];
      const center = polygonCentroid(pa.polygon);
      const near = nearestEdge(center);
      if (near.d > 120) return [];
      const s = Math.max(4, Math.min(near.edge.length - 4, near.s));
      return [
        {
          id: `lot-${i + 1}`,
          name: pa.name ?? `Estacionamento ${near.edge.street}`,
          center,
          polygon: pa.polygon,
          capacity: pa.capacity ?? Math.max(10, Math.round(pa.area / 28)),
          capacityMeasured: pa.capacity != null,
          pricePerHour: pa.fee === false ? 0 : 8 + Math.round(hash(i + 7) * 8),
          entryEdgeId: near.edge.id,
          entryS: s,
          entrySide: near.side,
        },
      ];
    });

  // ---------- pontos de interesse ----------
  const priority: PoiCategory[] = ['shopping', 'hospital', 'universidade', 'praia', 'parque', 'escritorio', 'restaurante'];
  const limits: Partial<Record<PoiCategory, number>> = { restaurante: 3, escritorio: 2, parque: 2, praia: 2 };
  const seen = new Set<string>();
  const counts = new Map<PoiCategory, number>();
  const rawPois = [
    ...data.pois,
    ...areas
      .filter((a) => a.name && (a.kind === 'beach' || (a.kind === 'park' && Math.abs(polygonArea(a.polygon)) > 2000)))
      .map((a) => ({ n: a.name!, c: (a.kind === 'beach' ? 'praia' : 'parque') as PoiCategory, p: null as LatLon | null, pos: polygonCentroid(a.polygon) })),
  ];
  const pois: PointOfInterest[] = [];
  for (const cat of priority) {
    for (const poi of rawPois) {
      if (poi.c !== cat || seen.has(poi.n)) continue;
      if ((counts.get(cat) ?? 0) >= (limits[cat] ?? 3)) break;
      const position = 'pos' in poi && poi.pos ? poi.pos : project(poi.p as LatLon);
      seen.add(poi.n);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
      pois.push({ id: `poi-${pois.length + 1}`, name: poi.n, category: cat, position });
    }
  }

  // ---------- nomes de ruas (busca) ----------
  const longest = new Map<string, CityEdge>();
  for (const e of edges.values()) {
    if (!e.street || e.street === 'Via sem nome') continue;
    const cur = longest.get(e.street);
    if (!cur || e.length > cur.length) longest.set(e.street, e);
  }
  const streetNames = [...longest.values()].map((e) => {
    const a = nodes.get(e.a)!.position;
    return { name: e.street, position: { x: a.x + (e.dir.x * e.length) / 2, z: a.z + (e.dir.z * e.length) / 2 } };
  });

  // ---------- limites e partida ----------
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const n of nodes.values()) {
    minX = Math.min(minX, n.position.x);
    maxX = Math.max(maxX, n.position.x);
    minZ = Math.min(minZ, n.position.z);
    maxZ = Math.max(maxZ, n.position.z);
  }
  const startCandidates = routableEdges
    .filter((e) => e.length >= 30 && ['residential', 'tertiary', 'secondary', 'unclassified'].includes(e.highway))
    .concat(routableEdges);
  let startEdge = startCandidates[0];
  let bestD = Infinity;
  for (const e of startCandidates.slice(0, Math.max(1, startCandidates.length - routableEdges.length))) {
    const a = nodes.get(e.a)!.position;
    const d = Math.hypot(a.x + (e.dir.x * e.length) / 2, a.z + (e.dir.z * e.length) / 2) + (e.oneway ? 40 : 0);
    if (d < bestD) {
      bestD = d;
      startEdge = e;
    }
  }
  if (!startEdge) throw new Error('Nenhuma via transitável encontrada nos dados do OpenStreetMap');

  const lotEntries = new Set(lots.map((l) => `${l.entryEdgeId}:${l.entrySide}`));
  const slots = generateCurbSlots({ nodes, edges }).filter((s) => !lotEntries.has(`${s.edgeId}:${s.side}`) || Math.abs(s.s - lots.find((l) => l.entryEdgeId === s.edgeId)!.entryS) > 8);

  return {
    source: 'osm',
    attribution: '© colaboradores do OpenStreetMap',
    nodes,
    edges,
    buildings,
    areas,
    coastlines,
    blocks: [],
    slots,
    lots,
    pois,
    streetNames,
    bounds: { minX: minX - 40, maxX: maxX + 40, minZ: minZ - 40, maxZ: maxZ + 40 },
    start: { edgeId: startEdge.id, s: Math.min(startEdge.length / 2, 25) },
    zoneAt,
    fetchedAt: data.fetchedAt,
  };
}
