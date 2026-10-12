// Supabase Edge Function (Deno): extrai itens de fotos de cardápio com a Claude API.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy extract-menu
//
// Segurança e custo:
//   * A chave da IA existe só aqui. O navegador chama com o JWT do usuário.
//   * Leitura/gravação de projeto usam o cliente DO USUÁRIO (RLS valida a posse).
//   * Só o registro de uso (ai_usage) usa a service role, para o usuário não apagar o histórico.
//   * Limites: MAX_IMAGES_PER_CALL por chamada e AI_DAILY_IMAGE_LIMIT por usuário/dia.
//   * Imagens já analisadas são puladas, salvo `force: true`.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  EXTRACTION_SCHEMA,
  EXTRACTION_SYSTEM_PROMPT,
  estimateCostUsd,
  normalizeKey,
  parseExtraction,
  postProcess,
} from '../_shared/extraction.ts';

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-opus-5-5';
const DAILY_IMAGE_LIMIT = Number(Deno.env.get('AI_DAILY_IMAGE_LIMIT') ?? '60');
const MAX_IMAGES_PER_CALL = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // limite por imagem da API

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function logUsage(
  admin: SupabaseClient,
  row: { owner_id: string; project_id: string; images: number; input_tokens?: number; output_tokens?: number; status: string; error?: string },
) {
  const cost = estimateCostUsd(MODEL, row.input_tokens ?? 0, row.output_tokens ?? 0);
  await admin.from('ai_usage').insert({ ...row, model: MODEL, cost_usd: cost });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'ai_not_configured', message: 'ANTHROPIC_API_KEY não configurada na Edge Function.' }, 503);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { projectId?: unknown; assetIds?: unknown; force?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const projectId = typeof body.projectId === 'string' && UUID.test(body.projectId) ? body.projectId : null;
  const assetIds = Array.isArray(body.assetIds) ? body.assetIds.filter((id): id is string => typeof id === 'string' && UUID.test(id)) : [];
  if (!projectId || assetIds.length === 0) return json({ error: 'invalid_input', message: 'Informe o projeto e as imagens.' }, 400);
  if (assetIds.length > MAX_IMAGES_PER_CALL)
    return json({ error: 'too_many_images', message: `Envie no máximo ${MAX_IMAGES_PER_CALL} imagens por análise.` }, 400);

  // Posse do projeto e das imagens: RLS só devolve o que é do usuário.
  const { data: project } = await supabase.from('restaurant_projects').select('id, status').eq('id', projectId).maybeSingle();
  if (!project) return json({ error: 'not_found' }, 404);

  const { data: assets, error: assetsError } = await supabase
    .from('project_assets')
    .select('id, bucket, storage_path, file_type, size_bytes, purpose, original_filename, analyzed_at')
    .eq('project_id', projectId)
    .in('id', assetIds);
  if (assetsError) return json({ error: 'db_error' }, 500);
  const pages = (assets ?? []).filter((a) => a.purpose === 'menu_page' && (body.force === true || !a.analyzed_at));
  const skipped = assetIds.length - pages.length;
  if (pages.length === 0) {
    return json({ createdProducts: 0, reviewRequired: 0, analyzedAssets: 0, skippedAssets: skipped, warnings: ['Nenhuma página de cardápio nova para analisar.'] });
  }

  // Limite diário (contado pelo histórico que só a service role grava).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: usage } = await admin.from('ai_usage').select('images').eq('owner_id', user.id).gte('created_at', since);
  const usedToday = (usage ?? []).reduce((sum, r) => sum + (r.images ?? 0), 0);
  if (usedToday + pages.length > DAILY_IMAGE_LIMIT) {
    return json({ error: 'daily_limit', message: `Limite diário de ${DAILY_IMAGE_LIMIT} imagens atingido (${usedToday} usadas nas últimas 24h).` }, 429);
  }

  await supabase.from('restaurant_projects').update({ status: 'awaiting_analysis' }).eq('id', projectId);

  // Baixa as imagens (privadas) com a permissão do próprio usuário.
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [index, asset] of pages.entries()) {
    if (asset.size_bytes > MAX_IMAGE_BYTES) {
      return json({ error: 'image_too_large', message: `"${asset.original_filename}" passa de 5 MB. Reenvie a imagem (o app reduz automaticamente).` }, 400);
    }
    const { data: blob, error } = await supabase.storage.from(asset.bucket).download(asset.storage_path);
    if (error || !blob) return json({ error: 'storage_error', message: `Não foi possível ler "${asset.original_filename}".` }, 500);
    content.push({ type: 'text', text: `Imagem ${index} (arquivo "${asset.original_filename}"):` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: asset.file_type as 'image/jpeg' | 'image/png' | 'image/webp', data: toBase64(new Uint8Array(await blob.arrayBuffer())) },
    });
  }
  content.push({ type: 'text', text: 'Transcreva os itens destas páginas de cardápio seguindo as regras.' });

  const anthropic = new Anthropic({ apiKey });
  let message: Anthropic.Beta.BetaMessage;
  try {
    const stream = anthropic.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: EXTRACTION_SYSTEM_PROMPT,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: 'user', content }],
    });
    message = await stream.finalMessage();
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? error.status : undefined;
    await logUsage(admin, { owner_id: user.id, project_id: projectId, images: pages.length, status: 'error', error: String(error).slice(0, 500) });
    await supabase.from('project_assets').update({ analysis_error: 'Falha ao chamar a IA.' }).in('id', pages.map((p) => p.id));
    const retryable = status === 429 || (status !== undefined && status >= 500);
    return json({ error: 'ai_error', message: retryable ? 'A IA está ocupada. Tente novamente em alguns minutos.' : 'A IA recusou a requisição.' }, 502);
  }

  const usageRow = {
    owner_id: user.id,
    project_id: projectId,
    images: pages.length,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
  };
  if (message.stop_reason === 'refusal') {
    await logUsage(admin, { ...usageRow, status: 'refused' });
    return json({ error: 'ai_refused', message: 'A IA não processou estas imagens. Revise o conteúdo enviado.' }, 422);
  }
  if (message.stop_reason === 'max_tokens') {
    await logUsage(admin, { ...usageRow, status: 'error', error: 'max_tokens' });
    return json({ error: 'too_long', message: 'Cardápio grande demais para uma análise. Envie menos páginas por vez.' }, 422);
  }

  const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  let extraction;
  try {
    extraction = parseExtraction(JSON.parse(text));
  } catch (error) {
    await logUsage(admin, { ...usageRow, status: 'error', error: `json inválido: ${String(error)}`.slice(0, 500) });
    return json({ error: 'invalid_ai_output', message: 'A resposta da IA veio em formato inesperado. Tente novamente.' }, 502);
  }
  await logUsage(admin, { ...usageRow, status: 'success' });

  // Grava categorias (reaproveita as existentes pelo nome) e produtos marcados para revisão.
  const [{ data: existingCats }, { data: existingProducts }] = await Promise.all([
    supabase.from('menu_categories').select('id, name, sort_order').eq('project_id', projectId),
    supabase.from('menu_products').select('name, sort_order').eq('project_id', projectId),
  ]);
  const { items, warnings } = postProcess(extraction, pages.length, (existingProducts ?? []).map((p) => p.name));

  const categoryIds = new Map((existingCats ?? []).map((c) => [normalizeKey(c.name), c.id as string]));
  let nextCatOrder = Math.max(-1, ...(existingCats ?? []).map((c) => c.sort_order)) + 1;
  for (const name of new Set(items.map((i) => i.category))) {
    if (categoryIds.has(normalizeKey(name))) continue;
    const { data: created, error } = await supabase
      .from('menu_categories')
      .insert({ project_id: projectId, name: name.slice(0, 80), sort_order: nextCatOrder++ })
      .select('id')
      .single();
    if (error || !created) return json({ error: 'db_error', message: 'Falha ao criar categorias.' }, 500);
    categoryIds.set(normalizeKey(name), created.id);
  }

  let nextOrder = Math.max(-1, ...(existingProducts ?? []).map((p) => p.sort_order)) + 1;
  const rows = items.map((item) => ({
    project_id: projectId,
    category_id: categoryIds.get(normalizeKey(item.category))!,
    name: item.name.slice(0, 120),
    description: item.description.slice(0, 600),
    price: item.price,
    variations: item.variations,
    sort_order: nextOrder++,
    source_reference: `ia:${pages[item.imageIndex].original_filename}`,
    source_asset_id: pages[item.imageIndex].id,
    confidence: Math.round(item.confidence * 100) / 100,
    review_required: item.reviewRequired,
    review_notes: item.reviewNotes,
  }));
  if (rows.length) {
    const { error } = await supabase.from('menu_products').insert(rows);
    if (error) return json({ error: 'db_error', message: 'Falha ao gravar os produtos extraídos.' }, 500);
  }

  await supabase.from('project_assets').update({ analyzed_at: new Date().toISOString(), analysis_error: null }).in('id', pages.map((p) => p.id));
  await supabase.from('restaurant_projects').update({ status: 'awaiting_review' }).eq('id', projectId);
  await supabase.from('activity_log').insert({
    project_id: projectId,
    action: 'ai_extraction',
    details: { images: pages.length, products: rows.length, model: message.model },
  });

  return json({
    createdProducts: rows.length,
    reviewRequired: rows.filter((r) => r.review_required).length,
    analyzedAssets: pages.length,
    skippedAssets: skipped,
    warnings,
  });
});
