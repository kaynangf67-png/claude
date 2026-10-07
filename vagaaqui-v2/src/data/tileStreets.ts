import { distance, lineLength, midpoint, type LonLat } from '../lib/geo';
import type { ParkingLot, Segment } from '../model/types';
import { profileOf } from './osm';

/**
 * Ruas tiradas das próprias "peças" (tiles) vetoriais do mapa que já está na tela
 * (esquema OpenMapTiles: camadas `transportation_name` e `poi`). Instantâneo e sem
 * depender do Overpass, que é lento e limita pedidos.
 */
export interface TileRoad {
  name: string;
  /** classe OpenMapTiles: primary, secondary, tertiary, minor, service… */
  cls: string;
  lines: LonLat[][];
}

export interface TilePoi {
  cls: string;
  name?: string;
  pos: LonLat;
}

const ROAD_CLASSES = new Set(['primary', 'secondary', 'tertiary', 'minor', 'unclassified', 'residential', 'living_street']);
/** POIs que não indicam movimento de comércio/serviço */
const NOT_ACTIVITY = new Set(['parking', 'bus', 'railway', 'bicycle_parking', 'fuel', 'park', 'playground', 'information', 'toilets', 'atm']);
const CHUNK_M = 110;
const MIN_CHUNK_M = 25;

/** highway equivalente para reaproveitar a regra de perfil do OSM */
const asHighway = (cls: string) => (cls === 'minor' ? 'residential' : cls);

/** Corta a linha em pedaços de ~110 m (≈ um quarteirão). */
export function chopLine(line: LonLat[], chunkM = CHUNK_M): LonLat[][] {
  const out: LonLat[][] = [];
  let cur: LonLat[] = [line[0]];
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    let a = line[i - 1];
    const b = line[i];
    let d = distance(a, b);
    while (acc + d > chunkM) {
      const t = (chunkM - acc) / d;
      const p: LonLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      cur.push(p);
      out.push(cur);
      cur = [p];
      d -= chunkM - acc;
      a = p;
      acc = 0;
    }
    cur.push(b);
    acc += d;
  }
  if (cur.length > 1) {
    if (acc < MIN_CHUNK_M && out.length) out[out.length - 1].push(...cur.slice(1));
    else out.push(cur);
  }
  return out;
}

export function segmentsFromTiles(roads: TileRoad[], pois: TilePoi[], center: LonLat, radiusM: number): { segments: Segment[]; lots: ParkingLot[] } {
  const activity = pois.filter((p) => !NOT_ACTIVITY.has(p.cls)).map((p) => p.pos);
  const countNear = (p: LonLat) => {
    let n = 0;
    for (const a of activity) if (Math.abs(a[1] - p[1]) < 0.001 && distance(a, p) <= 80) n++;
    return n;
  };
  const segments: Segment[] = [];
  const seen: { name: string; mid: LonLat }[] = [];
  for (const r of roads) {
    if (!ROAD_CLASSES.has(r.cls) || !r.name) continue;
    for (const line of r.lines) {
      if (line.length < 2) continue;
      for (const piece of chopLine(line)) {
        const lengthM = lineLength(piece);
        if (lengthM < MIN_CHUNK_M) continue;
        const mid = midpoint(piece);
        if (distance(mid, center) > radiusM + 150) continue;
        // a mesma rua aparece repetida na borda entre duas peças do mapa
        if (seen.some((s) => s.name === r.name && distance(s.mid, mid) < 30)) continue;
        seen.push({ name: r.name, mid });
        segments.push({
          id: `t:${r.name}:${mid[1].toFixed(4)},${mid[0].toFixed(4)}`,
          name: r.name,
          line: piece,
          mid,
          lengthM,
          capacity: Math.max(0, Math.floor((lengthM - 10) / 6)) * 2,
          profile: profileOf(asHighway(r.cls), countNear(mid)),
          noParking: false,
          paid: false,
        });
      }
    }
  }
  const lots: ParkingLot[] = pois
    .filter((p) => p.cls === 'parking' && distance(p.pos, center) <= radiusM + 300)
    .map((p) => ({ id: `t:lot:${p.pos[1].toFixed(5)},${p.pos[0].toFixed(5)}`, name: p.name || 'Estacionamento', pos: p.pos, fee: 'unknown' as const }));
  return { segments, lots };
}
