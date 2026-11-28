"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}

const Ctx = createContext<(message: string, kind?: Kind) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, kind: Kind = "info") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === "error" ? 6500 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="glass pointer-events-auto flex w-full max-w-md animate-fade-up items-start gap-3 rounded-2xl border border-line px-4 py-3 text-sm text-fg shadow-2xl"
          >
            {t.kind === "success" ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-brand" />
            ) : t.kind === "error" ? (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-500" />
            ) : (
              <Info className="mt-0.5 size-5 shrink-0 text-sky-500" />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button aria-label="Fechar" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} className="text-muted">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
