// Única porta de entrada das variáveis de ambiente do navegador.
// Só VITE_* chegam ao bundle — por isso nunca contêm segredos.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const publicBase = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '');

export const env = {
  supabaseUrl: url || null,
  supabaseAnonKey: anonKey || null,
  publicBaseUrl: publicBase || null,
} as const;

/** Sem Supabase o app roda em modo demonstração: dados só neste navegador, sem IA. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/** URL pública de um cardápio. Usada no link e no QR Code. */
export function publicMenuUrl(slug: string): string {
  const base = env.publicBaseUrl ?? window.location.origin;
  return `${base}/m/${slug}`;
}
