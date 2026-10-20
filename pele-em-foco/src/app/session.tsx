import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadBackend, type Backend } from '../services/backend';
import type { AccessInfo, AuthUser, ClaimResult, Profile } from '../services/types';

interface Session {
  /** null = backend ainda carregando; 'unconfigured' = build sem Supabase nem modo demo */
  backend: Backend | 'unconfigured' | null;
  user: AuthUser | null;
  loadingUser: boolean;
  profile: Profile | null;
  access: AccessInfo | null;
  lastClaim: ClaimResult | null;
  /** Rechecagem do acesso (e nova tentativa de vincular compra verificada). */
  refreshAccess: (opts?: { claim?: boolean }) => Promise<AccessInfo | null>;
  refreshProfile: () => Promise<void>;
  /** Evento do Supabase quando a pessoa chega pelo link de redefinição de senha */
  recoveringPassword: boolean;
  /** true depois de um "Sair" explícito: o login não deve voltar para a última página */
  signedOut: boolean;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | 'unconfigured' | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [lastClaim, setLastClaim] = useState<ClaimResult | null>(null);
  const [recoveringPassword, setRecovering] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    void loadBackend().then(async (b) => {
      if (!b) {
        setBackend('unconfigured');
        setLoadingUser(false);
        return;
      }
      setBackend(b);
      unsub = b.auth.onChange((u, event) => {
        if (event === 'PASSWORD_RECOVERY') setRecovering(true);
        setSignedOut(event === 'SIGNED_OUT');
        setUser(u);
      });
      setUser(await b.auth.getUser().catch(() => null));
      setLoadingUser(false);
    });
    return () => unsub();
  }, []);

  const b = backend && backend !== 'unconfigured' ? backend : null;

  const refreshAccess = useCallback(
    async ({ claim = true } = {}) => {
      if (!b || !user) return null;
      let info = await b.data.getAccess();
      // Conta sem acesso ativo: tenta vincular uma compra verificada pelo servidor.
      if (claim && info.status !== 'active') {
        const result = await b.data.claimAccess().catch(() => null);
        setLastClaim(result);
        if (result === 'activated') info = await b.data.getAccess();
      }
      setAccess(info);
      return info;
    },
    [b, user],
  );

  const refreshProfile = useCallback(async () => {
    if (!b || !user) return;
    setProfile(await b.data.getProfile().catch(() => null));
  }, [b, user]);

  useEffect(() => {
    setAccess(null);
    setProfile(null);
    setLastClaim(null);
    if (user) {
      void refreshProfile();
      void refreshAccess().catch(() => setAccess({ status: 'none', startsAt: null, expiresAt: null, source: null }));
    }
  }, [user, refreshAccess, refreshProfile]);

  const value = useMemo<Session>(
    () => ({ backend, user, loadingUser, profile, access, lastClaim, refreshAccess, refreshProfile, recoveringPassword, signedOut }),
    [backend, user, loadingUser, profile, access, lastClaim, refreshAccess, refreshProfile, recoveringPassword, signedOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession fora do SessionProvider');
  return s;
}

/** Backend já carregado (use só dentro de telas protegidas). */
export function useBackend(): Backend {
  const { backend } = useSession();
  if (!backend || backend === 'unconfigured') throw new Error('Backend indisponível');
  return backend;
}
