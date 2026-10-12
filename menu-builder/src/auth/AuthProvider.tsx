import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  isDemo: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
}

const DEMO_USER: AuthUser = { id: 'demo', email: 'demonstracao@local', isDemo: true };
const AuthContext = createContext<AuthState | null>(null);

const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail pelo link enviado antes de entrar.',
  'User already registered': 'Este e-mail já tem conta. Entre com sua senha.',
};
const translate = (message: string) => AUTH_ERRORS[message] ?? message;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(isSupabaseConfigured ? null : DEMO_USER);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    const map = (u: { id: string; email?: string } | null | undefined) => (u ? { id: u.id, email: u.email ?? '', isDemo: false } : null);
    supabase.auth.getSession().then(({ data }) => {
      setUser(map(data.session?.user));
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(map(session?.user)));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      async signIn(email, password) {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw new Error(translate(error.message));
      },
      async signUp(email, password) {
        const { data, error } = await getSupabase().auth.signUp({ email, password });
        if (error) throw new Error(translate(error.message));
        return { needsConfirmation: !data.session };
      },
      async signOut() {
        if (isSupabaseConfigured) await getSupabase().auth.signOut();
      },
    }),
    [user, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
