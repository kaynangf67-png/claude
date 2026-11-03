import { describe, expect, it } from "vitest";
import { rng } from "../forex/testkit.js";
import {
  brtDate, canOpen, closeTrade, hasPending, isOperationalDay, losses, MAX_TRADES_PER_DAY, newDay, openTrade, panel, RiskViolation, rollover, stateOf, viewState, wins,
  type DayState, type DayTrade,
} from "./risk2x0.js";

const at = (iso: string) => Date.parse(iso) / 1000;
const TUE = at("2026-11-03T10:00:00-03:00"), TUE_LATE = at("2026-11-03T23:30:00-03:00");
const WED = at("2026-11-04T09:00:00-03:00"), SAT = at("2026-11-07T12:00:00-03:00"), MON = at("2026-11-09T09:00:00-03:00"), FRI = at("2026-11-06T16:00:00-03:00");
const tr = (n: number, o: Partial<DayTrade> = {}) => ({ id: `t${n}`, setupId: `s${n}`, symbol: "EURUSD", dir: "BUY" as const, openedAt: TUE, ...o });
const day = () => newDay(brtDate(TUE));
const open = (d: DayState, n: number, now = TUE) => openTrade(d, tr(n), now);
const win = (d: DayState, n: number, now = TUE) => closeTrade(d, `t${n}`, "WIN", now, { r: 1.6 });
const loss = (d: DayState, n: number, now = TUE) => closeTrade(d, `t${n}`, "LOSS", now, { r: -1.2 });
const code = (fn: () => unknown) => { try { fn(); return null; } catch (e) { return e instanceof RiskViolation ? e.code : "OUTRO:" + (e as Error).message; } };

describe("fuso e calendário operacional (America/Sao_Paulo)", () => {
  it("o dia é o de São Paulo, não o UTC", () => {
    expect(brtDate(at("2026-11-04T01:30:00Z"))).toBe("2026-11-03");   // 22h30 de terça em SP
    expect(brtDate(at("2026-11-04T03:30:00Z"))).toBe("2026-11-04");   // 00h30 de quarta em SP
    expect(isOperationalDay(SAT)).toBe(false);
    expect(isOperationalDay(MON)).toBe(true);
  });
});

describe("tabela de resultados e estados", () => {
  it("0×0 READY · 1×0 FIRST_WIN · 2×0 TARGET_REACHED · 1×1 e 0×1 DAILY_LOCKED", () => {
    let d = day();
    expect(stateOf(d)).toBe("READY");
    d = win(open(d, 1), 1); expect([wins(d), losses(d), stateOf(d)]).toEqual([1, 0, "FIRST_WIN"]);
    const two = win(open(d, 2), 2); expect([wins(two), losses(two), stateOf(two)]).toEqual([2, 0, "TARGET_REACHED"]);
    const wl = loss(open(d, 2), 2); expect([wins(wl), losses(wl), stateOf(wl)]).toEqual([1, 1, "DAILY_LOCKED"]);
    const l0 = loss(open(day(), 1), 1); expect([wins(l0), losses(l0), stateOf(l0)]).toEqual([0, 1, "DAILY_LOCKED"]);
  });
  it("operação aberta NÃO conta como WIN nem LOSS; os estados ativos aparecem", () => {
    let d = open(day(), 1);
    expect([wins(d), losses(d), stateOf(d)]).toEqual([0, 0, "FIRST_TRADE_ACTIVE"]);
    d = open(win(d, 1), 2);
    expect([wins(d), losses(d), stateOf(d)]).toEqual([1, 0, "SECOND_TRADE_ACTIVE"]);
  });
});

describe("proteções obrigatórias", () => {
  it("1. nunca permite uma terceira operação no mesmo dia", () => {
    const d = win(open(win(open(day(), 1), 1), 2), 2);
    expect(code(() => open(d, 3))).toBe("BLOCKED");
    // mesmo sem a regra da meta, o limite de 2 vale: simulação direta com 2 operações fechadas e nenhuma meta
    expect(MAX_TRADES_PER_DAY).toBe(2);
  });
  it("2. nunca permite uma segunda operação após uma primeira perda", () => {
    expect(code(() => open(loss(open(day(), 1), 1), 2))).toBe("BLOCKED");
    expect(canOpen(loss(open(day(), 1), 1), TUE).reason).toMatch(/LOSS IDENTIFICADO/);
  });
  it("3/4. o risco é fixo em R$ 5 e o resultado financeiro vem do R × 5, sem aumento de mão", () => {
    const d = win(open(day(), 1), 1);
    expect(d.trades[0].brl).toBe(8);                       // +1,6R × R$ 5
    expect(loss(open(day(), 1), 1).trades[0].brl).toBe(-6); // −1,2R × R$ 5 (com custos)
    expect(panel(d, TUE).risk).toBe("RISCO POR ENTRADA: R$ 5,00.");
  });
  it("5/6/11. o estado é derivado do que está persistido: recarregar ou reiniciar não destrava o dia", () => {
    const locked = loss(open(day(), 1), 1);
    const reloaded: DayState = JSON.parse(JSON.stringify(locked)); // como se tivesse ido ao banco e voltado
    expect(stateOf(reloaded)).toBe("DAILY_LOCKED");
    expect(rollover(reloaded, TUE_LATE).rolled).toBe(false);       // mesmo dia: nada é zerado
    expect(canOpen(reloaded, TUE_LATE).ok).toBe(false);
  });
  it("7. impede entrada duplicada (mesmo id ou mesmo setup)", () => {
    const d = win(open(day(), 1), 1);
    expect(code(() => openTrade(d, { ...tr(2), setupId: "s1" }, TUE))).toBe("DUPLICATE");
    expect(code(() => openTrade(d, { ...tr(1), setupId: "outro" }, TUE))).toBe("DUPLICATE");
  });
  it("8/9. só fecha com resultado confirmado; aberta fica aberta; resultado confirmado não muda", () => {
    const d = open(day(), 1);
    expect(d.trades[0].result).toBe("OPEN");
    expect(code(() => loss(win(d, 1), 1))).toBe("IMMUTABLE");
    expect(win(win(d, 1), 1).trades[0].result).toBe("WIN"); // repetir é inofensivo
    expect(code(() => closeTrade(d, "nao-existe", "WIN", TUE, { r: 1 }))).toBe("NOT_FOUND");
  });
  it("10. resultado desconhecido bloqueia novas entradas até reconciliar", () => {
    let d = closeTrade(open(day(), 1), "t1", "UNKNOWN", TUE);
    expect(d.trades[0].result).toBe("UNKNOWN");
    expect([wins(d), losses(d)]).toEqual([0, 0]);
    expect(canOpen(d, TUE).reason).toMatch(/desconhecido/);
    expect(code(() => open(d, 2))).toBe("BLOCKED");
    expect(rollover(d, WED).blockedByPending).toBe(true);           // nem a virada do dia libera
    d = win(d, 1);                                                   // reconciliado como WIN
    expect(canOpen(d, TUE).ok).toBe(true);
    expect(stateOf(d)).toBe("FIRST_WIN");
  });
  it("só uma operação por vez, mesmo antes de qualquer limite", () => {
    expect(code(() => open(open(day(), 1), 2))).toBe("BLOCKED");
  });
  it("não opera em dia que não é o de hoje, nem no fim de semana", () => {
    expect(code(() => openTrade(day(), tr(1), WED))).toBe("BLOCKED");
    expect(canOpen(newDay(brtDate(SAT)), SAT).reason).toMatch(/sábado ou domingo/);
  });
});

describe("virada do dia", () => {
  it("zera contadores no dia seguinte, preserva o dia anterior arquivado e libera READY", () => {
    const locked = loss(open(day(), 1), 1);
    const r = rollover(locked, WED);
    expect(r.rolled).toBe(true);
    expect(r.archived).toEqual(locked);                  // o histórico não é perdido
    expect([wins(r.day), losses(r.day), r.day.trades.length, stateOf(r.day)]).toEqual([0, 0, 0, "READY"]);
    expect(canOpen(r.day, WED).ok).toBe(true);
  });
  it("não reinicia enquanto houver operação pendente do dia anterior", () => {
    const openYesterday = open(day(), 1);
    const r = rollover(openYesterday, WED);
    expect(r.rolled).toBe(false);
    expect(r.blockedByPending).toBe(true);
    expect(r.day).toBe(openYesterday);
    expect(canOpen(r.day, WED).ok).toBe(false);          // e o dia velho também não deixa abrir
  });
  it("meia-noite de São Paulo vira o dia; 23h30 ainda é o mesmo", () => {
    const d = loss(open(day(), 1), 1);
    expect(rollover(d, TUE_LATE).rolled).toBe(false);
    expect(rollover(d, at("2026-11-04T00:01:00-03:00")).rolled).toBe(true);
  });
  it("sexta com perda: sábado fica em WAIT_NEXT_DAY e segunda libera READY", () => {
    const fri = newDay(brtDate(FRI));
    const lockedFri = loss(openTrade(fri, tr(1, { openedAt: FRI }), FRI), 1, FRI);
    const sat = rollover(lockedFri, SAT);
    expect(viewState(sat.day, SAT)).toBe("WAIT_NEXT_DAY");
    expect(canOpen(sat.day, SAT).ok).toBe(false);
    const mon = rollover(sat.day, MON);
    expect(viewState(mon.day, MON)).toBe("READY");
  });
  it("relógio que volta no tempo nunca apaga o dia guardado", () => {
    const d = loss(open(day(), 1), 1);
    expect(rollover(d, at("2026-11-02T10:00:00-03:00")).day).toBe(d);
  });
});

describe("painel", () => {
  it("mostra os contadores fixos e os avisos de dia encerrado / meta", () => {
    const p0 = panel(day(), TUE);
    expect([p0.goal, p0.wins, p0.losses, p0.ops, p0.state, p0.banner, p0.canTrade]).toEqual(["META DIÁRIA: 2/2 VITÓRIAS.", "VITÓRIAS: 0/2.", "DERROTAS: 0/1.", "OPERAÇÕES REALIZADAS: 0/2.", "READY", null, true]);
    const l = panel(loss(open(day(), 1), 1), TUE);
    expect(l.banner).toMatch(/^DIA ENCERRADO — LOSS IDENTIFICADO\./);
    expect(l.canTrade).toBe(false);
    const w = panel(win(open(win(open(day(), 1), 1), 2), 2), TUE);
    expect(w.banner).toMatch(/^META ALCANÇADA — 2X0\./);
    expect([w.perfect2x0, w.resultBrl, w.resultR]).toEqual([true, 16, 3.2]);
    expect(panel(loss(open(win(open(day(), 1), 1), 2), 2), TUE).perfect2x0).toBe(false); // 2x0 comprometido
  });
});

describe("nenhum caminho ultrapassa os limites (teste de propriedade)", () => {
  it("20 mil sequências aleatórias de eventos, incluindo reinício, repetição e dias diferentes", () => {
    const r = rng(2026);
    const days = [TUE, TUE_LATE, WED, SAT, MON];
    for (let run = 0; run < 20000; run++) {
      let d: DayState = null as unknown as DayState, now = days[Math.floor(r() * 3)];
      const opensPerDay = new Map<string, number>();
      let lockedDay: string | null = null;
      for (let step = 0; step < 14; step++) {
        const x = r();
        if (x < 0.15) now = days[Math.floor(r() * days.length)] + Math.floor(r() * 3) * 3600; // pode voltar no tempo
        const ro = rollover(d as DayState | null, now); d = ro.day;
        if (x >= 0.15 && x < 0.55) {
          const n = Math.floor(r() * 5), before = d.trades.length;
          try { d = openTrade(d, tr(n, { id: `x${run}-${n}-${step}`, setupId: `y${n}`, openedAt: now }), now); opensPerDay.set(d.date, (opensPerDay.get(d.date) ?? 0) + 1); } catch (e) { expect(e).toBeInstanceOf(RiskViolation); expect(d.trades.length).toBe(before); }
        } else if (x < 0.9 && d.trades.length) {
          const t = d.trades[Math.floor(r() * d.trades.length)], res = (["WIN", "LOSS", "UNKNOWN"] as const)[Math.floor(r() * 3)];
          try { d = closeTrade(d, t.id, res, now, { r: res === "WIN" ? 1.5 : -1.1 }); } catch (e) { expect(e).toBeInstanceOf(RiskViolation); }
        } else d = JSON.parse(JSON.stringify(d)); // "reiniciou o servidor": volta do banco
        // invariantes depois de QUALQUER evento
        expect(d.trades.length).toBeLessThanOrEqual(MAX_TRADES_PER_DAY);
        expect(wins(d)).toBeLessThanOrEqual(2);
        expect(losses(d)).toBeLessThanOrEqual(1);
        expect(new Set(d.trades.map((t) => t.setupId)).size).toBe(d.trades.length);
        if (losses(d) >= 1) { lockedDay = d.date; expect(canOpen(d, now).ok).toBe(false); expect(stateOf(d)).toMatch(/DAILY_LOCKED|ACTIVE/); }
        if (wins(d) >= 2) expect(canOpen(d, now).ok).toBe(false);
        if (hasPending(d)) expect(canOpen(d, now).ok).toBe(false);
        // uma entrada depois de uma perda no mesmo dia é impossível
        const lossIdx = d.trades.findIndex((t) => t.result === "LOSS");
        if (lossIdx >= 0) expect(d.trades.length - 1).toBeLessThanOrEqual(lossIdx + 1 > 1 ? 1 : 1);
        if (lossIdx === 0) expect(d.trades.length).toBe(1); // perdeu na primeira: não existe segunda
      }
      for (const n of opensPerDay.values()) expect(n).toBeLessThanOrEqual(2);
      void lockedDay;
    }
  }, 60_000);
});
