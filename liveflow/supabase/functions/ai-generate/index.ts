// Supabase Edge Function (Deno): geração de roteiros e Copiloto IA via Claude API.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy ai-generate
//
// A chave NUNCA vai para o frontend. O browser chama esta função com o JWT do
// usuário; a função valida o usuário, checa a cota do plano e só então chama o modelo.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'claude-opus-5-5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const SCRIPT_SYSTEM = `Você é roteirista de vídeos curtos e lives para TikTok Shop no Brasil.
Escreva em português brasileiro, tom natural e direto, sem promessas falsas, sem alegações de saúde
não comprovadas e sem inventar avaliações, números de vendas ou depoimentos.
Responda SOMENTE com JSON válido no formato:
{"scripts":[{"hook":"...","script":"...","benefits":["..."],"proof":"...","cta":"..."}]}
- hook: frase dos 3 primeiros segundos
- script: roteiro com marcações de tempo ([0–3s], [3–8s]...) em até 45 segundos
- benefits: 3 a 5 benefícios curtos
- proof: como demonstrar/provar o benefício em vídeo (sem inventar dados)
- cta: chamada para ação apontando para o carrinho`;

const COPILOT_SYSTEM = `Você é o Copiloto do LiveFlow, assistente de um afiliado/vendedor do TikTok Shop.
Use os dados do usuário fornecidos em <dados> para embasar recomendações e cite os números.
Se faltar dado, diga o que falta. Não invente métricas. Respeite as políticas do TikTok:
não sugira apresentar vídeo gravado como se fosse ao vivo, nem táticas enganosas.
Responda em português brasileiro, em markdown curto e objetivo.`;

function textOf(msg: Anthropic.Message): string {
  return msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return json({ error: 'unauthorized' }, 401);

  // Cota mensal (leitura sob RLS do próprio usuário).
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('user_id', userData.user.id).single(),
    supabase
      .from('ai_generations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);
  const { data: limits } = await supabase
    .from('plan_limits')
    .select('max_ai_generations_per_month')
    .eq('plan', profile?.plan ?? 'free')
    .single();
  const max = limits?.max_ai_generations_per_month as number | null | undefined;
  if (max != null && (count ?? 0) >= max) return json({ error: 'plan_limit' }, 402);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  try {
    if (body.action === 'script') {
      const count = Math.min(5, Math.max(1, Number(body.count ?? 1)));
      const input = body.input as Record<string, unknown>;
      const msg = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SCRIPT_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Gere ${count} roteiro(s) com ganchos diferentes entre si.\n<produto>${JSON.stringify(input)}</produto>`,
          },
        ],
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);
      if (msg.stop_reason === 'refusal') return json({ error: 'refused' }, 422);
      const raw = textOf(msg as unknown as Anthropic.Message);
      const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      return json({ scripts: parsed.scripts ?? [] });
    }

    if (body.action === 'chat') {
      const history = (body.messages as { role: 'user' | 'assistant'; content: string }[]).slice(-12);
      const context = JSON.stringify(body.context ?? {});
      const messages: Anthropic.MessageParam[] = history.map((m, i) =>
        i === 0 && m.role === 'user' ? { role: 'user', content: `<dados>${context}</dados>\n\n${m.content}` } : m,
      );
      const msg = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: COPILOT_SYSTEM,
        messages,
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);
      if (msg.stop_reason === 'refusal') return json({ reply: 'Não posso ajudar com esse pedido.' });
      return json({ reply: textOf(msg as unknown as Anthropic.Message) });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream_error', status: err.status }, 502);
    console.error(err);
    return json({ error: 'internal_error' }, 500);
  }
});
