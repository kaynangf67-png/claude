import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../lib/env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseAnonKey) throw new Error('Supabase não configurado.');
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
