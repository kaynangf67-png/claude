import { describe, expect, it } from "vitest";
import type { Candle } from "../forex/types.js";
import { analyzeLatest, backtestBinary, buildSeries, evalAt, statsOf } from "./engine.js";
import { handleBinary, type BinDeps } from "./handlers.js";

const T0 = 1_800_000_000 - (1_800_000_000 % 300);
/** Velas a partir de uma lista de fechamentos (abertura = fechamento anterior). */
function fromCloses(closes: number[], opt: { wick?: number; step?: number } = {}): Candle[] {
  const w = opt.wick ?? 0.00006, step = opt.step ?? 300;
  return closes.map((c, i) => { const o = i === 0 ? c : closes[i - 1]; return { t: T0 + i * step, o, c, h: Math.max(o, c) + w, l: Math.min(o, c) - w }; });
}
const flat = (n: number, base = 1.1) => Array.from({ length: n }, (_, i) => base + Math.sin(i / 3) * 0.0002);

describe("reversão de preço", () => {
  it("queda forte + rejeição compradora na última vela = CALL, com RSI, banda e rejeição atendidos", () => {
    const closes = [...flat(70)]; let p = closes.at(-1)!;
    for (let i = 0; i < 14; i++) { p -= 0.0012; closes.push(p); }
    const c = fromCloses(closes);
    // última vela: mínima bem abaixo, fechou perto da máxima (pavio inferior longo)
    const last = c.at(-1)!; c[c.length - 1] = { ...last, o: last.o, l: last.c - 0.0030, h: last.o + 0.0002, c: last.c + 0.0010 };
    const r = analyzeLatest(c, "reversao")!;
    expect(r.best.dir).toBe("CALL");
    expect(r.best.conds[0].ok).toBe(true);   // RSI
    expect(r.best.conds[1].ok).toBe(true);   // banda
    expect(r.best.conds[2].ok).toBe(true);   // rejeição
    expect(["confirmada", "parcial"]).toContain(r.best.level);
  });
  it("alta forte + rejeição vendedora = PUT (simétrico)", () => {
    const closes = [...flat(70)]; let p = closes.at(-1)!;
    for (let i = 0; i < 14; i++) { p += 0.0012; closes.push(p); }
    const c = fromCloses(closes);
    const last = c.at(-1)!; c[c.length - 1] = { ...last, h: last.c + 0.0030, l: last.o - 0.0002, c: last.c - 0.0010 };
    expect(analyzeLatest(c, "reversao")!.best.dir).toBe("PUT");
  });
});

describe("retração", () => {
  it("tendência de alta + recuo + vela de retomada = CALL", () => {
    const closes: number[] = []; let p = 1.1;
    for (let i = 0; i < 70; i++) { p += 0.0004; closes.push(p); }
    for (let i = 0; i < 12; i++) { p -= 0.0004; closes.push(p); }
    p += 0.0004; closes.push(p); // vela de retomada
    const c = fromCloses(closes);
    const s = analyzeLatest(c, "retracao")!.best;
    expect(s.dir).toBe("CALL");
    expect(s.conds[0].ok).toBe(true);   // tendência
    expect(s.conds[1].ok).toBe(true);   // recuo de 30–70%
    expect(s.conds[3].ok).toBe(true);   // retomada
    expect(s.met).toBeGreaterThanOrEqual(4);
    expect(s.level).toBe("confirmada");
  });
  it("sem tendência não é confirmada (mercado lateral)", () => {
    const s = analyzeLatest(fromCloses(flat(120)), "retracao")!.best;
    expect(s.level).not.toBe("confirmada");
  });
});

describe("modo auto e fallback", () => {
  it("sempre devolve um lado e um nível, mesmo sem setup", () => {
    const r = analyzeLatest(fromCloses(flat(120)), "auto")!;
    expect(["CALL", "PUT"]).toContain(r.best.dir);
    expect(["confirmada", "parcial", "fraca"]).toContain(r.best.level);
    expect(r.signals.reversao.total).toBe(5);
  });
  it("poucas velas: sem análise", () => { expect(analyzeLatest(fromCloses(flat(30)))).toBeNull(); });
});

describe("estatística do backtest", () => {
  it("expectativa, ponto de equilíbrio e empates", () => {
    const t = [...Array(6).fill({ win: true }), ...Array(4).fill({ win: false }), { win: null }];
    const s = statsOf(t, 0.85);
    expect([s.n, s.wins, s.losses, s.ties]).toEqual([10, 6, 4, 1]);
    expect(s.expectancy).toBeCloseTo((6 * 0.85 - 4) / 10, 8);
    expect(s.breakEven).toBeCloseTo(1 / 1.85, 8);
    expect(s.ci![0]).toBeLessThan(0.6); expect(s.ci![1]).toBeGreaterThan(0.6);
  });
  it("não olha o futuro: o resultado de um sinal em i usa a abertura de i+1 e o fechamento de i+expiração", () => {
    const closes: number[] = []; let p = 1.1;
    for (let i = 0; i < 70; i++) { p += 0.0004; closes.push(p); }
    for (let i = 0; i < 12; i++) { p -= 0.0004; closes.push(p); }
    p += 0.0004; closes.push(p);
    // depois do sinal o preço SOBE forte: a CALL tem que ganhar
    for (let i = 0; i < 10; i++) { p += 0.0006; closes.push(p); }
    const c = fromCloses(closes);
    const bt = backtestBinary(c, { strategy: "retracao", expiry: 3, payout: 0.85, minLevel: "confirmada" });
    const hit = bt.trades.find((t) => t.at === c[83 + 1].t || t.at === c[83].t + 300);
    expect(bt.all.n).toBeGreaterThan(0);
    expect(bt.trades.some((t) => t.win === true && t.dir === "CALL")).toBe(true);
    expect(hit === undefined || hit.win === true).toBe(true);
  });
  it("índices de avaliação usam só velas já fechadas (evalAt não acessa i+1)", () => {
    const c = fromCloses(flat(120)), S = buildSeries(c);
    const a = evalAt(S, 100), c2 = c.slice(0, 101), b = evalAt(buildSeries(c2), 100);
    expect(a.reversao.met).toBe(b.reversao.met);
    expect(a.retracao.met).toBe(b.retracao.met);
  });
});

describe("/api/binary", () => {
  const closes: number[] = []; let p = 1.1;
  for (let i = 0; i < 70; i++) { p += 0.0004; closes.push(p); }
  for (let i = 0; i < 12; i++) { p -= 0.0004; closes.push(p); }
  p += 0.0004; closes.push(p);
  const candles = fromCloses(closes);
  const now = (candles.at(-1)!.t + 300 + 20) * 1000;
  const deps: BinDeps = { series: async () => candles, now: () => now };
  const post = (b: object) => handleBinary(new Request("http://x/api/binary", { method: "POST", body: JSON.stringify(b) }), deps);

  it("devolve sinal com entrada na próxima vela e expiração em velas", async () => {
    const j = await (await post({ asset: "EURUSD", tf: "M5", strategy: "retracao", expiry: 2, payout: 0.9 })).json();
    expect(j.data.ok).toBe(true);
    expect(j.signal.dir).toBe("CALL");
    expect(j.signal.expiryCandles).toBe(2);
    expect(j.signal.expiryMinutes).toBe(10);
    expect(j.signal.entryAt % 300).toBe(0);
    expect(j.signal.entryAt).toBeGreaterThan(now / 1000);
    expect(j.signal.expiryAt - j.signal.entryAt).toBe(600);
    expect(j.breakEven).toBeCloseTo(1 / 1.9, 6);
    expect(JSON.stringify(j)).not.toMatch(/NaN/);
  });
  it("aceita cripto e commodities, M1/M5/M15; recusa o resto", async () => {
    const stepOf = { M1: 60, M5: 300, M15: 900 } as const;
    for (const tf of ["M1", "M5", "M15"] as const) {
      const cs = fromCloses(closes, { step: stepOf[tf] }), d: BinDeps = { series: async () => cs, now: () => (cs.at(-1)!.t + stepOf[tf] + 20) * 1000 };
      for (const a of ["BTCUSD", "XAUUSD", "USOIL"]) {
        const j = await (await handleBinary(new Request("http://x/api/binary", { method: "POST", body: JSON.stringify({ asset: a, tf }) }), d)).json();
        expect(j.signal, `${a} ${tf}`).not.toBeNull();
      }
    }
    expect((await post({ asset: "XPTO" })).status).toBe(400);
  });
  it("dados atrasados (mercado fechado): não inventa entrada", async () => {
    const stale = await (await handleBinary(new Request("http://x/api/binary", { method: "POST", body: JSON.stringify({ asset: "EURUSD", tf: "M5" }) }), { ...deps, now: () => now + 3 * 86400_000 })).json();
    expect(stale.data.ok).toBe(false);
    expect(stale.signal).toBeNull();
  });
  it("backtest por rota: estatísticas, ponto de equilíbrio e veredito", async () => {
    const r = await handleBinary(new Request("http://x/api/binary?action=backtest&symbol=EURUSD&tf=M5&strategy=reversao&expiry=2&payout=0.85"), deps);
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.breakEven).toBeCloseTo(1 / 1.85, 6);
    expect(j.confirmada.all).toHaveProperty("winRate");
    expect(typeof j.verdict).toBe("string");
    expect((await handleBinary(new Request("http://x/api/binary?action=backtest&strategy=xx"), deps)).status).toBe(400);
  });
});
