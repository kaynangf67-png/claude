import { cleanCandles } from "./candles.js";
import type { Candle, TF } from "./types.js";

/** MarketDataService: velas OHLC reais do Yahoo Finance (gratuito, não oficial, pode atrasar). */

export const FOREX_YAHOO: Record<string, string> = {
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X", AUDUSD: "AUDUSD=X", USDCAD: "USDCAD=X",
  USDCHF: "USDCHF=X", NZDUSD: "NZDUSD=X", EURGBP: "EURGBP=X", EURJPY: "EURJPY=X", GBPJPY: "GBPJPY=X",
  AUDCAD: "AUDCAD=X", AUDJPY: "AUDJPY=X",
};
export const FOREX_LABEL = (id: string) => `${id.slice(0, 3)}/${id.slice(3)}`;
export const currenciesOf = (id: string) => [id.slice(0, 3), id.slice(3)];

interface YahooBody { chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] } }[] } }

export function parseYahooCandles(body: unknown): Candle[] {
  const r = (body as YahooBody)?.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0];
  if (!r?.timestamp || !q) throw new Error("Velas em formato inesperado");
  const out: Candle[] = [];
  r.timestamp.forEach((t, i) => {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (typeof o === "number" && typeof h === "number" && typeof l === "number" && typeof c === "number") {
      const v = q.volume?.[i];
      out.push({ t, o, h, l, c, v: typeof v === "number" && v > 0 ? v : undefined });
    }
  });
  return out;
}

const SPEC: Record<Exclude<TF, "H4">, { interval: string; range: string }> = {
  D1: { interval: "1d", range: "2y" },
  H1: { interval: "60m", range: "6mo" },
  M30: { interval: "30m", range: "1mo" },
  M15: { interval: "15m", range: "1mo" },
  M5: { interval: "5m", range: "60d" }, // o Yahoo limita o M5 a ~60 dias
  M1: { interval: "1m", range: "5d" },
};

export interface RawSeries { candles: Candle[]; duplicates: number; invalid: number }

export async function fetchSeries(symbolId: string, tf: TF, range?: string): Promise<RawSeries> {
  const sym = FOREX_YAHOO[symbolId];
  if (!sym) throw new Error("Par não suportado");
  if (tf === "H4") { // o Yahoo não tem 4h: monta a partir do H1 de 1 ano
    const h1 = await fetchSeries(symbolId, "H1", range ?? "1y");
    return { ...h1, candles: aggregate(h1.candles, 4 * 3600) };
  }
  const { interval, range: r } = SPEC[tf];
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range ?? r}`, {
    headers: { "user-agent": "Mozilla/5.0 (TradeAI forex)" },
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status} (${tf})`);
  const cleaned = cleanCandles(parseYahooCandles(await res.json()));
  return cleaned;
}

/** Agrega velas em blocos alinhados em UTC (ex.: H4 = 00h, 04h, 08h...). O bloco em formação some depois em closedOnly. */
export function aggregate(c: Candle[], seconds: number): Candle[] {
  const out: Candle[] = [];
  for (const k of c) {
    const t = Math.floor(k.t / seconds) * seconds, last = out[out.length - 1];
    if (last && last.t === t) { last.h = Math.max(last.h, k.h); last.l = Math.min(last.l, k.l); last.c = k.c; if (k.v) last.v = (last.v ?? 0) + k.v; }
    else out.push({ t, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v });
  }
  return out;
}
