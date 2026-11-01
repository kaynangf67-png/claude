import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCalendar, parseCalendar } from "./calendar";

const rows = [
  { title: "Non-Farm Employment Change", country: "USD", date: "2026-11-06T08:30:00-05:00", impact: "High", forecast: "110K", previous: "95K" },
  { title: "Bank Holiday", country: "JPY", date: "2026-11-03T00:00:00-05:00", impact: "Holiday", forecast: "", previous: "" },
  { title: "ECB President Speaks", country: "eur", date: "2026-11-03T00:00:00-05:00", impact: "Medium", forecast: "", previous: "" },
  { title: "", country: "USD", date: "2026-11-04T10:00:00-05:00", impact: "Low" },
  { title: "Sem data", country: "USD", date: "amanhã", impact: "Low" },
];

afterEach(() => vi.unstubAllGlobals());

describe("calendário econômico", () => {
  it("converte impacto em estrelas, ordena por horário e descarta linhas inválidas", () => {
    const ev = parseCalendar(rows);
    expect(ev.map((e) => e.title)).toEqual(["ECB President Speaks", "Bank Holiday", "Non-Farm Employment Change"]);
    expect(ev[0]).toMatchObject({ country: "EUR", impact: 2 });
    expect(ev[1].impact).toBe(0);
    expect(ev[2]).toEqual({ at: Date.UTC(2026, 10, 6, 13, 30) / 1000, title: "Non-Farm Employment Change", country: "USD", impact: 3, forecast: "110K", previous: "95K" });
  });

  it("recusa formato inesperado", () => {
    expect(() => parseCalendar({ erro: true })).toThrow();
  });

  it("API devolve os eventos e, se a fonte cair, 502 sem cache", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(rows))));
    const ok = await handleCalendar();
    expect(ok.headers.get("cache-control")).toMatch(/s-maxage=1800/);
    expect((await ok.json()).events).toHaveLength(3);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("limite", { status: 429 })));
    const bad = await handleCalendar();
    expect(bad.status).toBe(502);
    expect(bad.headers.get("cache-control")).toBe("no-store");
  });
});
