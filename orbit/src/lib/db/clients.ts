import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, supabaseConfigured } from "@/lib/env";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase não está configurado");
    this.name = "SupabaseNotConfiguredError";
  }
}

/** User-scoped client: every query runs under the user's JWT and RLS. */
export async function createUserClient(): Promise<SupabaseClient> {
  if (!supabaseConfigured()) throw new SupabaseNotConfiguredError();
  const e = env();
  const store = await cookies();
  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are refreshed by proxy.ts instead.
        }
      },
    },
  });
}

let service: SupabaseClient | null = null;
/**
 * Service-role client. Bypasses RLS, so it is only used inside the engine
 * and server actions AFTER the caller's membership and permission were
 * checked, and every query is explicitly filtered by org_id.
 */
export function createServiceClient(): SupabaseClient {
  if (!supabaseConfigured()) throw new SupabaseNotConfiguredError();
  if (!service) {
    const e = env();
    service = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return service;
}
