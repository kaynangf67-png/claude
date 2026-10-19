import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import { LocalRepository } from '@/data/localRepository';
import { SupabaseRepository } from '@/data/supabaseRepository';
import { DEMO_FEES, demoProducts } from '@/data/demo';
import type { Repository } from '@/data/types';

type Mode = 'demo' | 'local' | 'supabase';

interface AppState {
  mode: Mode;
  repo: Repository | null; // null = precisa de login
  session: Session | null;
  authReady: boolean;
  demo: boolean;
  setDemo(on: boolean): void;
  resetDemo(): void;
  signOut(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);
const DEMO_KEY = 'trenddrop:demo-mode';

const readDemo = () => {
  try {
    return localStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
};

const makeDemoRepo = () => new LocalRepository('demo', () => ({ products: demoProducts(), fees: DEMO_FEES }));

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [demo, setDemoState] = useState(readDemo);
  const [demoNonce, setDemoNonce] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const repo = useMemo<Repository | null>(() => {
    if (demo) return makeDemoRepo();
    if (!isSupabaseConfigured) return new LocalRepository('local');
    return session ? new SupabaseRepository(getSupabase(), session.user.id) : null;
    // demoNonce força recriação após reset dos dados de demonstração
  }, [demo, session?.user.id, demoNonce]);

  const mode: Mode = demo ? 'demo' : isSupabaseConfigured ? 'supabase' : 'local';

  const setDemo = useCallback(
    (on: boolean) => {
      try {
        localStorage.setItem(DEMO_KEY, on ? '1' : '0');
      } catch {
        /* ignora */
      }
      setDemoState(on);
      qc.clear();
    },
    [qc],
  );

  const resetDemo = useCallback(() => {
    new LocalRepository('demo').reset();
    setDemoNonce((n) => n + 1);
    qc.clear();
  }, [qc]);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await getSupabase().auth.signOut();
    qc.clear();
  }, [qc]);

  return <Ctx.Provider value={{ mode, repo, session, authReady, demo, setDemo, resetDemo, signOut }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp fora do AppProvider');
  return ctx;
}

export function useRepo(): Repository {
  const { repo } = useApp();
  if (!repo) throw new Error('Repositório indisponível (faça login).');
  return repo;
}
