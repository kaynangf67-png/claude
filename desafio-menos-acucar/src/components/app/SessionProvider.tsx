"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserData } from "@/domain/types";
import { getBackend, type Backend } from "@/services";

type Status = "loading" | "anonymous" | "authenticated" | "error";

interface SessionValue {
  status: Status;
  data: UserData | null;
  error: string | null;
  backend: Backend | null;
  /** Recarrega dados do backend (depois de qualquer escrita). */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<UserData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (b: Backend) => {
    try {
      const uid = await b.currentUserId();
      if (!uid) {
        setData(null);
        setStatus("anonymous");
        return;
      }
      const res = await b.loadUserData();
      if (res.ok) {
        setData(res.data);
        setError(null);
        setStatus("authenticated");
      } else {
        setError(res.error);
        setStatus("error");
      }
    } catch {
      setError("Não foi possível carregar seus dados. Verifique sua conexão.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const b = getBackend();
    setBackend(b);
    void load(b);
  }, [load]);

  const refresh = useCallback(async () => {
    if (backend) await load(backend);
  }, [backend, load]);

  const value = useMemo(() => ({ status, data, error, backend, refresh }), [status, data, error, backend, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession precisa estar dentro de <SessionProvider>.");
  return ctx;
}
