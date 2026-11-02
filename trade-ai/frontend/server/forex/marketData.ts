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

const SPEC: Record<TF, { interval: string; range: string }> = {
  H1: { interval: "60m", range: "3mo" },
  M15: { interval: "15m", range: "1mo" },
  M5: { interval: "5m", range: "1mo" },
  M1: { interval: "1m", range: "5d" },
};

export interface RawSeries { candles: Candle[]; duplicates: number; invalid: number }

export async function fetchSeries(symbolId: string, tf: TF, range?: string): Promise<RawSeries> {
  const sym = FOREX_YAHOO[symbolId];
  if (!sym) throw new Error("Par não suportado");
  const { interval, range: r } = SPEC[tf];
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range ?? r}`, {
    headers: { "user-agent": "Mozilla/5.0 (TradeAI forex)" },
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status} (${tf})`);
  const cleaned = cleanCandles(parseYahooCandles(await res.json()));
  return cleaned;
}
