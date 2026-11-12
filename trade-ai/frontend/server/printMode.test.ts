import { describe, expect, it } from "vitest";
import { applyMode, type Result } from "./analyze.js";

const base = { symbol: "USD/EGP (OTC)", decision: "PUT", stop_price: 53.02, target_price: 52.9955, warnings: ["Stop e alvo derivados dos suportes e resistências lidos no print."] } as unknown as Result;

describe("modo do print", () => {
  it("binárias: sem stop e alvo", () => {
    const r = applyMode(base, "binarias");
    expect(r.stop_price).toBeNull(); expect(r.target_price).toBeNull(); expect(r.mode).toBe("binarias");
    expect(r.warnings.some((w) => /stop e alvo/i.test(w))).toBe(false);
  });
  it("forex: mantém stop e alvo", () => {
    const r = applyMode(base, "forex");
    expect(r.stop_price).toBe(53.02); expect(r.target_price).toBe(52.9955);
  });
  it("OTC avisa que não é mercado real", () => {
    expect(applyMode(base, "binarias").warnings.some((w) => w.includes("OTC"))).toBe(true);
    expect(applyMode({ ...base, symbol: "EUR/USD" }, "forex").warnings.some((w) => w.includes("OTC"))).toBe(false);
  });
});

describe("estratégias do usuário no print", () => {
  const chk = (s: string, status: string, direction: string) => ({ strategy: s, status, direction, note: "" });
  const mk = (over: object) => ({ ...base, symbol: "EUR/USD", decision: "CALL", setup_quality: "forte", warnings: [], ...over }) as unknown as Result;
  it("sem estratégia confirmada não é forte", () => {
    const r = applyMode(mk({ strategy_checks: [chk("fluxo", "parcial", "CALL")] }), "binarias");
    expect(r.setup_quality).toBe("moderada");
    expect(r.warnings.join(" ")).toMatch(/Nenhuma das suas 7/);
  });
  it("confirmadas em lados opostos viram setup fraco", () => {
    const r = applyMode(mk({ strategy_checks: [chk("fluxo", "confirmada", "CALL"), chk("tres", "confirmada", "PUT")] }), "binarias");
    expect(r.setup_quality).toBe("fraca");
  });
  it("confirmada a favor mantém a qualidade", () => {
    const r = applyMode(mk({ strategy_checks: [chk("forca", "confirmada", "CALL")], strategy_used: "forca" }), "forex");
    expect(r.setup_quality).toBe("forte"); expect(r.warnings).toEqual([]);
  });
});

import { timeframeMinutes, withUserTf, type Reading } from "./analyze.js";
describe("tempo gráfico marcado pelo usuário", () => {
  const rd = (tf: string | null) => ({ timeframe: tf, against: [], missing: ["tempo gráfico"] }) as unknown as Reading;
  it("substitui o lido e entende todos os tempos", () => {
    for (const [tf, m] of [["M1", 1], ["M5", 5], ["M15", 15], ["M30", 30], ["H1", 60], ["H4", 240], ["D1", 1440]] as const) {
      const r = withUserTf(rd(null), tf);
      expect(r.timeframe).toBe(tf); expect(timeframeMinutes(r.timeframe)).toBe(m); expect(r.missing).toEqual([]);
    }
  });
  it("registra quando a IA leu outro tempo; sem escolha não muda nada", () => {
    expect(withUserTf(rd("M1"), "M5").against.join(" ")).toMatch(/parece ser M1/);
    expect(withUserTf(rd("M5"), null).timeframe).toBe("M5");
  });
});
