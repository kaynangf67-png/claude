import { describe, expect, it } from "vitest";
import { LOCK_S, applyResult, canTrade, expiryFor, newDesk, refresh, settle, type Trade } from "./desk";

const T0 = Date.UTC(2026, 9, 31, 15, 2, 0) / 1000; // sábado 12h02 em Brasília
const trade = (o: Partial<Trade> = {}): Trade => ({
  id: "t", asset: "BTCUSD", direction: "CALL", entryPrice: 100, entryAt: T0, expiry: expiryFor(T0, 1),
  stake: 10, payout: 0.85, reasons: [], ...o,
});
const won = (o: Partial<Trade> = {}) => ({ ...trade(o), result: "win" as const, profit: 8.5 });
const lost = (o: Partial<Trade> = {}) => ({ ...trade(o), result: "loss" as const, profit: -10 });

describe("expiração", () => {
  it("fecha na vela atual se faltar 2,5 min ou mais", () => {
    expect(expiryFor(T0, 1)).toBe(Date.UTC(2026, 9, 31, 15, 5, 0) / 1000);
    expect(expiryFor(T0, 3)).toBe(Date.UTC(2026, 9, 31, 15, 15, 0) / 1000);
  });
  it("pula para a próxima vela se faltar menos de 2,5 min", () => {
    expect(expiryFor(T0 + 160, 1)).toBe(Date.UTC(2026, 9, 31, 15, 10, 0) / 1000);
  });
});

describe("resultado", () => {
  const exp = expiryFor(T0, 1);
  const candle = (close: number, closed = true) => [{ time: exp - 300, open: 99, high: 102, low: 98, close, closed }];
  it("CALL ganha se fechar acima, PUT se fechar abaixo, igual é empate", () => {
    expect(settle(trade(), candle(101))?.result).toBe("win");
    expect(settle(trade(), candle(99))?.result).toBe("loss");
    expect(settle(trade({ direction: "PUT" }), candle(99))?.result).toBe("win");
    expect(settle(trade(), candle(100))?.result).toBe("empate");
  });
  it("espera a vela da expiração fechar", () => {
    expect(settle(trade(), candle(101, false))).toBeNull();
    expect(settle(trade(), [])).toBeNull();
  });
  it("lucro pelo payout, perda do valor da entrada", () => {
    expect(settle(trade(), candle(101))?.profit).toBeCloseTo(8.5);
    expect(settle(trade(), candle(99))?.profit).toBe(-10);
  });
});

describe("regras da mesa", () => {
  it("5 wins travam por 24 horas", () => {
    let d = { ...newDesk("m1", "Lia", "BTCUSD", T0), on: true };
    for (let i = 0; i < 5; i++) d = applyResult(d, won(), T0 + i);
    expect(d.wins).toBe(5);
    expect(d.lockUntil).toBe(T0 + 4 + LOCK_S);
    expect(d.lockReason).toMatch(/5 acertos/);
    expect(canTrade(d, T0 + 3600)).toBe(false);
    expect(d.balance).toBeCloseTo(1000 + 5 * 8.5);
  });
  it("2 losses travam por 24 horas, mesmo sem bater a meta", () => {
    let d = { ...newDesk("m1", "Lia", "BTCUSD", T0), on: true };
    d = applyResult(d, won(), T0);
    d = applyResult(d, lost(), T0 + 1);
    expect(d.lockUntil).toBeNull();
    d = applyResult(d, lost(), T0 + 2);
    expect(d.lockReason).toMatch(/2 erros/);
    expect(canTrade(d, T0 + LOCK_S)).toBe(false);
  });
  it("depois de 24 horas destrava e zera o placar do dia", () => {
    let d = { ...newDesk("m1", "Lia", "BTCUSD", T0), on: true };
    d = applyResult(applyResult(d, lost(), T0), lost(), T0);
    d = refresh(d, T0 + LOCK_S + 1);
    expect(d.lockUntil).toBeNull();
    expect(d.wins + d.losses).toBe(0);
    expect(canTrade(d, T0 + LOCK_S + 1)).toBe(true);
  });
  it("empate não conta", () => {
    let d = newDesk("m1", "Lia", "BTCUSD", T0);
    d = applyResult(d, { ...trade(), result: "empate", profit: 0 }, T0);
    expect(d.wins + d.losses).toBe(0);
  });
  it("sem trava, o placar zera na virada do dia", () => {
    let d = newDesk("m1", "Lia", "BTCUSD", T0);
    d = applyResult(d, lost(), T0);
    d = refresh(d, T0 + 13 * 3600); // dia seguinte em Brasília
    expect(d.losses).toBe(0);
  });
  it("mesa desligada ou com operação aberta não opera", () => {
    const d = newDesk("m1", "Lia", "BTCUSD", T0);
    expect(canTrade(d, T0)).toBe(false);
    expect(canTrade({ ...d, on: true, open: trade() }, T0)).toBe(false);
    expect(canTrade({ ...d, on: true }, T0)).toBe(true);
  });
});
