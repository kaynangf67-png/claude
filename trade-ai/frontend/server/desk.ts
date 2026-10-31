import Anthropic from "@anthropic-ai/sdk";
import { CRYPTO, M5, atr, ema, fetchCandles, fetchPrice, rsi, type Candle } from "./market.js";

/** Assistente de mesa: decide CALL, PUT ou AGUARDAR a partir das velas M5 reais (não de print). */

export const DESK_PROMPT = `Você é uma assistente de mesa que opera opções binárias de forma SIMULADA no gráfico de 5 minutos (M5).
Você recebe as últimas velas M5 fechadas (horário UTC) e alguns indicadores calculados a partir delas. Nada além disso.

Regras:
- O padrão é AGUARDAR. Só indique CALL (sobe) ou PUT (desce) quando tendência, posição em relação a suportes/resistências, as últimas velas e os indicadores concordam, e nada importante aponta contra.
- Não entre logo depois de uma vela de força muito esticada, em lateralização sem direção, nem com o preço colado em suporte/resistência contra a direção.
- Você não sabe o que a próxima vela fará. Avalie se existe um setup claro; não adivinhe.
- A expiração é em velas de 5 minutos: 1, 2 ou 3.
- Seja honesta nos fatores contra. Responda em português do Brasil, frases curtas.`;

export const DESK_SCHEMA = {
  type: "object",
  properties: {
    decision: { type: "string", enum: ["CALL", "PUT", "AGUARDAR"] },
    strength: { type: "string", enum: ["fraca", "moderada", "forte"] },
    expiration_candles: { type: "integer" },
    reasons: { type: "array", items: { type: "string" } },
    against: { type: "array", items: { type: "string" } },
  },
  required: ["decision", "strength", "expiration_candles", "reasons", "against"],
  additionalProperties: false,
} as const;

export interface DeskReading {
  decision: "CALL" | "PUT" | "AGUARDAR";
  strength: "fraca" | "moderada" | "forte";
  expiration_candles: number;
  reasons: string[];
  against: string[];
}

export interface DeskResult extends DeskReading {
  ai_decision: DeskReading["decision"];
  blocks: string[];
  asset: string;
  price: number; // preço ao vivo no momento da decisão (preço de entrada)
  decided_at: number; // epoch s
  last_candle: number; // abertura da última vela fechada usada
}

export function describe(candles: Candle[]): string {
  const closed = candles.filter((c) => c.closed);
  const closes = closed.map((c) => c.close);
  const e9 = ema(closes, 9).at(-1);
  const e21 = ema(closes, 21).at(-1);
  const e50 = ema(closes, 50).at(-1);
  const r = rsi(closes);
  const a = atr(closed);
  const rows = closed.slice(-40).map((c) => {
    const t = new Date(c.time * 1000).toISOString().slice(11, 16);
    return `${t},${c.open},${c.high},${c.low},${c.close}`;
  });
  const recent = closed.slice(-30);
  const hi = Math.max(...recent.map((c) => c.high));
  const lo = Math.min(...recent.map((c) => c.low));
  return [
    `Indicadores (última vela fechada): EMA9=${e9?.toFixed(4)} EMA21=${e21?.toFixed(4)} EMA50=${e50?.toFixed(4)} RSI14=${r?.toFixed(1)} ATR14=${a?.toFixed(4)}`,
    `Máxima/mínima das últimas 30 velas: ${hi} / ${lo}`,
    "Velas M5 fechadas (hora UTC,abertura,máxima,mínima,fechamento):",
    ...rows,
  ].join("\n");
}

/** Travas do servidor: na dúvida, AGUARDAR. */
export function guard(r: DeskReading, lastClosedOpen: number, now: number): { decision: DeskReading["decision"]; blocks: string[] } {
  const blocks: string[] = [];
  if (now - (lastClosedOpen + M5) > 3 * 60) blocks.push("Dados atrasados: a última vela fechou há mais de 3 minutos.");
  if (r.decision !== "AGUARDAR" && r.strength === "fraca") blocks.push("Setup fraco.");
  if (r.decision !== "AGUARDAR" && r.reasons.length < 2) blocks.push("Poucos motivos a favor.");
  return { decision: blocks.length ? "AGUARDAR" : r.decision, blocks };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function handleCandles(request: Request): Promise<Response> {
  const asset = new URL(request.url).searchParams.get("asset") ?? "";
  if (!CRYPTO[asset]) return json({ error: "Ativo não suportado" }, 400);
  try {
    const [candles, price] = await Promise.all([fetchCandles(asset, 60), fetchPrice(asset)]);
    return json({ asset, price, candles, server_time: Math.floor(Date.now() / 1000) });
  } catch (e) {
    return json({ error: `Sem dados da Binance agora: ${(e as Error).message}` }, 502);
  }
}

export async function handleDesk(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!process.env.ANTHROPIC_API_KEY)
    return json({ error: "IA desativada: configure ANTHROPIC_API_KEY na Vercel." }, 503);
  let body: { asset?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const asset = body.asset ?? "";
  if (!CRYPTO[asset]) return json({ error: "Ativo não suportado" }, 400);

  let candles: Candle[];
  let price: number;
  try {
    [candles, price] = await Promise.all([fetchCandles(asset, 100), fetchPrice(asset)]);
  } catch (e) {
    return json({ error: `Sem dados da Binance agora: ${(e as Error).message}` }, 502);
  }
  const closed = candles.filter((c) => c.closed);
  if (closed.length < 60) return json({ error: "Poucas velas disponíveis" }, 502);

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: DESK_SCHEMA } },
      system: DESK_PROMPT,
      messages: [{ role: "user", content: `Ativo: ${CRYPTO[asset].label}\n${describe(candles)}\n\nDecida e preencha o JSON.` }],
    });
    if (response.stop_reason === "refusal") return json({ error: "A IA recusou esta análise." }, 422);
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const reading = JSON.parse(text) as DeskReading;
    const now = Math.floor(Date.now() / 1000);
    const last = closed.at(-1)!.time;
    const g = guard(reading, last, now);
    const result: DeskResult = {
      ...reading,
      expiration_candles: Math.min(3, Math.max(1, Math.round(reading.expiration_candles || 1))),
      ai_decision: reading.decision,
      decision: g.decision,
      blocks: g.blocks,
      asset,
      price,
      decided_at: now,
      last_candle: last,
    };
    return json(result);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Limite de uso da IA atingido." }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "Chave da IA inválida." }, 503);
    if (err instanceof Anthropic.APIError) return json({ error: `Falha na IA (${err.status ?? "rede"}).` }, 502);
    if (err instanceof SyntaxError) return json({ error: "Resposta da IA em formato inesperado." }, 502);
    throw err;
  }
}
