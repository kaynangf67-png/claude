"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { toLocalDateKey } from "@/domain/progress";
import { useSession } from "./SessionProvider";

/** Aviso honesto do modo demonstração + atalho para explorar com uma conta de exemplo. */
export function DemoModeNotice() {
  const { backend, refresh } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!backend || backend.mode !== "demo" || !backend.demoTools) return null;
  const tools = backend.demoTools;

  async function explore() {
    setBusy(true);
    setError(null);
    const res = await tools.enterSampleAccount(toLocalDateKey(new Date()));
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    await refresh();
    router.push("/inicio");
  }

  return (
    <div className="mb-6 grid gap-3">
      <Notice tone="demo" title="Modo demonstração">
        O banco de dados ainda não está conectado. Sua conta e seu progresso ficam salvos só neste navegador.
      </Notice>
      <Button variant="secondary" onClick={explore} loading={busy} className="w-full">
        Explorar com uma conta de exemplo
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
