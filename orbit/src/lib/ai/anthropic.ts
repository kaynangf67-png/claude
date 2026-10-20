import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AiOutputError, type AiProvider, type AiUsage, type StructuredRequest, type StructuredResponse } from "./provider";

/**
 * Claude via the official SDK, using structured outputs (JSON schema) so the
 * response is machine-readable. The result is still validated with Zod by the
 * caller's schema; the provider never trusts the model's output shape.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    const response = await this.client.beta.messages.create(
      {
        model: this.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: { effort: "medium", format: { type: "json_schema", schema: req.jsonSchema } },
        // On a safety decline the API retries on Anthropic's recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal: req.signal },
    );
    const usage: AiUsage = {
      provider: this.id,
      model: response.model,
      input_tokens: response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0),
      output_tokens: response.usage.output_tokens,
    };
    if (response.stop_reason === "refusal") throw new AiOutputError("O modelo recusou a solicitação", usage);
    if (response.stop_reason === "max_tokens") throw new AiOutputError("Resposta truncada por limite de tokens", usage);
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiOutputError("A resposta do modelo não é JSON válido", usage);
    }
    const parsed = req.schema.safeParse(json);
    if (!parsed.success) {
      throw new AiOutputError(
        "A resposta do modelo não segue o schema esperado",
        usage,
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      );
    }
    return { data: parsed.data, usage };
  }
}
