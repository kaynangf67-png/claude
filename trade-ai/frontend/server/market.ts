/** Dados reais de cripto da Binance (endpoint público de dados de mercado, sem chave). */

export const CRYPTO: Record<string, { pair: string; label: string }> = {
  BTCUSD: { pair: "BTCUSDT", label: "BTC/USD" },
  ETHUSD: { pair: "ETHUSDT", label: "ETH/USD" },
  LTCUSD: { pair: "LTCUSDT", label: "LTC/USD" },
  XRPUSD: { pair: "XRPUSDT", label: "XRP/USD" },
  SOLUSD: { pair: "SOLUSDT", label: "SOL/USD" },
  BNBUSD: { pair: "BNBUSDT", label: "BNB/USD" },
};

// data-api.binance.vision serve só dados públicos e não bloqueia por região como api.binance.com
const BASE = "https://data-api.binance.vision/api/v3";
export const M5 = 300;

export interface Candle {
  time: number; // abertura, epoch em segundos
  open: number;
  high: number;
  low: number;
  close: number;
  closed: boolean;
}

export async function fetchCandles(asset: string, limit = 100, now = Date.now()): Promise<Candle[]> {
  const info = CRYPTO[asset];
  if (!info) throw new Error("Ativo não suportado");
  const res = await fetch(`${BASE}/klines?symbol=${info.pair}&interval=5m&limit=${limit}`);
  if (!res.ok) throw new Error(`Binance respondeu ${res.status}`);
  const rows = (await res.json()) as [number, string, string, string, string, string, number][];
  return rows.map((r) => ({
    time: Math.floor(r[0] / 1000),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    closed: r[6] < now,
  }));
}

export async function fetchPrice(asset: string): Promise<number> {
  const info = CRYPTO[asset];
  if (!info) throw new Error("Ativo não suportado");
  const res = await fetch(`${BASE}/ticker/price?symbol=${info.pair}`);
  if (!res.ok) throw new Error(`Binance respondeu ${res.status}`);
  return Number(((await res.json()) as { price: string }).price);
}

export function ema(values: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

export function rsi(closes: number[], n = 14): number | null {
  if (closes.length <= n) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

export function atr(c: Candle[], n = 14): number | null {
  if (c.length <= n) return null;
  const tr = c.slice(1).map((x, i) => Math.max(x.high - x.low, Math.abs(x.high - c[i].close), Math.abs(x.low - c[i].close)));
  let a = tr.slice(0, n).reduce((s, v) => s + v, 0) / n;
  for (let i = n; i < tr.length; i++) a = (a * (n - 1) + tr[i]) / n;
  return a;
}
