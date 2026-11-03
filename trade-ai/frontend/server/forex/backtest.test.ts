import { describe, expect, it } from "vitest";
import { runBacktest } from "./backtest.js";
import { computeStats, resolveSignal, type SavedSignal } from "./history.js";
import { aggregate, noisy } from "./testkit.js";

const opts = { pip: 0.0001, label: "EUR/USD", symbol: "EURUSD", currencies: ["EUR", "USD"], budgetMs: 120_000 };
const run = (n: number) => { const m5 = noisy(7, n); return runBacktest(m5, aggregate(m5, 12), opts); };

describe("backtest", () => {
  it("não enxerga o futuro: cortar o fim da série não muda os sinais anteriores", () => {
    let compared = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const full = noisy(seed, 4000), cut = full.slice(0, 2800);
      const a = runBacktest(full, aggregate(full, 12), opts);
      const b = runBacktest(cut, aggregate(cut, 12), opts);
      for (const t of b.list.filter((x) => (x.closedAt ?? 0) < cut.at(-1)!.t - 3600)) {
        const same = a.list.find((x) => x.at === t.at && x.dir === t.dir);
        expect(same, `sinal de ${seed} em ${t.at} sumiu na série completa`).toBeDefined();
        expect(same!.entry).toBeCloseTo(t.entry, 8);
        expect(same!.sl).toBeCloseTo(t.sl, 8);
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(0);
  }, 90_000);
  it("resultado tem custos, divisão desenvolvimento/validação e veredito cauteloso", () => {
    const r = run(4200);
    expect(r.costsPips).toBeCloseTo(1.2, 5);
    expect(r.development.n + r.validation.n).toBe(r.all.n);
    expect(r.verdict).toMatch(/Sem amostra|Sem vantagem|Expectativa positiva/);
    expect(JSON.stringify(r)).not.toMatch(/NaN/);
  }, 30_000);
});

const sig = (over: Partial<SavedSignal> = {}): SavedSignal => ({ id: "x", symbol: "EURUSD", label: "EUR/USD", at: 1000, tf: "M5", dir: "BUY", strategy: "BOS e reteste", entry: 1.1, sl: 1.099, tps: [1.102, null, null], score: 80, reasons: [], pip: 0.0001, ...over });
const k = (t: number, o: number, h: number, l: number, c: number) => ({ t, o, h, l, c });

describe("resultado dos sinais", () => {
  it("alvo antes do stop = +R; stop antes do alvo = -1; mesma vela = stop (ambíguo)", () => {
    const win = resolveSignal(sig(), [k(1000, 1.1, 1.1005, 1.0995, 1.1), k(1060, 1.1, 1.1021, 1.0999, 1.102)]);
    expect(win.status).toBe("tp1");
    expect(win.r).toBeCloseTo(2, 5);
    expect(resolveSignal(sig(), [k(1000, 1.1, 1.1005, 1.0989, 1.0995), k(1060, 1.1, 1.103, 1.1, 1.102)])).toMatchObject({ status: "stop", r: -1 });
    expect(resolveSignal(sig(), [k(1000, 1.1, 1.1025, 1.0985, 1.1)])).toMatchObject({ status: "ambiguo", r: -1 });
    expect(resolveSignal(sig(), [k(1000, 1.1, 1.1005, 1.0995, 1.1)]).status).toBe("aberto");
    const sell = resolveSignal(sig({ dir: "SELL", sl: 1.101, tps: [1.098, null, null] }), [k(1000, 1.1, 1.1005, 1.0975, 1.098)]);
    expect(sell.status).toBe("tp1");
    expect(sell.r).toBeCloseTo(2, 5);
  });
  it("estatísticas: taxa, expectativa em R, profit factor, drawdown e grupos", () => {
    const mk = (r: number, strategy: string, score: number, closedAt: number) => ({ ...sig({ strategy, score }), status: r > 0 ? ("tp1" as const) : ("stop" as const), r, closedAt });
    const s = computeStats([mk(2, "A", 80, 1), mk(-1, "A", 80, 2), mk(-1, "B", 70, 3), mk(-1, "B", 70, 4), mk(2, "A", 90, 5)]);
    expect(s.n).toBe(5);
    expect(s.winRate).toBeCloseTo(0.4, 5);
    expect(s.sumR).toBeCloseTo(1, 5);
    expect(s.expectancy).toBeCloseTo(0.2, 5);
    expect(s.profitFactor).toBeCloseTo(4 / 3, 5);
    expect(s.maxDrawdownR).toBeCloseTo(3, 5);
    expect(s.byStrategy.find((g) => g.key === "A")?.n).toBe(3);
    expect(s.byScore.map((g) => g.key)).toEqual(expect.arrayContaining(["75–84", "65–74", "85–100"]));
    expect(s.note).toMatch(/Amostra pequena/);
  });
});
