import { describe, expect, it } from "vitest";
import { directionDelta, patternHistoryComponent, sessionComponent } from "./confluence.js";
import { analyze, type EngineInput } from "./engine.js";
import { handleForexAnalyze, handleForexResolve, type Deps } from "./handlers.js";
import { summarizeHistory, type HistItem } from "./history.js";
import { analyzeTF } from "./mtf.js";
import { DEFAULT_PROFILE, positionSize, sanitizeProfile } from "./profile.js";
import { aggregate, noisy } from "./testkit.js";
import type { Candle } from "./types.js";

const input = (m5: Candle[], over: Partial<EngineInput> = {}): EngineInput => ({
  symbol: "EURUSD", label: "EUR/USD", pip: 0.0001, currencies: ["EUR", "USD"], now: m5.at(-1)!.t + 300,
  candles: { H1: aggregate(m5, 12), M5: m5, M1: null, M15: aggregate(m5, 3) }, events: [], skipFreshness: false, ...over,
});
const BUY = noisy(15, 2360), WAIT = noisy(8, 2360), NONE = noisy(3, 2360);

describe("Trade Profile", () => {
  it("valida o que vem do navegador: limites, pares inexistentes e listas vazias viram o padrão", () => {
    const p = sanitizeProfile({ pairs: ["EURUSD", "XXXYYY", 5], strategies: [3, 99], maxRiskPct: 50, minRR: 0.1, style: "louco", context: ["H1", "D1"], balance: "10000", entryTf: "M5" });
    expect(p.pairs).toEqual(["EURUSD"]);
    expect(p.strategies).toEqual([3]);
    expect(p.maxRiskPct).toBe(5);
    expect(p.minRR).toBe(1);
    expect(p.style).toBe("equilibrado");
    expect(p.context).toEqual(["H1"]);
    expect(p.balance).toBe(10000);
    expect(p.entryTf).toBe("M5");
    const d = sanitizeProfile(undefined);
    expect(d.pairs.length).toBe(12);
    expect(d.strategies).toEqual([1, 2, 3, 4, 5, 9]);
    expect(d.balance).toBeNull();
  });
  it("tamanho da posição: calcula só quando dá, e diz por quê quando não dá", () => {
    const p = { ...DEFAULT_PROFILE, balance: 10000, maxRiskPct: 1 };
    expect(positionSize(p, "EURUSD", 1.1, 10).lots).toBe(1); // 100 USD ÷ (10 pips × 10 USD)
    expect(positionSize(p, "USDJPY", 150, 10).lots).toBeCloseTo(Math.floor((100 / (10 * (1000 / 150))) * 100) / 100, 5);
    const cross = positionSize(p, "EURGBP", 0.85, 10);
    expect(cross.lots).toBeNull();
    expect(cross.note).toMatch(/cruzamento/);
    expect(positionSize(DEFAULT_PROFILE, "EURUSD", 1.1, 10).lots).toBeNull();
  });
  it("o perfil muda a decisão: conservador exige M1, estratégia desabilitada e R:R alto bloqueiam", () => {
    expect(analyze(input(BUY)).state).toBe("entrada_confirmada");
    const cons = analyze(input(BUY, { profile: sanitizeProfile({ style: "conservador" }) }));
    expect(cons.state).not.toBe("entrada_confirmada"); // sem M1 o gatilho não vale no perfil conservador
    expect(cons.trigger?.detail).toMatch(/conservador exige gatilho no M1/);
    const chosen = analyze(input(BUY)).chosen!.id;
    const off = analyze(input(BUY, { profile: sanitizeProfile({ strategies: [1, 2, 3, 4, 5, 9].filter((i) => i !== chosen) }) }));
    expect(off.chosen?.id).not.toBe(chosen);
    expect(off.strategies.find((s) => s.id === chosen)?.status).toBe("desabilitada");
    const rr = analyze(input(BUY, { profile: sanitizeProfile({ minRR: 5 }) }));
    expect(rr.state).not.toBe("entrada_confirmada");
  });
});

describe("Confluence Score", () => {
  const r = analyze(input(BUY));
  it("tem os 9 componentes, cada um com nota, estado e justificativa; pesos somam 100", () => {
    const c = r.score!.components;
    expect(c.map((x) => x.id)).toEqual(["delta", "structure", "history", "session", "alignment", "liquidity", "sr", "rr", "news"]);
    expect(c.reduce((t, x) => t + x.weight, 0)).toBe(100);
    for (const x of c) { expect(x.why.length).toBeGreaterThan(10); expect(["favoravel", "neutro", "contrario", "nao_verificado", "sem_dados"]).toContain(x.state); }
    expect(r.score!.total).toBeGreaterThanOrEqual(75);
  });
  it("componente sem dado verificável fica fora da média (histórico pequeno, notícia não verificada)", () => {
    const h = r.score!.components.find((x) => x.id === "history")!;
    expect(h.score).toBeNull();
    expect(h.state).toBe("sem_dados");
    const n = analyze(input(BUY, { events: null })).score!.components.find((x) => x.id === "news")!;
    expect(n.score).toBeNull();
    expect(n.state).toBe("nao_verificado");
  });
  it("Pattern History usa só resultados reais do seu histórico e exige amostra mínima", () => {
    expect(patternHistoryComponent("X", "EURUSD", [{ strategy: "X", symbol: "EURUSD", n: 9, sumR: 9 }]).score).toBeNull();
    const good = patternHistoryComponent("X", "EURUSD", [{ strategy: "X", symbol: "EURUSD", n: 20, sumR: 5 }]);
    const bad = patternHistoryComponent("X", "EURUSD", [{ strategy: "X", symbol: "EURUSD", n: 20, sumR: -10 }]);
    expect(good.score).toBe(75); // +0,5R por operação
    expect(bad.score).toBe(0);
    expect(bad.state).toBe("contrario");
    const withHist = analyze(input(BUY, { history: [{ strategy: r.chosen!.name, symbol: "EURUSD", n: 30, sumR: -15 }] }));
    expect(withHist.score!.components.find((x) => x.id === "history")!.state).toBe("contrario");
  });
  it("Direction Delta é simétrico: o saldo a favor da compra é o oposto do saldo a favor da venda", () => {
    const m5 = BUY, a = { H1: analyzeTF(aggregate(m5, 12), "H1"), M15: null, M5: analyzeTF(m5, "M5"), M1: null };
    const b = directionDelta(a, a.M5.lastClose, "BUY"), s = directionDelta(a, a.M5.lastClose, "SELL");
    expect(b.delta).toBeCloseTo(-s.delta, 9);
    expect(b.max).toBe(s.max);
  });
  it("sessão: fim de semana fechado, Londres+NY forte para EUR/USD, madrugada asiática fraca", () => {
    const at = (iso: string) => Date.parse(iso) / 1000;
    expect(sessionComponent(at("2026-11-07T14:00:00Z"), ["EUR", "USD"]).score).toBe(0);      // sábado
    const ov = sessionComponent(at("2026-11-04T14:00:00Z"), ["EUR", "USD"]);                  // quarta 14h UTC
    expect(ov.score).toBe(100);
    expect(ov.why).toMatch(/sobreposição/);
    expect(sessionComponent(at("2026-11-04T03:00:00Z"), ["EUR", "USD"]).score).toBe(30);
    expect(sessionComponent(at("2026-11-04T03:00:00Z"), ["JPY", "AUD"]).score).toBe(90);
  });
  it("filtro obrigatório reprovado limita a pontuação a 49 e diz qual", () => {
    const big = noisy(15, 2360).map((k, i, a) => (i === a.length - 1 ? { ...k, h: k.h + 0.03, l: k.l - 0.03 } : k)); // última vela gigante estoura a volatilidade
    const x = analyze(input(big));
    if (x.score) { expect(x.score.capped.length > 0 ? x.score.total <= 49 : true).toBe(true); }
    const withNews = analyze(input(BUY, { events: [{ at: BUY.at(-1)!.t + 900, title: "NFP", country: "USD", impact: 3 }] }));
    expect(withNews.state).not.toBe("entrada_confirmada");
    expect(withNews.score!.capped).toContain("Notícias");
    expect(withNews.score!.total).toBeLessThanOrEqual(49);
    expect(withNews.score!.label).toMatch(/BLOQUEADO/);
  });
});

describe("Trade Thesis, anotações e decisão", () => {
  const r = analyze(input(BUY));
  const f = (v: number) => v.toFixed(5);
  it("a tese usa exatamente os preços do motor e nada além", () => {
    const t = r.thesis, text = t.lines.map((l) => l.text).join("\n");
    expect(t.scenario).toBe("COMPRA");
    expect(t.status).toBe("confirmada");
    const by = (l: string) => t.lines.find((x) => x.label === l)!.text;
    expect(by("ENTRADA")).toContain(f(r.trade!.entry));
    expect(by("STOP")).toContain(f(r.trade!.sl));
    expect(by("TAKE 1")).toContain(f(r.trade!.tps[0]!));
    expect(by("INVALIDAÇÃO")).toBe(r.invalidation);
    expect(by("M1")).toMatch(/indisponível/); // o M1 não existe neste cenário, e a tese diz isso
    // todo preço citado na tese existe nos números do motor
    const prices = text.match(/\d\.\d{5}/g) ?? [];
    const known = new Set<string>([r.trade!.entry, r.trade!.invalidation, r.trade!.sl, ...r.trade!.tps.filter((x): x is number => x !== null), ...r.regions.flatMap((x) => [x.low, x.high]), r.tfs.M5.pivots.at(-1)!.price, ...(r.trigger?.level ? [r.trigger.level] : []), ...(r.tfs.M5.sweep ? [r.tfs.M5.sweep.level] : [])].map(f));
    for (const p of prices) expect(known.has(p)).toBe(true);
  });
  it("anotações: preços exatos do motor, nenhuma no futuro, e mesmos pivôs com velas novas não mudam", () => {
    const an = r.annotations, last = BUY.at(-1)!.t;
    expect(an.find((x) => x.kind === "stop")!.price).toBe(r.trade!.sl);
    expect(an.find((x) => x.kind === "entrada" && x.price !== undefined)!.price).toBe(r.trade!.entry);
    expect(an.filter((x) => x.kind === "take").map((x) => x.price)).toEqual(r.trade!.tps.filter((x) => x !== null));
    expect(an.some((x) => x.kind === "suporte" || x.kind === "resistencia")).toBe(true);
    for (const x of an) for (const t of [x.t1, x.t2]) if (t !== undefined) expect(t).toBeLessThanOrEqual(last);
    // sem repintura: o mesmo pivô/região anotado com 1 vela a menos continua igual
    const prev = analyze(input(BUY.slice(0, -1))).annotations.filter((x) => x.kind === "suporte" || x.kind === "resistencia");
    const now = r.annotations.filter((x) => x.kind === "suporte" || x.kind === "resistencia");
    expect(prev.length).toBeGreaterThan(0);
    for (const p of prev) { const q = now.find((y) => y.label === p.label && Math.abs(y.low! - p.low!) < 1e-4); expect(q).toBeTruthy(); }
  });
  it("aguardando: plano é condicional e a lista de liberação diz o que falta; sem setup não há preço inventado", () => {
    const w = analyze(input(WAIT));
    expect(w.state).toBe("aguardando_confirmacao");
    expect(w.plan?.status).toBe("condicional");
    expect(w.annotations.find((x) => x.kind === "stop")?.label).toMatch(/condicional/);
    expect(w.release!.conditions.some((c) => !c.ok)).toBe(true);
    expect(w.release!.conditions.some((c) => c.ok)).toBe(true);
    expect(w.thesis.status).toBe("condicional");
    expect(w.thesis.lines.find((l) => l.label === "ENTRADA")!.text).toMatch(/condicional/);
    expect(w.sizing).toBeNull();
    const n = analyze(input(NONE));
    expect(n.decision).toBe("NO_TRADE");
    expect(n.plan).toBeNull();
    expect(n.thesis.lines.some((l) => ["ENTRADA", "STOP", "TAKE 1"].includes(l.label))).toBe(false);
  });
  it("tamanho da posição só aparece com entrada confirmada e saldo informado", () => {
    expect(r.sizing?.lots).toBeNull();
    const withBal = analyze(input(BUY, { profile: sanitizeProfile({ balance: 10000, maxRiskPct: 1 }) }));
    expect(withBal.sizing!.lots).toBeGreaterThan(0);
    expect(withBal.sizing!.riskUsd).toBe(100);
  });
});

describe("histórico: simulado, real e não resolvido", () => {
  const sig = (id: string, o: Partial<HistItem> = {}): HistItem => ({ id, symbol: "EURUSD", label: "EUR/USD", at: 1, tf: "M5", decision: "BUY", state: "entrada_confirmada", dir: "BUY", strategy: "BOS e reteste", score: 80, ...o });
  const res = (id: string, status: "tp1" | "stop" | "aberto", r: number | null) => ({ ...sig(id), dir: "BUY" as const, entry: 1, sl: 0.9, tps: [1.2, null, null], reasons: [], pip: 0.0001, score: 80, status, r, closedAt: status === "aberto" ? null : 2 });
  it("grupos que não se sobrepõem; NO TRADE entra na contagem por par e motivo", () => {
    const items: HistItem[] = [
      sig("a"), sig("b"), sig("c"), sig("d", { realR: -1 }),
      sig("e", { dir: null, decision: "NO_TRADE", state: "sem_operacao", missing: ["Volatilidade: alta demais"] }),
      sig("f", { dir: null, decision: "NO_TRADE", state: "aguardando_confirmacao", missing: ["Gatilho M5: sem gatilho"], label: "GBP/USD" }),
    ];
    const s = summarizeHistory(items, [res("a", "tp1", 1.5), res("b", "stop", -1), res("c", "aberto", null), res("d", "tp1", 2)]);
    expect(s.analyses).toEqual({ total: 6, entries: 4, waiting: 1, noTrade: 2 });
    expect(s.simulated.n).toBe(2);       // a e b
    expect(s.real!.n).toBe(1);           // d usa o resultado real informado (−1R), não o simulado (+2R)
    expect(s.real!.sumR).toBe(-1);
    expect(s.unresolved).toBe(1);        // c
    expect(s.noTradeBySymbol.map((x) => x.key).sort()).toEqual(["EUR/USD", "GBP/USD"]);
    expect(s.noTradeReasons.map((x) => x.key)).toContain("Volatilidade");
    expect(summarizeHistory([sig("x")], []).real).toBeNull();
  });
  it("estatísticas por estratégia, ativo e tempo gráfico vêm de cada grupo", () => {
    const s = summarizeHistory([sig("a"), sig("b", { strategy: "Varredura de liquidez", label: "GBP/USD", symbol: "GBPUSD" })], [res("a", "tp1", 1.5), { ...res("b", "stop", -1), strategy: "Varredura de liquidez", label: "GBP/USD", symbol: "GBPUSD" }]);
    expect(s.simulated.byStrategy.map((g) => g.key).sort()).toEqual(["BOS e reteste", "Varredura de liquidez"]);
    expect(s.simulated.bySymbol).toHaveLength(2);
    expect(s.simulated.byTf[0].key).toBe("M5");
  });
});

describe("API com perfil e histórico", () => {
  const m5 = BUY, now = (m5.at(-1)!.t + 300) * 1000;
  const series: Deps["series"] = async (_id, tf) => { if (tf === "M1") throw new Error("sem M1"); return { candles: tf === "M5" ? m5 : tf === "M15" ? aggregate(m5, 3) : aggregate(m5, 12), duplicates: 0, invalid: 0 }; };
  const post = (body: unknown) => new Request("http://x/api/forex", { method: "POST", body: JSON.stringify(body) });
  it("devolve confluência, tese, plano, gráfico e anotações; usa o perfil enviado", async () => {
    const j = await (await handleForexAnalyze(post({ asset: "EURUSD", explain: false, profile: { balance: 5000, maxRiskPct: 2 } }), { series, calendar: async () => [], now: () => now })).json();
    expect(j.decision).toBe("BUY");
    expect(j.score.components).toHaveLength(9);
    expect(j.thesis.scenario).toBe("COMPRA");
    expect(j.plan.status).toBe("confirmado");
    expect(j.chart.candles.length).toBe(96);
    expect(j.chart.annotations.find((x: { kind: string }) => x.kind === "stop").price).toBe(j.trade.sl);
    expect(j.sizing.riskUsd).toBe(100);
    expect(j.profile.maxRiskPct).toBe(2);
    expect(j.tfs.M15).not.toBeNull();
    expect(JSON.stringify(j)).not.toMatch(/NaN|undefined/);
  });
  it("par fora dos pares monitorados é recusado com o motivo", async () => {
    const r = await handleForexAnalyze(post({ asset: "EURUSD", profile: { pairs: ["GBPUSD"] } }), { series, now: () => now });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/pares monitorados/);
  });
  it("histórico do usuário entra no Pattern History e M15 ausente não derruba a análise", async () => {
    const s2: Deps["series"] = async (id, tf) => { if (tf === "M15") throw new Error("x"); return series!(id, tf); };
    const j = await (await handleForexAnalyze(post({ asset: "EURUSD", explain: false, history: [{ strategy: "BOS e reteste", symbol: "EURUSD", n: 40, sumR: 12 }, { strategy: 5 }] }), { series: s2, calendar: async () => [], now: () => now })).json();
    expect(j.tfs.M15).toBeNull();
    const h = j.score.components.find((c: { id: string }) => c.id === "history");
    expect(["sem_dados", "favoravel", "neutro", "contrario"]).toContain(h.state);
    if (j.chosen?.name === "BOS e reteste") expect(h.score).toBeGreaterThan(50);
  });
  it("resolve devolve o resumo separado em simulado, real e não resolvido", async () => {
    const t0 = m5[2000].t, c = m5[2000].c;
    const item = { id: "1", symbol: "EURUSD", label: "EUR/USD", at: t0, tf: "M5", decision: "BUY", state: "entrada_confirmada", dir: "BUY", strategy: "BOS e reteste", entry: c, sl: c - 0.0005, tps: [c + 0.0008, null, null], score: 80, reasons: [], pip: 0.0001 };
    const no = { id: "2", symbol: "EURUSD", label: "EUR/USD", at: t0, tf: "M5", decision: "NO_TRADE", state: "sem_operacao", dir: null, strategy: "—", score: null, missing: ["Volatilidade: alta"] };
    const res = await handleForexResolve(new Request("http://x", { method: "POST", body: JSON.stringify({ items: [item, { ...item, id: "3", realR: 1.2 }, no] }) }), { series: async (_i, tf) => ({ candles: tf === "M1" ? [] : m5, duplicates: 0, invalid: 0 }) });
    const j = await res.json();
    expect(j.resolved).toHaveLength(2);
    expect(j.summary.analyses.noTrade).toBe(1);
    expect(j.summary.real.n).toBe(1);
    expect(j.summary.real.sumR).toBeCloseTo(1.2, 9);
    expect(j.summary.simulated.n + j.summary.unresolved).toBe(1);
  });
});
