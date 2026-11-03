import { describe, expect, it } from "vitest";
import { assessQuality, cleanCandles, closedOnly } from "./candles.js";
import { analyze, type EngineInput } from "./engine.js";
import { findFvgs } from "./fvg.js";
import { analyzeTF } from "./mtf.js";
import { impulse, type Ctx } from "./strategies.js";
import { atr, ema, rsiSeries } from "./indicators.js";
import { detectSweep } from "./liquidity.js";
import { buildRegions, mergeRegions } from "./levels.js";
import { detectPatterns } from "./patterns.js";
import { computeRisk } from "./risk.js";
import { analyzeStructure, findPivots, trendlines } from "./structure.js";
import { aggregate, noisy, series } from "./testkit.js";
import type { Candle } from "./types.js";

const wave = (i: number) => 1.1 + i * 0.00004 + 0.0012 * Math.sin(i / 7); // alta com ondas
const flat = (i: number) => 1.1 + 0.0004 * Math.sin(i / 5);

describe("dados", () => {
  it("remove duplicadas e inválidas, ordena e descarta a vela em formação", () => {
    const base = series(5, () => 1.1);
    const dirty: Candle[] = [base[2], base[0], base[1], { ...base[1], c: 1.2, h: 1.2 }, { ...base[3], h: 0.5 }, base[4]];
    const r = cleanCandles(dirty);
    expect(r.candles.map((k) => k.t)).toEqual([base[0].t, base[1].t, base[2].t, base[4].t]);
    expect(r.duplicates).toBe(1);
    expect(r.invalid).toBe(1);
    expect(r.candles[1].c).toBe(1.2); // fica a última versão
    expect(closedOnly(base, "M5", base[3].t + 100).length).toBe(3); // vela 3 ainda em formação
  });
  it("bloqueia dado atrasado, curto e com buracos", () => {
    const c = series(300, () => 1.1);
    expect(assessQuality(c, "M5", c.at(-1)!.t + 300).ok).toBe(true);
    expect(assessQuality(c, "M5", c.at(-1)!.t + 300 + 3600).ok).toBe(false);
    expect(assessQuality(c.slice(-50), "M5", c.at(-1)!.t + 300).issues.join()).toMatch(/histórico curto/);
    const holes = c.filter((_, i) => i < 280 || i % 3 === 0);
    expect(assessQuality(holes, "M5", holes.at(-1)!.t + 300).issues.join()).toMatch(/faltando/);
  });
});

describe("indicadores e estrutura", () => {
  it("EMA, RSI e ATR coerentes", () => {
    expect(ema([2, 2, 2], 3).at(-1)).toBe(2);
    expect(rsiSeries(Array.from({ length: 40 }, (_, i) => i)).at(-1)).toBe(100);
    expect(atr(series(40, () => 1.1, { wick: 0.0005 }))).toBeCloseTo(0.001, 5);
  });
  it("tendência de alta, BOS e linhas de tendência vêm de pivôs reais", () => {
    const c = series(260, wave);
    const piv = findPivots(c);
    const st = analyzeStructure(c, piv);
    expect(st.trend).toBe("alta");
    expect(st.higherHighs && st.higherLows).toBe(true);
    const lines = trendlines(c, piv, atr(c));
    expect(lines.lta?.touches).toBeGreaterThanOrEqual(2);
    expect(lines.lta?.slope).toBeGreaterThan(0);
  });
  it("pivô precisa de velas fechadas depois (não repinta)", () => {
    const c = series(30, (i) => 1.1 + (i === 28 ? 0.01 : 0));
    expect(findPivots(c).some((p) => p.i === 28)).toBe(false);
  });
});

describe("regiões, liquidez, FVG e padrões", () => {
  it("um pavio só não é região; dois ou mais são", () => {
    const c = series(120, (i) => 1.1 + 0.0005 * Math.sin(i / 3));
    c[20] = { ...c[20], h: 1.105 };
    const r1 = buildRegions(c, "H1", 1.1, atr(c), 0.0001);
    expect(r1.every((r) => !(r.low <= 1.105 && r.high >= 1.105 && r.reactions < 2))).toBe(true);
    c[60] = { ...c[60], h: 1.10502 };
    const r2 = buildRegions(c, "H1", 1.1, atr(c), 0.0001);
    expect(r2.some((r) => r.low <= 1.105 && r.high >= 1.105 && r.reactions >= 2 && r.role === "resistencia")).toBe(true);
  });
  it("FVG de três velas e preenchimento", () => {
    const c = series(12, () => 1.1);
    c[5] = { t: c[5].t, o: 1.1, h: 1.1005, l: 1.0999, c: 1.1004 };
    c[6] = { t: c[6].t, o: 1.1004, h: 1.1030, l: 1.1004, c: 1.1028 };
    c[7] = { t: c[7].t, o: 1.1028, h: 1.1035, l: 1.1015, c: 1.1030 };
    for (let i = 8; i < 12; i++) c[i] = { ...c[i], o: 1.103, h: 1.1032, l: 1.1020, c: 1.1025 };
    const open = findFvgs(c, 0.001);
    expect(open.find((f) => Math.abs(f.low - 1.1005) < 1e-9)).toMatchObject({ dir: "BUY", status: "aberto" });
    c[11] = { ...c[11], l: 1.1002 };
    expect(findFvgs(c, 0.001).some((f) => Math.abs(f.low - 1.1005) < 1e-9)).toBe(false); // o gap 1.1005–1.1015 foi preenchido
  });
  it("sweep: pavio passa do topo e o fechamento volta; rompimento com fechamento não é sweep", () => {
    const c = series(60, (i) => 1.1 + 0.0004 * Math.sin(i / 4));
    const piv = findPivots(c);
    const topo = piv.filter((p) => p.type === "high").at(-1)!;
    const k = c.length - 1;
    c[k] = { ...c[k], o: topo.price - 0.0001, h: topo.price + 0.0004, l: topo.price - 0.0003, c: topo.price - 0.0002 };
    expect(detectSweep(c, piv, atr(c))?.dir).toBe("SELL");
    c[k] = { ...c[k], c: topo.price + 0.0003 };
    expect(detectSweep(c, piv, atr(c))).toBeNull();
  });
  it("engolfo de alta confirmado", () => {
    const c = series(20, (i) => 1.1 - i * 0.0001);
    const n = c.length;
    c[n - 2] = { t: c[n - 2].t, o: 1.0985, h: 1.0986, l: 1.0978, c: 1.0979 };
    c[n - 1] = { t: c[n - 1].t, o: 1.0978, h: 1.0992, l: 1.0977, c: 1.0990 };
    const p = detectPatterns(c, { atr: 0.0006, inRegion: true });
    expect(p.some((x) => x.name === "Engolfo de alta" && x.dir === "BUY")).toBe(true);
    expect(detectPatterns(c, { atr: 0.0006, inRegion: false }).find((x) => x.name === "Engolfo de alta")!.weight).toBe(0.4);
  });
});

describe("risco e retorno (operação curta)", () => {
  const reg = (low: number, high: number, role: "suporte" | "resistencia") => ({ low, high, role, strength: "forte" as const, reactions: 3, origin: "H1" as const, distance: 0.003, distancePips: 30, intensity: 80 });
  const base = { regions: [] as ReturnType<typeof reg>[], extraTargets: [] as number[], atr: 0.0004, pip: 0.0001 };
  it("stop pela estrutura com margem de ATR, alvo em região de H1 alcançável e tempo máximo", () => {
    const r = computeRisk("BUY", 1.1000, { ...base, invalidation: 1.0990, regions: [reg(1.1030, 1.1035, "resistencia")] });
    expect(r.sl).toBeCloseTo(1.0988, 5);
    expect(r.tps[0]).toBe(1.103);
    expect(r.rr[0]).toBeCloseTo(0.003 / 0.0012, 3);
    expect(r.ok).toBe(true);
    expect(r.maxHoldMin).toBe(60);
  });
  it("topo recente do M5 serve de alvo curto quando tem espaço de pelo menos 1,5R", () => {
    const r = computeRisk("BUY", 1.1000, { ...base, invalidation: 1.0990, extraTargets: [1.1010, 1.1022, 1.1050] });
    expect(r.tps[0]).toBe(1.1022); // 1.1010 tem só 0,83R e é pulado; 1.1022 tem 1,83R
    expect(r.tps[1]).toBe(1.105);
    expect(r.ok).toBe(true);
  });
  it("região de H1 no caminho com menos de 1,5R reprova; alvo longe demais para operação curta reprova", () => {
    expect(computeRisk("BUY", 1.1, { ...base, invalidation: 1.099, regions: [reg(1.1010, 1.1012, "resistencia")] }).ok).toBe(false);
    const far = computeRisk("BUY", 1.1, { ...base, invalidation: 1.099, regions: [reg(1.1060, 1.1065, "resistencia")] });
    expect(far.ok).toBe(false);
    expect(far.notes.join(" ")).toMatch(/longe demais para operação curta/);
  });
  it("sem alvo estrutural reprova; venda é simétrica", () => {
    expect(computeRisk("SELL", 1.1, { ...base, invalidation: 1.101 }).ok).toBe(false);
    const s = computeRisk("SELL", 1.1, { ...base, invalidation: 1.101, regions: [reg(1.0965, 1.097, "suporte")] });
    expect(s.sl).toBeGreaterThan(1.1);
    expect(s.tps[0]).toBe(1.097);
    expect(s.ok).toBe(true);
  });
});

function input(m5: Candle[], over: Partial<EngineInput> = {}): EngineInput {
  const now = m5.at(-1)!.t + 300;
  return {
    symbol: "EURUSD", label: "EUR/USD", pip: 0.0001, currencies: ["EUR", "USD"], now,
    candles: { H1: aggregate(m5, 12), M5: m5, M1: null }, events: [], skipFreshness: false, ...over,
  };
}

describe("motor", () => {
  it("dados atrasados bloqueiam qualquer sinal", () => {
    const m5 = series(2400, wave);
    const r = analyze(input(m5, { now: m5.at(-1)!.t + 300 + 6 * 3600 }));
    expect(r.decision).toBe("NO_TRADE");
    expect(r.data.ok).toBe(false);
    expect(r.filters.find((f) => f.id === 10)?.status).toBe("falha");
    expect(r.trade).toBeNull();
  });
  it("mercado lateral não gera entrada", () => {
    const r = analyze(input(series(2400, flat)));
    expect(r.decision).toBe("NO_TRADE");
    expect(r.trade).toBeNull();
    expect(r.state).not.toBe("entrada_confirmada");
  });
  it("calendário indisponível aparece como 'não verificado'", () => {
    const r = analyze(input(series(2400, wave), { events: null }));
    expect(r.filters.find((f) => f.id === 9)?.status).toBe("nao_verificado");
  });
  it("evento de alto impacto próximo bloqueia a entrada", () => {
    const m5 = series(2400, wave), now = m5.at(-1)!.t + 300;
    const r = analyze(input(m5, { events: [{ at: now + 600, title: "NFP", country: "USD", impact: 3 }] }));
    expect(r.filters.find((f) => f.id === 9)?.status).toBe("falha");
    expect(r.decision).toBe("NO_TRADE");
  });
  it("resultado sempre estruturado, sem NaN, e entrada só com gatilho confirmado", () => {
    for (const f of [wave, flat, (i: number) => 1.2 - i * 0.00004 + 0.001 * Math.sin(i / 6)]) {
      const r = analyze(input(series(2400, f)));
      expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/);
      if (r.decision !== "NO_TRADE") { expect(r.trigger?.confirmed).toBe(true); expect(r.trade!.rr[0]).toBeGreaterThanOrEqual(1.5); expect(r.score!.total).toBeGreaterThanOrEqual(75); }
    }
  });
});

describe("motor: cenários completos", () => {
  const run = (m5: Candle[]) => analyze(input(m5));
  it("compra confirmada: varredura de liquidez + gatilho, gatilho, filtros, pontuação e risco coerentes", () => {
    const r = run(noisy(15, 2360));
    expect(r.decision).toBe("BUY");
    expect(r.state).toBe("entrada_confirmada");
    expect(r.trigger?.confirmed).toBe(true);
    expect(r.filters.every((f) => f.status !== "falha")).toBe(true);
    expect(r.score!.total).toBeGreaterThanOrEqual(75);
    expect(Object.values(r.score!.parts).reduce((s, p) => s + p.max, 0)).toBe(100);
    const t = r.trade!;
    expect(t.sl).toBeLessThan(t.entry);
    expect(t.tps[0]!).toBeGreaterThan(t.entry);
    expect(t.rr[0]!).toBeGreaterThanOrEqual(1.5);
    expect(t.riskPips).toBeGreaterThan(0);
    expect(t.maxHoldMin).toBe(60);              // operação curta
    expect(t.targetAtr!).toBeLessThanOrEqual(8); // alvo alcançável em poucas velas
    expect(r.invalidation).toMatch(/abaixo/);
    expect(r.favor.length).toBeGreaterThan(0);
  });
  it("o espelho do mesmo mercado gera venda, não compra", () => {
    const r = run(noisy(15, 2360, true));
    expect(r.decision).toBe("SELL");
    expect(r.trade!.sl).toBeGreaterThan(r.trade!.entry);
    expect(r.trade!.tps[0]!).toBeLessThan(r.trade!.entry);
    expect(r.invalidation).toMatch(/acima/);
  });
  it("cenário bom sem gatilho vira 'aguardando confirmação' e não ativa a entrada", () => {
    const r = run(noisy(8, 2360));
    expect(r.state).toBe("aguardando_confirmacao");
    expect(r.decision).toBe("NO_TRADE");
    expect(r.trade).toBeNull();
    expect(r.watch?.condition).toMatch(/Aguardar gatilho/);
    expect(r.closest).not.toBeNull();                       // mostra o que já foi cumprido e o que falta
    expect(r.closest!.done.length).toBeGreaterThan(0);
    expect(r.closest!.missing.join(" ")).toMatch(/gatilho|Confluência/i);
  });
  it("sem M1 o gatilho vem do M5 e isso é informado", () => {
    const r = run(noisy(15, 2360));
    expect(r.trigger?.source).toBe("M5");
    expect(r.filters.find((f) => f.id === 10)?.note).toMatch(/M1 indisponível/);
  });
});

describe("estratégia 9: impulso a favor da estrutura", () => {
  const ctxOf = (m5: Candle[]): Ctx => {
    const a = { H1: analyzeTF(aggregate(m5, 12), "H1"), M5: analyzeTF(m5, "M5"), M1: null };
    const price = a.M5.lastClose;
    return { price, pip: 0.0001, a, regions: mergeRegions([buildRegions(aggregate(m5, 12), "H1", price, a.H1.atr, 0.0001)], price, 0.0001), m5, patterns: detectPatterns(m5, { atr: a.M5.atr, inRegion: true }) };
  };
  const withImpulse = (step: number, sign = 1) => {
    const m5 = [...series(900, (i) => 1.1 + sign * (i * 0.00002 + 0.0004 * Math.sin(i / 10)), { wick: 0.00005 })];
    for (let k = 1; k <= 4; k++) { const last = m5[m5.length - 1], c = last.c + sign * step; m5.push({ t: last.t + 300, o: last.c, h: Math.max(last.c, c) + 0.00004, l: Math.min(last.c, c) - 0.00004, c }); }
    return m5;
  };
  it("compra: topos e fundos ascendentes + 4 velas fortes + espaço = pronta; venda é o espelho", () => {
    const up = impulse(ctxOf(withImpulse(0.00012)), "BUY");
    expect(up.ready).toBe(true);
    expect(up.invalidation).not.toBeNull();
    expect(up.invalidation!).toBeLessThan(ctxOf(withImpulse(0.00012)).price); // stop no último fundo da estrutura
    const down = impulse(ctxOf(withImpulse(0.00012, -1)), "SELL");
    expect(down.ready).toBe(true);
    expect(down.invalidation!).toBeGreaterThan(ctxOf(withImpulse(0.00012, -1)).price);
  });
  it("não dispara em mercado lateral, na direção contrária nem com o preço já esticado", () => {
    expect(impulse(ctxOf(series(900, (i) => 1.1 + 0.0003 * Math.sin(i / 7), { wick: 0.00005 })), "BUY").ready).toBe(false);
    expect(impulse(ctxOf(withImpulse(0.00012)), "SELL").ready).toBe(false);
    const over = impulse(ctxOf(withImpulse(0.00018)), "BUY");
    expect(over.ready).toBe(false);
    expect(over.needs.join(" ")).toMatch(/EMA 20/);
  });
});
