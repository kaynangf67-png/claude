import { describe, expect, it } from "vitest";
import { MemoryStore } from "../agent/store.js";
import { handleAgent } from "../agent/handlers.js";
import type { Opportunity } from "./core.js";
import { enqueue, loadMt5, MT5_RULES, poll, publicView, report, setEnabled, toText } from "./mt5.js";

const T = 1_800_000_000;
const opp = (o: Partial<Opportunity> = {}): Opportunity => ({ id: "EURUSD-1", symbol: "EURUSD", label: "EUR/USD", at: T, tf: "M5", dir: "BUY", strategy: "x", entry: 1.1, sl: 1.098, tps: [1.104, null, null], score: 80, reasons: [], pip: 0.0001, rr: 2, evidence: [], against: [], ...o });
const hb = (mode = "DEMO") => new URLSearchParams({ mode, server: "Demo-Server", currency: "USD", balance: "10000", equity: "10000", open: "0", ea: "1.0" });
const q = (o: Record<string, string>) => new URLSearchParams(o);

describe("ponte MT5", () => {
  it("desligada por padrão: nada é enfileirado nem entregue", async () => {
    const s = new MemoryStore();
    await poll(s, hb(), T);
    expect((await enqueue(s, opp(), T)).reason).toMatch(/desligada/);
    expect((await poll(s, hb(), T + 5)).orders).toEqual([]);
  });
  it("exige EA conectado e conta DEMO", async () => {
    const s = new MemoryStore(); await setEnabled(s, true, T);
    expect((await enqueue(s, opp(), T)).reason).toMatch(/desconectado/);
    await poll(s, hb("REAL"), T);
    expect((await enqueue(s, opp(), T + 1)).reason).toMatch(/não é DEMO/);
    expect((await poll(s, hb("REAL"), T + 2)).note).toMatch(/conta real/);
    await poll(s, hb(), T + 3);
    await poll(s, hb(), T + 3 + MT5_RULES.heartbeatFreshS + 1).catch(() => null);
    expect((await enqueue(s, opp(), T + 400)).reason).toMatch(/desconectado/); // sinal de vida velho
  });
  it("fluxo completo: enfileira, entrega UMA vez, executa, fecha; avisos repetidos não duplicam", async () => {
    const s = new MemoryStore(); await setEnabled(s, true, T); await poll(s, hb(), T);
    expect((await enqueue(s, opp(), T + 1)).queued).toBe(true);
    expect((await enqueue(s, opp(), T + 2)).queued).toBe(false);                       // mesma ordem
    expect((await enqueue(s, opp({ id: "EURUSD-2" }), T + 2)).reason).toMatch(/ativa/); // mesmo par
    const first = await poll(s, hb(), T + 5);
    expect(first.orders).toHaveLength(1);
    expect(toText(first)).toBe("NOTE|ok\nORDER|EURUSD-1|EURUSD|BUY|1.1|1.098|1.104|0.5|3600\n");
    expect((await poll(s, hb(), T + 10)).orders).toHaveLength(0);                      // não entrega de novo
    expect((await report(s, q({ id: "EURUSD-1", type: "executed", ticket: "123", price: "1.1001", volume: "0.25" }), T + 11)).ok).toBe(true);
    expect((await report(s, q({ id: "EURUSD-1", type: "executed", ticket: "123", price: "1.1001", volume: "0.25" }), T + 12)).note).toBe("já registrada");
    expect((await report(s, q({ id: "EURUSD-1", type: "rejected", reason: "x" }), T + 13)).ok).toBe(false); // não rebaixa executada
    expect((await report(s, q({ id: "EURUSD-1", type: "closed", profit: "12.5" }), T + 900)).ok).toBe(true);
    expect((await report(s, q({ id: "EURUSD-1", type: "closed", profit: "99" }), T + 901)).note).toBe("já registrada");
    const v = publicView(await loadMt5(s), T + 905);
    expect(v.counts.closed).toBe(1); expect(v.profit).toBe(12.5); expect(v.orders[0].volume).toBe(0.25);
    expect(JSON.stringify(v)).not.toMatch(/10000/); // saldo não vai para a página
    await poll(s, hb(), T + 905);
    expect((await enqueue(s, opp({ id: "EURUSD-2" }), T + 906)).queued).toBe(true);    // par liberado depois de fechar
  });
  it("ordem não buscada a tempo expira e libera o par; rejeição também", async () => {
    const s = new MemoryStore(); await setEnabled(s, true, T); await poll(s, hb(), T);
    await enqueue(s, opp(), T + 1);
    await poll(s, new URLSearchParams({ ...Object.fromEntries(hb()), mode: "DEMO" }), T + 1); // entregue
    await report(s, q({ id: "EURUSD-1", type: "rejected", reason: "spread alto" }), T + 2);
    expect((await loadMt5(s)).orders[0].status).toBe("REJECTED");
    await enqueue(s, opp({ id: "EURUSD-3" }), T + 3);
    await setEnabled(s, false, T + 4);                                                // desligou antes do EA buscar
    expect((await poll(s, hb(), T + 5)).orders).toEqual([]);
    await poll(s, hb(), T + 5 + MT5_RULES.orderTtlS);
    expect((await loadMt5(s)).orders.find((o) => o.id === "EURUSD-3")!.status).toBe("EXPIRED");
  });
});

describe("rotas do EA", () => {
  const env = { MT5_BRIDGE_TOKEN: "tok-mt5-123456", AGENT_ADMIN_TOKEN: "adm-123456" };
  const call = (store: MemoryStore, action: string, body: string, token?: string, now = T) => handleAgent(new Request(`http://x/api/agent?action=${action}`, { method: "POST", body, headers: token ? { authorization: `Bearer ${token}` } : {} }), { store, env, now: () => now * 1000 });
  it("sem token ou com token errado = 401; sem configurar = 503", async () => {
    const s = new MemoryStore();
    expect((await call(s, "mt5-poll", hb().toString())).status).toBe(401);
    expect((await call(s, "mt5-poll", hb().toString(), "errado")).status).toBe(401);
    expect((await handleAgent(new Request("http://x/api/agent?action=mt5-poll", { method: "POST", body: "" }), { store: s, env: {} })).status).toBe(503);
  });
  it("ligar pela rota de controle, EA busca em texto e o escritório vê o estado", async () => {
    const s = new MemoryStore();
    const on = await handleAgent(new Request("http://x/api/agent?action=control", { method: "POST", body: JSON.stringify({ op: "mt5-on" }), headers: { authorization: "Bearer adm-123456" } }), { store: s, env, now: () => T * 1000 });
    expect((await on.json()).mt5.enabled).toBe(true);
    const r = await call(s, "mt5-poll", hb().toString(), env.MT5_BRIDGE_TOKEN);
    expect(r.headers.get("content-type")).toMatch(/text\/plain/);
    expect(await r.text()).toBe("NOTE|ok\n");
    await enqueue(s, opp(), T + 1);
    expect(await (await call(s, "mt5-poll", hb().toString(), env.MT5_BRIDGE_TOKEN, T + 2)).text()).toMatch(/^NOTE\|ok\nORDER\|EURUSD-1\|/);
    expect((await call(s, "mt5-report", "id=EURUSD-1&type=executed&ticket=9&price=1.1&volume=0.1", env.MT5_BRIDGE_TOKEN, T + 3)).status).toBe(200);
    expect((await call(s, "mt5-report", "id=nada&type=executed", env.MT5_BRIDGE_TOKEN, T + 3)).status).toBe(409);
    const z = await (await handleAgent(new Request("http://x/api/agent?action=zyon"), { store: s, env, now: () => (T + 4) * 1000 })).json();
    expect(z.mt5.connected).toBe(true); expect(z.mt5.mode).toBe("DEMO"); expect(z.mt5.counts.executed).toBe(1);
  });
});
