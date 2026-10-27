import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaultConfig, loadConfig, saveConfig, type KeyValueStore } from '../core/config';
import { generateDemoCandles, demoSource, sourceFor, type DemoScenario } from '../core/demo';
import { analyze } from '../core/engine';
import { loadData, saveData, MAX_PERSISTED_CANDLES } from '../core/dataStore';
import { createRecord, loadHistory, saveHistory, setOutcome, type AnalysisRecord, type RecordedOutcome } from '../core/history';
import { importCandlesCsv, type ImportResult } from '../core/csv';
import { TIMEFRAME_SECONDS } from '../core/engine';
import type { AnalysisConfig, AnalysisResult, Candle, DataSourceInfo, IntrabarInfo } from '../core/types';

/** localStorage com proteção: modo privado, cota cheia ou bloqueio nunca derrubam o app. */
export function browserStore(): KeyValueStore {
  return {
    getItem: (k) => {
      try { return window.localStorage.getItem(k); } catch { return null; }
    },
    setItem: (k, v) => window.localStorage.setItem(k, v),
    removeItem: (k) => {
      try { window.localStorage.removeItem(k); } catch { /* ignorado */ }
    },
  };
}

export type Tab = 'dashboard' | 'grafico' | 'filtros' | 'aovivo' | 'historico' | 'configuracoes';

export interface LoadedData {
  candles: Candle[];
  source: DataSourceInfo;
  importInfo: Pick<ImportResult, 'warnings' | 'gaps' | 'stats'> | null;
  /** Presente só com o feed ao vivo: candle em formação e cronômetro. */
  live?: { symbol: string; formingOpenT: number; intrabar: IntrabarInfo };
}

export interface ImportRequest {
  text: string;
  fileName: string;
  timezone: string | undefined;
  asset: string;
  origin: string;
  synthetic: boolean;
  otc: boolean;
}

interface Prefs { displayTimezone: string }
const PREFS_KEY = 'm5sa.prefs.v1';

function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function loadPrefs(store: KeyValueStore): Prefs {
  try {
    const raw = JSON.parse(store.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null;
    if (raw && typeof raw.displayTimezone === 'string') {
      new Intl.DateTimeFormat('en-US', { timeZone: raw.displayTimezone });
      return { displayTimezone: raw.displayTimezone };
    }
  } catch { /* usa o padrão */ }
  return { displayTimezone: defaultTimezone() };
}

interface Store {
  tab: Tab;
  setTab: (t: Tab) => void;
  config: AnalysisConfig;
  setConfig: (c: AnalysisConfig) => void;
  resetConfig: () => void;
  data: LoadedData | null;
  /** Substitui os dados carregados (usado pelo feed ao vivo). */
  setLoaded: (d: LoadedData | null) => void;
  analysis: AnalysisResult | null;
  loadDemo: (s: DemoScenario) => void;
  importCsv: (req: ImportRequest) => ImportResult;
  clearData: () => void;
  displayTimezone: string;
  setDisplayTimezone: (tz: string) => void;
  intrabarSeconds: number | null;
  setIntrabarSeconds: (s: number | null) => void;
  history: AnalysisRecord[];
  registerAnalysis: (note: string) => AnalysisRecord | null;
  updateOutcome: (id: string, outcome: RecordedOutcome | null) => void;
  deleteRecords: (ids: string[]) => void;
  storageWarning: string | null;
  /** Candles que sustentam um filtro, destacados no gráfico. */
  focus: { label: string; indexes: number[] } | null;
  setFocus: (f: { label: string; indexes: number[] } | null) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fora do provider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useRef(browserStore()).current;
  const [tab, setTab] = useState<Tab>('dashboard');
  const [config, setConfigState] = useState<AnalysisConfig>(() => loadConfig(store));
  const [history, setHistory] = useState<AnalysisRecord[]>(() => loadHistory(store));
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs(store));
  const [data, setData] = useState<LoadedData | null>(() => {
    const saved = loadData(store);
    return saved ? { candles: saved.candles, source: { ...saved.source, displayTimezone: prefs.displayTimezone }, importInfo: null } : null;
  });
  const [intrabarSeconds, setIntrabarSeconds] = useState<number | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ label: string; indexes: number[] } | null>(null);

  useEffect(() => {
    if (!saveConfig(store, config)) setStorageWarning('Não foi possível salvar as configurações neste navegador (armazenamento bloqueado ou cheio).');
  }, [config, store]);
  useEffect(() => {
    if (!saveHistory(store, history)) setStorageWarning('Não foi possível salvar o histórico neste navegador. Exporte o CSV para não perder registros.');
  }, [history, store]);
  useEffect(() => {
    // o feed ao vivo não é persistido (e não apaga o CSV guardado)
    if (data?.live) return;
    const r = saveData(store, data ? { source: data.source, candles: data.candles } : null);
    if (r === 'grande_demais') setStorageWarning(`Estes dados têm mais de ${MAX_PERSISTED_CANDLES} candles e não serão guardados no navegador: ao recarregar, importe o CSV de novo.`);
    else if (r === 'falhou') setStorageWarning('Não foi possível guardar os candles neste navegador; ao recarregar será preciso importar de novo.');
    else setStorageWarning((w) => (w && w.includes('candles') ? null : w));
  }, [data, store]);
  useEffect(() => {
    try { store.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* preferência não essencial */ }
  }, [prefs, store]);

  const analysis = useMemo(
    () => {
      if (!data) return null;
      const intrabar = data.live?.intrabar ?? (intrabarSeconds === null ? null : { remainingSeconds: intrabarSeconds });
      return analyze({ candles: data.candles, source: data.source, config, intrabar });
    },
    [data, config, intrabarSeconds],
  );

  const loadDemo = useCallback((scenario: DemoScenario) => {
    const candles = generateDemoCandles(scenario);
    setData({ candles, source: demoSource(scenario, candles, prefs.displayTimezone, Date.now()), importInfo: null });
    setIntrabarSeconds(null);
    setFocus(null);
  }, [prefs.displayTimezone]);

  const importCsv = useCallback((req: ImportRequest): ImportResult => {
    const result = importCandlesCsv(req.text, { timezone: req.timezone, timeframeSeconds: TIMEFRAME_SECONDS[config.timeframe] });
    if (result.ok) {
      const source = sourceFor(result.candles, {
        kind: 'csv', name: req.fileName, origin: req.origin.trim() || 'não informada',
        synthetic: req.synthetic, asset: req.asset.trim(), otc: req.otc,
        timezone: req.timezone ?? 'UTC (offset no arquivo)', displayTimezone: prefs.displayTimezone,
      }, Date.now());
      setData({ candles: result.candles, source, importInfo: { warnings: result.warnings, gaps: result.gaps, stats: result.stats } });
      setIntrabarSeconds(null);
      setFocus(null);
    }
    return result;
  }, [config.timeframe, prefs.displayTimezone]);

  const setDisplayTimezone = useCallback((displayTimezone: string) => {
    setPrefs({ displayTimezone });
    setData((d) => (d ? { ...d, source: { ...d.source, displayTimezone } } : d));
  }, []);

  const registerAnalysis = useCallback((note: string) => {
    if (!data || !analysis) return null;
    const rec = createRecord(analysis, config, data.source, Date.now(), note);
    if (rec) setHistory((h) => [rec, ...h]);
    return rec;
  }, [data, analysis, config]);

  const value: Store = {
    tab, setTab, config,
    setConfig: setConfigState,
    resetConfig: () => setConfigState(defaultConfig()),
    data, setLoaded: setData, analysis, loadDemo, importCsv,
    clearData: () => { setData(null); setIntrabarSeconds(null); setFocus(null); },
    displayTimezone: prefs.displayTimezone, setDisplayTimezone,
    intrabarSeconds, setIntrabarSeconds,
    history, registerAnalysis,
    updateOutcome: (id, outcome) => setHistory((h) => setOutcome(h, id, outcome)),
    deleteRecords: (ids) => setHistory((h) => h.filter((r) => !ids.includes(r.id))),
    storageWarning, focus, setFocus,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
