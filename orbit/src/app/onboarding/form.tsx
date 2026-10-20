"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/client";
import { createOrganizationAction } from "./actions";

export function OrgForm() {
  const [state, action] = useActionState(createOrganizationAction, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className="label">Nome da organização</label>
        <input id="name" name="name" required minLength={2} maxLength={120} className="input" placeholder="Ex.: Atendimento Comercial Ltda." />
        <FieldError state={state} name="name" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Criando…">Criar organização</SubmitButton>
    </form>
  );
}
