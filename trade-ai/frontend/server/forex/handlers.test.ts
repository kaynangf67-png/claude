import { describe, expect, it, vi } from "vitest";
import { handleForexAnalyze, handleForexBacktest, handleForexResolve, type Deps } from "./handlers.js";
import { aggregate, noisy } from "./testkit.js";
import type { TF } from "./types.js";

const m5 = noisy(11, 2360);
const now = (m5.at(-1)!.t + 300) * 1000;
const fakeSeries = (override: Partial<Record<TF, "falha">> = {}): Deps["series"] => async (_id, tf) => {
  if (override[tf] === "falha") throw new Error(`falha ${tf}`);
  if (tf === "M1") throw new Error("sem M1");
  const c = tf === "M5" ? m5 : tf === "M15" ? aggregate(m5, 3) : aggregate(m5, 12);
  return { candles: c, duplicates: 0, invalid: 0 };
};
const post = (body: unknown) => new Request("http://x/api/forex", { method: "POST", body: JSON.stringify(body) });

describe("/api/forex", () => {
  it("devolve a análise estruturada, com M1 indisponível e narrativa só quando há cenário", async () => {
    const narrate = vi.fn(async () => ({ resumo: "r", contexto: "c", fatores_favor: ["a"], fatores_contra: ["b"] }));
    const res = await handleForexAnalyze(post({ asset: "EURUSD" }), { series: fakeSeries(), calendar: async () => [], narrate, now: () => now });
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.decision).toBe("BUY");
    expect(j.trade.sl).toBeLessThan(j.trade.entry);
    expect(j.m1Used).toBe(false);
    expect(j.filters).toHaveLength(10);
    expect(j.narrative.resumo).toBe("r");
    expect(narrate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(j)).not.toMatch(/NaN/);
  });
  it("sem cenário a IA nem é chamada; calendário fora do ar vira 'não verificado'", async () => {
    const narrate = vi.fn();
    const flat = noisy(3, 2360);
    const series: Deps["series"] = async (_id, tf) => { if (tf === "M1") throw new Error("x"); return { candles: tf === "M5" ? flat : tf === "M15" ? aggregate(flat, 3) : aggregate(flat, 12), duplicates: 0, invalid: 0 }; };
    const j = await (await handleForexAnalyze(post({ asset: "GBPUSD" }), { series, calendar: async () => { throw new Error("off"); }, narrate: narrate as never, now: () => (flat.at(-1)!.t + 300) * 1000 })).json();
    expect(j.decision).toBe("NO_TRADE");
    expect(narrate).not.toHaveBeenCalled();
    expect(j.filters.find((f: { id: number }) => f.id === 9).status).toBe("nao_verificado");
  });
  it("par desconhecido = 400; falha de dados base = 502 com o motivo", async () => {
    expect((await handleForexAnalyze(post({ asset: "XXXYYY" }), {})).status).toBe(400);
    const r = await handleForexAnalyze(post({ asset: "EURUSD" }), { series: fakeSeries({ H1: "falha" }), now: () => now });
    expect(r.status).toBe(502);
    expect((await r.json()).error).toMatch(/H1/);
  });
  it("dado atrasado bloqueia: sem trade e com o motivo", async () => {
    const j = await (await handleForexAnalyze(post({ asset: "EURUSD" }), { series: fakeSeries(), calendar: async () => [], now: () => now + 8 * 3600_000 })).json();
    expect(j.decision).toBe("NO_TRADE");
    expect(j.trade).toBeNull();
    expect(j.data.ok).toBe(false);
    expect(j.data.issues.join(" ")).toMatch(/atrasados/);
  });
});

describe("/api/forex-resolve e /api/forex-backtest", () => {
  it("resolve sinais com as velas reais e devolve estatísticas", async () => {
    const entryT = m5[2000].t;
    const sig = { id: "1", symbol: "EURUSD", label: "EUR/USD", at: entryT, tf: "M5", dir: "BUY", strategy: "BOS e reteste", entry: m5[2000].c, sl: m5[2000].c - 0.0005, tps: [m5[2000].c + 0.0008, null, null], score: 80, reasons: [], pip: 0.0001 };
    const res = await handleForexResolve(new Request("http://x", { method: "POST", body: JSON.stringify({ signals: [sig, { ...sig, symbol: "ZZZ" }] }) }), { series: async (_id, tf) => ({ candles: tf === "M1" ? [] : m5, duplicates: 0, invalid: 0 }) });
    const j = await res.json();
    expect(j.resolved).toHaveLength(1); // o par inválido é descartado
    expect(["tp1", "stop", "ambiguo", "expirado", "aberto"]).toContain(j.resolved[0].status);
    expect(j.stats.note).toMatch(/Amostra pequena/);
  });
  it("backtest devolve período, custos e veredito", async () => {
    const j = await (await handleForexBacktest(new Request("http://x/api/forex-backtest?symbol=EURUSD"), { series: fakeSeries(), now: () => now })).json();
    expect(j.costsPips).toBeCloseTo(1.2, 5);
    expect(j.period.candlesM5).toBeGreaterThan(2000);
    expect(j.verdict).toBeTruthy();
    expect(j.note).toMatch(/sem olhar o futuro/);
  }, 30_000);
});
