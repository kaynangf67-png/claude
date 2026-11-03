import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CalEvent } from "../calendar.js";
import { aggregate, noisy } from "../forex/testkit.js";
import type { Candle, TF } from "../forex/types.js";
import { agentStatus, runTick, type TickDeps } from "./agent.js";
import { panel, stateOf } from "./risk2x0.js";
import { DEFAULT_CONFIG, MemoryStore, PgStore, type JournalTrade, type Store } from "./store.js";

const at = (iso: string) => Date.parse(iso) / 1000;
const TUE = at("2026-11-03T10:00:00-03:00");          // terça 10h em São Paulo: dentro do horário, mercado aberto
const N = 2360;
type Kind = "buy" | "wait" | "none";
const SEED: Record<Kind, number> = { buy: 15, wait: 8, none: 3 };

/** Mundo de teste: velas determinísticas deslocadas no tempo para terminar em `end`; M1 indisponível (como no Yahoo fora de hora). */
function world(end: number, map: Record<string, Kind>, extra: Record<string, Candle[]> = {}) {
  const cache = new Map<string, Candle[]>();
  const m5 = (sym: string) => {
    if (!cache.has(sym)) {
      const raw = noisy(SEED[map[sym] ?? "none"], N), shift = end - 300 - raw.at(-1)!.t;
      cache.set(sym, [...raw.map((k) => ({ ...k, t: k.t + shift })), ...(extra[sym] ?? [])]);
    }
    return cache.get(sym)!;
  };
  const calls: string[] = [];
  const series: TickDeps["series"] = async (id, tf: TF) => {
    calls.push(`${id}:${tf}`);
    if (!(id in map) && !(id in extra)) throw new Error("par sem dados");
    if (tf === "M1") throw new Error("sem M1");
    const c = m5(id);
    return { candles: tf === "M5" ? c : tf === "M15" ? aggregate(c, 3) : aggregate(c, 12), duplicates: 0, invalid: 0 };
  };
  return { series, calls, m5 };
}


/** Substitui as velas M5 de alguns pares (o resto vem do mundo base). M1 continua indisponível. */
const override = (base: ReturnType<typeof world>, extra: Record<string, Candle[]>): TickDeps["series"] => async (id, tf) => {
  if (!(id in extra)) return base.series!(id, tf);
  if (tf === "M1") throw new Error("sem M1");
  const c = extra[id];
  return { candles: tf === "M5" ? c : tf === "M15" ? aggregate(c, 3) : aggregate(c, 12), duplicates: 0, invalid: 0 };
};

const PAIRS = ["EURUSD", "GBPUSD", "USDJPY"];
const cfg = { ...DEFAULT_CONFIG, enabledPairs: PAIRS };
function harness(store: Store, send?: (t: string) => Promise<{ ok: boolean; error?: string }>) {
  const sent: string[] = [];
  const sender = send ?? (async (t: string) => { sent.push(t); return { ok: true }; });
  const tick = (now: number, w: ReturnType<typeof world>, calendar: () => Promise<CalEvent[]> = async () => []) =>
    runTick({ store, send: sender, now: () => (now + 10) * 1000, series: w.series, calendar });
  return { sent, tick };
}
const of = (sent: string[], re: RegExp) => sent.filter((s) => re.test(s));
const setup = async (over: Partial<typeof DEFAULT_CONFIG> = {}) => { const s = new MemoryStore(); await s.setConfig({ ...cfg, ...over }); return s; };
/** Velas depois da entrada: uma de espera e uma que bate o alvo (WIN) ou o stop (LOSS). */
function after(trade: JournalTrade, lastT: number, kind: "WIN" | "LOSS"): Candle[] {
  const d = trade.dir === "BUY" ? 1 : -1, e = trade.entry, p = 0.00002;
  const wait = { t: lastT + 300, o: e, c: e, h: e + p, l: e - p };
  const hit = kind === "WIN" ? e + d * Math.abs(trade.tps[0]! - e) + d * 0.00005 : e - d * Math.abs(e - trade.sl) - d * 0.00005;
  const k = { t: lastT + 600, o: e, c: hit, h: Math.max(e, hit) + (d > 0 ? 0 : 0), l: Math.min(e, hit) };
  return [wait, k];
}

describe("agente: entrada, resultado e gerenciamento 2x0", () => {
  it("abre UMA entrada simulada, grava o limite antes de avisar e não repete no tick seguinte", async () => {
    const store = await setup(), h = harness(store);
    const w = world(TUE, { EURUSD: "buy", GBPUSD: "none", USDJPY: "none" });
    const r = await h.tick(TUE, w);
    expect([r.action, r.opened, r.scanned, r.failed]).toEqual(["scanned", "EUR/USD BUY", 3, 0]);
    const day = (await store.latestDay())!;
    expect([stateOf(day), day.trades.length, day.trades[0].result]).toEqual(["FIRST_TRADE_ACTIVE", 1, "OPEN"]);
    const j = (await store.listTrades({ status: "OPEN" }))[0];
    expect([j.symbol, j.dir, j.status]).toEqual(["EURUSD", "BUY", "OPEN"]);
    const msg = of(h.sent, /SETUP CONFIRMADO/)[0];
    expect(msg).toContain(`Entrada: ${j.entry.toFixed(5)}`);
    expect(msg).toContain(`Stop: ${j.sl.toFixed(5)}`);
    expect(msg).toMatch(/Fonte: Yahoo Finance.*idade da última vela fechada/);
    expect(msg).toMatch(/SIMULADA/);
    expect(msg).toMatch(/não probabilidade/);
    const r2 = await h.tick(TUE + 60, w);
    expect(r2.action).toBe("locked");                           // há operação em andamento: só uma por vez
    expect(of(h.sent, /SETUP CONFIRMADO/)).toHaveLength(1);
    expect((await store.latestDay())!.trades).toHaveLength(1);
  });

  it("WIN → FIRST_WIN, não entra na mesma execução, e a segunda passa pelos filtros; segunda WIN → META 2x0 e bloqueio", async () => {
    const store = await setup(), h = harness(store);
    await h.tick(TUE, world(TUE, { EURUSD: "buy", GBPUSD: "none", USDJPY: "none" }));
    const t1 = (await store.listTrades({ status: "OPEN" }))[0];
    const base = world(TUE, { EURUSD: "none" }).m5("EURUSD"); void base;
    const lastT = TUE - 300;
    const T1 = TUE + 900;                                        // 15 min depois
    const extra = { EURUSD: after(t1, lastT, "WIN") };
    // o fixture de EURUSD precisa ser o MESMO (buy) para o tick ver as velas novas depois da entrada
    const w2 = world(T1, { EURUSD: "buy", GBPUSD: "buy", USDJPY: "none" }, {});
    const m5 = w2.m5("EURUSD");
    // reconstrói o mundo 2 com as velas originais (terminando em TUE) + as de resultado + deslocamento certo
    const orig = world(TUE, { EURUSD: "buy" }).m5("EURUSD");
    const w3 = world(T1, { GBPUSD: "buy", USDJPY: "none" });
    const series = override(w3, { EURUSD: [...orig, ...extra.EURUSD] });
    void m5;
    const r = await runTick({ store, send: async (t) => { h.sent.push(t); return { ok: true }; }, now: () => (T1 + 10) * 1000, series, calendar: async () => [] });
    expect(r.closed).toEqual(["EUR/USD WIN"]);
    expect(r.opened).toBeNull();                                  // não entra imediatamente só porque a primeira venceu
    expect(stateOf((await store.latestDay())!)).toBe("FIRST_WIN");
    expect(of(h.sent, /RESULTADO WIN/)[0]).toMatch(/ESTADO: FIRST_WIN/);
    const done = (await store.getTrade(t1.id))!;
    expect([done.status, done.outcome]).toEqual(["WIN", "tp1"]);
    expect(done.brl).toBeCloseTo(done.r! * 5, 1);
    // próxima execução: GBPUSD confirma (novo setup, passa por todos os filtros) → segunda operação
    const T2 = T1 + 300;
    const w4 = world(T2, { GBPUSD: "buy", USDJPY: "none" });
    const series2: TickDeps["series"] = async (id, tf) => w4.series(id === "EURUSD" ? "USDJPY" : id, tf);
    const r2 = await runTick({ store, send: async (t) => { h.sent.push(t); return { ok: true }; }, now: () => (T2 + 10) * 1000, series: series2, calendar: async () => [] });
    expect(r2.opened).toBe("GBP/USD BUY");
    expect(stateOf((await store.latestDay())!)).toBe("SECOND_TRADE_ACTIVE");
    const t2 = (await store.listTrades({ status: "OPEN" }))[0];
    // segunda vence
    const T3 = T2 + 900, lastG = T2 - 300;
    const gOrig = world(T2, { GBPUSD: "buy" }).m5("GBPUSD");
    const w5 = world(T3, { USDJPY: "none" });
    const series3 = override(w5, { GBPUSD: [...gOrig, ...after(t2, lastG, "WIN")] });
    const r3 = await runTick({ store, send: async (t) => { h.sent.push(t); return { ok: true }; }, now: () => (T3 + 10) * 1000, series: series3, calendar: async () => [] });
    expect(r3.closed).toEqual(["GBP/USD WIN"]);
    const day = (await store.latestDay())!;
    expect(stateOf(day)).toBe("TARGET_REACHED");
    expect(panel(day, T3).banner).toMatch(/META ALCANÇADA — 2X0/);
    expect(of(h.sent, /TRADE AGENT \| META ALCANÇADA/)).toHaveLength(1);
    // depois da meta: nenhuma varredura nem entrada, mesmo com setup perfeito disponível
    const wBuy = world(T3 + 600, { EURUSD: "buy", GBPUSD: "buy", USDJPY: "buy" });
    const r4 = await h.tick(T3 + 600, wBuy);
    expect(r4.action).toBe("locked");
    expect(wBuy.calls).toHaveLength(0);                           // nem consultou o mercado
    expect((await store.latestDay())!.trades).toHaveLength(2);
  }, 30_000);

  it("LOSS na primeira → DAILY_LOCKED na hora, sem segunda operação, mesmo com setup perfeito; só libera no próximo dia", async () => {
    const store = await setup(), h = harness(store);
    await h.tick(TUE, world(TUE, { EURUSD: "buy", GBPUSD: "none", USDJPY: "none" }));
    const t1 = (await store.listTrades({ status: "OPEN" }))[0];
    const orig = world(TUE, { EURUSD: "buy" }).m5("EURUSD");
    const T1 = TUE + 900, w = world(T1, { GBPUSD: "buy", USDJPY: "buy" });
    const series = override(w, { EURUSD: [...orig, ...after(t1, TUE - 300, "LOSS")] });
    const r = await runTick({ store, send: async (t) => { h.sent.push(t); return { ok: true }; }, now: () => (T1 + 10) * 1000, series, calendar: async () => [] });
    expect(r.closed).toEqual(["EUR/USD LOSS"]);
    expect(r.opened).toBeNull();
    const day = (await store.latestDay())!;
    expect(stateOf(day)).toBe("DAILY_LOCKED");
    expect(of(h.sent, /DIA ENCERRADO — LOSS IDENTIFICADO/).length).toBeGreaterThan(0);
    expect((await store.getTrade(t1.id))!.brl).toBeLessThan(0);
    // 3 execuções seguintes com setups perfeitos: nada abre
    for (let i = 1; i <= 3; i++) {
      const wx = world(T1 + 300 * i, { EURUSD: "buy", GBPUSD: "buy", USDJPY: "buy" });
      const rx = await h.tick(T1 + 300 * i, wx);
      expect([rx.action, rx.opened]).toEqual(["locked", null]);
      expect(wx.calls).toHaveLength(0);
    }
    expect((await store.latestDay())!.trades).toHaveLength(1);
    // próximo dia operacional (quarta 10h): READY de novo, histórico do dia anterior preservado
    const WED = at("2026-11-04T10:00:00-03:00"), wedW = world(WED, { EURUSD: "none", GBPUSD: "buy", USDJPY: "none" });
    const rw = await h.tick(WED, wedW);
    expect(rw.opened).toBe("GBP/USD BUY");
    expect((await store.listDays(5)).map((d) => d.date)).toEqual(["2026-11-04", "2026-11-03"]);
    expect((await store.getDay("2026-11-03"))!.trades[0].result).toBe("LOSS");
  }, 30_000);
});

describe("travas: horário, mercado, pausa, notícias, dados", () => {
  const cases: [string, number, Partial<typeof DEFAULT_CONFIG>, RegExp][] = [
    ["pausado", TUE, { paused: true }, /PAUSADO/],
    ["antes do horário operacional", at("2026-11-03T03:00:00-03:00"), {}, /Fora do horário/],
    ["depois do horário operacional", at("2026-11-03T17:30:00-03:00"), {}, /Fora do horário/],
    ["sábado", at("2026-11-07T10:00:00-03:00"), {}, /Mercado fechado/],
  ];
  for (const [name, now, over, re] of cases) {
    it(`não varre nem opera: ${name}`, async () => {
      const store = await setup(over), h = harness(store), w = world(now, { EURUSD: "buy", GBPUSD: "buy", USDJPY: "buy" });
      const r = await h.tick(now, w);
      expect(r.action).toMatch(/idle|paused/);
      expect(r.note).toMatch(re);
      expect(w.calls.filter((c) => !c.endsWith(":M1") || true).length).toBe(0);
      expect((await store.latestDay())!.trades).toHaveLength(0);
    });
  }
  it("evento de ALTO impacto bloqueia entrada; 'notícias não verificadas' também; passada a janela, libera", async () => {
    const ev = (min: number): CalEvent => ({ at: TUE + 10 + min * 60, title: "Non-Farm Employment Change", country: "USD", impact: 3, forecast: "180K", previous: "150K" });
    const w = () => world(TUE, { EURUSD: "buy", GBPUSD: "none", USDJPY: "none" });
    let store = await setup(), h = harness(store);
    expect((await h.tick(TUE, w(), async () => [ev(10)])).opened).toBeNull();                  // evento em 10 min
    const sc = await store.listScans((await store.latestDay())!.date);
    expect(sc.find((s) => s.symbol === "EURUSD")!.state).not.toBe("entrada_confirmada");
    store = await setup(); h = harness(store);
    expect((await h.tick(TUE, w(), async () => { throw new Error("fora do ar"); })).opened).toBeNull(); // calendário caiu
    store = await setup(); h = harness(store);
    expect((await h.tick(TUE, w(), async () => [ev(-20)])).opened).toBe("EUR/USD BUY");        // 20 min depois: já passou a janela
    store = await setup({ news: { ...DEFAULT_CONFIG.news, beforeMin: 15, afterMin: 15 } }); h = harness(store);
    expect((await h.tick(TUE, w(), async () => [ev(-10)])).opened).toBeNull();                 // 10 min depois: ainda bloqueado
  });
  it("setup confirmado é descartado com motivo registrado quando as travas bloqueiam (relatório explica)", async () => {
    const store = await setup(), h = harness(store);
    const ev: CalEvent = { at: TUE + 10 + 600, title: "FOMC Statement", country: "USD", impact: 3, forecast: "", previous: "" };
    await h.tick(TUE, world(TUE, { EURUSD: "buy", GBPUSD: "none", USDJPY: "none" }), async () => [ev]);
    const scans = await store.listScans((await store.latestDay())!.date);
    expect(scans).toHaveLength(3);                                // tudo foi registrado, inclusive o que não virou entrada
  });
  it("falha de dados em todos os pares: nenhum sinal, alerta de saúde uma vez por hora, contagem de falhas e painel OFFLINE", async () => {
    const store = await setup(), h = harness(store);
    const broken = world(TUE, {});                                // nenhum par tem dados
    for (let i = 0; i < 3; i++) { const r = await h.tick(TUE + 60 * i, broken); expect([r.action, r.failed]).toEqual(["scanned", 3]); }
    expect(of(h.sent, /Falha de dados|Não consegui buscar dados/)).toHaveLength(1);
    expect((await store.listTrades({}))).toHaveLength(0);
    const st = await agentStatus(store, (TUE + 200) * 1000);
    expect(st.online).toBe(false);
    expect(st.reason).toMatch(/execuções seguidas com falha/);
  });
});

describe("agente: radar, dedupe, resultado desconhecido, concorrência e falhas de envio", () => {
  it("setup em formação alerta UMA vez em várias execuções; ao sumir, alerta de invalidação UMA vez", async () => {
    const store = await setup(), h = harness(store);
    for (let i = 0; i < 3; i++) await h.tick(TUE + 300 * i, world(TUE + 300 * i, { EURUSD: "none", GBPUSD: "wait", USDJPY: "none" }));
    expect(of(h.sent, /SETUP EM FORMAÇÃO/)).toHaveLength(1);
    expect(of(h.sent, /FORMAÇÃO/)[0]).toMatch(/STATUS: AGUARDANDO/);
    for (let i = 3; i < 5; i++) await h.tick(TUE + 300 * i, world(TUE + 300 * i, { EURUSD: "none", GBPUSD: "none", USDJPY: "none" }));
    expect(of(h.sent, /CENÁRIO INVALIDADO/)).toHaveLength(1);
    expect((await store.getKv<Record<string, unknown>>("radar:active"))).toEqual({});
    const alerts = await store.listAlerts(50);
    expect(new Set(alerts.map((a) => a.key)).size).toBe(alerts.length);
  });
  it("sem resultado confirmado por mais de 90 min → DESCONHECIDO, bloqueia tudo; quando os dados voltam, reconcilia", async () => {
    const store = await setup(), h = harness(store);
    await h.tick(TUE, world(TUE, { EURUSD: "buy", GBPUSD: "none", USDJPY: "none" }));
    const t1 = (await store.listTrades({ status: "OPEN" }))[0];
    const down: TickDeps["series"] = async () => { throw new Error("Yahoo fora do ar"); };
    const T = TUE + 100 * 60;
    const r = await runTick({ store, send: async (t) => { h.sent.push(t); return { ok: true }; }, now: () => (T + 10) * 1000, series: down, calendar: async () => [] });
    expect((await store.latestDay())!.trades[0].result).toBe("UNKNOWN");
    expect(r.opened).toBeNull();
    expect((await store.getTrade(t1.id))!.status).toBe("UNKNOWN");
    expect(of(h.sent, /Não consegui confirmar o resultado/)).toHaveLength(1);
    // dados voltam: o mundo mostra que o Take 1 tinha sido atingido
    const orig = world(TUE, { EURUSD: "buy" }).m5("EURUSD"), w = world(T + 600, { GBPUSD: "buy", USDJPY: "none" });
    const series = override(w, { EURUSD: [...orig, ...after(t1, TUE - 300, "WIN")] });
    const r2 = await runTick({ store, send: async (t) => { h.sent.push(t); return { ok: true }; }, now: () => (T + 610) * 1000, series, calendar: async () => [] });
    expect(r2.closed).toEqual(["EUR/USD WIN"]);
    expect(stateOf((await store.latestDay())!)).toBe("FIRST_WIN");
  });
  it("operação pendente de um dia não deixa o dia seguinte reiniciar", async () => {
    const store = await setup(), h = harness(store);
    const LATE = at("2026-11-03T16:50:00-03:00");
    await h.tick(LATE, world(LATE, { EURUSD: "buy", GBPUSD: "none", USDJPY: "none" }));
    const WED = at("2026-11-04T10:00:00-03:00");
    const down: TickDeps["series"] = async () => { throw new Error("fora"); };
    const r = await runTick({ store, send: async (t) => { h.sent.push(t); return { ok: true }; }, now: () => (WED + 10) * 1000, series: down, calendar: async () => [] });
    expect((await store.latestDay())!.date).toBe("2026-11-03");   // continua o dia velho
    expect(r.note).toMatch(/pendente do dia anterior|Operação|desconhecid/i);
    expect(r.opened).toBeNull();
  });
  it("duas execuções simultâneas: só uma trabalha (trava) e a outra devolve 'busy'", async () => {
    const store = await setup(), h = harness(store);
    const w = world(TUE, { EURUSD: "buy", GBPUSD: "none", USDJPY: "none" });
    const [a, b] = await Promise.all([h.tick(TUE, w), h.tick(TUE, w)]);
    expect([a.action, b.action].sort()).toEqual(["busy", "scanned"]);
    expect((await store.latestDay())!.trades).toHaveLength(1);
  });
  it("Telegram fora do ar: o alerta fica registrado com o erro e o agente continua; token nunca aparece no erro", async () => {
    const store = await setup(), h = harness(store, async () => ({ ok: false, error: "Telegram 502" }));
    const r = await h.tick(TUE, world(TUE, { EURUSD: "buy", GBPUSD: "none", USDJPY: "none" }));
    expect(r.opened).toBe("EUR/USD BUY");                          // a entrada simulada existe mesmo sem notificação
    const al = (await store.listAlerts(20)).find((a) => a.cls === "CONFIRMADA")!;
    expect([al.sent, al.error]).toEqual([false, "Telegram 502"]);
  });
  it("relatório de encerramento: uma vez, com regras 2x0 e oportunidades não aproveitadas", async () => {
    const store = await setup(), h = harness(store);
    await h.tick(TUE, world(TUE, { EURUSD: "buy", GBPUSD: "wait", USDJPY: "none" }));
    const END = at("2026-11-03T17:05:00-03:00");
    await h.tick(END, world(END, { EURUSD: "none", GBPUSD: "none", USDJPY: "none" }));
    await h.tick(END + 300, world(END + 300, { EURUSD: "none" }));
    const rep = of(h.sent, /RELATÓRIO DO DIA/);
    expect(rep).toHaveLength(1);
    expect(rep[0]).toMatch(/Regras 2x0: \d\/2 vitórias · \d\/1 derrotas · 1\/2 operações/);
    expect(rep[0]).toMatch(/Oportunidades não aproveitadas/);
    expect(rep[0]).toMatch(/simulado/);
  });
  it("painel de status: ONLINE com batimento recente, OFFLINE sem execução, e execução real sempre DESLIGADA", async () => {
    const store = await setup(), h = harness(store);
    expect((await agentStatus(store, TUE * 1000)).online).toBe(false);
    await h.tick(TUE, world(TUE, { EURUSD: "none", GBPUSD: "none", USDJPY: "none" }));
    const st = await agentStatus(store, (TUE + 120) * 1000);
    expect([st.online, st.execution, st.mode, st.panel.state]).toEqual([true, "DESLIGADA", "ANÁLISE".length ? "ANALISTA AUTÔNOMO" : "", "READY"]);
    expect((await agentStatus(store, (TUE + 3600) * 1000)).online).toBe(false);
  });
});

const PG = process.env.TEST_DATABASE_URL;
describe.skipIf(!PG)("persistência real: o bloqueio diário sobrevive a 'reiniciar o servidor'", () => {
  let s1: PgStore, s2: PgStore;
  beforeAll(async () => { s1 = new PgStore(PG!); await s1.migrate(); await s1.pool.query("truncate agent_kv, agent_days, agent_trades, agent_alerts, agent_scans, agent_lease"); await s1.setConfig({ ...cfg }); });
  afterAll(async () => { await s1.close(); await s2?.close(); });
  it("entra, perde, 'reinicia' (nova conexão) e continua bloqueado até o dia seguinte", async () => {
    const h1 = harness(s1);
    await h1.tick(TUE, world(TUE, { EURUSD: "buy", GBPUSD: "none", USDJPY: "none" }));
    const t1 = (await s1.listTrades({ status: "OPEN" }))[0];
    const orig = world(TUE, { EURUSD: "buy" }).m5("EURUSD");
    s2 = new PgStore(PG!); // "servidor reiniciado": nada em memória
    const h2 = harness(s2), T1 = TUE + 900, w = world(T1, { GBPUSD: "buy", USDJPY: "buy" });
    const series = override(w, { EURUSD: [...orig, ...after(t1, TUE - 300, "LOSS")] });
    const r = await runTick({ store: s2, send: async (t) => { h2.sent.push(t); return { ok: true }; }, now: () => (T1 + 10) * 1000, series, calendar: async () => [] });
    expect(r.closed).toEqual(["EUR/USD LOSS"]);
    const s3 = new PgStore(PG!); // outro reinício
    const wx = world(T1 + 600, { EURUSD: "buy", GBPUSD: "buy", USDJPY: "buy" });
    const rx = await runTick({ store: s3, send: async () => ({ ok: true }), now: () => (T1 + 610) * 1000, series: wx.series, calendar: async () => [] });
    expect([rx.action, rx.state, rx.opened, wx.calls.length]).toEqual(["locked", "DAILY_LOCKED", null, 0]);
    expect((await s3.latestDay())!.trades).toHaveLength(1);
    await s3.close();
    const WED = at("2026-11-04T10:00:00-03:00"), s4 = new PgStore(PG!);
    const rw = await runTick({ store: s4, send: async () => ({ ok: true }), now: () => (WED + 10) * 1000, series: world(WED, { GBPUSD: "buy", EURUSD: "none", USDJPY: "none" }).series, calendar: async () => [] });
    expect(rw.opened).toBe("GBP/USD BUY");
    expect((await s4.listDays(5)).map((d) => d.date)).toEqual(["2026-11-04", "2026-11-03"]);
    await s4.close();
  }, 60_000);
});
