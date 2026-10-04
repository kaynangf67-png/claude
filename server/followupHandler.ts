import Anthropic from '@anthropic-ai/sdk';
import { FOLLOWUP_SYSTEM_PROMPT, buildFollowupUserPrompt } from '../src/lib/followup';
import type { Analysis, Business, Lead } from '../src/lib/types';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Gera o texto do follow-up com Claude. Sem ANTHROPIC_API_KEY responde 503 e o
 * front-end usa o motor local — o MVP funciona sem nenhuma chave configurada.
 */
export async function handleFollowupRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  // 200 + configured:false para o navegador não registrar erro: o front usa o motor local.
  if (!process.env.ANTHROPIC_API_KEY) return json({ configured: false });

  let payload: { lead?: Lead; business?: Business; analysis?: Analysis };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const { lead, business, analysis } = payload;
  if (!lead?.messages || !business?.products || !analysis) return json({ error: 'Dados incompletos' }, 400);

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: FOLLOWUP_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildFollowupUserPrompt(lead, business, analysis) }],
    });
    if (response.stop_reason === 'refusal') return json({ error: 'Pedido recusado pela IA' }, 422);

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()
      .replace(/^["“]|["”]$/g, '');
    if (!text) return json({ error: 'Resposta vazia' }, 502);
    return json({ text });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Limite de uso atingido' }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'Chave da IA inválida' }, 503);
    if (err instanceof Anthropic.APIError) return json({ error: 'Falha na IA' }, 502);
    throw err;
  }
}
