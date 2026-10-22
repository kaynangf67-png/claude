import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!env.isSupabaseConfigured) throw new Error("Supabase não está configurado.");
  client ??= createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
