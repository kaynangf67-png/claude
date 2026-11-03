import { breakEven, wilson } from "../src/lib/math.js";
import { parseBinance, type Candle } from "./signal.js";

/**
 * Teste histórico de 3 estratégias de padrão, em velas de 5 minutos da Binance.
 * Regra de resultado (binária de 1 vela): entra no fechamento do sinal e expira no fechamento da vela seguinte.
 * Empate conta como perda (mais conservador). Payout padrão de 85%.
 */

export type Dir = "CALL" | "PUT";
export interface Trade { i: number; dir: Dir; win: boolean }
export interface StrategyResult { name: string; trades: number; wins: number; rate: number | null; ci: [number, number] | null; breakEven: number; edge: "acima" | "abaixo" | "sem amostra" }

const pct = (a: number, b: number) => Math.abs(a - b) / b;
const isUp = (c: Candle) => c.c > c.o;
const isDown = (c: Candle) => c.c < c.o;

/** 1) Rompimento com reteste: rompe a máxima das 30 velas anteriores, volta a encostar nela e fecha de volta a favor. */
export function breakoutRetest(c: Candle[], i: number): Dir | null {
  if (i < 35) return null;
  const hi = Math.max(...c.slice(i - 32, i - 3).map((k) => k.h));
  const lo = Math.min(...c.slice(i - 32, i - 3).map((k) => k.l));
  const b = c[i - 2], r = c[i - 1], s = c[i];
  if (b.c > hi && pct(r.l, hi) <= 0.001 && r.l <= hi * 1.001 && isUp(s) && s.c > hi) return "CALL";
  if (b.c < lo && pct(r.h, lo) <= 0.001 && r.h >= lo * 0.999 && isDown(s) && s.c < lo) return "PUT";
  return null;
}

/** 2) Tendência com pullback na média: EMA21 > EMA50 (ou o contrário), preço recua até a EMA21 e a vela retoma a tendência. */
export function trendPullback(c: Candle[], i: number, ema21: number[], ema50: number[]): Dir | null {
  if (i < 60) return null;
  const p = c[i - 1], s = c[i];
  if (ema21[i] > ema50[i] && p.l <= ema21[i - 1] * 1.0005 && p.c > ema21[i - 1] && isUp(s) && s.c > ema21[i]) return "CALL";
  if (ema21[i] < ema50[i] && p.h >= ema21[i - 1] * 0.9995 && p.c < ema21[i - 1] && isDown(s) && s.c < ema21[i]) return "PUT";
  return null;
}

/** 3) Rejeição em suporte/resistância: a vela toca a máxima (ou mínima) das 50 velas anteriores e volta. */
export function rejection(c: Candle[], i: number): Dir | null {
  if (i < 52) return null;
  const hi = Math.max(...c.slice(i - 51, i).map((k) => k.h));
  const lo = Math.min(...c.slice(i - 51, i).map((k) => k.l));
  const s = c[i];
  if (s.h >= hi * 0.9995 && s.c < hi * 0.999 && isDown(s)) return "PUT";
  if (s.l <= lo * 1.0005 && s.c > lo * 1.001 && isUp(s)) return "CALL";
  return null;
}

export function ema(values: number[], n: number): number[] {
  const k = 2 / (n + 1), out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

export function runStrategy(name: string, c: Candle[], pick: (i: number) => Dir | null, payout = 0.85): StrategyResult {
  const trades: Trade[] = [];
  for (let i = 0; i < c.length - 1; i++) {
    const dir = pick(i);
    if (!dir) continue;
    const up = c[i + 1].c > c[i].c;
    const win = dir === "CALL" ? up : !up && c[i + 1].c < c[i].c;
    trades.push({ i, dir, win });
    // não empilha operações: a próxima só depois que esta expira (1 vela)
    i += 1;
  }
  const wins = trades.filter((t) => t.win).length;
  const n = trades.length;
  const be = breakEven(payout);
  const ci = wilson(wins, n);
  const rate = n ? wins / n : null;
  let edge: StrategyResult["edge"] = "sem amostra";
  if (ci) edge = ci[0] > be ? "acima" : ci[1] < be ? "abaixo" : "sem amostra";
  return { name, trades: n, wins, rate, ci, breakEven: be, edge };
}

export function backtest(c: Candle[], payout = 0.85) {
  const closes = c.map((k) => k.c);
  const e21 = ema(closes, 21), e50 = ema(closes, 50);
  return [
    runStrategy("Rompimento com reteste", c, (i) => breakoutRetest(c, i), payout),
    runStrategy("Tendência com pullback na EMA21", c, (i) => trendPullback(c, i, e21, e50), payout),
    runStrategy("Rejeição em suporte/resistência", c, (i) => rejection(c, i), payout),
  ];
}

const SYMBOLS = new Set(["BTCUSDT", "ETHUSDT"]);

export async function handleBacktest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();
  if (!SYMBOLS.has(symbol)) return new Response(JSON.stringify({ error: "Símbolo não permitido" }), { status: 400, headers: { "content-type": "application/json" } });
  const res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=5m&limit=1000`);
  if (!res.ok) return new Response(JSON.stringify({ error: `Binance ${res.status}` }), { status: 502, headers: { "content-type": "application/json" } });
  const candles = parseBinance(await res.json()).slice(0, -1); // descarta a vela em formação
  const results = backtest(candles);
  const body = {
    symbol, candles: candles.length,
    from: new Date(candles[0].t * 1000).toISOString(), to: new Date(candles.at(-1)!.t * 1000).toISOString(),
    payout: 0.85, breakEven: breakEven(0.85), results,
    note: "Histórico de ~3,5 dias de velas de 5 min. Resultado passado não garante resultado futuro.",
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
