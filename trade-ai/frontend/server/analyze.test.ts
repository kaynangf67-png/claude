import { afterEach, describe, expect, it, vi } from "vitest";
import { applyGuards, handleAnalyze, normalizeSymbol, sameAsset, timeframeMinutes, type Reading } from "./analyze";
import { breakEven, entryTimes, units, wilson } from "../src/lib/math";

const base: Reading = {
  is_chart: true, platform: "Corretora X", symbol: "EUR/USD", timeframe: "M5", last_price: 1.0842,
  visible_time: "14:32", trend: "alta", last_candles: "três velas de alta", supports: [1.083], resistances: [1.086],
  indicators: [], decision: "CALL", setup_quality: "moderada", entry_reference_price: 1.0842, expiration_candles: 1,
  reasons: ["Tendência de alta", "Rejeição no suporte"], against: [], invalidation: null, missing: [],
  request_new_capture: false, new_capture_reason: null,
};

describe("matemática", () => {
  it("ponto de equilíbrio do payout", () => {
    expect(breakEven(0.85)).toBeCloseTo(0.5405, 4);
    expect(breakEven(1)).toBe(0.5);
  });
  it("intervalo de Wilson cobre a taxa e encolhe com a amostra", () => {
    const [lo, hi] = wilson(55, 100)!;
    expect(lo).toBeLessThan(0.55);
    expect(hi).toBeGreaterThan(0.55);
    const [lo2, hi2] = wilson(550, 1000)!;
    expect(hi2 - lo2).toBeLessThan(hi - lo);
    expect(wilson(0, 0)).toBeNull();
  });
  it("resultado em entradas", () => {
    expect(units(6, 4, 0.85)).toBeCloseTo(1.1);
  });
  it("entrada na próxima vela e pula se faltar pouco", () => {
    const now = new Date("2026-10-30T14:32:20Z");
    const t = entryTimes(now, 5, 2);
    expect(t.entry.toISOString()).toBe("2026-10-30T14:35:00.000Z");
    expect(t.expiry.toISOString()).toBe("2026-10-30T14:45:00.000Z");
    const late = entryTimes(new Date("2026-10-30T14:34:55Z"), 5, 1);
    expect(late.entry.toISOString()).toBe("2026-10-30T14:40:00.000Z");
  });
});

describe("timeframe", () => {
  it.each([["M1", 1], ["1m", 1], ["5", 5], ["M5", 5], ["15 min", 15], ["H1", 60], ["1h", 60], ["diário", null], [null, null]])(
    "%s -> %s", (tf, m) => expect(timeframeMinutes(tf as string | null)).toBe(m));
});

describe("travas", () => {
  it("mantém um setup válido", () => {
    const r = applyGuards(base, 20);
    expect(r.decision).toBe("CALL");
    expect(r.blocks).toEqual([]);
    expect(r.timeframe_minutes).toBe(5);
  });
  it("print antigo vira NÃO OPERAR", () => {
    const r = applyGuards(base, 600);
    expect(r.decision).toBe("NAO_OPERAR");
    expect(r.ai_decision).toBe("CALL");
    expect(r.blocks[0]).toMatch(/10 min/);
  });
  it("sem timeframe, não é gráfico, setup fraco ou nova captura -> NÃO OPERAR", () => {
    expect(applyGuards({ ...base, timeframe: null }, 0).decision).toBe("NAO_OPERAR");
    expect(applyGuards({ ...base, is_chart: false }, 0).decision).toBe("NAO_OPERAR");
    expect(applyGuards({ ...base, setup_quality: "fraca" }, 0).decision).toBe("NAO_OPERAR");
    expect(applyGuards({ ...base, request_new_capture: true }, 0).decision).toBe("NAO_OPERAR");
    expect(applyGuards({ ...base, timeframe: "H1" }, 0).decision).toBe("NAO_OPERAR");
    expect(applyGuards({ ...base, reasons: ["só um"] }, 0).decision).toBe("NAO_OPERAR");
  });
  it("só aceita M5", () => {
    expect(applyGuards({ ...base, timeframe: "M1" }, 0).blocks[0]).toMatch(/5 minutos/);
    expect(applyGuards({ ...base, timeframe: "15m" }, 0).decision).toBe("NAO_OPERAR");
    expect(applyGuards({ ...base, timeframe: "5m" }, 0).decision).toBe("CALL");
  });
  it("confere o ativo selecionado", () => {
    expect(applyGuards(base, 0, "EUR/USD").decision).toBe("CALL");
    expect(applyGuards({ ...base, symbol: "EUR/USD (OTC)" }, 0, "EUR/USD").decision).toBe("CALL");
    expect(applyGuards({ ...base, symbol: "GBP/USD" }, 0, "EUR/USD").blocks[0]).toMatch(/GBP\/USD/);
    expect(applyGuards({ ...base, symbol: null }, 0, "EUR/USD").decision).toBe("NAO_OPERAR");
  });
  it("normaliza símbolos de corretora", () => {
    expect(normalizeSymbol("BTCUSDT")).toBe("BTCUSD");
    expect(normalizeSymbol("Gold")).toBe("XAUUSD");
    expect(sameAsset("XAU/USD", "Ouro (XAU/USD)")).toBe(true);
    expect(sameAsset("Ouro", "XAU/USD")).toBe(true);
    expect(sameAsset("EUR/JPY", "EUR/USD")).toBe(false);
  });
  it("limita a expiração entre 1 e 3 velas", () => {
    expect(applyGuards({ ...base, expiration_candles: 12 }, 0).expiration_candles).toBe(3);
    expect(applyGuards({ ...base, expiration_candles: 0 }, 0).expiration_candles).toBe(1);
  });
});

describe("API /api/analyze", () => {
  const req = (body: unknown) =>
    new Request("http://x/api/analyze", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sem chave avisa em vez de inventar", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await handleAnalyze(req({ image: "x", media_type: "image/png" }));
    expect(res.status).toBe(503);
  });

  it("recusa formato inválido", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test");
    expect((await handleAnalyze(req({ image: "x", media_type: "text/plain" }))).status).toBe(400);
  });

  it("chama a IA com imagem e esquema e aplica as travas", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test");
    let sent: Record<string, unknown> = {};
    let headers: Headers | null = null;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      headers = new Headers(init.headers);
      return new Response(JSON.stringify({
        id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn",
        stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 },
        content: [{ type: "text", text: JSON.stringify(base) }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const res = await handleAnalyze(req({ image: "aGVsbG8=", media_type: "image/jpeg", image_age_s: 900, asset: "EUR/USD" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ai_decision).toBe("CALL");
    expect(body.decision).toBe("NAO_OPERAR"); // print de 15 min
    expect(sent.model).toBe("claude-opus-5-5");
    expect(sent.fallbacks).toBe("default");
    expect((sent.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    const content = (sent.messages as { content: { type: string }[] }[])[0].content;
    expect(content[0].type).toBe("image");
    expect((content[1] as unknown as { text: string }).text).toContain("EUR/USD");
    expect(headers!.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
  });
});
