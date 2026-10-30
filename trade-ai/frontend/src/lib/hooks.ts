import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useLive } from "./live";
import type { Signal } from "./types";

/** Carrega dados e recarrega a cada evento ao vivo (ou intervalo). */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = [], follow = true) {
  const { version } = useLive();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tick = follow ? version : 0;
  useEffect(() => {
    let alive = true;
    load().then((d) => alive && (setData(d), setError(null))).catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, setData };
}

export function useExecute() {
  const { toast, refresh } = useLive();
  return useCallback(async (s: Signal) => {
    try {
      const t = await api.openTrade(s.id);
      toast(`Entrada demo ${s.symbol} a ${t.entry.toPrecision(6)}`, "ok");
      await refresh();
    } catch (e) {
      toast((e as Error).message, "erro");
    }
  }, [toast, refresh]);
}
