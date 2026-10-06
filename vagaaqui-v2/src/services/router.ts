import { config } from '../config';
import type { LonLat } from '../lib/geo';
import { buildRoute, type NavRoute, type OsrmStep } from '../model/nav';

interface OsrmResponse {
  code: string;
  routes?: { distance: number; duration: number; geometry: { coordinates: LonLat[] }; legs: { steps: OsrmStep[] }[] }[];
}

/** Rota de carro com manobras (OSRM). */
export async function fetchRoute(from: LonLat, to: LonLat, signal?: AbortSignal): Promise<NavRoute> {
  const coords = `${from[0].toFixed(6)},${from[1].toFixed(6)};${to[0].toFixed(6)},${to[1].toFixed(6)}`;
  const url = `${config.routerUrl.replace(/\/$/, '')}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  signal?.addEventListener('abort', () => ctrl.abort());
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as OsrmResponse;
    const r = json.routes?.[0];
    if (json.code !== 'Ok' || !r) throw new Error('rota não encontrada');
    return buildRoute(r.geometry.coordinates, r.duration, r.legs.flatMap((l) => l.steps));
  } finally {
    clearTimeout(timer);
  }
}
