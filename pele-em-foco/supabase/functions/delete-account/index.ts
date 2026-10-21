// Edge Function: exclui a conta do usuário autenticado (auth.users) e, em cascata,
// perfil, rotina, diário e acesso. Precisa da service_role, por isso roda no servidor.
//
// STATUS: implantado em 21/10/2026; ainda NÃO testado pelo app real.
// Deploy: supabase functions deploy delete-account   (com verificação de JWT, o padrão)
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('APP_ORIGIN') ?? '*';
const cors = {
  'access-control-allow-origin': ALLOWED_ORIGIN,
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'unauthorized' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'unauthorized' });

  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
  if (delError) return json(500, { error: 'delete_failed' });
  return json(200, { deleted: true });
});
