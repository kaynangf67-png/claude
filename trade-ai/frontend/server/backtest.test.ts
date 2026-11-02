import { describe, expect, it } from "vitest";
import { backtest, breakoutRetest, rejection, runStrategy, trendPullback, ema } from "./backtest";
import type { Candle } from "./signal";

const mk = (t: number, o: number, h: number, l: number, c: number): Candle => ({ t, o, h, l, c });

describe("estratégias", () => {
  it("rompimento com reteste dispara CALL no padrão certo", () => {
    const c: Candle[] = [];
    for (let i = 0; i < 40; i++) c.push(mk(i, 99.9, 100, 99.8, 99.95));           // resistência em 100
    c[37] = mk(37, 99.9, 100.6, 99.9, 100.5);                                       // rompe (fecha acima de 100)
    c[38] = mk(38, 100.4, 100.45, 100.0, 100.1);                                    // reteste: mínima encosta em 100
    c[39] = mk(39, 100.1, 100.8, 100.0, 100.7);                                     // vela de alta fecha acima de 100
    expect(breakoutRetest(c, 39)).toBe("CALL");
  });

  it("rejeição na máxima de 50 velas dispara PUT", () => {
    const c: Candle[] = Array.from({ length: 60 }, (_, i) => mk(i, 99, 100, 98, 99));
    c[59] = mk(59, 99.8, 100.02, 99.5, 99.6);                                       // toca 100 e fecha para baixo
    expect(rejection(c, 59)).toBe("PUT");
  });

  it("pullback na EMA21 em tendência de alta dispara CALL", () => {
    const c: Candle[] = Array.from({ length: 120 }, (_, i) => mk(i, 100 + i * 0.1, 100.2 + i * 0.1, 99.9 + i * 0.1, 100.1 + i * 0.1));
    const closes = c.map((k) => k.c);
    const e21 = ema(closes, 21), e50 = ema(closes, 50);
    const i = 119;
    c[i - 1] = mk(i - 1, e21[i - 1] + 0.3, e21[i - 1] + 0.4, e21[i - 1] - 0.01, e21[i - 1] + 0.2);
    c[i] = mk(i, e21[i] + 0.1, e21[i] + 0.5, e21[i], e21[i] + 0.4);
    expect(trendPullback(c, i, e21, e50)).toBe("CALL");
  });
});

describe("resultado", () => {
  it("empate e perda contam como perda; sem amostra não diz acima nem abaixo", () => {
    const up = mk(0, 1, 1, 1, 1), down = mk(0, 1, 1, 1, 0.5);
    const c = [up, mk(1, 1, 1, 1, 2), down, mk(3, 1, 1, 1, 0.1)];
    const r = runStrategy("x", c, (i) => (i === 0 ? "CALL" : i === 2 ? "CALL" : null));
    expect(r.trades).toBe(2);
    expect(r.wins).toBe(1);
    expect(r.edge).toBe("sem amostra");
  });

  it("backtest devolve as três estratégias", () => {
    const c = Array.from({ length: 200 }, (_, i) => mk(i, 100 + Math.sin(i / 5), 101 + Math.sin(i / 5), 99 + Math.sin(i / 5), 100.2 + Math.sin(i / 5)));
    const res = backtest(c);
    expect(res.map((r) => r.name)).toEqual(["Rompimento com reteste", "Tendência com pullback na EMA21", "Rejeição em suporte/resistência"]);
    expect(res[0].breakEven).toBeCloseTo(0.5405, 4);
  });
});
