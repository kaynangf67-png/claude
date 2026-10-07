// Única porta de entrada para variáveis de ambiente do frontend.
// Só variáveis VITE_* chegam ao bundle — e por isso NUNCA devem conter segredos.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const aiMode = (import.meta.env.VITE_AI_MODE as string | undefined) ?? 'local';

export const env = {
  supabaseUrl: url?.trim() || null,
  supabaseAnonKey: anonKey?.trim() || null,
  aiMode: aiMode === 'remote' ? 'remote' : 'local',
} as const;

/** Sem Supabase configurado o app inteiro roda em modo demonstração local. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
