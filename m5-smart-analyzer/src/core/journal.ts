import type { KeyValueStore } from './config';
import { configHash } from './config';
import { breakevenRate, tally, verdict, type Tally, type Verdict } from './stats';
import type { AnalysisConfig, AnalysisResult, Candle, ScenarioState } from './types';

/**
 * Diário ao vivo: registra cada toque do candle em formação numa zona ARMADA
 * e confere o resultado no fechamento do M5. Só funciona com o app aberto e
 * visível; toques durante a aba em segundo plano não são anotados.
 */

export const JOURNAL_STORAGE_KEY = 'm5sa.journal.v1';
export const JOURNAL_MAX = 3000;

export type JournalResult = 'ganhou' | 'perdeu' | 'empate';

export interface JournalEntry {
  id: string;
  symbol: string;
  side: 'resistencia' | 'suporte';
  zoneId: string;
  /** Abertura do candle M5 (segundos). */
  t5: number;
  /** Instante da detecção (segundos). */
  detectedAt: number;
  entry: number;
  remainingSeconds: number;
  state: ScenarioState;
  triggerConfirmed: boolean;
  criteria: Record<string, string>;
  filters: Record<string, string>;
  rulesVersion: string;
  configHash: string;
  close: number | null;
  result: JournalResult | null;
}

export const entryId = (symbol: string, t5: number, zoneId: string) => `${symbol}|${t5}|${zoneId}`;

/** Cria o registro quando o candle em formação toca uma zona armada. */
export function detectEntry(
  symbol: string, analysis: AnalysisResult, config: AnalysisConfig, formingOpenT: number, remainingSeconds: number, nowSec: number,
): JournalEntry | null {
  const e = analysis.entry;
  if (!e || !e.armed || analysis.state === 'NAO_AVALIAVEL') return null;
  const criteria: Record<string, string> = {};
  for (const c of analysis.trigger.criteria) criteria[c.id] = c.status;
  const filters: Record<string, string> = {};
  for (const f of analysis.filters) filters[f.id] = f.status;
  return {
    id: entryId(symbol, formingOpenT, e.zoneId), symbol, side: e.side, zoneId: e.zoneId, t5: formingOpenT,
    detectedAt: nowSec, entry: e.entry, remainingSeconds, state: analysis.state, triggerConfirmed: analysis.trigger.confirmed,
    criteria, filters, rulesVersion: analysis.rulesVersion, configHash: configHash(config), close: null, result: null,
  };
}

/** Pronto para resolver: o candle M5 já fechou (com folga de 3 s). */
export const isResolvable = (e: JournalEntry, nowSec: number) => e.result === null && nowSec >= e.t5 + 303;

/** Resolve com o candle M5 fechado correspondente (ignora candle diferente ou ainda aberto). */
export function resolveEntry(e: JournalEntry, closed: Candle | undefined, nowSec: number): JournalEntry {
  if (e.result !== null || !closed || closed.t !== e.t5 || closed.t + 300 > nowSec) return e;
  const res: JournalResult =
    closed.c === e.entry ? 'empate' : (e.side === 'resistencia' ? closed.c < e.entry : closed.c > e.entry) ? 'ganhou' : 'perdeu';
  return { ...e, close: closed.c, result: res };
}

export interface JournalStats {
  breakeven: number;
  pending: number;
  todos: Tally;
  favoravel: Tally;
  gatilho: Tally;
  verdicts: { todos: Verdict; favoravel: Verdict; gatilho: Verdict };
}

export function journalStats(entries: JournalEntry[], payoutPercent: number): JournalStats {
  const be = breakevenRate(payoutPercent);
  const done = entries.filter((e) => e.result !== null).map((e) => ({ ...e, win: e.result === 'ganhou', tie: e.result === 'empate' }));
  const todos = tally(done);
  const favoravel = tally(done.filter((e) => e.state === 'FAVORAVEL'));
  const gatilho = tally(done.filter((e) => e.triggerConfirmed));
  return {
    breakeven: be, pending: entries.filter((e) => e.result === null).length, todos, favoravel, gatilho,
    verdicts: { todos: verdict(todos, be), favoravel: verdict(favoravel, be), gatilho: verdict(gatilho, be) },
  };
}

const isEntry = (x: unknown): x is JournalEntry => {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' && typeof o.symbol === 'string' && (o.side === 'resistencia' || o.side === 'suporte') &&
    ['t5', 'detectedAt', 'entry', 'remainingSeconds'].every((k) => typeof o[k] === 'number') &&
    typeof o.state === 'string' && typeof o.triggerConfirmed === 'boolean' &&
    (o.result === null || o.result === 'ganhou' || o.result === 'perdeu' || o.result === 'empate')
  );
};

export function loadJournal(store: KeyValueStore): JournalEntry[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(JOURNAL_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function saveJournal(store: KeyValueStore, entries: JournalEntry[]): boolean {
  try {
    store.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries.slice(-JOURNAL_MAX)));
    return true;
  } catch {
    return false;
  }
}
