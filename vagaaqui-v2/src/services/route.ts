import { config } from '../config';
import { distance, type LonLat } from '../lib/geo';

export interface Eta {
  minutes: number;
  meters: number;
  /** 'route' = calculado por serviço de rotas; 'estimate' = estimativa por distância */
  source: 'route' | 'estimate';
}

/** velocidade média urbana com semáforos (km/h) usada na estimativa */
const URBAN_KMH = 22;

export function estimateEta(from: LonLat, to: LonLat): Eta {
  const meters = distance(from, to) * 1.35;
  return { minutes: Math.max(1, Math.round(meters / ((URBAN_KMH * 1000) / 60) + 1)), meters, source: 'estimate' };
}

/** Tempo de viagem de carro: OpenRouteService se houver chave, senão estimativa. */
export async function driveEta(from: LonLat, to: LonLat, signal?: AbortSignal): Promise<Eta> {
  if (!config.orsKey || distance(from, to) < 150) return estimateEta(from, to);
  try {
    const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: { Authorization: config.orsKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [from, to] }),
      signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { routes: { summary: { duration: number; distance: number } }[] };
    const s = json.routes[0].summary;
    return { minutes: Math.max(1, Math.round(s.duration / 60)), meters: s.distance, source: 'route' };
  } catch {
    return estimateEta(from, to);
  }
}

/** Links para navegar no app que o motorista já usa. */
export function navLinks(to: LonLat) {
  const ll = `${to[1].toFixed(6)},${to[0].toFixed(6)}`;
  return {
    waze: `https://waze.com/ul?ll=${encodeURIComponent(ll)}&navigate=yes`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ll)}&travelmode=driving`,
    walk: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ll)}&travelmode=walking`,
  };
}
