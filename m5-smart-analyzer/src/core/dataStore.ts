import { candleIssue } from './candle';
import type { KeyValueStore } from './config';
import type { Candle, DataSourceInfo } from './types';

/**
 * Persistência opcional dos candles carregados (localStorage tem ~5 MB).
 * Formato compacto: cada candle é [t, o, h, l, c, v?]. Acima do limite, não persiste.
 */

export const DATA_STORAGE_KEY = 'm5sa.data.v1';
export const MAX_PERSISTED_CANDLES = 5000;

export interface PersistedData {
  source: DataSourceInfo;
  candles: Candle[];
}

export type SaveDataResult = 'salvo' | 'grande_demais' | 'falhou';

export function saveData(store: KeyValueStore, data: PersistedData | null): SaveDataResult {
  try {
    if (data === null) {
      store.removeItem(DATA_STORAGE_KEY);
      return 'salvo';
    }
    if (data.candles.length > MAX_PERSISTED_CANDLES) {
      store.removeItem(DATA_STORAGE_KEY);
      return 'grande_demais';
    }
    const rows = data.candles.map((c) => (c.v === undefined ? [c.t, c.o, c.h, c.l, c.c] : [c.t, c.o, c.h, c.l, c.c, c.v]));
    store.setItem(DATA_STORAGE_KEY, JSON.stringify({ source: data.source, rows }));
    return 'salvo';
  } catch {
    return 'falhou';
  }
}

const isSource = (s: unknown): s is DataSourceInfo => {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Record<string, unknown>;
  return (
    (o.kind === 'csv' || o.kind === 'demo_sintetico' || o.kind === 'binance_live') && typeof o.name === 'string' && typeof o.origin === 'string' &&
    typeof o.synthetic === 'boolean' && typeof o.asset === 'string' && typeof o.otc === 'boolean' &&
    typeof o.timezone === 'string' && typeof o.displayTimezone === 'string' && typeof o.datasetId === 'string' &&
    ['importedAt', 'rows', 'firstT', 'lastT'].every((k) => typeof o[k] === 'number')
  );
};

/** Devolve null se algo estiver corrompido: melhor recarregar o CSV do que analisar dados duvidosos. */
export function loadData(store: KeyValueStore): PersistedData | null {
  try {
    const text = store.getItem(DATA_STORAGE_KEY);
    if (!text) return null;
    const raw = JSON.parse(text) as { source?: unknown; rows?: unknown };
    if (!isSource(raw.source) || !Array.isArray(raw.rows) || raw.rows.length === 0) return null;
    const candles: Candle[] = [];
    for (const r of raw.rows as unknown[]) {
      if (!Array.isArray(r) || (r.length !== 5 && r.length !== 6)) return null;
      const c: Candle = { t: r[0] as number, o: r[1] as number, h: r[2] as number, l: r[3] as number, c: r[4] as number };
      if (r.length === 6) c.v = r[5] as number;
      if (candleIssue(c) !== null) return null;
      if (candles.length && c.t <= candles[candles.length - 1]!.t) return null;
      candles.push(c);
    }
    return { source: raw.source, candles };
  } catch {
    return null;
  }
}
