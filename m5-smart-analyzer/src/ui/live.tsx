import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { symbolMt5Valido } from '../core/arquivoM1';
import { BINANCE_BASES, buildIntrabar, isValidSymbol, liveSource, splitForming } from '../core/binance';
import { analyze } from '../core/engine';
import {
  detectEntry, isResolvable, loadJournal, resolveEntry, saveJournal, type JournalEntry,
} from '../core/journal';
import type { AnalysisResult, Candle } from '../core/types';
import { fetchKlines, serverOffsetMs, setBases } from './binanceApi';
import { browserStore, useStore } from './store';
import type { KeyValueStore } from '../core/config';

export const DEFAULT_WATCH = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
const WATCH_KEY = 'm5sa.watch.v1';
const WATCH_MT5_KEY = 'm5sa.watch.mt5.v1';
const FONTE_KEY = 'm5sa.fonte.v1';

export type Fonte = 'binance' | 'mt5';
export const DEFAULT_WATCH_MT5 = ['EURUSD'];
export const PONTE_PADRAO = 'http://127.0.0.1:8765';

/** A ponte só pode ficar neste computador: endereço de loopback com porta. */
export function ponteValida(u: string): boolean {
  return /^http:\/\/(127\.0\.0\.1|localhost):\d{4,5}$/.test(u);
}

const simboloValido = (f: Fonte, s: string) => (f === 'mt5' ? symbolMt5Valido(s) : isValidSymbol(s));

function loadFonte(store: KeyValueStore): { fonte: Fonte; ponte: string } {
  try {
    const o = JSON.parse(store.getItem(FONTE_KEY) ?? 'null') as { fonte?: unknown; ponte?: unknown } | null;
    return {
      fonte: o?.fonte === 'mt5' ? 'mt5' : 'binance',
      ponte: typeof o?.ponte === 'string' && ponteValida(o.ponte) ? o.ponte : PONTE_PADRAO,
    };
  } catch { return { fonte: 'binance', ponte: PONTE_PADRAO }; }
}

function loadSymbols(store: KeyValueStore, f: Fonte): string[] {
  try {
    const raw = JSON.parse(store.getItem(f === 'mt5' ? WATCH_MT5_KEY : WATCH_KEY) ?? 'null') as unknown;
    if (Array.isArray(raw)) {
      const ok = raw.filter((x): x is string => typeof x === 'string' && simboloValido(f, x));
      if (ok.length) return ok.slice(0, 12);
    }
  } catch { /* usa o padrão */ }
  return f === 'mt5' ? DEFAULT_WATCH_MT5 : DEFAULT_WATCH;
}

export interface LiveRow {
  symbol: string;
  price: number | null;
  remaining: number;
  analysis: AnalysisResult | null;
  error: string | null;
}

interface Live {
  fonte: Fonte;
  ponte: string;
  setFonte: (f: Fonte, ponte?: string) => void;
  on: boolean;
  online: boolean;
  connect: () => void;
  disconnect: () => void;
  symbols: string[];
  setSymbols: (s: string[]) => void;
  selected: string;
  select: (s: string) => void;
  rows: LiveRow[];
  journal: JournalEntry[];
  clearJournal: () => void;
}

const Ctx = createContext<Live | null>(null);
export function useLive(): Live {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLive fora do provider');
  return v;
}

interface Raw { c5: Candle[]; m1: Candle[] }

/**
 * Feed ao vivo por consulta periódica (a cada 5 s) da API pública da Binance.
 * Mantém uma análise por par e entrega a do par selecionado ao resto do app.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { config, displayTimezone, setLoaded, data } = useStore();
  const store = useRef(browserStore()).current;
  const [on, setOn] = useState(false);
  const [online, setOnline] = useState(false);
  const [{ fonte, ponte }, setFonteState] = useState(() => loadFonte(store));
  const [symbols, setSymbolsState] = useState<string[]>(() => loadSymbols(store, fonte));
  const [selected, setSelected] = useState(symbols[0]!);
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>(() => loadJournal(store));

  const cfg = useRef(config);
  cfg.current = config;
  const tz = useRef(displayTimezone);
  tz.current = displayTimezone;
  const sel = useRef(selected);
  sel.current = selected;
  const dataRef = useRef(data);
  dataRef.current = data;
  const syms = useRef(symbols);
  syms.current = symbols;
  const fonteRef = useRef({ fonte, ponte });
  fonteRef.current = { fonte, ponte };
  const offset = useRef(0);
  const raw = useRef(new Map<string, Raw>());
  const analyses = useRef(new Map<string, LiveRow>());
  const seen = useRef(new Set(journal.map((e) => e.id)));
  const warm = useRef(true);
  const journalRef = useRef(journal);
  journalRef.current = journal;
  const busy = useRef(false);

  const nowSec = () => (Date.now() + offset.current) / 1000;

  const compute = useCallback((only?: string): void => {
    const now = nowSec();
    for (const s of only ? [only] : syms.current) {
      const r = raw.current.get(s);
      if (!r) continue;
      const split = splitForming(r.c5, now);
      if (!split) continue;
      const intrabar = buildIntrabar(split, r.m1, now);
      const source = liveSource(s, split.closed, tz.current, Date.now(), fonteRef.current.fonte);
      const analysis = analyze({ candles: split.closed, source, config: cfg.current, intrabar });
      analyses.current.set(s, { symbol: s, price: intrabar.forming?.c ?? null, remaining: intrabar.remainingSeconds, analysis, error: null });
      if (s === sel.current) {
        setLoaded({ candles: split.closed, source, importInfo: null, live: { symbol: s, formingOpenT: split.formingOpenT, intrabar } });
      }
    }
    setRows(syms.current.map((s) => analyses.current.get(s) ?? { symbol: s, price: null, remaining: 0, analysis: null, error: null }));
  }, [setLoaded]);

  const journalStep = useCallback(async (): Promise<void> => {
    const now = nowSec();
    let list = journalRef.current;
    let changed = false;
    if (!warm.current) {
      for (const s of syms.current) {
        const row = analyses.current.get(s);
        const r = raw.current.get(s);
        if (!row?.analysis || !r) continue;
        const split = splitForming(r.c5, now);
        if (!split) continue;
        const e = detectEntry(s, row.analysis, cfg.current, split.formingOpenT, row.remaining, now);
        if (e && !seen.current.has(e.id)) {
          seen.current.add(e.id);
          list = [...list, e];
          changed = true;
        }
      }
    }
    for (const e of list.filter((x) => isResolvable(x, now))) {
      try {
        const k = await fetchKlines(e.symbol, '5m', 1, `&startTime=${e.t5 * 1000}`);
        const done = resolveEntry(e, k[0], nowSec());
        if (done !== e) {
          list = list.map((x) => (x.id === e.id ? done : x));
          changed = true;
        }
      } catch { /* tenta de novo no próximo ciclo */ }
    }
    if (changed) {
      setJournal(list);
      saveJournal(store, list);
    }
    warm.current = false;
  }, [store]);

  const poll = useCallback(async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    try {
      let ok = 0;
      await Promise.all(syms.current.map(async (s) => {
        try {
          const [c5, m1] = await Promise.all([fetchKlines(s, '5m', 700), fetchKlines(s, '1m', 8)]);
          raw.current.set(s, { c5, m1 });
          ok++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'erro';
          const semPonte = fonteRef.current.fonte === 'mt5' && e instanceof TypeError;
          analyses.current.set(s, {
            symbol: s, price: null, remaining: 0, analysis: null,
            error: semPonte ? `ponte não encontrada em ${fonteRef.current.ponte} (abra a ponte: node ponte-mt5.cjs)` : msg,
          });
        }
      }));
      setOnline(ok > 0);
      compute();
      await journalStep();
    } finally {
      busy.current = false;
    }
  }, [compute, journalStep]);

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    warm.current = true;
    setBases(fonteRef.current.fonte === 'mt5' ? [fonteRef.current.ponte] : BINANCE_BASES);
    void (async () => {
      try { offset.current = await serverOffsetMs(); } catch { offset.current = 0; }
      if (!cancelled) void poll();
    })();
    const p = setInterval(() => void poll(), 5000);
    const t = setInterval(() => compute(sel.current), 1000);
    return () => {
      cancelled = true;
      clearInterval(p);
      clearInterval(t);
    };
  }, [on, poll, compute]);

  // trocar de par ou de configuração reflete na hora, sem esperar a próxima consulta
  useEffect(() => {
    if (on) compute();
  }, [selected, config, on, compute]);

  const trocarFonte = useCallback((f: Fonte, novaPonte?: string): void => {
    const p = novaPonte !== undefined && ponteValida(novaPonte) ? novaPonte : fonteRef.current.ponte;
    setOn(false); setOnline(false); setRows([]);
    analyses.current.clear(); raw.current.clear();
    if (dataRef.current?.live) setLoaded(null);
    const list = loadSymbols(store, f);
    setFonteState({ fonte: f, ponte: p });
    setSymbolsState(list);
    setSelected(list[0]!);
    try { store.setItem(FONTE_KEY, JSON.stringify({ fonte: f, ponte: p })); } catch { /* preferência não essencial */ }
  }, [store, setLoaded]);

  const value = useMemo<Live>(() => ({
    fonte, ponte, setFonte: trocarFonte,
    on, online,
    connect: () => setOn(true),
    disconnect: () => { setOn(false); setOnline(false); setRows([]); analyses.current.clear(); raw.current.clear(); if (data?.live) setLoaded(null); },
    symbols,
    setSymbols: (list) => {
      const f = fonteRef.current.fonte;
      const clean = [...new Set(list.map((x) => (f === 'mt5' ? x.trim() : x.trim().toUpperCase())).filter((x) => simboloValido(f, x)))].slice(0, 12);
      if (!clean.length) return;
      setSymbolsState(clean);
      try { store.setItem(f === 'mt5' ? WATCH_MT5_KEY : WATCH_KEY, JSON.stringify(clean)); } catch { /* preferência não essencial */ }
      if (!clean.includes(sel.current)) setSelected(clean[0]!);
    },
    selected,
    select: setSelected,
    rows, journal,
    clearJournal: () => { setJournal([]); seen.current.clear(); saveJournal(store, []); },
  }), [fonte, ponte, trocarFonte, on, online, symbols, selected, rows, journal, data, setLoaded, store]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
