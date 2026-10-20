import "server-only";
import { unstable_rethrow } from "next/navigation";
import { EngineError } from "@/lib/engine/engine";
import { PermissionError } from "@/lib/domain/permissions";
import { InvalidTransitionError } from "@/lib/domain/states";
import type { ActionState } from "@/components/ui/client";

/** Maps known errors to user-facing pt-BR messages; never leaks internals. */
export function toActionState(e: unknown): ActionState {
  // Let redirect()/notFound() thrown inside try blocks propagate.
  unstable_rethrow(e);
  if (e instanceof EngineError) return { ok: false, message: e.message };
  if (e instanceof PermissionError) return { ok: false, message: "Você não tem permissão para esta ação." };
  if (e instanceof InvalidTransitionError) return { ok: false, message: "Esta ação não é permitida no estado atual." };
  console.error("[orbit] unexpected action error", e);
  return { ok: false, message: "Ocorreu um erro inesperado. Tente novamente." };
}
