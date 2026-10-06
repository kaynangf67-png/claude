import { config } from '../config';
import { fromLocal, type LonLat } from '../lib/geo';
import type { ParkingLot, Segment } from '../model/types';
import { buildSegments, overpassQuery, type OverpassElement } from './osm';

export type StreetSource = 'osm' | 'cache' | 'demo';

export interface StreetData {
  segments: Segment[];
  lots: ParkingLot[];
  source: StreetSource;
}

const CACHE_PREFIX = 'vq2.streets.';
const CACHE_DAYS = 7;
const CACHE_MAX = 8;
export const STREET_RADIUS_M = 800;

/** chave da área: grade de ~500 m, para destinos vizinhos reaproveitarem o download */
function areaKey(c: LonLat) {
  return `${(Math.round(c[0] * 200) / 200).toFixed(3)},${(Math.round(c[1] * 200) / 200).toFixed(3)}`;
}

function readCache(key: string): StreetData | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; segments: Segment[]; lots: ParkingLot[] };
    if (Date.now() - v.at > CACHE_DAYS * 86400000) return null;
    return { segments: v.segments, lots: v.lots, source: 'cache' };
  } catch {
    return null;
  }
}

function writeCache(key: string, data: StreetData) {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length >= CACHE_MAX) {
      const oldest = keys
        .map((k) => ({ k, at: (JSON.parse(localStorage.getItem(k) || '{}') as { at?: number }).at ?? 0 }))
        .sort((a, b) => a.at - b.at)[0];
      if (oldest) localStorage.removeItem(oldest.k);
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), segments: data.segments, lots: data.lots }));
  } catch {
    /* sem espaço / modo privado: segue sem cache */
  }
}

async function fetchOverpass(center: LonLat, signal?: AbortSignal): Promise<OverpassElement[]> {
  const body = 'data=' + encodeURIComponent(overpassQuery(center, STREET_RADIUS_M));
  let lastErr: unknown = null;
  for (const url of config.overpassUrls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      signal?.addEventListener('abort', () => ctrl.abort());
      const res = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { elements: OverpassElement[] };
      return json.elements;
    } catch (e) {
      lastErr = e;
      if (signal?.aborted) throw e;
    }
  }
  throw lastErr ?? new Error('Overpass indisponível');
}

/**
 * Ruas em volta de um ponto: cache local → OpenStreetMap (Overpass) → grade de
 * demonstração (só se tudo falhar, e o app avisa que as ruas são simuladas).
 */
export async function loadStreets(center: LonLat, signal?: AbortSignal): Promise<StreetData> {
  const key = areaKey(center);
  const cached = readCache(key);
  if (cached && cached.segments.length) return cached;
  try {
    const { segments, lots } = buildSegments(await fetchOverpass(center, signal));
    if (segments.length) {
      const data: StreetData = { segments, lots, source: 'osm' };
      writeCache(key, data);
      return data;
    }
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  return { ...demoGrid(center), source: 'demo' };
}

/** Grade de quarteirões de 100 m em volta do ponto (fallback de demonstração). */
export function demoGrid(center: LonLat): { segments: Segment[]; lots: ParkingLot[] } {
  const segments: Segment[] = [];
  const N = 6;
  const step = 100;
  const name = (axis: 'h' | 'v', i: number) => (axis === 'h' ? `Rua Demonstração ${i + N + 1}` : `Avenida Demonstração ${i + N + 1}`);
  for (let i = -N; i <= N; i++) {
    for (let j = -N; j < N; j++) {
      for (const axis of ['h', 'v'] as const) {
        const a = axis === 'h' ? fromLocal(center, j * step, i * step) : fromLocal(center, i * step, j * step);
        const b = axis === 'h' ? fromLocal(center, (j + 1) * step, i * step) : fromLocal(center, i * step, (j + 1) * step);
        const main = i % 3 === 0;
        segments.push({
          id: `demo-${axis}${i}_${j}`,
          name: name(axis, i),
          line: [a, b],
          mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          lengthM: step,
          capacity: 30,
          profile: main ? 'commercial' : (i + j) % 2 ? 'mixed' : 'residential',
          noParking: false,
          paid: main,
        });
      }
    }
  }
  const lots: ParkingLot[] = [
    { id: 'demo-lot-1', name: 'Estacionamento Central (demonstração)', pos: fromLocal(center, 150, 50), fee: 'yes', capacity: 120 },
    { id: 'demo-lot-2', name: 'Garagem Shopping (demonstração)', pos: fromLocal(center, -250, -150), fee: 'yes', capacity: 400 },
  ];
  return { segments, lots };
}
