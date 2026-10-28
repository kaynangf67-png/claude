import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildIntrabar, isValidSymbol, liveSource, splitForming } from '../core/binance';
import { analyze } from '../core/engine';
import {
  detectEntry, isResolvable, loadJournal, resolveEntry, saveJournal, type JournalEntry,
} from '../core/journal';
import type { AnalysisResult, Candle } from '../core/types';
import { fetchKlines, serverOffsetMs } from './binanceApi';
import { browserStore, useStore } from './store';

export const DEFAULT_WATCH = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
const WATCH_KEY = 'm5sa.watch.v1';

export interface LiveRow {
  symbol: string;
  price: number | null;
  remaining: number;
  analysis: AnalysisResult | null;
  error: string | null;
}

interface Live {
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
  const [symbols, setSymbolsState] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(store.getItem(WATCH_KEY) ?? 'null') as unknown;
      if (Array.isArray(raw)) {
        const ok = raw.filter((x): x is string => typeof x === 'string' && isValidSymbol(x));
        if (ok.length) return ok.slice(0, 12);
      }
    } catch { /* usa o padrão */ }
    return DEFAULT_WATCH;
  });
  const [selected, setSelected] = useState(symbols[0]!);
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>(() => loadJournal(store));

  const cfg = useRef(config);
  cfg.current = config;
  const tz = useRef(displayTimezone);
  tz.current = displayTimezone;
  const sel = useRef(selected);
  sel.current = selected;
  const syms = useRef(symbols);
  syms.current = symbols;
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
      const source = liveSource(s, split.closed, tz.current, Date.now());
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
          analyses.current.set(s, { symbol: s, price: null, remaining: 0, analysis: null, error: e instanceof Error ? e.message : 'erro' });
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

  const value = useMemo<Live>(() => ({
    on, online,
    connect: () => setOn(true),
    disconnect: () => { setOn(false); setOnline(false); setRows([]); analyses.current.clear(); raw.current.clear(); if (data?.live) setLoaded(null); },
    symbols,
    setSymbols: (list) => {
      const clean = [...new Set(list.map((x) => x.trim().toUpperCase()).filter(isValidSymbol))].slice(0, 12);
      if (!clean.length) return;
      setSymbolsState(clean);
      try { store.setItem(WATCH_KEY, JSON.stringify(clean)); } catch { /* preferência não essencial */ }
      if (!clean.includes(sel.current)) setSelected(clean[0]!);
    },
    selected,
    select: setSelected,
    rows, journal,
    clearJournal: () => { setJournal([]); seen.current.clear(); saveJournal(store, []); },
  }), [on, online, symbols, selected, rows, journal, data, setLoaded, store]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
