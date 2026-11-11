import Anthropic from "@anthropic-ai/sdk";

export const SYSTEM_PROMPT = `Você analisa prints de gráficos de preço para operações binárias de curto prazo (CALL = sobe, PUT = desce).

Regras obrigatórias:
- Use SOMENTE o que está visível na imagem. Se um dado não aparece ou não dá para ler com segurança, devolva null. Nunca estime preço, horário, ativo ou timeframe.
- Você não sabe o que a próxima vela fará. Sua tarefa é dizer se existe um setup técnico claro no print, não adivinhar.
- Sempre indique CALL ou PUT quando o print for um gráfico legível: escolha a direção mais provável pelo conjunto (tendência, região de suporte/resistência, padrão das últimas velas, indicadores visíveis). Use NAO_OPERAR só quando não der para ler o gráfico.
- A força do setup vai em setup_quality: "forte" quando vários sinais concordam; "moderada" quando há uma direção razoável; "fraca" quando o gráfico está lateral, a vela está esticada ou o preço está colado em suporte/resistência contra a direção. Nesses casos ainda indique a direção mais provável e liste os riscos em "against".
- Se o print estiver cortado, sem as velas mais recentes, sem escala de preço, borrado, ou não for um gráfico, marque request_new_capture=true e decida NAO_OPERAR.
- Quando indicar CALL ou PUT, defina também stop_price e target_price usando SOMENTE níveis visíveis na escala do print: stop além do suporte/resistência que invalida a ideia; alvo no próximo nível a favor. Se a escala não permitir ler os preços, devolva null nos dois.\n- Liste com honestidade os fatores contra a entrada.
- Qualquer tempo gráfico é aceito (M1, M5, M15, M30, H1, H4, D1...). Analise no tempo gráfico que aparece no print e não trate o tempo gráfico como fator a favor nem contra. A expiração é contada em velas DESSE tempo gráfico (1 a 3).
- Analise o ativo que aparece no print. O usuário informa qual ativo selecionou só para conferência: se for outro, apenas registre isso em "against" e analise o ativo do print mesmo assim.
- Responda em português do Brasil, frases curtas.`;

export const SCHEMA = {
  type: "object",
  properties: {
    is_chart: { type: "boolean" },
    platform: { anyOf: [{ type: "string" }, { type: "null" }], description: "Corretora ou plataforma, se visível" },
    symbol: { anyOf: [{ type: "string" }, { type: "null" }] },
    timeframe: { anyOf: [{ type: "string" }, { type: "null" }], description: "Tempo gráfico como aparece: M1, 1m, 5, M5, 15m..." },
    last_price: { anyOf: [{ type: "number" }, { type: "null" }] },
    visible_time: { anyOf: [{ type: "string" }, { type: "null" }], description: "Horário visível no print, como aparece" },
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
    entry_reference_price: { anyOf: [{ type: "number" }, { type: "null" }], description: "Preço visível de referência para a entrada" },
    stop_price: { anyOf: [{ type: "number" }, { type: "null" }], description: "Stop Loss sugerido em preço, além do suporte/resistência visível que invalida a entrada. null se NAO_OPERAR ou se a escala de preço não permite" },
    target_price: { anyOf: [{ type: "number" }, { type: "null" }], description: "Alvo (Take Profit) sugerido em preço, no próximo suporte/resistência visível a favor. null se NAO_OPERAR ou se a escala não permite" },
    expiration_candles: { type: "integer", description: "Expiração sugerida em velas do tempo gráfico do print (1 a 3)" },
    reasons: { type: "array", items: { type: "string" } },
    against: { type: "array", items: { type: "string" } },
    invalidation: { anyOf: [{ type: "string" }, { type: "null" }], description: "O que invalida a entrada antes de entrar" },
    missing: { type: "array", items: { type: "string" } },
    request_new_capture: { type: "boolean" },
    new_capture_reason: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: [
    "is_chart", "platform", "symbol", "timeframe", "last_price", "visible_time", "trend", "last_candles",
    "supports", "resistances", "indicators", "decision", "setup_quality", "entry_reference_price", "stop_price", "target_price",
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
  /** Stop e alvo em preço (para quem opera Forex/CFD no MT5); null quando não dá para definir pelo print. */
  stop_price?: number | null;
  target_price?: number | null;
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
  blocks: string[]; // só o que impede a leitura (não é gráfico, print cortado): vira NAO_OPERAR
  warnings: string[]; // ressalvas que NÃO bloqueiam a entrada (ativo diferente, print antigo, setup fraco...)
  derived: boolean; // true quando a direção, o stop e o alvo foram derivados pelo servidor a partir dos níveis lidos
  timeframe_minutes: number | null;
}

/** "M5", "5m", "5", "1 min", "15M", "H1", "D1", "diário" -> minutos. */
export function timeframeMinutes(tf: string | null): number | null {
  if (!tf) return null;
  const t = tf.trim().toLowerCase().replace(/\s+/g, "");
  const h = t.match(/^(?:h(\d+)|(\d+)h)$/);
  if (h) return Number(h[1] ?? h[2]) * 60;
  if (/^(d1|1d|d|diario|diário|daily)$/.test(t)) return 1440;
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

/** Direção, stop e alvo derivados dos níveis lidos no print, para quando a IA não deu entrada ou deu sem stop/alvo.
 * Tendência de alta = CALL, baixa = PUT; lateral = lado mais perto do suporte (CALL) ou da resistência (PUT).
 * Stop = nível oposto mais próximo + 20% da distância como margem; alvo = próximo nível a favor, ou 1,5R se não houver. */
export function deriveEntry(r: Reading): { decision: "CALL" | "PUT"; stop: number | null; target: number | null } | null {
  const ref = r.entry_reference_price ?? r.last_price;
  if (ref === null || !Number.isFinite(ref)) return null;
  const below = r.supports.filter((x) => x < ref).sort((a, b) => b - a)[0] ?? null;
  const above = r.resistances.filter((x) => x > ref).sort((a, b) => a - b)[0] ?? null;
  let decision: "CALL" | "PUT" | null = r.trend === "alta" ? "CALL" : r.trend === "baixa" ? "PUT" : null;
  if (!decision) {
    if (below !== null && above !== null) decision = ref - below <= above - ref ? "CALL" : "PUT";
    else if (below !== null) decision = "CALL";
    else if (above !== null) decision = "PUT";
  }
  if (!decision) return null;
  const buy = decision === "CALL";
  const slLevel = buy ? below : above, tpLevel = buy ? above : below;
  const stop = slLevel === null ? null : buy ? slLevel - 0.2 * (ref - slLevel) : slLevel + 0.2 * (slLevel - ref);
  const target = tpLevel !== null ? tpLevel : stop !== null ? (buy ? ref + 1.5 * (ref - stop) : ref - 1.5 * (stop - ref)) : null;
  return { decision, stop, target };
}

/** Travas do servidor. O print SEMPRE gera entrada quando o gráfico é legível: só não ser um gráfico, ou estar cortado,
 * bloqueia. O resto (ativo diferente, print antigo, setup fraco) vira aviso, e a entrada sai marcada como de baixa convicção. */
export function applyGuards(r: Reading, imageAgeSeconds: number | null, selected: string | null = null): Result {
  const blocks: string[] = [], warnings: string[] = [];
  const tfm = timeframeMinutes(r.timeframe);
  if (!r.is_chart) blocks.push("A imagem não parece ser um gráfico de preços.");
  if (r.request_new_capture) blocks.push(r.new_capture_reason || "Print incompleto: envie uma nova captura.");
  if (tfm === null) warnings.push("Tempo gráfico não visível no print: mostre o tempo gráfico (M1, M5, M15, H1...) para calcular horário de entrada e expiração.");
  if (selected) {
    if (!r.symbol) warnings.push(`O ativo não aparece no print: não dá para confirmar que é ${selected}.`);
    else if (!sameAsset(r.symbol, selected)) warnings.push(`O print é de ${r.symbol}, não de ${selected} (o ativo selecionado). A entrada vale para ${r.symbol}.`);
  }
  if (imageAgeSeconds !== null && imageAgeSeconds > 180)
    warnings.push(`O print tem ${Math.round(imageAgeSeconds / 60)} min: o mercado já andou. Confira o preço atual antes de entrar.`);
  if (r.decision !== "NAO_OPERAR" && r.setup_quality === "fraca") warnings.push("Setup fraco: entrada de baixa convicção.");
  if (r.decision !== "NAO_OPERAR" && r.reasons.length < 2) warnings.push("Poucos motivos a favor.");

  let decision: Decision = r.decision, quality = r.setup_quality, derived = false;
  let sl = r.stop_price ?? null, tp = r.target_price ?? null;
  const ref = r.entry_reference_price ?? r.last_price;
  const side = (d: Decision, s: number | null, t: number | null) => ref !== null && s !== null && t !== null && (d === "CALL" ? s < ref && ref < t : d === "PUT" ? t < ref && ref < s : false);
  if (!blocks.length) {
    if (decision === "NAO_OPERAR") {
      const d = deriveEntry(r);
      if (d) { decision = d.decision; sl = d.stop; tp = d.target; quality = "fraca"; derived = true; warnings.push("A IA não achou setup claro: entrada de baixa convicção, pela tendência e pelos níveis lidos no print."); }
      else blocks.push("Não deu para definir direção: o print não mostra tendência nem níveis de suporte/resistência legíveis. Envie um print com mais velas e a escala de preço.");
    } else if (!side(decision, sl, tp)) {
      const d = deriveEntry({ ...r, trend: decision === "CALL" ? "alta" : "baixa" });
      if (d && d.decision === decision && side(decision, d.stop, d.target)) { sl = d.stop; tp = d.target; derived = true; warnings.push("Stop e alvo derivados dos suportes e resistências lidos no print."); }
      else { sl = null; tp = null; warnings.push("Stop e alvo não puderam ser definidos pela escala do print."); }
    }
  }
  const exp = Math.min(3, Math.max(1, Math.round(r.expiration_candles || 1)));
  return {
    ...r,
    decision: blocks.length ? "NAO_OPERAR" : decision,
    setup_quality: quality,
    stop_price: !blocks.length && side(decision, sl, tp) ? sl : null,
    target_price: !blocks.length && side(decision, sl, tp) ? tp : null,
    expiration_candles: exp,
    ai_decision: r.decision,
    blocks, warnings, derived,
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
    if (err instanceof Anthropic.APIError) {
      console.error("analyze: erro da API da Anthropic", err.status, err.message);
      const m = err.message || "";
      return json({ error: /credit balance/i.test(m) ? "Sua conta da Anthropic está sem créditos. Adicione em console.anthropic.com → Billing." : `Falha na IA (${err.status ?? "rede"}): ${m.replace(/\s+/g, " ").slice(0, 300)}` }, 502);
    }
    if (err instanceof SyntaxError) return json({ error: "Resposta da IA em formato inesperado." }, 502);
    throw err;
  }
}
