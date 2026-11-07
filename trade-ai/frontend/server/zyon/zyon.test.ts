import { describe, expect, it } from "vitest";
import { MemoryStore } from "../agent/store.js";
import { handleAgent } from "../agent/handlers.js";
import { aggregate, noisy } from "../forex/testkit.js";
import type { TF } from "../forex/types.js";
import { brain, emptyState, exposure, master, resolvePosition, riskGuard, RISK_RULES, type Opportunity, type Position } from "./core.js";
import { loadState, MIN_GAP_S, runCycle } from "./cycle.js";

const T0 = 1_800_000_000; // uma quarta-feira, mercado aberto
const opp = (o: Partial<Opportunity> = {}): Opportunity => ({
  id: "x", symbol: "EURUSD", label: "EUR/USD", at: T0, tf: "M5", dir: "BUY", strategy: "BOS e reteste",
  entry: 1.1, sl: 1.098, tps: [1.104, null, null], score: 82, reasons: [], pip: 0.0001, rr: 2, evidence: ["a"], against: [], ...o,
});
const pos = (o: Partial<Position> = {}): Position => ({ ...opp(o), kind: "simulada", maxHoldS: 3600, ...o });

describe("Master", () => {
  it("descarta ativo já em operação e aposta repetida na mesma moeda; deixa passar só a melhor", () => {
    const open = [pos({ symbol: "EURUSD", dir: "BUY" })]; // +EUR −USD
    const r = master([
      opp({ symbol: "EURUSD", id: "1" }),
      opp({ symbol: "GBPUSD", label: "GBP/USD", dir: "BUY", id: "2" }),   // −USD de novo: correlação
      opp({ symbol: "USDJPY", label: "USD/JPY", dir: "BUY", id: "3", score: 78 }), // +USD: reduz exposição, ok
    ], open);
    expect(r.pick?.symbol).toBe("USDJPY");
    expect(r.dropped.map((d) => d.opp.symbol).sort()).toEqual(["EURUSD", "GBPUSD"]);
    expect(exposure(open)).toEqual({ EUR: 1, USD: -1 });
  });
  it("entre várias livres, escolhe a maior confluência", () => {
    const r = master([opp({ symbol: "GBPUSD", score: 80 }), opp({ symbol: "USDJPY", dir: "SELL", score: 90 })], []);
    expect(r.pick?.symbol).toBe("USDJPY");
    expect(r.dropped).toHaveLength(1);
  });
});

describe("Risk Guard (veto)", () => {
  const cal = [] as never[];
  it("aprova o que está dentro dos limites", () => { expect(riskGuard(opp(), emptyState(), cal, T0)).toEqual([]); });
  it("veta confluência baixa, R:R baixo, stop curto demais e excesso de posições", () => {
    const st = emptyState(); st.open = [pos({ symbol: "GBPUSD" }), pos({ symbol: "USDJPY" })];
    const v = riskGuard(opp({ score: 60, rr: 1.1, sl: 1.0997 }), st, cal, T0).join(" ");
    expect(v).toMatch(/Confluência 60/); expect(v).toMatch(/R:R 1.10/); expect(v).toMatch(/Custo/); expect(v).toMatch(/2 posições/);
  });
  it("calendário fora do ar = veto (notícias não verificadas)", () => {
    expect(riskGuard(opp(), emptyState(), null, T0).join(" ")).toMatch(/NÃO verificadas/);
  });
  it("notícia de alto impacto do dólar perto = veto", () => {
    const v = riskGuard(opp(), emptyState(), [{ at: T0 + 300, title: "Payroll", country: "USD", impact: 3, forecast: "", previous: "" }], T0);
    expect(v.join(" ")).toMatch(/Payroll/);
  });
  it("perda do dia no limite trava o dia", () => {
    const st = emptyState();
    st.closed = [1, 2, 3].map((i) => ({ ...pos({ id: String(i), at: T0 - 600 }), status: "stop" as const, r: -1, rNet: -1.05, closedAt: T0 - 60 }));
    expect(riskGuard(opp(), st, [], T0).join(" ")).toMatch(/dia travado/);
  });
});

describe("Execução simulada", () => {
  const k = (t: number, h: number, l: number, c = (h + l) / 2) => ({ t, o: c, h, l, c });
  it("alvo, stop (stop vence empate), prazo e custos", () => {
    const p = pos();
    expect(resolvePosition(p, [k(T0 + 300, 1.1045, 1.0995)])?.status).toBe("tp1");
    expect(resolvePosition(p, [k(T0 + 300, 1.1045, 1.0975)])?.status).toBe("ambiguo");
    const exp = resolvePosition(p, [k(T0 + 3600, 1.101, 1.1, 1.101)])!;
    expect(exp.status).toBe("expirado");
    expect(exp.rNet).toBeCloseTo(0.5 - (RISK_RULES.costPips * 0.0001) / 0.002, 6);
    expect(resolvePosition(p, [k(T0 + 300, 1.101, 1.099)])).toBeNull();
  });
});

describe("Brain", () => {
  it("mede o efeito do veto e não inventa vantagem com amostra pequena", () => {
    const st = emptyState();
    st.shadowClosed = [{ ...pos({ kind: "sombra" }), kind: "sombra", status: "stop", r: -1, rNet: -1.06, closedAt: T0 + 600 }];
    const b = brain(st);
    expect(b.vetoEffectR).toBeCloseTo(-1.06);
    expect(b.verdict).toMatch(/Amostra pequena/);
  });
});

describe("Ciclo completo (banco em memória, velas sintéticas)", () => {
  const m5 = noisy(15, 2360).map((x, i) => ({ ...x, t: T0 - 2360 * 300 + i * 300 }));
  const now = (m5.at(-1)!.t + 300) * 1000;
  const series = async (_id: string, tf: TF) => {
    if (tf === "M1") throw new Error("sem M1");
    return { candles: tf === "M5" ? m5 : tf === "H1" ? aggregate(m5, 12) : aggregate(m5, 3), duplicates: 0, invalid: 0 };
  };
  it("roda, grava o estado, respeita o intervalo mínimo e expõe tudo pela API", async () => {
    const store = new MemoryStore();
    const r = await runCycle({ store, now: () => now, series, calendar: async () => [] });
    expect(r.ran).toBe(true);
    expect(r.state.agents.map((a) => a.symbol)).toEqual(["EURUSD", "GBPUSD", "USDJPY"]);
    expect(r.state.events.some((e) => e.who === "BRAIN")).toBe(true);
    const again = await runCycle({ store, now: () => now + 60_000, series, calendar: async () => [] });
    expect(again.ran).toBe(false);
    expect((await loadState(store)).cycles).toBe(1);
    const later = await runCycle({ store, now: () => now + (MIN_GAP_S + 1) * 1000, series, calendar: async () => [] });
    expect(later.ran).toBe(true);
    const res = await handleAgent(new Request("http://x/api/agent?action=zyon"), { store, now: () => now });
    const j = await res.json();
    expect(j.mode).toBe("SIMULADO");
    expect(j.cycles).toBe(2);
    expect(j.brain.verdict).toBeTruthy();
    expect(JSON.stringify(j)).not.toMatch(/NaN/);
  });
  it("mercado fechado: especialistas dormindo, nenhuma entrada", async () => {
    const sat = Date.UTC(2026, 10, 7, 12) ; // sábado
    const r = await runCycle({ store: new MemoryStore(), now: () => sat, series, calendar: async () => [] });
    expect(r.state.agents.every((a) => a.status === "dormindo")).toBe(true);
    expect(r.state.open).toHaveLength(0);
  });
});
