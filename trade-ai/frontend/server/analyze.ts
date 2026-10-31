import Anthropic from "@anthropic-ai/sdk";

export const SYSTEM_PROMPT = `Você analisa prints de gráficos de preço para operações binárias de curto prazo (CALL = sobe, PUT = desce).

Regras obrigatórias:
- Use SOMENTE o que está visível na imagem. Se um dado não aparece ou não dá para ler com segurança, devolva null. Nunca estime preço, horário, ativo ou timeframe.
- Você não sabe o que a próxima vela fará. Sua tarefa é dizer se existe um setup técnico claro no print, não adivinhar.
- O padrão é NAO_OPERAR. Só indique CALL ou PUT quando vários sinais visíveis concordam (tendência, região de suporte/resistência, padrão das últimas velas, indicadores visíveis) e nada importante aponta contra.
- Não indique entrada no meio de vela esticada, logo após vela de força muito grande, em lateralização sem direção, ou com o preço colado em suporte/resistência contra a direção.
- Se o print estiver cortado, sem as velas mais recentes, sem escala de preço, borrado, ou não for um gráfico, marque request_new_capture=true e decida NAO_OPERAR.
- Liste com honestidade os fatores contra a entrada.
- O Trade AI opera só no gráfico de 5 minutos (M5). A expiração é contada em velas de 5 minutos (1 a 3).
- O usuário informa qual ativo selecionou. Use isso só para conferir: se o ativo visível no print for outro, registre em "against" e não troque o nome lido.
- Responda em português do Brasil, frases curtas.`;

export const SCHEMA = {
  type: "object",
  properties: {
    is_chart: { type: "boolean" },
    platform: { type: ["string", "null"], description: "Corretora ou plataforma, se visível" },
    symbol: { type: ["string", "null"] },
    timeframe: { type: ["string", "null"], description: "Tempo gráfico como aparece: M1, 1m, 5, M5, 15m..." },
    last_price: { type: ["number", "null"] },
    visible_time: { type: ["string", "null"], description: "Horário visível no print, como aparece" },
    trend: { type: "string", enum: ["alta", "baixa", "lateral", "indefinida"] },
    last_candles: { type: "string", description: "Descrição das 3 últimas velas visíveis" },
    supports: { type: "array", items: { type: "number" } },
    resistances: { type: "array", items: { type: "number" } },
    indicators: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, reading: { type: "string" } },
        required: ["name", "reading"],
        additionalProperties: false,
      },
    },
    decision: { type: "string", enum: ["CALL", "PUT", "NAO_OPERAR"] },
    setup_quality: { type: "string", enum: ["fraca", "moderada", "forte"] },
    entry_reference_price: { type: ["number", "null"], description: "Preço visível de referência para a entrada" },
    expiration_candles: { type: "integer", description: "Expiração sugerida em velas de 5 minutos (1 a 3)" },
    reasons: { type: "array", items: { type: "string" } },
    against: { type: "array", items: { type: "string" } },
    invalidation: { type: ["string", "null"], description: "O que invalida a entrada antes de entrar" },
    missing: { type: "array", items: { type: "string" } },
    request_new_capture: { type: "boolean" },
    new_capture_reason: { type: ["string", "null"] },
  },
  required: [
    "is_chart", "platform", "symbol", "timeframe", "last_price", "visible_time", "trend", "last_candles",
    "supports", "resistances", "indicators", "decision", "setup_quality", "entry_reference_price",
    "expiration_candles", "reasons", "against", "invalidation", "missing", "request_new_capture", "new_capture_reason",
  ],
  additionalProperties: false,
} as const;

export type Decision = "CALL" | "PUT" | "NAO_OPERAR";

export interface Reading {
  is_chart: boolean;
  platform: string | null;
  symbol: string | null;
  timeframe: string | null;
  last_price: number | null;
  visible_time: string | null;
  trend: "alta" | "baixa" | "lateral" | "indefinida";
  last_candles: string;
  supports: number[];
  resistances: number[];
  indicators: { name: string; reading: string }[];
  decision: Decision;
  setup_quality: "fraca" | "moderada" | "forte";
  entry_reference_price: number | null;
  expiration_candles: number;
  reasons: string[];
  against: string[];
  invalidation: string | null;
  missing: string[];
  request_new_capture: boolean;
  new_capture_reason: string | null;
}

export interface Result extends Reading {
  ai_decision: Decision; // o que a IA disse antes das travas do servidor
  blocks: string[]; // por que o servidor mudou para NAO_OPERAR
  timeframe_minutes: number | null;
}

/** "M5", "5m", "5", "1 min", "15M", "H1" -> minutos. */
export function timeframeMinutes(tf: string | null): number | null {
  if (!tf) return null;
  const t = tf.trim().toLowerCase().replace(/\s+/g, "");
  const h = t.match(/^(?:h(\d+)|(\d+)h)$/);
  if (h) return Number(h[1] ?? h[2]) * 60;
  const m = t.match(/^(?:m(\d+)|(\d+)(?:m|min|minutos?)?)$/);
  if (m) return Number(m[1] ?? m[2]);
  return null;
}

const ALIASES: Record<string, string> = {
  GOLD: "XAUUSD", OURO: "XAUUSD", SILVER: "XAGUSD", PRATA: "XAGUSD",
  WTI: "USOIL", CRUDE: "USOIL", CRUDEOIL: "USOIL", OIL: "USOIL", PETROLEO: "USOIL",
  BITCOIN: "BTCUSD", ETHEREUM: "ETHUSD", LITECOIN: "LTCUSD",
};

/** "EUR/USD (OTC)" -> "EURUSD"; "BTCUSDT" -> "BTCUSD"; "Gold" -> "XAUUSD". */
export function normalizeSymbol(s: string): string {
  const n = s.toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "").replace(/OTC/g, "").replace(/USDT$/, "USD");
  return ALIASES[n] ?? n;
}

export function sameAsset(read: string, selected: string): boolean {
  const a = normalizeSymbol(read);
  const b = normalizeSymbol(selected);
  return a.length > 0 && (a.includes(b) || b.includes(a));
}

/** Travas que não dependem da IA: na dúvida, NÃO OPERAR. */
export function applyGuards(r: Reading, imageAgeSeconds: number | null, selected: string | null = null): Result {
  const blocks: string[] = [];
  const tfm = timeframeMinutes(r.timeframe);
  if (!r.is_chart) blocks.push("A imagem não parece ser um gráfico de preços.");
  if (r.request_new_capture) blocks.push(r.new_capture_reason || "Print incompleto: envie uma nova captura.");
  if (tfm === null) blocks.push("Tempo gráfico não visível no print. Use o gráfico de 5 minutos (M5).");
  else if (tfm !== 5) blocks.push(`O print está em ${r.timeframe}. O Trade AI opera só no gráfico de 5 minutos (M5).`);
  if (selected) {
    if (!r.symbol) blocks.push(`O ativo não aparece no print: não dá para confirmar que é ${selected}.`);
    else if (!sameAsset(r.symbol, selected)) blocks.push(`O print é de ${r.symbol}, mas o ativo selecionado é ${selected}.`);
  }
  if (imageAgeSeconds !== null && imageAgeSeconds > 180)
    blocks.push(`O print tem ${Math.round(imageAgeSeconds / 60)} min: o mercado já andou. Tire um print novo.`);
  if (r.decision !== "NAO_OPERAR" && r.setup_quality === "fraca") blocks.push("Setup fraco.");
  if (r.decision !== "NAO_OPERAR" && r.reasons.length < 2) blocks.push("Poucos motivos a favor.");
  const exp = Math.min(3, Math.max(1, Math.round(r.expiration_candles || 1)));
  return {
    ...r,
    expiration_candles: exp,
    ai_decision: r.decision,
    decision: blocks.length ? "NAO_OPERAR" : r.decision,
    blocks,
    timeframe_minutes: tfm,
  };
}

const MEDIA = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function handleAnalyze(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!process.env.ANTHROPIC_API_KEY)
    return json({ error: "Análise desativada: configure ANTHROPIC_API_KEY no servidor (Vercel → Settings → Environment Variables)." }, 503);

  let body: { image?: string; media_type?: string; image_age_s?: number | null; asset?: string | null };
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const { image, media_type } = body;
  if (!image || !media_type || !MEDIA.has(media_type)) return json({ error: "Envie uma imagem PNG, JPEG, WEBP ou GIF" }, 400);
  if (image.length > 6_000_000) return json({ error: "Imagem grande demais" }, 413);

  const selected = typeof body.asset === "string" && body.asset.trim() ? body.asset.trim().slice(0, 40) : null;
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: media_type as "image/png", data: image } },
          { type: "text", text: `Ativo selecionado pelo usuário: ${selected ?? "não informado"}. Analise este print e preencha o JSON.` },
        ],
      }],
    });
    if (response.stop_reason === "refusal") return json({ error: "A IA recusou analisar esta imagem." }, 422);
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (!text) return json({ error: "Resposta vazia da IA" }, 502);
    const reading = JSON.parse(text) as Reading;
    const age = typeof body.image_age_s === "number" ? body.image_age_s : null;
    return json(applyGuards(reading, age, selected));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Limite de uso da IA atingido. Tente em instantes." }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "Chave da IA inválida." }, 503);
    if (err instanceof Anthropic.APIError) return json({ error: `Falha na IA (${err.status ?? "rede"}).` }, 502);
    if (err instanceof SyntaxError) return json({ error: "Resposta da IA em formato inesperado." }, 502);
    throw err;
  }
}
