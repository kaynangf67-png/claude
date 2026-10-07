import { env } from '../config/env';
import { setGeoOrigin } from '../lib/geo';
import { generateCity } from './cityGenerator';
import type { CityData } from './cityTypes';
import { buildCityFromOsm } from './osm/buildFromOsm';
import { overpassToCompact, type CompactOsm } from './osm/compact';
import { fetchOverpass } from './osm/overpass';

/**
 * Carrega a cidade. Ordem de tentativa:
 *  1. snapshot empacotado em /osm/area.json (gerado por `npm run import-osm`)
 *  2. cache local do navegador (download anterior, válido por 7 dias)
 *  3. Overpass API ao vivo (direto do navegador do usuário)
 *  4. cidade procedural de reserva, avisando o usuário
 */

export type CityOrigin = 'snapshot' | 'cache' | 'live' | 'procedural';
export interface CityLoadResult {
  city: CityData;
  origin: CityOrigin;
  note?: string;
}

const CACHE_KEY = 'vagaaqui.osm.v1';
const CACHE_TTL_MS = 7 * 24 * 3600_000;

let current: CityData | null = null;

export function getCity(): CityData {
  if (!current) current = generateCity();
  return current;
}

export function setCity(city: CityData) {
  current = city;
}

function sameArea(data: CompactOsm) {
  const [lat, lon] = data.center;
  return Math.abs(lat - env.mapCenter.lat) < 1e-4 && Math.abs(lon - env.mapCenter.lon) < 1e-4 && data.radius >= env.osmRadius;
}

function cityFromCompact(data: CompactOsm): CityData {
  setGeoOrigin({ lat: data.center[0], lon: data.center[1] });
  return buildCityFromOsm(data);
}

function readCache(): CompactOsm | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw) as { savedAt: number; data: CompactOsm };
    if (Date.now() - savedAt > CACHE_TTL_MS || !sameArea(data)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearCityCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignora */
  }
}

function writeCache(data: CompactOsm) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* cota cheia: segue sem cache */
  }
}

async function readSnapshot(): Promise<CompactOsm | null> {
  // aberto como arquivo local (build de arquivo único): não há snapshot para buscar
  if (typeof location !== 'undefined' && location.protocol === 'file:') return null;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}osm/area.json`, { cache: 'no-cache' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    const data = (await res.json()) as CompactOsm;
    return data?.v === 1 && Array.isArray(data.roads) && data.roads.length ? data : null;
  } catch {
    return null;
  }
}

export async function loadCity(onStatus?: (text: string) => void): Promise<CityLoadResult> {
  if (env.mapSource === 'procedural') {
    setGeoOrigin(env.mapCenter);
    current = generateCity();
    return { city: current, origin: 'procedural' };
  }
  const fallback = (note: string): CityLoadResult => {
    setGeoOrigin(env.mapCenter);
    current = generateCity();
    return { city: current, origin: 'procedural', note };
  };
  try {
    onStatus?.('Carregando ruas do OpenStreetMap…');
    const snapshot = await readSnapshot();
    if (snapshot) {
      current = cityFromCompact(snapshot);
      return { city: current, origin: 'snapshot' };
    }
    const cached = readCache();
    if (cached) {
      current = cityFromCompact(cached);
      return { city: current, origin: 'cache' };
    }
    onStatus?.('Baixando ruas reais (OpenStreetMap)…');
    const center: [number, number] = [env.mapCenter.lat, env.mapCenter.lon];
    const raw = await fetchOverpass(center, env.osmRadius);
    const data = overpassToCompact(raw, center, env.osmRadius);
    if (!data.roads.length) return fallback('Nenhuma rua encontrada no OpenStreetMap para esta área. Mostrando a cidade de demonstração.');
    current = cityFromCompact(data);
    writeCache(data);
    return { city: current, origin: 'live' };
  } catch {
    return fallback('Não foi possível baixar as ruas do OpenStreetMap agora. Mostrando a cidade de demonstração.');
  }
}
