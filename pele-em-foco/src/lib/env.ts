// Única porta de entrada das variáveis do backend no frontend.
// Só VITE_* chega ao navegador — e por isso NUNCA deve conter segredos.
// A anon key do Supabase é pública por design: quem protege os dados é o RLS.

const read = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const env = {
  supabaseUrl: read(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: read(import.meta.env.VITE_SUPABASE_ANON_KEY),
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/**
 * Modo demonstração: autenticação e dados só no navegador, SEM segurança real.
 * Liga sozinho em desenvolvimento quando não há Supabase; em build de produção
 * precisa de VITE_DEMO_MODE=true, para nunca ir ao ar por engano.
 */
export const demoAllowed = !isSupabaseConfigured && (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true');

export type BackendMode = 'supabase' | 'demo' | 'unconfigured';
export const backendMode: BackendMode = isSupabaseConfigured ? 'supabase' : demoAllowed ? 'demo' : 'unconfigured';
