"use client";

import { useActionState, useRef, useEffect } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/client";
import { createRecordAction } from "../actions";

export function RecordForm() {
  const [state, action] = useActionState(createRecordAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="kind" className="label">Tipo</label>
          <select id="kind" name="kind" className="input" defaultValue="customer_message">
            <option value="customer_message">Mensagem de cliente</option>
            <option value="note">Nota</option>
            <option value="contact">Contato</option>
            <option value="order">Pedido</option>
          </select>
        </div>
        <div>
          <label htmlFor="sender" className="label">Remetente (opcional)</label>
          <input id="sender" name="sender" maxLength={200} className="input" placeholder="maria@cliente.com.br" />
        </div>
      </div>
      <div>
        <label htmlFor="title" className="label">Título / assunto</label>
        <input id="title" name="title" required maxLength={200} className="input" />
        <FieldError state={state} name="title" />
      </div>
      <div>
        <label htmlFor="body" className="label">Conteúdo</label>
        <textarea id="body" name="body" rows={4} maxLength={20000} className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar registro</SubmitButton>
    </form>
  );
}
