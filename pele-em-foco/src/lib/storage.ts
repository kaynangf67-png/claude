import { buildRoutine } from './routine';
import type { AppData, DayEntry, Preferences } from './types';

export const STORAGE_KEY = 'pele-em-foco:v1';

export const defaultPreferences: Preferences = {
  name: '',
  skinFeel: 'nao-sei',
  usesMakeup: false,
  shaves: false,
  hasTreatment: false,
};

export function emptyData(): AppData {
  return {
    version: 1,
    onboardedAt: null,
    disclaimerAcceptedAt: null,
    preferences: { ...defaultPreferences },
    routine: buildRoutine(defaultPreferences),
    days: {},
  };
}

export function emptyDay(): DayEntry {
  return { done: [], habits: [], tags: [], note: '' };
}

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): KV | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Lê os dados salvos neste aparelho. Dados ausentes ou corrompidos voltam ao estado inicial. */
export function load(storage: KV | null = browserStorage()): AppData {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (parsed.version !== 1) return emptyData();
    const base = emptyData();
    return {
      ...base,
      ...parsed,
      preferences: { ...base.preferences, ...parsed.preferences },
      routine: Array.isArray(parsed.routine) ? parsed.routine : base.routine,
      days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
    };
  } catch {
    return emptyData();
  }
}

/** Salva os dados. Retorna false se o navegador bloquear o armazenamento (ex.: modo privado). */
export function save(data: AppData, storage: KV | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clear(storage: KV | null = browserStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* nada a fazer */
  }
}
