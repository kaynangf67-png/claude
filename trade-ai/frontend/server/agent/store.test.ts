import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newDay, openTrade, closeTrade, brtDate } from "./risk2x0.js";
import { DEFAULT_CONFIG, MemoryStore, PgStore, storeFromEnv, type AlertRecord, type JournalTrade, type Store } from "./store.js";

const PG = process.env.TEST_DATABASE_URL;
const NOW = Date.parse("2026-11-03T13:00:00Z") / 1000;
const jt = (n: number, o: Partial<JournalTrade> = {}): JournalTrade => ({ id: `t${n}`, day: "2026-11-03", setupId: `s${n}`, symbol: "EURUSD", label: "EUR/USD", dir: "BUY", strategy: "BOS e reteste", strategyId: 3, openedAt: NOW + n, entry: 1.1, sl: 1.099, tps: [1.102, null, null], rr: [2, null, null], riskDist: 0.001, pip: 0.0001, score: 80, status: "OPEN", ...o });
const al = (key: string): AlertRecord => ({ key, setupId: "s", cls: "CONFIRMADA", day: "2026-11-03", at: NOW, title: "t", text: "x", sent: false });

function contract(name: string, make: () => Store) {
  describe(`contrato do Store: ${name}`, () => {
    let s: Store;
    beforeAll(async () => { s = make(); await s.migrate(); if (s instanceof PgStore) await s.pool.query("truncate agent_kv, agent_days, agent_trades, agent_alerts, agent_scans, agent_lease"); });
    afterAll(async () => { await s.close(); });
    it("config: padrão, gravação e execução real sempre desligada", async () => {
      expect((await s.getConfig()).enabledPairs).toHaveLength(10);
      await s.setConfig({ ...DEFAULT_CONFIG, paused: true, enabledPairs: ["EURUSD"] });
      const c = await s.getConfig();
      expect([c.paused, c.enabledPairs, c.execution.enabled]).toEqual([true, ["EURUSD"], false]);
      await s.setConfig({ ...DEFAULT_CONFIG, execution: { enabled: true, broker: "x" } as never });
      expect((await s.getConfig()).execution).toEqual({ enabled: false, broker: null }); // nada liga a execução por configuração
    });
    it("dia de risco persiste, volta idêntico e a escrita é compare-and-set", async () => {
      const d0 = newDay("2026-11-03");
      expect(await s.putDay(d0, null)).toBe(true);
      expect(await s.putDay(d0, null)).toBe(false);                    // não recria
      const d1 = openTrade(d0, { id: "t1", setupId: "s1", symbol: "EURUSD", dir: "BUY", openedAt: NOW }, NOW);
      expect(await s.putDay(d1, 0)).toBe(true);
      const d2 = closeTrade(d1, "t1", "LOSS", NOW, { r: -1.2 });
      expect(await s.putDay(d2, 0)).toBe(false);                       // versão velha perde a corrida
      expect(await s.putDay(d2, 1)).toBe(true);
      expect(await s.getDay("2026-11-03")).toEqual(d2);
      expect((await s.latestDay())!.trades[0].result).toBe("LOSS");    // o bloqueio sobrevive a "reiniciar" (nova conexão/leitura)
      await s.putDay(newDay("2026-11-04"), null);
      expect((await s.listDays(10)).map((d) => d.date)).toEqual(["2026-11-04", "2026-11-03"]);
      expect(brtDate(NOW)).toBe("2026-11-03");
    });
    it("diário de operações: grava, atualiza e filtra", async () => {
      await s.putTrade(jt(1)); await s.putTrade(jt(2, { day: "2026-11-04" }));
      await s.putTrade(jt(1, { status: "WIN", r: 1.6, brl: 8 }));
      expect((await s.getTrade("t1"))!.status).toBe("WIN");
      expect((await s.listTrades({ day: "2026-11-03" })).map((t) => t.id)).toEqual(["t1"]);
      expect((await s.listTrades({ status: "OPEN" })).map((t) => t.id)).toEqual(["t2"]);
      expect(await s.getTrade("nada")).toBeNull();
    });
    it("alertas: a mesma chave nunca é gravada duas vezes", async () => {
      expect(await s.addAlert(al("k1"))).toBe(true);
      expect(await s.addAlert(al("k1"))).toBe(false);
      await s.markAlert("k1", true);
      expect((await s.listAlerts(10))[0].sent).toBe(true);
      await s.markAlert("k1", false, "Telegram 500");
      expect((await s.listAlerts(10))[0].error).toBe("Telegram 500");
    });
    it("varreduras e trava de execução", async () => {
      await s.logScans([{ at: NOW, day: "2026-11-03", symbol: "EURUSD", label: "EUR/USD", decision: "NO_TRADE", state: "sem_operacao", cls: null, score: null, strategy: null, setupId: null, discard: "sem setup", dataAgeSec: 30 }]);
      expect((await s.listScans("2026-11-03"))).toHaveLength(1);
      expect(await s.acquireLease("tick", 60, NOW)).toBe(true);
      expect(await s.acquireLease("tick", 60, NOW + 10)).toBe(false);   // outra execução simultânea não passa
      expect(await s.acquireLease("tick", 60, NOW + 61)).toBe(true);    // trava vencida (execução anterior morreu)
      await s.releaseLease("tick");
      expect(await s.acquireLease("tick", 60, NOW + 62)).toBe(true);
    });
  });
}

contract("memória", () => new MemoryStore());
describe.skipIf(!PG)("PostgreSQL real", () => { contract("PostgreSQL", () => new PgStore(PG!)); });
describe("ambiente", () => {
  it("sem DATABASE_URL o agente se recusa a rodar, com o motivo", () => { expect(() => storeFromEnv({})).toThrow(/DATABASE_URL/); });
});
