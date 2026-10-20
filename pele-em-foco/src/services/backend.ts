// Único ponto que escolhe entre Supabase (produção) e modo demonstração.
// As condições usam import.meta.env diretamente para o Vite eliminar do build de
// produção o código (e o conteúdo da biblioteca) do modo demonstração.
import type { AuthService, DataService, DemoControls } from './types';

export interface Backend {
  mode: 'supabase' | 'demo';
  auth: AuthService;
  data: DataService;
  demo: DemoControls | null;
}

let backend: Promise<Backend | null> | null = null;

export function loadBackend(): Promise<Backend | null> {
  backend ??= (async () => {
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      const [{ getSupabase }, { SupabaseAuthService }, { SupabaseDataService }] = await Promise.all([
        import('./supabase/client'),
        import('./supabase/auth'),
        import('./supabase/data'),
      ]);
      const db = getSupabase();
      return { mode: 'supabase', auth: new SupabaseAuthService(db), data: new SupabaseDataService(db), demo: null };
    }
    if (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true') {
      const { DemoBackend } = await import('./demo/index');
      const demo = new DemoBackend();
      return { mode: 'demo', auth: demo, data: demo, demo };
    }
    return null; // build de produção sem Supabase e sem VITE_DEMO_MODE: o app mostra "configuração pendente"
  })();
  return backend;
}
