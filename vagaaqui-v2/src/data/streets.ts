import { config } from '../config';
import type { LonLat } from '../lib/geo';
import type { ParkingLot, Segment } from '../model/types';
import { buildSegments, overpassQuery, type OverpassElement } from './osm';

export type StreetSource = 'map' | 'osm' | 'cache';

export interface StreetData {
  segments: Segment[];
  lots: ParkingLot[];
  source: StreetSource;
}

const CACHE_PREFIX = 'vq2.streets.';
const CACHE_DAYS = 7;
const CACHE_MAX = 12;
/** raio baixado: o maior raio de caminhada (600 m) + folga */
export const STREET_RADIUS_M = 700;
const TIMEOUT_MS = 25000;

/** chave da área: grade de ~250 m, para destinos vizinhos reaproveitarem o download */
function areaKey(c: LonLat) {
  return `${(Math.round(c[0] * 400) / 400).toFixed(4)},${(Math.round(c[1] * 400) / 400).toFixed(4)}`;
}

/** cache em memória (instantâneo) na frente do localStorage */
const memory = new Map<string, StreetData>();
const pending = new Map<string, Promise<StreetData>>();

function readCache(key: string): StreetData | null {
  const m = memory.get(key);
  if (m) return m;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; segments: Segment[]; lots: ParkingLot[] };
    if (Date.now() - v.at > CACHE_DAYS * 86400000) return null;
    const data: StreetData = { segments: v.segments, lots: v.lots, source: 'cache' };
    memory.set(key, data);
    return data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: StreetData) {
  memory.set(key, data);
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
    /* sem espaço / modo privado: segue só com o cache em memória */
  }
}

/**
 * Pede ao servidor principal; se ele não responder em 1,5 s, pede também ao
 * próximo (e assim por diante) e fica com o primeiro que chegar. Rápido quando um
 * servidor está lento, sem triplicar a carga nos servidores públicos.
 */
const HEDGE_MS = 3000;
async function fetchOverpass(center: LonLat): Promise<OverpassElement[]> {
  const body = 'data=' + encodeURIComponent(overpassQuery(center, STREET_RADIUS_M));
  const ctrls = config.overpassUrls.map(() => new AbortController());
  const timers: ReturnType<typeof setTimeout>[] = [];
  const overall = setTimeout(() => ctrls.forEach((c) => c.abort()), TIMEOUT_MS);
  let failed = 0;
  try {
    return await new Promise<OverpassElement[]>((resolve, reject) => {
      let done = false;
      const launched = new Set<number>();
      const launch = (i: number) => {
        if (done || i >= config.overpassUrls.length || launched.has(i)) return;
        launched.add(i);
        // próximo servidor entra se este demorar
        timers.push(setTimeout(() => launch(i + 1), HEDGE_MS));
        fetch(config.overpassUrls[i], { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrls[i].signal })
          .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as { elements?: OverpassElement[] };
            if (!json.elements) throw new Error('resposta inválida');
            if (done) return;
            done = true;
            ctrls.forEach((c, j) => j !== i && c.abort());
            resolve(json.elements);
          })
          .catch(() => {
            failed++;
            if (done) return;
            if (failed >= config.overpassUrls.length) reject(new Error('todos falharam'));
            else launch(i + 1); // falhou: não espera, tenta o próximo já
          });
      };
      launch(0);
    });
  } catch {
    throw new Error('Não consegui baixar as ruas do OpenStreetMap agora. Verifique a internet e tente de novo.');
  } finally {
    clearTimeout(overall);
    timers.forEach(clearTimeout);
  }
}

/** Leitor de ruas a partir do mapa na tela (registrado pelo MapView). */
type TileProvider = (center: LonLat) => Promise<{ segments: Segment[]; lots: ParkingLot[] } | null>;
let tileProvider: TileProvider | null = null;
export function setTileStreetProvider(p: TileProvider | null) {
  tileProvider = p;
}

/**
 * Ruas em volta de um ponto: memória → aparelho (7 dias) → peças do mapa na tela
 * (instantâneo) → OpenStreetMap/Overpass (reserva, mais lento).
 * Downloads da mesma área são compartilhados (pré-carregamento + seleção não baixam duas vezes).
 */
export function loadStreets(center: LonLat): Promise<StreetData> {
  const key = areaKey(center);
  const cached = readCache(key);
  if (cached && cached.segments.length) return Promise.resolve(cached);
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const p = (async (): Promise<StreetData> => {
    if (tileProvider) {
      try {
        const fromMap = await tileProvider(center);
        if (fromMap && fromMap.segments.length >= 3) {
          const data: StreetData = { ...fromMap, source: 'map' };
          memory.set(key, data); // não grava no aparelho: o mapa já tem cache próprio
          return data;
        }
      } catch {
        /* segue para o Overpass */
      }
    }
    const { segments, lots } = buildSegments(await fetchOverpass(center));
    const data: StreetData = { segments, lots, source: 'osm' };
    if (segments.length) writeCache(key, data);
    return data;
  })().finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

/** Começa a baixar as ruas de um lugar antes do toque (ex.: 1º resultado da busca). Só via Overpass quando o mapa não tem as ruas. */
export function prefetchStreets(center: LonLat) {
  if (tileProvider) return; // o mapa lê as ruas na hora; não gasta o Overpass à toa
  loadStreets(center).catch(() => undefined);
}
