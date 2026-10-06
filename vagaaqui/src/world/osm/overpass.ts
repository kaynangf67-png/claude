import type { LatLon, OverpassResponse } from './compact';

/** Servidores públicos do Overpass, tentados em ordem. */
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export function bboxAround([lat, lon]: LatLon, radiusM: number) {
  const dLat = radiusM / 110_574;
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { south: lat - dLat, west: lon - dLon, north: lat + dLat, east: lon + dLon };
}

/** Consulta tudo o que o mapa usa: vias, prédios, áreas, litoral e pontos de interesse. */
export function buildOverpassQuery(center: LatLon, radiusM: number) {
  const b = bboxAround(center, radiusM);
  const bbox = [b.south, b.west, b.north, b.east].map((v) => v.toFixed(6)).join(',');
  return `[out:json][timeout:90][bbox:${bbox}];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street)(_link)?$"];
  way["building"];
  relation["building"]["type"="multipolygon"];
  way["amenity"="parking"];
  way["leisure"~"^(park|garden|playground|pitch|nature_reserve)$"];
  relation["leisure"="park"]["type"="multipolygon"];
  way["natural"~"^(beach|water|coastline|wood|scrub|grassland)$"];
  relation["natural"~"^(beach|water)$"]["type"="multipolygon"];
  way["landuse"~"^(commercial|retail|grass|forest|recreation_ground|village_green|reservoir|basin)$"];
  way["place"="square"];
  node["shop"];
  node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|bank|pharmacy|clinic|hospital|university|college|townhall|ice_cream)$"];
  way["amenity"~"^(hospital|university|college)$"];
  way["shop"~"^(mall|department_store)$"];
);
out body geom qt;`;
}

export async function fetchOverpass(center: LatLon, radiusM: number, timeoutMs = 45_000): Promise<OverpassResponse> {
  const query = buildOverpassQuery(center, radiusM);
  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as OverpassResponse;
      if (!Array.isArray(json.elements)) throw new Error('Resposta do Overpass inválida');
      return json;
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Overpass indisponível');
}
