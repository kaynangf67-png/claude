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

describe("fluxo de vela (região)", () => {
  /** Suporte testado várias vezes (fundos da senoide em ~1.0985), depois: toque com pavio, retração e vela verde de confirmação. */
  const oscillation = () => Array.from({ length: 72 }, (_, k) => 1.1 + 0.0015 * Math.sin((2 * Math.PI * k) / 24));
  const supportSetup = (): Candle[] => {
    const c = fromCloses(oscillation()), t = c.at(-1)!.t, W = 300;
    const mk = (n: number, o: number, h: number, l: number, cl: number): Candle => ({ t: t + n * W, o, h, l, c: cl });
    return [...c, mk(1, 1.0995, 1.0996, 1.0989, 1.0990), mk(2, 1.0990, 1.0991, 1.0983, 1.0987), mk(3, 1.0987, 1.0990, 1.0981, 1.0989), mk(4, 1.0989, 1.0997, 1.0988, 1.0996)];
  };
  const mirror = (c: Candle[]): Candle[] => c.map((k) => ({ t: k.t, o: 2.2 - k.o, c: 2.2 - k.c, h: 2.2 - k.l, l: 2.2 - k.h }));

  it("toque no suporte + retração + vela verde de confirmação = CALL confirmada, expiração de 1 vela", () => {
    const r = analyzeLatest(supportSetup(), "fluxo")!.best;
    expect(r.dir).toBe("CALL");
    expect(r.conds.map((x) => x.ok)).toEqual([true, true, true, true, true]);
    expect(r.level).toBe("confirmada");
    expect(r.defaultExpiry).toBe(1);
  });
  it("espelho: toque na resistência + vela vermelha de confirmação = PUT", () => {
    const r = analyzeLatest(mirror(supportSetup()), "fluxo")!.best;
    expect(r.dir).toBe("PUT");
    expect(r.level).toBe("confirmada");
  });
  it("sem a vela de confirmação (a última é vermelha no suporte) não é confirmada", () => {
    const c = supportSetup(), last = c.at(-1)!;
    c[c.length - 1] = { ...last, o: 1.0996, c: 1.0988, h: 1.0997, l: 1.0987 };
    const r = analyzeLatest(c, "fluxo")!.best;
    expect(r.level).not.toBe("confirmada");
  });
  it("se o preço FECHA através da região (rompe), a região não foi respeitada: não confirma CALL", () => {
    const c = supportSetup(), t = c.at(-1)!.t;
    c.splice(c.length - 2, 2,
      { t: t - 300, o: 1.0987, h: 1.0988, l: 1.0970, c: 1.0972 },   // fecha bem abaixo do suporte
      { t, o: 1.0972, h: 1.0985, l: 1.0971, c: 1.0984 });             // verde, mas abaixo da região
    const r = analyzeLatest(c, "fluxo")!.best;
    expect(r.dir === "CALL" && r.level === "confirmada").toBe(false);
  });
  it("entra no modo auto e na rota, e o backtest aceita a estratégia", async () => {
    expect(analyzeLatest(supportSetup(), "auto")!.signals.fluxo.total).toBe(5);
    const c = supportSetup(), now = (c.at(-1)!.t + 300 + 20) * 1000;
    const j = await (await handleBinary(new Request("http://x/api/binary", { method: "POST", body: JSON.stringify({ asset: "EURUSD", tf: "M5", strategy: "fluxo" }) }), { series: async () => c, now: () => now })).json();
    expect(j.signal.strategy).toBe("fluxo");
    expect(j.signal.expiryCandles).toBe(1);
    const bt = await handleBinary(new Request("http://x/api/binary?action=backtest&symbol=EURUSD&tf=M5&strategy=fluxo"), { series: async () => c, now: () => now });
    expect(bt.status).toBe(200);
  });
});

describe("três velas + região (reversão)", () => {
  /** Resistência testada várias vezes (topos da senoide em ~1.1015); depois três velas verdes, de tamanhos diferentes, chegam nela. */
  const osc = () => Array.from({ length: 72 }, (_, k) => 1.1 + 0.0015 * Math.sin((2 * Math.PI * k) / 24));
  const resistanceSetup = (): Candle[] => {
    const c = fromCloses(osc()), t = c.at(-1)!.t, mk = (n: number, o: number, h: number, l: number, cl: number): Candle => ({ t: t + n * 300, o, h, l, c: cl });
    return [...c, mk(1, 1.1000, 1.1006, 1.0999, 1.1005), mk(2, 1.1005, 1.1012, 1.1004, 1.1011), mk(3, 1.1011, 1.1016, 1.1010, 1.1014)];
  };
  const mirror = (c: Candle[]): Candle[] => c.map((k) => ({ t: k.t, o: 2.2 - k.o, c: 2.2 - k.c, h: 2.2 - k.l, l: 2.2 - k.h }));

  it("3 velas verdes tocando a resistência = PUT na próxima vela, expiração de 1 vela", () => {
    const r = analyzeLatest(resistanceSetup(), "tres")!.best;
    expect(r.dir).toBe("PUT");
    expect(r.conds.map((x) => x.ok)).toEqual([true, true, true, true, true]);
    expect(r.level).toBe("confirmada");
    expect(r.defaultExpiry).toBe(1);
  });
  it("espelho: 3 velas vermelhas tocando o suporte = CALL", () => {
    const r = analyzeLatest(mirror(resistanceSetup()), "tres")!.best;
    expect(r.dir).toBe("CALL");
    expect(r.level).toBe("confirmada");
  });
  it("o tamanho das velas não importa (regra do curso), mas as 3 precisam ser da mesma cor", () => {
    const c = resistanceSetup(), n = c.length;
    c[n - 2] = { ...c[n - 2], o: 1.1012, c: 1.1006, h: 1.1013, l: 1.1005 }; // 2ª vela vira vermelha (fecha abaixo da abertura)
    const r = analyzeLatest(c, "tres")!.best;
    expect(r.level).not.toBe("confirmada");
  });
  it("sem região por perto não confirma (3 verdes no meio do nada)", () => {
    const c = fromCloses(osc()); const t = c.at(-1)!.t;
    // a senoide termina perto do meio; 3 verdes curtas longe dos topos e fundos
    const mk = (n: number, o: number, cl: number): Candle => ({ t: t + n * 300, o, h: cl + 0.00006, l: o - 0.00006, c: cl });
    const all = [...c, mk(1, 1.1000, 1.1002), mk(2, 1.1002, 1.1004), mk(3, 1.1004, 1.1006)];
    expect(analyzeLatest(all, "tres")!.best.level).not.toBe("confirmada");
  });
  it("a 3ª vela fecha ROMPENDO a região por cima: não é reversão respeitada", () => {
    const c = resistanceSetup(), n = c.length;
    c[n - 1] = { ...c[n - 1], h: 1.1030, c: 1.1028 };
    const r = analyzeLatest(c, "tres")!.best;
    expect(r.dir === "PUT" && r.level === "confirmada").toBe(false);
  });
  it("modo auto compara as 5 estratégias e a rota aceita 'tres'", async () => {
    const c = resistanceSetup(), now = (c.at(-1)!.t + 300 + 20) * 1000;
    expect(Object.keys(analyzeLatest(c, "auto")!.signals).sort()).toEqual(["diminuicao", "fluxo", "retracao", "reversao", "tres"]);
    const j = await (await handleBinary(new Request("http://x/api/binary", { method: "POST", body: JSON.stringify({ asset: "EURUSD", tf: "M5", strategy: "tres" }) }), { series: async () => c, now: () => now })).json();
    expect(j.signal.strategy).toBe("tres");
    expect(j.signal.dir).toBe("PUT");
    expect(j.signal.expiryCandles).toBe(1);
    expect((await handleBinary(new Request("http://x/api/binary?action=backtest&symbol=EURUSD&tf=M5&strategy=tres"), { series: async () => c, now: () => now })).status).toBe(200);
  });
});

describe("diminuição de vela + região", () => {
  const osc = () => Array.from({ length: 72 }, (_, k) => 1.1 + 0.0015 * Math.sin((2 * Math.PI * k) / 24));
  /** 3 verdes com corpos 0.0010 > 0.0005 > 0.0002 chegando na resistência (~1.1015). */
  const setup = (bodies: [number, number, number] = [0.0010, 0.0005, 0.0002]): Candle[] => {
    const c = fromCloses(osc()), t = c.at(-1)!.t;
    const end = 1.1015 - 0.0001, [b1, b2, b3] = bodies;
    const o3 = end - b3, o2 = o3 - b2, o1 = o2 - b1;
    const mk = (n: number, o: number, cl: number, extra = 0.00005): Candle => ({ t: t + n * 300, o, c: cl, h: cl + extra, l: o - extra });
    return [...c, mk(1, o1, o2), mk(2, o2, o3), { ...mk(3, o3, end), h: 1.1016 }];
  };
  const mirror = (c: Candle[]): Candle[] => c.map((k) => ({ t: k.t, o: 2.2 - k.o, c: 2.2 - k.c, h: 2.2 - k.l, l: 2.2 - k.h }));

  it("3 verdes perdendo tamanho na resistência = PUT confirmada, 1 vela", () => {
    const r = analyzeLatest(setup(), "diminuicao")!.best;
    expect(r.dir).toBe("PUT");
    expect(r.conds.map((x) => x.ok)).toEqual([true, true, true, true, true]);
    expect(r.level).toBe("confirmada");
    expect(r.defaultExpiry).toBe(1);
  });
  it("espelho: 3 vermelhas perdendo tamanho no suporte = CALL", () => {
    const r = analyzeLatest(mirror(setup()), "diminuicao")!.best;
    expect(r.dir).toBe("CALL");
    expect(r.level).toBe("confirmada");
  });
  it("velas CRESCENDO (ganhando força) não confirmam esta estratégia", () => {
    const r = analyzeLatest(setup([0.0002, 0.0005, 0.0010]), "diminuicao")!.best;
    expect(r.level).not.toBe("confirmada");
    expect(r.conds[2].ok).toBe(false);
  });
  it("3ª vela grande (não diminuiu o bastante) não confirma, mas a 'três velas' simples ainda pode", () => {
    const c = setup([0.0010, 0.0008, 0.0007]);
    expect(analyzeLatest(c, "diminuicao")!.best.conds[3].ok).toBe(false);
    expect(analyzeLatest(c, "diminuicao")!.best.level).not.toBe("confirmada");
  });
  it("entra no modo auto (5 estratégias) e na rota", async () => {
    const c = setup(), now = (c.at(-1)!.t + 300 + 20) * 1000;
    expect(Object.keys(analyzeLatest(c, "auto")!.signals)).toHaveLength(5);
    const j = await (await handleBinary(new Request("http://x/api/binary", { method: "POST", body: JSON.stringify({ asset: "EURUSD", tf: "M5", strategy: "diminuicao" }) }), { series: async () => c, now: () => now })).json();
    expect(j.signal.strategy).toBe("diminuicao");
    expect(j.signal.dir).toBe("PUT");
  });
});
