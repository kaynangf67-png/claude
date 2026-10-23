import { describe, expect, it } from 'vitest';
import { effectiveRules, emptyProduct, type ListingContent } from '@vendora/shared';
import { AnthropicGenerator } from '../src/modules/ai/anthropic';
import type { GenerationInput } from '../src/modules/ai/types';

/**
 * Testa a integração com o SDK sem chamar a API real: o transporte HTTP é
 * substituído. Confere o formato da requisição e o tratamento das respostas.
 * (A chamada real à API não foi testada neste ambiente — não há chave.)
 */
const input: GenerationInput = {
  product: { ...emptyProduct(), title: 'Garrafa Inox 500ml', brand: 'Termix' },
  fieldStatus: { title: 'confirmed' },
  marketplace: 'shopee',
  rules: effectiveRules('shopee'),
  part: 'all',
};
const listing: ListingContent = {
  title: 'Garrafa Térmica Termix Inox 500ml',
  description: 'Garrafa de inox.',
  highlights: [],
  specifications: [],
  keywords: ['garrafa'],
  category: null,
  missingInfo: [],
};

function fakeApi(body: object, status = 200) {
  const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  }) as typeof fetch;
  return { fn, calls };
}

const message = (text: string, stop_reason = 'end_turn') => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text }],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

describe('AnthropicGenerator', () => {
  it('envia modelo, esforço, formato estruturado e fallback; devolve o conteúdo validado', async () => {
    const api = fakeApi(message(JSON.stringify(listing)));
    const gen = new AnthropicGenerator('sk-test', 'claude-opus-5-5', 'medium', api.fn);
    const out = await gen.generate(input);
    expect(out).toEqual(listing);
    const req = api.calls[0]!;
    expect(req.url).toContain('/v1/messages');
    expect(req.body.model).toBe('claude-opus-5-5');
    expect(req.body.fallbacks).toBe('default');
    expect(req.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    const oc = req.body.output_config as { effort: string; format: { type: string } };
    expect(oc.effort).toBe('medium');
    expect(oc.format.type).toBe('json_schema');
    expect(String((req.body.messages as Array<{ content: string }>)[0]!.content)).toContain('<dados_do_produto>');
  });

  it('trata recusa', async () => {
    const api = fakeApi(message('', 'refusal'));
    await expect(new AnthropicGenerator('k', 'claude-opus-5-5', 'low', api.fn).generate(input)).rejects.toMatchObject({ code: 'ai_refused' });
  });

  it('trata chave inválida sem vazar detalhes', async () => {
    const api = fakeApi({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401);
    await expect(new AnthropicGenerator('k', 'claude-opus-5-5', 'low', api.fn).generate(input)).rejects.toMatchObject({
      code: 'ai_auth',
      status: 503,
    });
  });
});
