/**
 * Formato compacto dos dados do OpenStreetMap usado pelo VagaAqui.
 * Gerado a partir da resposta do Overpass (no navegador ou pelo script
 * `npm run import-osm`) e salvo em cache/snapshot. Coordenadas em [lat, lon].
 *
 * Dados © colaboradores do OpenStreetMap, licença ODbL — a atribuição é exibida no mapa.
 */

export type LatLon = [number, number];

export interface CompactRoad {
  id: number;
  /** nome (ou ref) da via */
  n: string;
  /** classe highway */
  h: string;
  /** mão única no sentido dos nós */
  o: boolean;
  lanes: number | null;
  width: number | null;
  /** estacionamento no meio-fio pelo OSM: lados permitidos ou null (desconhecido) */
  pk: { left: boolean; right: boolean } | null;
  nodes: number[];
  g: LatLon[];
}

export interface CompactBuilding {
  g: LatLon[];
  height: number | null;
  levels: number | null;
  type: string;
}

export type CompactAreaKind = 'park' | 'beach' | 'water' | 'parking' | 'plaza' | 'commercial';

export interface CompactArea {
  k: CompactAreaKind;
  g: LatLon[];
  name?: string;
  capacity?: number;
  fee?: boolean;
}

export type PoiCategory = 'shopping' | 'hospital' | 'praia' | 'universidade' | 'restaurante' | 'escritorio' | 'parque';

export interface CompactPoi {
  n: string;
  c: PoiCategory;
  p: LatLon;
}

export interface CompactOsm {
  v: 1;
  center: LatLon;
  radius: number;
  fetchedAt: string;
  roads: CompactRoad[];
  buildings: CompactBuilding[];
  areas: CompactArea[];
  coast: LatLon[][];
  pois: CompactPoi[];
  /** comércios/serviços (densidade usada para classificar zonas) */
  shops: LatLon[];
}

// ---------------- resposta do Overpass ----------------

interface OverpassGeom {
  lat: number;
  lon: number;
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  geometry?: (OverpassGeom | null)[];
  members?: { type: string; ref: number; role: string; geometry?: (OverpassGeom | null)[] }[];
}

export interface OverpassResponse {
  elements: OverpassElement[];
  osm3s?: { timestamp_osm_base?: string };
}

/** Vias em que carros circulam (usadas na malha de rotas). */
export const DRIVABLE = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'motorway_link',
  'trunk_link',
  'primary_link',
  'secondary_link',
  'tertiary_link',
]);

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const toLatLon = (g: (OverpassGeom | null)[] | undefined): LatLon[] =>
  (g ?? []).filter((p): p is OverpassGeom => p != null).map((p) => [round(p.lat), round(p.lon)]);

function parseNumber(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const NO_PARKING = new Set(['no', 'no_parking', 'no_stopping', 'separate', 'fire_lane']);
function sideAllows(v: string | undefined): boolean | null {
  if (!v) return null;
  return !NO_PARKING.has(v);
}

/** Lê as tags de estacionamento no meio-fio (esquema antigo parking:lane e novo parking:*). */
function parkingTags(tags: Record<string, string>): { left: boolean; right: boolean } | null {
  const both = sideAllows(tags['parking:both'] ?? tags['parking:lane:both']);
  const left = sideAllows(tags['parking:left'] ?? tags['parking:lane:left']);
  const right = sideAllows(tags['parking:right'] ?? tags['parking:lane:right']);
  if (both == null && left == null && right == null) return null;
  return { left: left ?? both ?? true, right: right ?? both ?? true };
}

function closedRing(g: LatLon[]) {
  return g.length >= 4 && g[0][0] === g[g.length - 1][0] && g[0][1] === g[g.length - 1][1];
}

function areaKind(tags: Record<string, string>): CompactAreaKind | null {
  if (tags.amenity === 'parking' && tags.parking !== 'underground') return 'parking';
  if (tags.natural === 'beach') return 'beach';
  if (tags.natural === 'water' || tags.water || tags.landuse === 'reservoir' || tags.landuse === 'basin') return 'water';
  if (['park', 'garden', 'playground', 'pitch', 'nature_reserve'].includes(tags.leisure ?? '')) return 'park';
  if (['grass', 'forest', 'recreation_ground', 'village_green'].includes(tags.landuse ?? '')) return 'park';
  if (['wood', 'scrub', 'grassland'].includes(tags.natural ?? '')) return 'park';
  if (tags.place === 'square' || (tags.highway === 'pedestrian' && tags.area === 'yes')) return 'plaza';
  if (tags.landuse === 'commercial' || tags.landuse === 'retail') return 'commercial';
  return null;
}

function poiCategory(tags: Record<string, string>): PoiCategory | null {
  if (tags.shop === 'mall' || tags.shop === 'department_store') return 'shopping';
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic') return 'hospital';
  if (['university', 'college'].includes(tags.amenity ?? '')) return 'universidade';
  if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream'].includes(tags.amenity ?? '')) return 'restaurante';
  if (tags.office || tags.amenity === 'bank' || tags.amenity === 'townhall') return 'escritorio';
  if (tags.leisure === 'park') return 'parque';
  if (tags.natural === 'beach') return 'praia';
  return null;
}

function centroid(g: LatLon[]): LatLon {
  let la = 0;
  let lo = 0;
  for (const p of g) {
    la += p[0];
    lo += p[1];
  }
  return [round(la / g.length), round(lo / g.length)];
}

/** Converte a resposta bruta do Overpass para o formato compacto. Função pura. */
export function overpassToCompact(raw: OverpassResponse, center: LatLon, radius: number): CompactOsm {
  const roads: CompactRoad[] = [];
  const buildings: CompactBuilding[] = [];
  const areas: CompactArea[] = [];
  const coast: LatLon[][] = [];
  const pois: CompactPoi[] = [];
  const shops: LatLon[] = [];

  const outerRings = (el: OverpassElement) =>
    (el.members ?? []).filter((m) => m.type === 'way' && m.role !== 'inner').map((m) => toLatLon(m.geometry)).filter(closedRing);

  for (const el of raw.elements) {
    const tags = el.tags ?? {};
    if (el.type === 'node') {
      if (el.lat == null || el.lon == null) continue;
      const p: LatLon = [round(el.lat), round(el.lon)];
      const cat = poiCategory(tags);
      if (cat && tags.name) pois.push({ n: tags.name, c: cat, p });
      if (tags.shop || ['restaurant', 'cafe', 'fast_food', 'bar', 'bank', 'pharmacy', 'clinic'].includes(tags.amenity ?? '')) shops.push(p);
      continue;
    }

    const rings = el.type === 'relation' ? outerRings(el) : [toLatLon(el.geometry)];

    if (el.type === 'way' && tags.highway && DRIVABLE.has(tags.highway) && tags.area !== 'yes') {
      const g = toLatLon(el.geometry);
      if (!el.nodes || el.nodes.length !== g.length || g.length < 2) continue;
      const access = tags.access ?? tags.motor_vehicle ?? tags.motorcar;
      if (access === 'no' || access === 'private') continue;
      let nodes = el.nodes.slice();
      let geom = g;
      let pk = parkingTags(tags);
      const oneway = tags.oneway ?? (tags.junction === 'roundabout' ? 'yes' : undefined);
      if (oneway === '-1') {
        // normaliza para "mão única no sentido dos nós"
        nodes = nodes.reverse();
        geom = geom.slice().reverse();
        if (pk) pk = { left: pk.right, right: pk.left };
      }
      roads.push({
        id: el.id,
        n: tags.name ?? tags.ref ?? '',
        h: tags.highway,
        o: oneway === 'yes' || oneway === 'true' || oneway === '1' || oneway === '-1',
        lanes: parseNumber(tags.lanes),
        width: parseNumber(tags.width),
        pk,
        nodes,
        g: geom,
      });
      continue;
    }

    if (tags.natural === 'coastline' && el.type === 'way') {
      const g = toLatLon(el.geometry);
      if (g.length >= 2) coast.push(g);
      continue;
    }

    if (tags.building && tags.building !== 'no' && tags.building !== 'roof') {
      for (const g of rings) {
        if (!closedRing(g)) continue;
        buildings.push({
          g,
          height: parseNumber(tags.height ?? tags['building:height']),
          levels: parseNumber(tags['building:levels']),
          type: tags.building,
        });
      }
    }

    const kind = areaKind(tags);
    if (kind) {
      for (const g of rings) {
        if (!closedRing(g)) continue;
        areas.push({
          k: kind,
          g,
          name: tags.name,
          capacity: parseNumber(tags.capacity) ?? undefined,
          fee: tags.fee ? tags.fee !== 'no' : undefined,
        });
      }
    }

    const cat = poiCategory(tags);
    if (cat && tags.name && rings[0]?.length) pois.push({ n: tags.name, c: cat, p: centroid(rings[0]) });
    if (tags.shop && rings[0]?.length) shops.push(centroid(rings[0]));
  }

  return {
    v: 1,
    center,
    radius,
    fetchedAt: raw.osm3s?.timestamp_osm_base ?? new Date().toISOString(),
    roads,
    buildings,
    areas,
    coast,
    pois,
    shops,
  };
}
