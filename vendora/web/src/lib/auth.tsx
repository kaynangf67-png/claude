import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type Meta, type User } from './api';

interface AuthState {
  user: User | null;
  meta: Meta | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: User | null }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (!(e instanceof ApiError) || e.status !== 401) console.warn(e);
      })
      .finally(() => setLoading(false));
    api.get<Meta>('/api/meta').then(setMeta).catch(() => setMeta(null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser((await api.post<{ user: User }>('/api/auth/login', { email, password })).user);
  }, []);
  const register = useCallback(async (name: string, email: string, password: string) => {
    setUser((await api.post<{ user: User }>('/api/auth/register', { name, email, password })).user);
  }, []);
  const logout = useCallback(async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, meta, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
