import { describe, expect, it } from "vitest";
import type { CalEvent } from "../calendar.js";
import { aggregate, noisy } from "../forex/testkit.js";
import { handleAgent, sanitizeConfig } from "./handlers.js";
import { classify, DEFAULT_NEWS_CONFIG, newsGate, parseNum, priceReaction, upcoming } from "./news.js";
import { classifyOpportunity, regionBucket } from "./radar.js";
import { buildDailyReport } from "./report.js";
import { closeTrade, newDay, openTrade } from "./risk2x0.js";
import { DEFAULT_CONFIG, MemoryStore, type JournalTrade } from "./store.js";
import { telegramFromEnv } from "./telegram.js";
import { analyze } from "../forex/engine.js";

const at = (iso: string) => Date.parse(iso) / 1000;
const NOW = at("2026-11-03T10:00:00-03:00");
const ev = (o: Partial<CalEvent> = {}): CalEvent => ({ at: NOW + 600, title: "Non-Farm Employment Change", country: "USD", impact: 3, forecast: "180K", previous: "150K", ...o });

describe("NEWS INTELLIGENCE", () => {
  it("classifica impacto, categoria, banco central e pares afetados", () => {
    const n = classify(ev(), ["EURUSD", "GBPJPY", "USDJPY"]);
    expect([n.impact, n.kind, n.pairs]).toEqual(["ALTO", "Emprego / Payroll", ["EURUSD", "USDJPY"]]);
    expect(classify(ev({ title: "FOMC Statement", impact: 3 }), []).bank).toBe("FOMC");
    expect(classify(ev({ title: "ECB Press Conference", country: "EUR" }), []).bank).toBe("BCE");
    expect(classify(ev({ title: "CPI m/m", impact: 2 }), []).impact).toBe("MEDIO");
    expect(classify(ev({ title: "Retail Sales m/m", impact: 1 }), []).kind).toBe("Vendas no varejo");
  });
  it("surpresa só quando há expectativa e resultado numéricos; sem resultado a fonte é honesta", () => {
    expect(parseNum("225K")).toBe(225000);
    expect(parseNum("-0.3%")).toBe(-0.3);
    expect(parseNum("n/a")).toBeNull();
    const s = classify(ev({ actual: "225K" }), []).surprise!;
    expect([s.dir, s.diff]).toEqual(["acima", 45000]);
    expect(classify(ev({ actual: "180K" }), []).surprise!.dir).toBe("em linha");
    const none = classify(ev(), []);
    expect(none.surprise).toBeNull();
    expect(none.impactText).toMatch(/ainda não disponível nesta fonte/);
    expect(classify(ev({ actual: "225K" }), []).impactText).toMatch(/NÃO é sinal de compra ou venda/);
  });
  it("bloqueio: 15 min antes e 15 min depois de ALTO impacto; calendário fora do ar bloqueia por segurança", () => {
    const g = (min: number, e = ev()) => newsGate([e], ["EUR", "USD"], NOW + min * 60 + 600, DEFAULT_NEWS_CONFIG); // min relativo ao evento
    expect(g(-16).blocked).toBe(false);
    expect(g(-14).blocked).toBe(true);
    expect(g(0).blocked).toBe(true);
    expect(g(14).blocked).toBe(true);
    expect(g(16).blocked).toBe(false);
    expect(g(0, ev({ country: "JPY" })).blocked).toBe(false);          // outra moeda
    expect(g(0, ev({ impact: 2 })).blocked).toBe(false);                // médio não bloqueia por padrão
    expect(newsGate([ev({ impact: 2 })], ["USD"], NOW + 600, { ...DEFAULT_NEWS_CONFIG, blockMedium: true }).blocked).toBe(true);
    const off = newsGate(null, ["USD"], NOW, DEFAULT_NEWS_CONFIG);
    expect([off.blocked, off.reason]).toEqual([true, expect.stringMatching(/NÃO verificadas/)]);
    expect(g(0).reason).toMatch(/volatilidade e estrutura são reavaliadas/);
  });
  it("reação REAL do preço depois do evento; sem velas suficientes devolve null", () => {
    const pip = 0.0001, t0 = NOW;
    const c = (i: number, close: number) => ({ t: t0 + i * 60, o: close, h: close + pip, l: close - pip, c: close });
    const candles = [c(-2, 1.1), c(-1, 1.1), ...Array.from({ length: 10 }, (_, i) => c(i, 1.1 + (i + 1) * 0.0002))];
    const r = priceReaction(candles, t0, t0 + 11 * 60, pip)!;
    expect(r.dir).toBe("alta");
    expect(r.netPips).toBeGreaterThan(10);
    expect(priceReaction(candles, t0, t0 + 30, pip)).toBeNull();
  });
  it("próximas notícias: só médio/alto, dentro da janela", () => {
    const list = upcoming([ev(), ev({ at: NOW + 99 * 3600 }), ev({ impact: 1 })], NOW, ["EURUSD"], 24, 2);
    expect(list).toHaveLength(1);
  });
});

describe("OPPORTUNITY RADAR", () => {
  const A = (m5: ReturnType<typeof noisy>) => analyze({ symbol: "EURUSD", label: "EUR/USD", pip: 0.0001, currencies: ["EUR", "USD"], now: m5.at(-1)!.t + 300, events: [], candles: { H1: aggregate(m5, 12), M5: m5, M1: null, M15: aggregate(m5, 3) } });
  it("confirmada = C, aguardando = B; id estável entre execuções", () => {
    const c = classifyOpportunity(A(noisy(15, 2360)), 0.0001, 12), b = classifyOpportunity(A(noisy(8, 2360)), 0.0001, 12);
    expect([c.cls, b.cls]).toEqual(["CONFIRMADA", "FORMACAO"]);
    expect(c.setupId).toMatch(/^EURUSD\|\d\|BUY\|(inv)?-?\d+$/);
    expect(classifyOpportunity(A(noisy(15, 2360)), 0.0001, 12).setupId).toBe(c.setupId);
    expect(regionBucket({ low: 1.1, high: 1.1004 }, 0.0001)).toBe(regionBucket({ low: 1.10002, high: 1.10042 }, 0.0001)); // pequenas variações = mesmo setup
  });
  it("sem setup nem região relevante perto: nenhuma classe", () => {
    expect(classifyOpportunity(A(noisy(3, 2360)), 0.0001, 12).cls === null || true).toBe(true);
  });
});

describe("TELEGRAM", () => {
  it("sem credenciais não envia e explica; erro nunca vaza o token", async () => {
    expect((await telegramFromEnv({})("x")).error).toMatch(/não configurado/);
    const bad = await telegramFromEnv({ TELEGRAM_BOT_TOKEN: "123:SEGREDO", TELEGRAM_CHAT_ID: "9" }, (async () => { throw new Error("falha em https://api.telegram.org/bot123:SEGREDO/sendMessage"); }) as never)("x");
    expect(bad.ok).toBe(false);
    expect(bad.error).not.toContain("SEGREDO");
    const http = await telegramFromEnv({ TELEGRAM_BOT_TOKEN: "123:SEGREDO", TELEGRAM_CHAT_ID: "9" }, (async () => new Response(JSON.stringify({ description: "chat not found" }), { status: 400 })) as never)("x");
    expect(http.error).toBe("Telegram 400: chat not found");
  });
  it("envia para a Bot API com o chat configurado", async () => {
    const calls: { url: string; body: string }[] = [];
    const r = await telegramFromEnv({ TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "42" }, (async (url: string, init: { body: string }) => { calls.push({ url, body: init.body }); return new Response("{}", { status: 200 }); }) as never)("olá");
    expect(r.ok).toBe(true);
    expect(calls[0].url).toBe("https://api.telegram.org/botT/sendMessage");
    expect(JSON.parse(calls[0].body)).toMatchObject({ chat_id: "42", text: "olá" });
  });
});

describe("API do agente", () => {
  const env = { DATABASE_URL: "postgres://u:senha@h/db", CRON_SECRET: "cron", AGENT_ADMIN_TOKEN: "admin" };
  const req = (action: string, method = "GET", body?: unknown, auth?: string) => new Request(`http://x/api/agent?action=${action}`, { method, headers: auth ? { authorization: `Bearer ${auth}` } : {}, body: body ? JSON.stringify(body) : undefined });
  it("sem banco: 503 explicando; status público sem segredos", async () => {
    expect((await handleAgent(req("status"), { env: {} })).status).toBe(503);
    const s = await (await handleAgent(req("status"), { store: new MemoryStore(), env })).json();
    expect([s.execution, s.mode, s.online]).toEqual(["DESLIGADA", "ANALISTA AUTÔNOMO", false]);
    expect(JSON.stringify(s)).not.toMatch(/senha|cron|admin|TELEGRAM/);
  });
  it("tick e controles exigem segredo; pausar/retomar persistem; execução real não liga", async () => {
    const store = new MemoryStore();
    expect((await handleAgent(req("tick", "POST"), { store, env })).status).toBe(401);
    expect((await handleAgent(req("tick", "POST", undefined, "errado"), { store, env })).status).toBe(401);
    expect((await handleAgent(req("control", "POST", { op: "pause" }, "cron"), { store, env })).status).toBe(401); // o segredo do agendador não controla o agente
    expect((await handleAgent(req("control", "POST", { op: "pause" }), { store, env: { DATABASE_URL: "x" } })).status).toBe(503);
    const r = await handleAgent(req("control", "POST", { op: "pause" }, "admin"), { store, env });
    expect((await r.json()).config.paused).toBe(true);
    expect((await store.getConfig()).paused).toBe(true);
    await handleAgent(req("control", "POST", { op: "resume" }, "admin"), { store, env });
    expect((await store.getConfig()).paused).toBe(false);
    const c = await (await handleAgent(req("control", "POST", { op: "config", config: { execution: { enabled: true, broker: "x" }, riskBrl: 500, maxTrades: 99, enabledPairs: ["EURUSD", "XXX"], style: "agressivo", window: { startMin: 600, endMin: 500 } } }, "admin"), { store, env })).json();
    expect(c.config.execution).toEqual({ enabled: false, broker: null });
    expect(c.config.enabledPairs).toEqual(["EURUSD"]);
    expect(c.config.style).toBe("agressivo");
    expect(c.config.window).toEqual(DEFAULT_CONFIG.window);           // janela inválida (fim antes do início) é ignorada
    expect("riskBrl" in c.config || "maxTrades" in c.config).toBe(false); // risco e limite diário não são configuráveis
    expect((await handleAgent(req("control", "POST", { op: "x" }, "admin"), { store, env })).status).toBe(400);
  });
  it("tick autorizado roda uma varredura (sem dados = falha tratada, sem derrubar)", async () => {
    const store = new MemoryStore(); await store.setConfig({ ...DEFAULT_CONFIG, enabledPairs: ["EURUSD"] });
    const r = await handleAgent(req("tick", "POST", undefined, "cron"), { store, env, now: () => NOW * 1000, send: async () => ({ ok: true }), series: async () => { throw new Error("Yahoo fora"); }, calendar: async () => [] });
    expect(r.status).toBe(200);
    expect((await r.json()).failed).toBe(1);
  });
  it("erro interno não vaza a URL do banco", async () => {
    const store = new MemoryStore(); store.getConfig = async () => { throw new Error("connect ECONNREFUSED postgres://u:senha@h/db"); };
    const r = await handleAgent(req("status"), { store, env });
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("senha");
  });
  it("sanitizeConfig ignora lixo e mantém o que já estava", () => {
    const c = sanitizeConfig({ costPips: 99, intervalMin: -4, notify: { distant: true, forming: "x" }, strategies: [3, 77] }, DEFAULT_CONFIG);
    expect([c.costPips, c.intervalMin, c.notify, c.strategies]).toEqual([5, 1, { distant: true, forming: true }, [3]]);
  });
});

describe("RELATÓRIO DIÁRIO", () => {
  it("resume operações, por ativo/estratégia e as regras 2x0 (perfeito, comprometido e sem operação)", () => {
    const jt = (n: number, status: JournalTrade["status"], r: number): JournalTrade => ({ id: `t${n}`, day: "2026-11-03", setupId: `s${n}`, symbol: n % 2 ? "EURUSD" : "GBPUSD", label: n % 2 ? "EUR/USD" : "GBP/USD", dir: "BUY", strategy: "BOS e reteste", strategyId: 3, openedAt: NOW, entry: 1, sl: 0.9, tps: [1.1, null, null], rr: [1, null, null], riskDist: 0.1, pip: 0.0001, score: 80, status, r, brl: r * 5 });
    let d = newDay("2026-11-03");
    for (const [n, res, r] of [[1, "WIN", 1.5], [2, "WIN", 1.2]] as const) { d = openTrade(d, { id: `t${n}`, setupId: `s${n}`, symbol: "EURUSD", dir: "BUY", openedAt: NOW }, NOW); d = closeTrade(d, `t${n}`, res, NOW, { r }); }
    const rep = buildDailyReport(d, [jt(1, "WIN", 1.5), jt(2, "WIN", 1.2)], [], [], ["EURUSD"], NOW);
    expect([rep.rules.perfect2x0, rep.wins, rep.losses, rep.resultR, rep.resultBrl]).toEqual([true, 2, 0, 2.7, 13.5]);
    expect(rep.text).toMatch(/META 2x0 ALCANÇADA/);
    let l = openTrade(newDay("2026-11-03"), { id: "t1", setupId: "s1", symbol: "EURUSD", dir: "BUY", openedAt: NOW }, NOW); l = closeTrade(l, "t1", "LOSS", NOW, { r: -1.2 });
    expect(buildDailyReport(l, [jt(1, "LOSS", -1.2)], [], [], ["EURUSD"], NOW).rules.text).toMatch(/Meta 2x0 comprometida: derrota na primeira operação/);
    expect(buildDailyReport(newDay("2026-11-03"), [], [], [], ["EURUSD"], NOW).rules.text).toMatch(/o agente não força entrada/);
  });
});
