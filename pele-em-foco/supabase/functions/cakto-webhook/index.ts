// Edge Function: recebe o webhook da Cakto e registra a compra verificada.
// A ativação dos 30 dias acontece quando a pessoa entra no app com o MESMO e-mail
// (confirmado) — função public.claim_verified_purchase().
//
// STATUS: código pronto, NÃO implantado nem testado contra a Cakto real.
// Deploy: supabase functions deploy cakto-webhook --no-verify-jwt
// Secrets: supabase secrets set CAKTO_WEBHOOK_SECRET=... CAKTO_PRODUCT_ID=...
import { createClient } from 'npm:@supabase/supabase-js@2';
import { decideCaktoEvent } from '../_shared/cakto.ts';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const decision = decideCaktoEvent(body, Deno.env.get('CAKTO_WEBHOOK_SECRET') ?? '', Deno.env.get('CAKTO_PRODUCT_ID') ?? null);
  if (decision.action === 'reject') return json(decision.httpStatus, { error: decision.reason });
  if (decision.action === 'ignore') return json(200, { ignored: decision.reason });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { error } = await admin.rpc('record_verified_purchase', {
    p_email: decision.email,
    p_order_id: decision.orderId,
    p_product_id: decision.productId,
    p_status: decision.status,
    p_source: 'cakto',
  });
  if (error) {
    console.error('record_verified_purchase falhou', error.message);
    return json(500, { error: 'db_error' });
  }
  return json(200, { recorded: decision.event, order: decision.orderId });
});
