import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import { AuthFailure, translateAuthError } from './authErrors';

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
  resendConfirmation(email: string): Promise<void>;
  signOut(): Promise<void>;
}

const DEMO_USER: AuthUser = { id: 'demo', email: 'demonstracao@local', isDemo: true };
const AuthContext = createContext<AuthState | null>(null);

/** Para onde o link de confirmação do e-mail leva: a tela de login deste app. */
const confirmRedirect = () => `${window.location.origin}/login`;

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
        if (error) throw translateAuthError(error);
      },
      async signUp(email, password) {
        const { data, error } = await getSupabase().auth.signUp({ email, password, options: { emailRedirectTo: confirmRedirect() } });
        if (error) throw translateAuthError(error);
        // Com confirmação de e-mail ligada, o Supabase não acusa e-mail repetido (para não revelar quem tem conta):
        // devolve um usuário sem identidades. Tratamos como "já tem conta".
        if (data.user && data.user.identities?.length === 0) {
          throw new AuthFailure('Este e-mail já tem conta. Entre com sua senha ou reenvie a confirmação, se ainda não confirmou.', 'user_already_exists');
        }
        return { needsConfirmation: !data.session };
      },
      async resendConfirmation(email) {
        const { error } = await getSupabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: confirmRedirect() } });
        if (error) throw translateAuthError(error);
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
