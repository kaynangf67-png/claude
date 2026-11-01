/** Painel do escritório: cotações de cripto (Binance) e manchetes recentes (Google Notícias, pt-BR). */

const PAIRS = [
  ["BTCUSDT", "BTC"], ["ETHUSDT", "ETH"], ["SOLUSDT", "SOL"],
  ["XRPUSDT", "XRP"], ["BNBUSDT", "BNB"], ["LTCUSDT", "LTC"],
] as const;

const NEWS_URL =
  "https://news.google.com/rss/search?q=" +
  encodeURIComponent("mercado financeiro OR bolsa de valores OR corretora OR ibovespa OR bitcoin OR dólar when:1d") +
  "&hl=pt-BR&gl=BR&ceid=BR:pt-419";

export interface Quote { symbol: string; price: number; change: number }
export interface Headline { title: string; source: string; at: number; link: string }

export async function fetchQuotes(): Promise<Quote[]> {
  const symbols = encodeURIComponent(JSON.stringify(PAIRS.map(([p]) => p)));
  const res = await fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${symbols}`);
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const rows = (await res.json()) as { symbol: string; lastPrice: string; priceChangePercent: string }[];
  return PAIRS.flatMap(([pair, symbol]) => {
    const r = rows.find((x) => x.symbol === pair);
    return r ? [{ symbol, price: Number(r.lastPrice), change: Number(r.priceChangePercent) }] : [];
  });
}

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();

/** Lê o RSS e devolve as manchetes mais recentes primeiro. O título do Google vem como "Manchete - Fonte". */
export function parseNews(xml: string, limit = 12): Headline[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const out = items.map((it) => {
    const tag = (t: string) => decode(it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? "");
    const source = tag("source");
    let title = tag("title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const link = tag("link");
    // só links https: o painel abre esse endereço numa nova aba
    return { title, source, at: Math.floor(Date.parse(tag("pubDate")) / 1000) || 0, link: /^https:\/\//.test(link) ? link : "" };
  }).filter((h) => h.title);
  out.sort((a, b) => b.at - a.at);
  return out.slice(0, limit);
}

export async function fetchNews(): Promise<Headline[]> {
  const res = await fetch(NEWS_URL, { headers: { "user-agent": "Mozilla/5.0 (TradeAI painel)" } });
  if (!res.ok) throw new Error(`Notícias ${res.status}`);
  return parseNews(await res.text());
}

export async function handleFeed(): Promise<Response> {
  const [q, n] = await Promise.allSettled([fetchQuotes(), fetchNews()]);
  const body = {
    quotes: q.status === "fulfilled" ? q.value : [],
    news: n.status === "fulfilled" ? n.value : [],
    errors: [q, n].flatMap((r) => (r.status === "rejected" ? [String((r.reason as Error).message)] : [])),
    at: Math.floor(Date.now() / 1000),
  };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "public, s-maxage=15, stale-while-revalidate=30" },
  });
}
