import { distance, distanceToLine, lineLength, midpoint, type LonLat } from '../lib/geo';
import type { AreaProfile, ParkingLot, Segment } from '../model/types';

/** Resposta do Overpass com `out geom` (vias) e `out center` (estacionamentos). */
export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  nodes?: number[];
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/** comércio e serviços que lotam a rua de dia */
export const ACTIVITY_AMENITIES = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'bank', 'pharmacy', 'clinic', 'hospital', 'doctors', 'dentist', 'school', 'university', 'college', 'marketplace', 'townhall', 'courthouse', 'post_office', 'cinema', 'theatre', 'place_of_worship'];

export const ROAD_TYPES = ['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link'];

export function overpassQuery(center: LonLat, radiusM: number) {
  const around = `around:${Math.round(radiusM)},${center[1].toFixed(6)},${center[0].toFixed(6)}`;
  return `[out:json][timeout:10];
way["highway"~"^(${ROAD_TYPES.join('|')})$"](${around});
out geom;
nwr["amenity"="parking"](${around});
out center tags;
(node["shop"](${around});node["amenity"~"^(${ACTIVITY_AMENITIES.join('|')})$"](${around});node["office"](${around}););
out skel;`;
}

/**
 * Perfil do trecho: o tipo de via do OSM sozinho engana (quase toda rua pequena
 * do centro é "residential"), então contamos comércio/serviços a até 80 m.
 */
export function profileOf(highway: string, activityNearby: number): AreaProfile {
  if (activityNearby >= 4) return 'commercial';
  if (highway.startsWith('primary') || highway.startsWith('secondary')) return activityNearby >= 1 ? 'commercial' : 'mixed';
  if (activityNearby >= 1) return 'mixed';
  if (highway === 'residential' || highway === 'living_street') return 'residential';
  return 'mixed';
}

const ACTIVITY_RADIUS_M = 80;

const NO = new Set(['no', 'no_parking', 'no_stopping', 'separate']);

/** Lados com estacionamento permitido, a partir das tags parking:* do OSM (padrão: 2). */
export function parkingSides(tags: Record<string, string>): number {
  const both = tags['parking:both'] ?? tags['parking:lane:both'];
  const left = tags['parking:left'] ?? tags['parking:lane:left'] ?? both;
  const right = tags['parking:right'] ?? tags['parking:lane:right'] ?? both;
  let sides = 2;
  if (left && NO.has(left)) sides--;
  if (right && NO.has(right)) sides--;
  if (tags.highway === 'living_street') sides = Math.min(sides, 1);
  return sides;
}

function isPaid(tags: Record<string, string>) {
  return Object.entries(tags).some(([k, v]) => k.startsWith('parking') && ((k.includes('fee') && v === 'yes') || v === 'ticket'));
}

/**
 * Converte vias OSM em TRECHOS entre cruzamentos (a unidade de previsão).
 * IDs estáveis `wayId-índice`, para os relatos continuarem valendo entre downloads.
 */
export function buildSegments(elements: OverpassElement[]): { segments: Segment[]; lots: ParkingLot[] } {
  const ways = elements.filter((e) => e.type === 'way' && e.tags?.highway && ROAD_TYPES.includes(e.tags.highway) && e.nodes && e.geometry && e.nodes.length === e.geometry.length);
  const uses = new Map<number, number>();
  for (const w of ways) for (const n of new Set(w.nodes)) uses.set(n, (uses.get(n) ?? 0) + 1);

  const activity = elements
    .filter((e) => e.type === 'node' && e.lat !== undefined && e.lon !== undefined && (!e.tags || e.tags.shop || e.tags.office || (e.tags.amenity && ACTIVITY_AMENITIES.includes(e.tags.amenity))))
    .filter((e) => !e.tags || e.tags.amenity !== 'parking')
    .map((e) => [e.lon!, e.lat!] as LonLat);
  const countNear = (p: LonLat) => {
    let n = 0;
    for (const a of activity) if (Math.abs(a[1] - p[1]) < 0.001 && distance(a, p) <= ACTIVITY_RADIUS_M) n++;
    return n;
  };

  const segments: Segment[] = [];
  for (const w of ways) {
    const tags = w.tags!;
    const sides = parkingSides(tags);
    const pts = w.geometry!.map((g) => [g.lon, g.lat] as LonLat);
    let start = 0;
    let k = 0;
    for (let i = 1; i < pts.length; i++) {
      const isJunction = (uses.get(w.nodes![i]) ?? 0) > 1;
      if (!isJunction && i !== pts.length - 1) continue;
      const line = pts.slice(start, i + 1);
      const lengthM = lineLength(line);
      if (lengthM >= 15) {
        const mid = midpoint(line);
        segments.push({
          id: `${w.id}-${k}`,
          name: tags.name || (tags.ref ? `Via ${tags.ref}` : 'Rua sem nome'),
          line,
          mid,
          lengthM,
          capacity: Math.max(0, Math.floor((lengthM - 10) / 6)) * sides,
          profile: profileOf(tags.highway, countNear(mid)),
          noParking: sides === 0,
          paid: isPaid(tags),
        });
      }
      k++;
      start = i;
    }
  }

  const lots: ParkingLot[] = elements
    .filter((e) => e.tags?.amenity === 'parking' && (e.center || (e.lat !== undefined && e.lon !== undefined)))
    .filter((e) => e.tags?.access !== 'private' && e.tags?.access !== 'customers')
    .map((e) => {
      const c = e.center ?? { lat: e.lat!, lon: e.lon! };
      const fee = e.tags?.fee === 'yes' ? 'yes' : e.tags?.fee === 'no' ? 'no' : 'unknown';
      return {
        id: `${e.type}-${e.id}`,
        name: e.tags?.name || (e.tags?.parking === 'street_side' ? 'Bolsão de estacionamento' : 'Estacionamento'),
        pos: [c.lon, c.lat] as LonLat,
        fee,
        capacity: e.tags?.capacity ? Number(e.tags.capacity) || undefined : undefined,
      } satisfies ParkingLot;
    });
  return { segments, lots };
}

export function nearestSegment(segments: Segment[], p: LonLat, maxM: number): Segment | null {
  let best: Segment | null = null;
  let bestD = maxM;
  for (const s of segments) {
    // filtro rápido pelo meio do trecho antes da conta exata
    if (distance(s.mid, p) > s.lengthM / 2 + maxM) continue;
    const d = distanceToLine(p, s.line);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
