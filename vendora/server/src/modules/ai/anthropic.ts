import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ListingContent } from '@vendora/shared';
import { AppError } from '../../lib/errors';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt';
import type { GenerationInput, ListingGenerator } from './types';

export class AnthropicGenerator implements ListingGenerator {
  readonly id = 'anthropic' as const;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
    private readonly effort: 'low' | 'medium' | 'high',
    /** Só para testes: substitui o transporte HTTP do SDK. */
    fetchImpl?: typeof fetch,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000, ...(fetchImpl ? { fetch: fetchImpl, maxRetries: 0 } : {}) });
  }

  async generate(input: GenerationInput): Promise<ListingContent> {
    try {
      // create (e não parse): o parse automático lança erro antes de vermos stop_reason numa recusa.
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // Se o modelo principal recusar, a própria API tenta o modelo de fallback padrão.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: this.effort, format: betaZodOutputFormat(ListingContent) },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      });
      if (response.stop_reason === 'refusal')
        throw new AppError(422, 'ai_refused', 'A IA recusou gerar este anúncio. Revise os dados do produto.');
      if (response.stop_reason === 'max_tokens')
        throw new AppError(502, 'ai_truncated', 'A resposta da IA foi cortada. Tente novamente.');
      const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new AppError(502, 'ai_invalid', 'A IA devolveu um formato inválido. Tente novamente.');
      }
      const parsed = ListingContent.safeParse(json);
      if (!parsed.success) throw new AppError(502, 'ai_invalid', 'A IA devolveu um formato inválido. Tente novamente.');
      return parsed.data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Anthropic.RateLimitError)
        throw new AppError(429, 'ai_rate_limited', 'Limite de uso da IA atingido. Tente em instantes.');
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
        throw new AppError(503, 'ai_auth', 'A chave da IA é inválida ou não tem permissão. Verifique ANTHROPIC_API_KEY.');
      if (err instanceof Anthropic.BadRequestError)
        throw new AppError(502, 'ai_bad_request', 'A IA rejeitou a solicitação. Verifique AI_MODEL e AI_EFFORT.');
      if (err instanceof Anthropic.APIConnectionError)
        throw new AppError(503, 'ai_unreachable', 'Não foi possível falar com a IA agora.');
      if (err instanceof Anthropic.APIError) throw new AppError(502, 'ai_error', 'Falha temporária na IA. Tente novamente.');
      throw err;
    }
  }
}
