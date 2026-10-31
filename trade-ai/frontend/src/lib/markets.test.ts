import { describe, expect, it } from "vitest";
import { findAsset, marketState } from "./markets";

const eur = findAsset("EURUSD");
const gold = findAsset("XAUUSD");
const btc = findAsset("BTCUSD");
// horário de verão de NY (EDT, UTC-4) até 1/11/2026
const at = (iso: string) => new Date(iso);

describe("horário dos mercados", () => {
  it("sábado: forex e commodities fechados, cripto aberto", () => {
    const sat = at("2026-10-31T05:43:00Z"); // sábado 02h43 em Brasília
    expect(marketState(eur, sat).open).toBe(false);
    expect(marketState(gold, sat).open).toBe(false);
    expect(marketState(btc, sat).open).toBe(true);
  });
  it("sexta: forex fecha às 17h de Nova York", () => {
    expect(marketState(eur, at("2026-10-30T20:59:00Z")).open).toBe(true); // 16h59 NY
    expect(marketState(eur, at("2026-10-30T21:01:00Z")).open).toBe(false); // 17h01 NY
  });
  it("domingo: forex reabre às 17h e ouro às 18h de Nova York", () => {
    expect(marketState(eur, at("2026-11-01T21:30:00Z")).open).toBe(false); // 16h30 NY (EST)
    expect(marketState(eur, at("2026-11-01T22:10:00Z")).open).toBe(true); // 17h10 NY
    expect(marketState(gold, at("2026-11-01T22:10:00Z")).open).toBe(false);
    expect(marketState(gold, at("2026-11-01T23:10:00Z")).open).toBe(true); // 18h10 NY
  });
  it("commodities têm pausa diária das 17h às 18h", () => {
    expect(marketState(gold, at("2026-11-03T22:30:00Z")).open).toBe(false); // terça 17h30 NY
    expect(marketState(gold, at("2026-11-03T23:30:00Z")).open).toBe(true);
    expect(marketState(eur, at("2026-11-03T22:30:00Z")).open).toBe(true);
  });
});
