import Anthropic from "@anthropic-ai/sdk";
import { fetchCalendar, type CalEvent } from "./calendar.js";
import { PLAYBOOK } from "./playbook.js";

/**
 * Entrada sugerida pela IA para um ativo, a partir das velas M5 reais (não de print).
 *  - Cripto: Binance (tempo real).
 *  - Forex e commodities: Yahoo Finance (gratuito, não oficial; pode ter alguns minutos de atraso).
 * Travas no servidor (não dependem da IA): dados atrasados/mercado parado, notícia de alto impacto perto
 * e sinal fraco viram NÃO OPERAR.
 */

const M5 = 300;

type Source = { kind: "binance"; symbol: string } | { kind: "yahoo"; symbol: string };
interface SignalAsset { label: string; source: Source; currencies: string[] }

export const SIGNAL_ASSETS: Record<string, SignalAsset> = {
  EURUSD: { label: "EUR/USD", source: { kind: "yahoo", symbol: "EURUSD=X" }, currencies: ["EUR", "USD"] },
  GBPUSD: { label: "GBP/USD", source: { kind: "yahoo", symbol: "GBPUSD=X" }, currencies: ["GBP", "USD"] },
  USDJPY: { label: "USD/JPY", source: { kind: "yahoo", symbol: "USDJPY=X" }, currencies: ["USD", "JPY"] },
  AUDUSD: { label: "AUD/USD", source: { kind: "yahoo", symbol: "AUDUSD=X" }, currencies: ["AUD", "USD"] },
  USDCAD: { label: "USD/CAD", source: { kind: "yahoo", symbol: "USDCAD=X" }, currencies: ["USD", "CAD"] },
  USDCHF: { label: "USD/CHF", source: { kind: "yahoo", symbol: "USDCHF=X" }, currencies: ["USD", "CHF"] },
  NZDUSD: { label: "NZD/USD", source: { kind: "yahoo", symbol: "NZDUSD=X" }, currencies: ["NZD", "USD"] },
  EURJPY: { label: "EUR/JPY", source: { kind: "yahoo", symbol: "EURJPY=X" }, currencies: ["EUR", "JPY"] },
  EURGBP: { label: "EUR/GBP", source: { kind: "yahoo", symbol: "EURGBP=X" }, currencies: ["EUR", "GBP"] },
  GBPJPY: { label: "GBP/JPY", source: { kind: "yahoo", symbol: "GBPJPY=X" }, currencies: ["GBP", "JPY"] },
  AUDCAD: { label: "AUD/CAD", source: { kind: "yahoo", symbol: "AUDCAD=X" }, currencies: ["AUD", "CAD"] },
  AUDJPY: { label: "AUD/JPY", source: { kind: "yahoo", symbol: "AUDJPY=X" }, currencies: ["AUD", "JPY"] },
  BTCUSD: { label: "BTC/USD", source: { kind: "binance", symbol: "BTCUSDT" }, currencies: ["USD"] },
  ETHUSD: { label: "ETH/USD", source: { kind: "binance", symbol: "ETHUSDT" }, currencies: ["USD"] },
  LTCUSD: { label: "LTC/USD", source: { kind: "binance", symbol: "LTCUSDT" }, currencies: ["USD"] },
  XAUUSD: { label: "Ouro (XAU/USD)", source: { kind: "yahoo", symbol: "GC=F" }, currencies: ["USD"] },
  XAGUSD: { label: "Prata (XAG/USD)", source: { kind: "yahoo", symbol: "SI=F" }, currencies: ["USD"] },
  USOIL: { label: "Petróleo (WTI)", source: { kind: "yahoo", symbol: "CL=F" }, currencies: ["USD"] },
};

export interface Candle { t: number; o: number; h: number; l: number; c: number }

export function parseBinance(rows: unknown): Candle[] {
  if (!Array.isArray(rows)) throw new Error("Velas em formato inesperado");
  return rows.map((r) => {
    const a = r as unknown[];
    return { t: Math.floor(Number(a[0]) / 1000), o: Number(a[1]), h: Number(a[2]), l: Number(a[3]), c: Number(a[4]) };
  }).filter((k) => [k.t, k.o, k.h, k.l, k.c].every(Number.isFinite));
}

interface YahooChart { chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[] } }[] } }

export function parseYahoo(body: unknown): Candle[] {
  const r = (body as YahooChart)?.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0];
  if (!r?.timestamp || !q) throw new Error("Velas em formato inesperado");
  const out: Candle[] = [];
  r.timestamp.forEach((t, i) => {
    const k = { t, o: q.open?.[i], h: q.high?.[i], l: q.low?.[i], c: q.close?.[i] };
    if ([k.o, k.h, k.l, k.c].every((v) => typeof v === "number" && Number.isFinite(v))) out.push(k as Candle);
  });
  return out;
}

export async function fetchCandles(src: Source): Promise<Candle[]> {
  const headers = { "user-agent": "Mozilla/5.0 (TradeAI sinal)" };
  if (src.kind === "binance") {
    const res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${src.symbol}&interval=5m&limit=150`, { headers });
    if (!res.ok) throw new Error(`Binance ${res.status}`);
    return parseBinance(await res.json());
  }
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(src.symbol)}?interval=5m&range=2d`, { headers });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  return parseYahoo(await res.json());
}

// ---------- indicadores ----------
export function ema(values: number[], n: number): number[] {
  const k = 2 / (n + 1), out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

/** RSI de Wilder. */
export function rsi(closes: number[], n = 14): number | null {
  if (closes.length <= n) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gain += d; else loss -= d; }
  gain /= n; loss /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n; loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

export function atr(c: Candle[], n = 14): number | null {
  if (c.length <= n) return null;
  const tr = c.slice(1).map((k, i) => Math.max(k.h - k.l, Math.abs(k.h - c[i].c), Math.abs(k.l - c[i].c)));
  return tr.slice(-n).reduce((a, b) => a + b, 0) / n;
}

export interface Indicators { price: number; ema9: number; ema21: number; rsi14: number | null; atr14: number | null; high20: number; low20: number }

export function indicators(c: Candle[]): Indicators {
  const closes = c.map((k) => k.c), last20 = c.slice(-20);
  return {
    price: closes[closes.length - 1],
    ema9: ema(closes, 9).at(-1)!, ema21: ema(closes, 21).at(-1)!,
    rsi14: rsi(closes), atr14: atr(c),
    high20: Math.max(...last20.map((k) => k.h)), low20: Math.min(...last20.map((k) => k.l)),
  };
}

/** Só velas fechadas: a última da fonte costuma ser a vela em formação. */
export const closedCandles = (c: Candle[], now: number) => c.filter((k) => k.t + M5 <= now);

/** Notícia de alto impacto (★★★) da moeda do ativo entre 15 min antes e 30 min depois de agora. */
export function newsBlock(events: CalEvent[], currencies: string[], now: number): CalEvent | null {
  return events.find((e) => e.impact === 3 && currencies.includes(e.country) && e.at >= now - 15 * 60 && e.at <= now + 30 * 60) ?? null;
}

// ---------- IA ----------
export interface AiReading {
  decision: "CALL" | "PUT" | "NAO_OPERAR";
  strength: number;
  expiry_candles: number;
  invalidation_price: number | null;
  target_price: number | null;
  reasons_for: string[];
  reasons_against: string[];
  summary: string;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decision", "strength", "expiry_candles", "invalidation_price", "target_price", "reasons_for", "reasons_against", "summary"],
  properties: {
    decision: { type: "string", enum: ["CALL", "PUT", "NAO_OPERAR"] },
    strength: { type: "integer", description: "0 a 100: força do sinal, não probabilidade de acerto" },
    expiry_candles: { type: "integer", description: "1 a 3 velas de 5 minutos" },
    invalidation_price: { anyOf: [{ type: "number" }, { type: "null" }], description: "preço que, se atingido, invalida a leitura" },
    target_price: { anyOf: [{ type: "number" }, { type: "null" }], description: "preço de referência para onde o movimento pode ir" },
    reasons_for: { type: "array", items: { type: "string" } },
    reasons_against: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
};

const SYSTEM_PROMPT = `Você é um analista técnico de gráfico de 5 minutos (M5) para opções binárias.
Recebe as últimas velas FECHADAS de um ativo e indicadores calculados no servidor. Responda só com o JSON pedido, em português do Brasil.
Referência de estratégias (hipóteses, não validadas):
${PLAYBOOK}
Regras:
- Decida CALL (alta), PUT (baixa) ou NAO_OPERAR para a PRÓXIMA vela de 5 minutos.
- Use somente os dados recebidos. Não invente preço, notícia ou indicador.
- strength de 0 a 100 mede a clareza do setup (tendência, momentum, estrutura de suporte/resistência, padrão das últimas velas). Não é probabilidade de acerto.
- Lateralização, velas de indecisão, RSI esticado contra a direção ou preço colado em suporte/resistência contrária pedem NAO_OPERAR ou strength baixa.
- invalidation_price: nível que, se o preço atingir, a leitura deixa de valer (abaixo do preço para CALL, acima para PUT). target_price: nível de referência no sentido da operação. Use null se não houver nível claro.
- expiry_candles entre 1 e 3.
- reasons_for e reasons_against: frases curtas e concretas, citando números quando possível. Seja honesto sobre o que pesa contra.
- Na dúvida, NAO_OPERAR. Em binárias com payout de 85% é preciso acertar mais de 54% só para empatar.`;

type Ask = (prompt: string) => Promise<AiReading>;

async function askClaude(prompt: string): Promise<AiReading> {
  const client = new Anthropic();
  const base = {
    model: "claude-opus-5-5",
    max_tokens: 8000,
    output_config: { effort: "medium" as const, format: { type: "json_schema" as const, schema: SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content: prompt }],
  };
  let response;
  try {
    // fallback no servidor: se o modelo recusar, outro modelo responde na mesma chamada
    response = await client.beta.messages.create({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (err) {
    // conta sem acesso a esse beta: tenta de novo sem o fallback
    if (err instanceof Anthropic.BadRequestError && /anthropic-beta|fallbacks/i.test(err.message)) response = await client.beta.messages.create(base);
    else throw err;
  }
  if (response.stop_reason === "refusal") throw new SignalError("A IA recusou analisar este ativo.", 422);
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  if (!text) throw new SignalError("Resposta vazia da IA", 502);
  return JSON.parse(text) as AiReading;
}

/** Mensagem de erro da API para o usuário: explica os casos comuns e mostra o texto original (nunca contém a chave). */
export function aiErrorText(err: { status?: number; message: string }): string {
  const m = err.message || "";
  if (/credit balance/i.test(m)) return "Sua conta da Anthropic está sem créditos. Adicione em console.anthropic.com → Billing.";
  return `Falha na IA (${err.status ?? "rede"}): ${m.replace(/\s+/g, " ").slice(0, 300)}`;
}

class SignalError extends Error { constructor(msg: string, public status: number) { super(msg); } }

const brt = (t: number) => new Date(t * 1000).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const fmt = (v: number) => Number(v.toPrecision(6));

export function buildPrompt(label: string, c: Candle[], ind: Indicators): string {
  const rows = c.slice(-48).map((k) => `${brt(k.t)} ${fmt(k.o)} ${fmt(k.h)} ${fmt(k.l)} ${fmt(k.c)}`).join("\n");
  return `Ativo: ${label} — gráfico M5 (horário de Brasília).
Indicadores na última vela fechada: preço ${fmt(ind.price)}, EMA9 ${fmt(ind.ema9)}, EMA21 ${fmt(ind.ema21)}, RSI14 ${ind.rsi14?.toFixed(1) ?? "n/d"}, ATR14 ${ind.atr14 ? fmt(ind.atr14) : "n/d"}, máxima 20 velas ${fmt(ind.high20)}, mínima 20 velas ${fmt(ind.low20)}.
Velas fechadas (hora abertura máxima mínima fechamento), da mais antiga para a mais recente:
${rows}`;
}

export interface Signal {
  asset: string; label: string; source: string; delayed: boolean;
  decision: "CALL" | "PUT" | "NAO_OPERAR"; strength: number;
  entry_at: number | null; expiry_at: number | null; expiry_candles: number | null;
  price: number; invalidation_price: number | null; target_price: number | null;
  reasons_for: string[]; reasons_against: string[]; summary: string; blocked_by: string | null; at: number;
}

/** Travas finais sobre a resposta da IA. */
export function applySignalGuards(r: AiReading, price: number) {
  const out = { ...r, reasons_for: r.reasons_for.slice(0, 5), reasons_against: r.reasons_against.slice(0, 5) };
  out.strength = Math.max(0, Math.min(100, Math.round(r.strength)));
  out.expiry_candles = Math.max(1, Math.min(3, Math.round(r.expiry_candles) || 1));
  let blocked: string | null = null;
  if (out.decision !== "NAO_OPERAR" && out.strength < 60) blocked = "Sinal fraco (força abaixo de 60).";
  else if (out.decision !== "NAO_OPERAR" && out.reasons_for.length < 2) blocked = "Menos de dois motivos a favor.";
  if (blocked) out.decision = "NAO_OPERAR";
  // níveis do lado errado do preço são descartados
  const up = out.decision === "CALL", down = out.decision === "PUT";
  if (out.invalidation_price !== null && !((up && out.invalidation_price < price) || (down && out.invalidation_price > price))) out.invalidation_price = null;
  if (out.target_price !== null && !((up && out.target_price > price) || (down && out.target_price < price))) out.target_price = null;
  return { reading: out, blocked };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function handleSignal(request: Request, deps: { ask?: Ask; now?: () => number; calendar?: () => Promise<CalEvent[]> } = {}): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  let body: { asset?: unknown };
  try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const id = typeof body.asset === "string" ? body.asset : "";
  const asset = SIGNAL_ASSETS[id];
  if (!asset) return json({ error: "Ativo desconhecido" }, 400);

  const now = Math.floor((deps.now ?? Date.now)() / 1000);
  const delayed = asset.source.kind === "yahoo";
  const source = delayed ? "Yahoo Finance (pode ter alguns minutos de atraso)" : "Binance (tempo real)";
  const base = { asset: id, label: asset.label, source, delayed, at: now };
  const noTrade = (price: number, why: string, extra: Partial<Signal> = {}): Signal => ({
    ...base, decision: "NAO_OPERAR", strength: 0, entry_at: null, expiry_at: null, expiry_candles: null, price,
    invalidation_price: null, target_price: null, reasons_for: [], reasons_against: [why], summary: why, blocked_by: why, ...extra,
  });

  let candles: Candle[];
  try { candles = closedCandles(await fetchCandles(asset.source), now); }
  catch (e) { return json({ error: `Não consegui buscar as velas: ${(e as Error).message}` }, 502); }
  if (candles.length < 30) return json(noTrade(candles.at(-1)?.c ?? 0, "Poucas velas disponíveis agora (mercado fechado ou fonte sem dados)."));
  const last = candles[candles.length - 1];
  // vela fechada mais recente deve ter terminado há no máximo 20 min (forex pela fonte gratuita pode atrasar)
  if (last.t + M5 < now - 20 * 60) return json(noTrade(last.c, `Mercado parado ou fechado: a última vela é das ${brt(last.t)}.`));

  try {
    const events = await (deps.calendar ?? fetchCalendar)();
    const hit = newsBlock(events, asset.currencies, now);
    if (hit) return json(noTrade(last.c, `Notícia de alto impacto: ${hit.country} ${hit.title} às ${brt(hit.at)}. Evite operar perto de notícia ★★★.`));
  } catch { /* calendário fora do ar não impede a análise; a IA segue sem essa trava */ }

  if (!deps.ask && !process.env.ANTHROPIC_API_KEY)
    return json({ error: "IA desativada: configure ANTHROPIC_API_KEY na Vercel (Settings → Environment Variables) e publique de novo." }, 503);

  const ind = indicators(candles);
  let reading: AiReading;
  try { reading = await (deps.ask ?? askClaude)(buildPrompt(asset.label, candles, ind)); }
  catch (err) {
    if (err instanceof SignalError) return json({ error: err.message }, err.status);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Limite de uso da IA atingido. Tente em instantes." }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "Chave da IA inválida." }, 503);
    if (err instanceof Anthropic.APIError) {
      console.error("signal: erro da API da Anthropic", err.status, err.message);
      return json({ error: aiErrorText(err) }, 502);
    }
    if (err instanceof SyntaxError) return json({ error: "Resposta da IA em formato inesperado." }, 502);
    throw err;
  }
  const { reading: r, blocked } = applySignalGuards(reading, ind.price);
  // entrada na abertura da próxima vela; se faltar menos de 30 s, pula para a seguinte
  let entry = Math.ceil(now / M5) * M5;
  if (entry - now < 30) entry += M5;
  const trade = r.decision !== "NAO_OPERAR";
  const signal: Signal = {
    ...base, decision: r.decision, strength: r.strength,
    entry_at: trade ? entry : null, expiry_at: trade ? entry + r.expiry_candles * M5 : null, expiry_candles: trade ? r.expiry_candles : null,
    price: ind.price, invalidation_price: trade ? r.invalidation_price : null, target_price: trade ? r.target_price : null,
    reasons_for: r.reasons_for, reasons_against: blocked ? [blocked, ...r.reasons_against] : r.reasons_against,
    summary: r.summary, blocked_by: blocked,
  };
  return json(signal);
}
