import { config } from '../config';
import type { LonLat } from '../lib/geo';

export interface Place {
  id: string;
  name: string;
  detail: string;
  pos: LonLat;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { osm_id?: number; osm_type?: string; name?: string; street?: string; housenumber?: string; district?: string; city?: string; state?: string; type?: string };
}

export function placeFromPhoton(f: PhotonFeature): Place {
  const p = f.properties;
  const street = p.street ? `${p.street}${p.housenumber ? ', ' + p.housenumber : ''}` : '';
  const name = p.name || street || 'Local';
  const detail = [p.name ? street : '', p.district, p.city, p.state].filter(Boolean).join(' · ');
  return { id: `${p.osm_type ?? ''}${p.osm_id ?? Math.random()}`, name, detail, pos: f.geometry.coordinates };
}

/** Busca de endereço/local (Photon/OSM), com viés para perto do usuário. */
export async function searchPlaces(q: string, near: LonLat, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q, lat: near[1].toFixed(5), lon: near[0].toFixed(5), limit: '6' });
  const res = await fetch(`${config.geocoderUrl}?${params}`, { signal });
  if (!res.ok) throw new Error(`Busca indisponível (${res.status})`);
  const json = (await res.json()) as { features: PhotonFeature[] };
  return json.features.map(placeFromPhoton);
}
