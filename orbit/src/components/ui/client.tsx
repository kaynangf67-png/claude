"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, type ButtonVariant } from "./button";

export function SubmitButton({ children, pendingText, variant = "primary", size = "md", className, disabled }: { children: ReactNode; pendingText?: string; variant?: ButtonVariant; size?: "sm" | "md" | "lg"; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export function FormMessage({ state }: { state: ActionState | null | undefined }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-green-300" : "text-sm text-red-300"}>
      {state.message}
    </p>
  );
}

export function FieldError({ state, name }: { state: ActionState | null | undefined; name: string }) {
  const err = state?.fieldErrors?.[name]?.[0];
  return err ? <p className="mt-1 text-xs text-red-300">{err}</p> : null;
}

/**
 * A form whose submit first opens an accessible confirmation dialog.
 * The server action still performs its own authorization; this only
 * prevents accidental clicks.
 */
export function ConfirmForm({ action, title, description, confirmLabel, variant = "danger", trigger, children }: { action: (fd: FormData) => void | Promise<void>; title: string; description: ReactNode; confirmLabel: string; variant?: ButtonVariant; trigger: ReactNode; children?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <span onClick={() => dialog.current?.showModal()} className="contents">
        {trigger}
      </span>
      <dialog ref={dialog} className="m-auto w-[min(92vw,28rem)] rounded-xl border border-border-strong bg-surface p-0 text-fg backdrop:bg-black/60">
        <form action={action} className="p-5" onSubmit={() => setTimeout(() => dialog.current?.close(), 0)}>
          <h2 className="text-base font-semibold">{title}</h2>
          <div className="mt-2 text-sm text-muted">{description}</div>
          {children}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>
              Voltar
            </Button>
            <SubmitButton variant={variant}>{confirmLabel}</SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Refreshes server data periodically while something is in progress. */
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}

export function MobileNavToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <Button variant="ghost" size="sm" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
        Menu
      </Button>
      {open ? (
        <div id="mobile-nav" className="absolute inset-x-0 top-14 z-40 border-b border-border bg-surface p-3" onClick={() => setOpen(false)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
