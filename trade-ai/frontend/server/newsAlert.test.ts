import { describe, expect, it } from "vitest";
import { currenciesForAsset, newsAlertFor } from "./newsAlert.js";

const now = 1_800_000_000;
const ev = (min: number, impact: number, country = "USD", title = "Payroll") => ({ at: now + min * 60, title, country, impact });

describe("alerta de notícia (2+ estrelas, ±15 min)", () => {
  it("alerta para notícia média ou alta da moeda do par na janela, inclusive na hora exata", () => {
    for (const m of [-15, -5, 0, 10, 15]) expect(newsAlertFor(["EUR", "USD"], [ev(m, 2)], now).level).toBe("alerta");
    expect(newsAlertFor(["EUR", "USD"], [ev(0, 3)], now).events[0].minutes).toBe(0);
  });
  it("não alerta para 1 estrela, fora da janela ou de outra moeda", () => {
    expect(newsAlertFor(["EUR", "USD"], [ev(0, 1)], now).level).toBeNull();
    expect(newsAlertFor(["EUR", "USD"], [ev(16, 3), ev(-16, 3)], now).level).toBeNull();
    expect(newsAlertFor(["EUR", "USD"], [ev(0, 3, "JPY")], now).level).toBeNull();
  });
  it("calendário indisponível também avisa; próxima notícia forte vem como informação", () => {
    expect(newsAlertFor(["EUR", "USD"], null, now).level).toBe("sem_calendario");
    const a = newsAlertFor(["EUR", "USD"], [ev(90, 3, "EUR", "BCE")], now);
    expect(a.level).toBeNull(); expect(a.next?.title).toBe("BCE");
  });
  it("moedas do ativo", () => {
    expect(currenciesForAsset("EUR/USD")).toEqual(["EUR", "USD"]);
    expect(currenciesForAsset("XAUUSD")).toEqual(["XAU", "USD"]);
    expect(currenciesForAsset("USOIL")).toEqual(["USD"]);
  });
});
