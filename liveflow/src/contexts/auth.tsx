import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAuth } from '@/services/backend';
import type { AuthService, AuthUser } from '@/services/data/types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  auth: AuthService;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = getAuth();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    auth.getUser().then((u) => {
      if (!alive) return;
      setUser(u);
      setLoading(false);
    });
    const off = auth.onChange((u) => {
      setUser((prev) => {
        // Troca de usuário: nunca reaproveitar cache de outra conta.
        if (prev?.id !== u?.id) queryClient.clear();
        return u;
      });
      setLoading(false);
    });
    return () => {
      alive = false;
      off();
    };
  }, [auth, queryClient]);

  const value = useMemo(() => ({ user, loading, auth }), [user, loading, auth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
