import { describe, expect, it } from "vitest";
import { buildSeries } from "../binary/engine.js";
import { backtestCandle, candleEntryNow, CS_LIST, planFor, statsR, verdict } from "./candleStrategies.js";
import type { Candle } from "./types.js";

function walk(n: number, seed = 7, step = 3600): Candle[] {
  let s = seed, p = 1.1; const out: Candle[] = [];
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < n; i++) {
    const o = p, c = o + (rnd() - 0.5) * 0.003, h = Math.max(o, c) + rnd() * 0.001, l = Math.min(o, c) - rnd() * 0.001;
    out.push({ t: 1_700_000_000 + i * step, o, h, l, c, v: 0 }); p = c;
  }
  return out;
}

describe("estratégias de vela no Forex", () => {
  it("stop além das últimas velas, mínimo 0,7 ATR e alvo 1,5R", () => {
    const c = walk(200), S = buildSeries(c), i = 150, entry = c[i].c;
    const b = planFor(S, i, true, entry)!;
    expect(b.sl).toBeLessThan(Math.min(...c.slice(i - 4, i + 1).map((k) => k.l)) + 1e-12);
    expect(entry - b.sl).toBeGreaterThanOrEqual(0.7 * S.atr[i] - 1e-12);
    expect(b.tp - entry).toBeCloseTo(1.5 * (entry - b.sl), 10);
    const s = planFor(S, i, false, entry)!;
    expect(s.sl).toBeGreaterThan(entry); expect(s.tp).toBeLessThan(entry);
  });

  it("validada só com amostra, os dois períodos positivos e fator de lucro", () => {
    const mk = (rs: number[]) => statsR(rs.map((r) => ({ r, out: r > 0 ? "tp" as const : "sl" as const })));
    const good = mk([...Array(30)].map((_, k) => (k % 2 ? 1.4 : -1)));
    expect(verdict(good, good, mk([...Array(12)].map((_, k) => (k % 2 ? 1.4 : -1)))).validated).toBe(true);
    expect(verdict(mk([1, -1]), mk([1]), mk([-1])).validated).toBe(false);
    const badVal = mk([...Array(12)].map(() => -1));
    expect(verdict(good, good, badVal).validated).toBe(false);
  });

  it("passeio aleatório: nenhuma estratégia deveria sair validada com folga, e roda rápido em 1 ano de H1", () => {
    const c = walk(6200), t0 = Date.now();
    const bt = backtestCandle(c, 0.0001, 1.2);
    const ms = Date.now() - t0;
    expect(ms).toBeLessThan(8000);
    for (const s of CS_LIST) expect(bt.results[s].all.n).toBeGreaterThanOrEqual(0);
    // custo descontado: num mercado sem tendência a média deve ficar perto de zero ou negativa
    const avg = CS_LIST.reduce((a, s) => a + (bt.results[s].all.expR ?? 0), 0) / CS_LIST.length;
    expect(avg).toBeLessThan(0.15);
    const now = candleEntryNow(c, 0.0001, bt, c.at(-1)!.c);
    if (now.entry) expect(bt.results[now.entry.strategy].validated).toBe(true);
    console.log("ms", ms, CS_LIST.map((s) => `${s}:${bt.results[s].all.n}/${bt.results[s].all.expR?.toFixed(2)}`).join(" "));
  });
});
