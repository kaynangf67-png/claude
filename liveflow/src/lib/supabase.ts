import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from './env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado (defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).');
  if (!client) {
    client = createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
