import { env } from "@/lib/env";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Backend } from "./backend";
import { DemoBackend } from "./demoBackend";
import { SupabaseBackend } from "./supabaseBackend";

let backend: Backend | null = null;

/** Único ponto que escolhe entre modo demonstração e Supabase. Só no navegador. */
export function getBackend(): Backend {
  if (typeof window === "undefined") throw new Error("getBackend() só pode ser usado no navegador.");
  backend ??= env.isSupabaseConfigured ? new SupabaseBackend(getBrowserSupabase()) : new DemoBackend(window.localStorage);
  return backend;
}

export type { Backend, Result } from "./backend";
