import { configHash } from './config';
import type { KeyValueStore } from './config';
import type {
  AnalysisConfig, AnalysisResult, DataSourceInfo, FilterResult, ScenarioState, TriggerEvaluation,
} from './types';

export const HISTORY_STORAGE_KEY = 'm5sa.history.v1';

export type OutcomeValue = 'retracao_observada' | 'retracao_nao_observada' | 'inconclusivo';

export interface RecordedOutcome {
  value: OutcomeValue;
  note: string;
  recordedAt: number;
}

export interface AnalysisRecord {
  id: string;
  /** Momento em que o usuário registrou a análise (relógio do sistema). */
  analyzedAt: number;
  /** Instante do último candle usado. */
  cutoffT: number;
  asset: string;
  timeframe: string;
  source: Pick<DataSourceInfo, 'kind' | 'name' | 'origin' | 'synthetic' | 'otc' | 'datasetId' | 'timezone' | 'displayTimezone'>;
  state: ScenarioState;
  summary: string;
  window: { fromT: number; toT: number; count: number } | null;
  favorableFilters: string[];
  unfavorableFilters: string[];
  pendingFilters: string[];
  notEvaluableFilters: string[];
  noEntryReasons: string[];
  trigger: Pick<TriggerEvaluation, 'status' | 'confirmed' | 'message'>;
  rulesVersion: string;
  configHash: string;
  /** Cópia da configuração usada: nunca é reescrita depois. */
  configSnapshot: AnalysisConfig;
  note: string;
  outcome: RecordedOutcome | null;
}

function names(filters: FilterResult[], status: FilterResult['status']): string[] {
  return filters.filter((f) => f.status === status && f.role !== 'informativo').map((f) => f.name);
}

export function createRecord(
  result: AnalysisResult, config: AnalysisConfig, source: DataSourceInfo, now: number, note = '',
): AnalysisRecord | null {
  if (result.cutoffT === null) return null;
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    analyzedAt: now,
    cutoffT: result.cutoffT,
    asset: source.asset,
    timeframe: config.timeframe,
    source: {
      kind: source.kind, name: source.name, origin: source.origin, synthetic: source.synthetic, otc: source.otc,
      datasetId: source.datasetId, timezone: source.timezone, displayTimezone: source.displayTimezone,
    },
    state: result.state,
    summary: result.summary,
    window: result.window ? { fromT: result.window.fromT, toT: result.window.toT, count: result.window.count } : null,
    favorableFilters: names(result.filters, 'favoravel'),
    unfavorableFilters: names(result.filters, 'desfavoravel'),
    pendingFilters: names(result.filters, 'pendente'),
    notEvaluableFilters: names(result.filters, 'nao_avaliavel'),
    noEntryReasons: result.state === 'DESFAVORAVEL' ? result.blockingReasons : result.state === 'NAO_AVALIAVEL' ? result.invalidReasons : [],
    trigger: { status: result.trigger.status, confirmed: result.trigger.confirmed, message: result.trigger.message },
    rulesVersion: result.rulesVersion,
    configHash: configHash(config),
    configSnapshot: structuredCloneSafe(config),
    note,
    outcome: null,
  };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ----------------------------------------------------------------- filtros

export interface HistoryFilter {
  asset?: string;
  timeframe?: string;
  state?: ScenarioState | '';
  configHash?: string;
  /** Instantes Unix em segundos (analyzedAt). */
  fromDate?: number;
  toDate?: number;
  /** 'todas' | 'reais' | 'sinteticas' */
  origin?: 'todas' | 'reais' | 'sinteticas';
}

export function filterRecords(records: AnalysisRecord[], f: HistoryFilter): AnalysisRecord[] {
  return records.filter((r) => {
    if (f.asset && !r.asset.toLowerCase().includes(f.asset.trim().toLowerCase())) return false;
    if (f.timeframe && r.timeframe !== f.timeframe) return false;
    if (f.state && r.state !== f.state) return false;
    if (f.configHash && r.configHash !== f.configHash) return false;
    if (f.fromDate !== undefined && r.analyzedAt / 1000 < f.fromDate) return false;
    if (f.toDate !== undefined && r.analyzedAt / 1000 > f.toDate) return false;
    if (f.origin === 'reais' && r.source.synthetic) return false;
    if (f.origin === 'sinteticas' && !r.source.synthetic) return false;
    return true;
  });
}

// ---------------------------------------------------------------- comparação

export interface ComparisonRow {
  state: ScenarioState;
  total: number;
  retracaoObservada: number;
  retracaoNaoObservada: number;
  inconclusivo: number;
  semResultado: number;
}

/**
 * Contagens descritivas por classificação. NÃO é taxa de acerto: o resultado é
 * registrado manualmente, não há gatilho/expiração definidos e a amostra
 * costuma ser minúscula. Dados sintéticos nunca entram aqui.
 */
export function compareByState(records: AnalysisRecord[]): ComparisonRow[] {
  const real = records.filter((r) => !r.source.synthetic);
  const states: ScenarioState[] = ['FAVORAVEL', 'DESFAVORAVEL', 'AGUARDAR', 'NAO_AVALIAVEL'];
  return states.map((state) => {
    const rs = real.filter((r) => r.state === state);
    return {
      state,
      total: rs.length,
      retracaoObservada: rs.filter((r) => r.outcome?.value === 'retracao_observada').length,
      retracaoNaoObservada: rs.filter((r) => r.outcome?.value === 'retracao_nao_observada').length,
      inconclusivo: rs.filter((r) => r.outcome?.value === 'inconclusivo').length,
      semResultado: rs.filter((r) => !r.outcome).length,
    };
  });
}

export function setOutcome(
  records: AnalysisRecord[], id: string, outcome: RecordedOutcome | null,
): AnalysisRecord[] {
  return records.map((r) => (r.id === id ? { ...r, outcome } : r));
}

/**
 * Quantos candles posteriores ao corte do registro existem no conjunto de
 * dados carregado. 0 = "sem dados posteriores" (resultado não avaliável).
 */
export function laterCandlesAvailable(record: AnalysisRecord, loaded: { datasetId: string; candleTimes: number[] } | null): number {
  if (!loaded || loaded.datasetId.split('|')[0] !== record.source.datasetId.split('|')[0]) return 0;
  return loaded.candleTimes.filter((t) => t > record.cutoffT).length;
}

// ------------------------------------------------------------------ exportação

const EXPORT_COLUMNS: Array<[string, (r: AnalysisRecord) => string | number]> = [
  ['id', (r) => r.id],
  ['registrado_em_utc', (r) => new Date(r.analyzedAt).toISOString()],
  ['ultimo_candle_utc', (r) => new Date(r.cutoffT * 1000).toISOString()],
  ['ativo', (r) => r.asset],
  ['timeframe', (r) => r.timeframe],
  ['origem_dos_dados', (r) => r.source.origin],
  ['arquivo_ou_conjunto', (r) => r.source.name],
  ['dados_sinteticos', (r) => (r.source.synthetic ? 'sim' : 'nao')],
  ['otc_declarado', (r) => (r.source.otc ? 'sim' : 'nao')],
  ['classificacao', (r) => r.state],
  ['filtros_favoraveis', (r) => r.favorableFilters.join(' | ')],
  ['filtros_desfavoraveis', (r) => r.unfavorableFilters.join(' | ')],
  ['filtros_pendentes', (r) => r.pendingFilters.join(' | ')],
  ['motivos_nao_entrada', (r) => r.noEntryReasons.join(' | ')],
  ['gatilho', (r) => r.trigger.message],
  ['explicacao', (r) => r.summary],
  ['versao_regras', (r) => r.rulesVersion],
  ['hash_configuracao', (r) => r.configHash],
  ['resultado_posterior', (r) => r.outcome?.value ?? 'sem_resultado'],
  ['observacao_resultado', (r) => r.outcome?.note ?? ''],
  ['observacao', (r) => r.note],
];

/**
 * Escapa um campo CSV e neutraliza injeção de fórmulas em planilhas
 * (células iniciadas por = + - @ ou tabulação/CR viram texto).
 */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function recordsToCsv(records: AnalysisRecord[]): string {
  const header = EXPORT_COLUMNS.map(([name]) => name).join(',');
  const lines = records.map((r) => EXPORT_COLUMNS.map(([, get]) => csvCell(get(r))).join(','));
  return '﻿' + [header, ...lines].join('\r\n') + '\r\n';
}

// -------------------------------------------------------------- persistência

const STATES: ScenarioState[] = ['FAVORAVEL', 'DESFAVORAVEL', 'AGUARDAR', 'NAO_AVALIAVEL'];

function isRecord(x: unknown): x is AnalysisRecord {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === 'string' && typeof r.analyzedAt === 'number' && typeof r.cutoffT === 'number' &&
    typeof r.state === 'string' && STATES.includes(r.state as ScenarioState) &&
    typeof r.source === 'object' && r.source !== null && typeof r.configSnapshot === 'object' && r.configSnapshot !== null
  );
}

export function loadHistory(store: KeyValueStore): AnalysisRecord[] {
  try {
    const text = store.getItem(HISTORY_STORAGE_KEY);
    if (!text) return [];
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

export function saveHistory(store: KeyValueStore, records: AnalysisRecord[]): boolean {
  try {
    store.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}
