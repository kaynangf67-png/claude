import { afterEach, describe, expect, it, vi } from "vitest";
import { applySignalGuards, closedCandles, ema, handleSignal, newsBlock, parseBinance, parseYahoo, rsi, type AiReading } from "./signal";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const NOW = Date.UTC(2026, 10, 3, 14, 32, 10) / 1000; // ter 03/11 14:32:10 UTC
const req = (asset: string) => new Request("http://x/api/signal", { method: "POST", body: JSON.stringify({ asset }) });

/** velas M5 em alta suave, terminando na vela em formação de agora */
function klines(n = 120, lastOpen = Math.floor(NOW / 300) * 300) {
  return Array.from({ length: n }, (_, i) => {
    const t = lastOpen - (n - 1 - i) * 300, o = 100 + i * 0.1;
    return [t * 1000, String(o), String(o + 0.15), String(o - 0.05), String(o + 0.1), "0"];
  });
}
const binance = (rows: unknown) => vi.fn(async () => new Response(JSON.stringify(rows)));

const good: AiReading = {
  decision: "CALL", strength: 72, expiry_candles: 2, invalidation_price: 110, target_price: 113,
  reasons_for: ["EMA9 acima da EMA21", "Topos e fundos ascendentes"], reasons_against: ["RSI alto"], summary: "Tendência de alta.",
};

describe("velas", () => {
  it("lê a Binance e descarta a vela em formação", () => {
    const c = parseBinance(klines(3));
    expect(c).toHaveLength(3);
    expect(closedCandles(c, NOW)).toHaveLength(2);
  });
  it("lê o Yahoo e pula buracos (null)", () => {
    const c = parseYahoo({ chart: { result: [{ timestamp: [1, 2, 3], indicators: { quote: [{ open: [1, null, 3], high: [2, 2, 4], low: [0.5, 1, 2], close: [1.5, 1.5, 3.5] }] } }] } });
    expect(c.map((k) => k.t)).toEqual([1, 3]);
    expect(() => parseYahoo({})).toThrow();
  });
});

describe("indicadores", () => {
  it("EMA de série constante é a própria constante; RSI só de altas é 100", () => {
    expect(ema([5, 5, 5, 5], 3).at(-1)).toBe(5);
    expect(rsi(Array.from({ length: 30 }, (_, i) => i))).toBe(100);
    expect(rsi([1, 2, 3])).toBeNull();
  });
});

describe("travas", () => {
  it("notícia ★★★ da moeda do ativo perto de agora bloqueia", () => {
    const ev = [{ at: NOW + 600, title: "CPI m/m", country: "USD", impact: 3, forecast: "", previous: "" }];
    expect(newsBlock(ev, ["EUR", "USD"], NOW)?.title).toBe("CPI m/m");
    expect(newsBlock(ev, ["GBP", "JPY"], NOW)).toBeNull();
    expect(newsBlock([{ ...ev[0], impact: 2 }], ["USD"], NOW)).toBeNull();
    expect(newsBlock([{ ...ev[0], at: NOW + 3 * 3600 }], ["USD"], NOW)).toBeNull();
  });
  it("sinal fraco vira NÃO OPERAR; níveis do lado errado são descartados", () => {
    expect(applySignalGuards({ ...good, strength: 40 }, 111).reading.decision).toBe("NAO_OPERAR");
    expect(applySignalGuards({ ...good, reasons_for: ["só um"] }, 111).blocked).toMatch(/dois motivos/);
    const r = applySignalGuards({ ...good, invalidation_price: 115, target_price: 105, expiry_candles: 9 }, 111).reading;
    expect(r.invalidation_price).toBeNull();
    expect(r.target_price).toBeNull();
    expect(r.expiry_candles).toBe(3);
  });
});

describe("API /api/signal", () => {
  const deps = { now: () => NOW * 1000, calendar: async () => [], ask: async () => good };

  it("ativo desconhecido → 400", async () => {
    expect((await handleSignal(req("XYZ"), deps)).status).toBe(400);
  });

  it("sem rompimento nem rejeição em zona de H1 → NÃO OPERAR sem chamar a IA", async () => {
    vi.stubGlobal("fetch", binance(klines()));
    const ask = vi.fn(async () => good);
    const s = await (await handleSignal(req("BTCUSD"), { ...deps, ask })).json();
    expect(s.decision).toBe("NAO_OPERAR");
    expect(s.setup).toBeNull();
    expect(ask).not.toHaveBeenCalled();
    expect(s.price).toBeCloseTo(111.9, 5); // fechamento da última vela FECHADA
  });

  it("mercado parado (última vela antiga) → NÃO OPERAR sem chamar a IA", async () => {
    vi.stubGlobal("fetch", binance(klines(120, Math.floor(NOW / 300) * 300 - 3 * 3600)));
    const ask = vi.fn(async () => good);
    const s = await (await handleSignal(req("BTCUSD"), { ...deps, ask })).json();
    expect(s.decision).toBe("NAO_OPERAR");
    expect(s.blocked_by).toMatch(/parado ou fechado/);
    expect(ask).not.toHaveBeenCalled();
  });

  it("notícia de alto impacto → NÃO OPERAR sem chamar a IA", async () => {
    vi.stubGlobal("fetch", binance(klines()));
    const ask = vi.fn(async () => good);
    const calendar = async () => [{ at: NOW + 300, title: "Non-Farm Employment Change", country: "USD", impact: 3, forecast: "", previous: "" }];
    const s = await (await handleSignal(req("BTCUSD"), { ...deps, ask, calendar })).json();
    expect(s.decision).toBe("NAO_OPERAR");
    expect(s.blocked_by).toMatch(/Non-Farm/);
    expect(ask).not.toHaveBeenCalled();
  });

  it("sem chave da IA → 503 com instrução", async () => {
    vi.stubGlobal("fetch", binance(klines()));
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await handleSignal(req("BTCUSD"), { now: deps.now, calendar: deps.calendar });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("fonte fora do ar → 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    expect((await handleSignal(req("EURUSD"), deps)).status).toBe(502);
  });
});

describe("mensagem de erro da IA", async () => {
  const { aiErrorText } = await import("./signal");
  it("explica falta de crédito e mostra o texto original nos outros casos", () => {
    expect(aiErrorText({ status: 400, message: "400 Your credit balance is too low to access the Anthropic API." })).toMatch(/sem créditos/);
    expect(aiErrorText({ status: 400, message: "output_config.format.schema: invalid" })).toBe("Falha na IA (400): output_config.format.schema: invalid");
  });
});
