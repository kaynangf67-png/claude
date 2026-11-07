import Anthropic from "@anthropic-ai/sdk";

/** A IA só explica e organiza o que o código calculou. Não calcula, não muda a decisão. */
export interface Narrative { resumo: string; contexto: string; fatores_favor: string[]; fatores_contra: string[] }

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["resumo", "contexto", "fatores_favor", "fatores_contra"],
  properties: {
    resumo: { type: "string" }, contexto: { type: "string" },
    fatores_favor: { type: "array", items: { type: "string" } }, fatores_contra: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM = `Você recebe o resultado de um motor de análise técnica de Forex que já calculou tudo em código (tendências, regiões, estratégias, filtros, pontuação, entrada, stop e alvos).
Sua tarefa é só explicar em português do Brasil, de forma objetiva:
- resumo: 2 a 3 frases sobre a decisão do motor e por quê.
- contexto: o que o preço fez no trecho recente descrito em context30, usando apenas os dados recebidos. Se horizon for "swing", lembre que a operação pode durar dias e que os tempos gráficos são D1/H4/H1/M15.
- fatores_favor e fatores_contra: frases curtas reescrevendo os motivos recebidos.
Regras: use SOMENTE números, níveis e fatos presentes no JSON. Não invente padrões, preços ou notícias. Não mude a decisão (BUY, SELL ou NO_TRADE) nem sugira outra. Se for NO_TRADE ou aguardando, diga o que falta. Pontuação é confluência técnica, não probabilidade de acerto.`;

export async function narrate(view: unknown): Promise<Narrative> {
  const client = new Anthropic();
  const base = {
    model: "claude-opus-5-5", max_tokens: 6000,
    output_config: { effort: "low" as const, format: { type: "json_schema" as const, schema: SCHEMA } },
    system: SYSTEM, messages: [{ role: "user" as const, content: JSON.stringify(view) }],
  };
  let response;
  try { response = await client.beta.messages.create({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }); }
  catch (err) {
    if (err instanceof Anthropic.BadRequestError && /anthropic-beta|fallbacks/i.test(err.message)) response = await client.beta.messages.create(base);
    else throw err;
  }
  if (response.stop_reason === "refusal") throw new Error("A IA recusou explicar esta análise.");
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(text) as Narrative;
}
