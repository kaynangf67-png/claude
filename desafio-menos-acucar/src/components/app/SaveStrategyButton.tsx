"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSession } from "./SessionProvider";

export function SaveStrategyButton({ strategyId, title, className }: { strategyId: string; title: string; className?: string }) {
  const { backend, data, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = Boolean(data?.strategies.some((s) => s.strategyId === strategyId));

  async function toggle() {
    if (!backend) return;
    setBusy(true);
    setError(null);
    const res = saved ? await backend.removeStrategy(strategyId) : await backend.saveStrategy(strategyId);
    if (!res.ok) setError(res.error);
    await refresh();
    setBusy(false);
  }

  return (
    <div className={className}>
      <Button
        variant={saved ? "ghost" : "secondary"}
        size="sm"
        onClick={toggle}
        loading={busy}
        aria-pressed={saved}
        aria-label={saved ? `Remover “${title}” das estratégias salvas` : `Salvar “${title}” nas suas estratégias`}
        icon={saved ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
      >
        {saved ? "Salva" : "Salvar"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
