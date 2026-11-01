import { afterEach, describe, expect, it, vi } from "vitest";
import { handleFeed, parseNews } from "./feed";

const rss = `<?xml version="1.0"?><rss><channel>
<item><title>Ibovespa fecha em alta com bancos - InfoMoney</title><link>javascript:alert(1)</link><pubDate>Sat, 31 Oct 2026 20:00:00 GMT</pubDate><source url="x">InfoMoney</source></item>
<item><title><![CDATA[Bitcoin passa de US$ 77 mil &amp; altcoins sobem - Valor]]></title><link>https://news.google.com/rss/articles/abc?oc=5</link><pubDate>Sat, 31 Oct 2026 22:00:00 GMT</pubDate><source url="y">Valor</source></item>
</channel></rss>`;

afterEach(() => vi.unstubAllGlobals());

describe("notícias", () => {
  it("tira a fonte do título, decodifica e ordena da mais nova", () => {
    const n = parseNews(rss);
    expect(n[0]).toEqual({ title: "Bitcoin passa de US$ 77 mil & altcoins sobem", source: "Valor", at: Date.UTC(2026, 9, 31, 22) / 1000, link: "https://news.google.com/rss/articles/abc?oc=5" });
    expect(n[1].title).toBe("Ibovespa fecha em alta com bancos");
    expect(n[1].link).toBe(""); // link que não é https é descartado
  });
});

describe("API /api/feed", () => {
  it("junta cotações e notícias", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("binance")) return new Response(JSON.stringify([
        { symbol: "BTCUSDT", lastPrice: "77480.12", priceChangePercent: "1.25" },
        { symbol: "ETHUSDT", lastPrice: "3100.5", priceChangePercent: "-0.8" },
      ]));
      return new Response(rss);
    }));
    const body = await (await handleFeed()).json();
    expect(body.quotes).toEqual([{ symbol: "BTC", price: 77480.12, change: 1.25 }, { symbol: "ETH", price: 3100.5, change: -0.8 }]);
    expect(body.news).toHaveLength(2);
    expect(body.errors).toEqual([]);
  });
  it("uma fonte fora do ar não derruba a outra", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("binance") ? new Response("x", { status: 500 }) : new Response(rss))));
    const body = await (await handleFeed()).json();
    expect(body.quotes).toEqual([]);
    expect(body.news).toHaveLength(2);
    expect(body.errors[0]).toMatch(/Binance 500/);
  });
});
