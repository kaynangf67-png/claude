// Acesso ao banco pelo backend com a service role (ignora RLS). Usado apenas
// pela sincronização agendada e para guardar segredos rotacionados.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from './env';

let admin: SupabaseClient | null = null;

export function isDatabaseConfigured() {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabaseServiceKey);
}

export function adminClient(): SupabaseClient | null {
  if (!isDatabaseConfigured()) return null;
  admin ??= createClient(serverEnv.supabaseUrl!, serverEnv.supabaseServiceKey!, { auth: { persistSession: false } });
  return admin;
}

export async function readSecret(integration: string, key: string): Promise<string | null> {
  const db = adminClient();
  if (!db) return null;
  const { data } = await db.from('integration_secrets').select('value').eq('integration_id', integration).eq('key', key).maybeSingle();
  return (data?.value as string | undefined) ?? null;
}

export async function writeSecret(integration: string, key: string, value: string) {
  const db = adminClient();
  if (!db) return;
  const { error } = await db.from('integration_secrets').upsert({ integration_id: integration, key, value, updated_at: new Date().toISOString() });
  if (error) console.error('[db] falha ao salvar segredo rotacionado', error.message);
}
