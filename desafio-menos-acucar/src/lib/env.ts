// Só variáveis públicas (NEXT_PUBLIC_*) podem ser lidas aqui: este módulo roda no navegador.
// Acesso estático é obrigatório para o Next.js embutir os valores no bundle.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  /** Opcional: e-mail público do fundador para contato. Sem ele, o contato é só pelo formulário no app. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  /** Sem Supabase configurado, o app roda em modo demonstração (dados só no navegador). */
  isSupabaseConfigured: Boolean(url && anonKey),
} as const;
