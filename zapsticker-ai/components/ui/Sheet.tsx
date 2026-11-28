"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Painel estilo iOS: sobe de baixo no celular, centralizado no computador. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Fechar" className="absolute inset-0 animate-[fade-up_0.2s_ease_both] bg-black/55" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-t-[28px] border border-line bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-2xl sm:rounded-[28px] sm:pb-5">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>}
          <button onClick={onClose} aria-label="Fechar" className="ml-auto flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
