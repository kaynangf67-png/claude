import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { describe as describeCandles, guard, handleCandles, handleDesk, type DeskReading } from "./desk";
import { atr, ema, rsi } from "./market";

// relógio fixo: 10 s depois do fechamento de uma vela M5 (as mesas analisam nesse momento)
const lastOpen = Math.floor(Date.UTC(2026, 9, 31, 15, 0, 0) / 1000);
const now = lastOpen + 300 + 10;
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now * 1000);
});
afterAll(() => vi.useRealTimers());
const klines = Array.from({ length: 100 }, (_, i) => {
  const t = lastOpen - (98 - i) * 300; // 99 fechadas + 1 em formação
  const p = 100 + i * 0.1;
  return [t * 1000, String(p), String(p + 0.3), String(p - 0.2), String(p + 0.1), "10", (t + 300) * 1000 - 1];
});
const reading: DeskReading = { decision: "CALL", strength: "moderada", expiration_candles: 2, reasons: ["a", "b"], against: [] };

function stubFetch(aiText = JSON.stringify(reading)) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
    const u = String(url instanceof Request ? url.url : url);
    calls.push(u);
    if (u.includes("/klines")) return new Response(JSON.stringify(klines), { status: 200 });
    if (u.includes("/ticker/price")) return new Response(JSON.stringify({ price: "109.95" }), { status: 200 });
    return new Response(JSON.stringify({
      id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: aiText }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("indicadores", () => {
  it("EMA, RSI e ATR em série de alta", () => {
    const up = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(ema(up, 9).at(-1)!).toBeLessThan(30);
    expect(rsi(up)).toBe(100);
    expect(atr(up.map((v, i) => ({ time: i, open: v, high: v + 1, low: v - 1, close: v, closed: true })))).toBeGreaterThan(0);
  });
});

describe("travas da mesa", () => {
  it("dado atrasado, setup fraco ou poucos motivos viram AGUARDAR", () => {
    expect(guard(reading, lastOpen, now).decision).toBe("CALL");
    expect(guard(reading, lastOpen - 3600, now).decision).toBe("AGUARDAR");
    expect(guard({ ...reading, strength: "fraca" }, lastOpen, now).decision).toBe("AGUARDAR");
    expect(guard({ ...reading, reasons: ["a"] }, lastOpen, now).decision).toBe("AGUARDAR");
  });
  it("a IA recebe só velas fechadas", () => {
    const candles = klines.map((r) => ({ time: Number(r[0]) / 1000, open: 1, high: 1, low: 1, close: 1, closed: Number(r[6]) < Date.now() }));
    const text = describeCandles(candles);
    expect(text.split("\n").filter((l) => /^\d\d:\d\d,/.test(l))).toHaveLength(40);
  });
});

describe("API", () => {
  const post = (body: unknown) => new Request("http://x/api/desk", { method: "POST", body: JSON.stringify(body) });

  it("sem chave da IA avisa", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await handleDesk(post({ asset: "BTCUSD" }))).status).toBe(503);
  });
  it("recusa ativo fora da lista", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    expect((await handleDesk(post({ asset: "EURUSD" }))).status).toBe(400);
  });
  it("busca velas reais, chama a IA e devolve a decisão com o preço de entrada", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    const calls = stubFetch();
    const res = await handleDesk(post({ asset: "BTCUSD" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.decision).toBe("CALL");
    expect(body.price).toBe(109.95);
    expect(body.last_candle).toBe(lastOpen);
    expect(calls.some((u) => u.includes("data-api.binance.vision") && u.includes("BTCUSDT"))).toBe(true);
  });
  it("candles para conferir o resultado", async () => {
    stubFetch();
    const res = await handleCandles(new Request("http://x/api/candles?asset=ETHUSD"));
    const body = await res.json();
    expect(body.candles.at(-1).closed).toBe(false);
    expect(body.candles.at(-2).closed).toBe(true);
  });
});
