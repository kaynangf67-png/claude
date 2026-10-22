"use client";

import { useEffect, useMemo, useState } from "react";
import { buildChallengeView } from "@/domain/challengeView";
import { toLocalDateKey } from "@/domain/progress";
import { useSession } from "./SessionProvider";

/** Data local de hoje; atualiza quando a aba volta a ficar visível (ex.: virou o dia). */
export function useTodayKey(): string {
  const [key, setKey] = useState(() => toLocalDateKey(new Date()));
  useEffect(() => {
    const update = () => setKey(toLocalDateKey(new Date()));
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  return key;
}

export function useChallenge() {
  const session = useSession();
  const today = useTodayKey();
  const view = useMemo(() => (session.data ? buildChallengeView(session.data, today) : null), [session.data, today]);
  return { ...session, today, view };
}
