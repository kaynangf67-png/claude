"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/client";
import { createMissionAction } from "../../actions";

export function NewMissionForm({ aiAvailable }: { aiAvailable: boolean }) {
  const [state, action] = useActionState(createMissionAction, null);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="name" className="label">Nome</label>
        <input id="name" name="name" required maxLength={120} className="input" placeholder="Triagem do atendimento da semana" />
        <FieldError state={state} name="name" />
      </div>
      <div>
        <label htmlFor="objective" className="label">Objetivo</label>
        <textarea id="objective" name="objective" required rows={6} maxLength={4000} className="input" placeholder="Classifique as mensagens de clientes abertas em suporte, vendas ou financeiro, crie itens de trabalho para as urgentes e gere um relatório do período." />
        <p className="hint">Descreva o resultado esperado. O texto é tratado como dado: ele não altera regras, permissões ou ferramentas.</p>
        <FieldError state={state} name="objective" />
      </div>
      <fieldset>
        <legend className="label">Como montar o plano</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`card flex cursor-pointer gap-3 p-4 ${aiAvailable ? "" : "cursor-not-allowed opacity-60"}`}>
            <input type="radio" name="planning" value="ai" defaultChecked={aiAvailable} disabled={!aiAvailable} className="mt-1 accent-[#3b82f6]" />
            <span>
              <span className="block text-sm font-medium">Gerar com o Estrategista</span>
              <span className="mt-0.5 block text-xs text-muted">{aiAvailable ? "A IA propõe tarefas; você revisa antes de executar." : "Indisponível: provedor de IA não configurado."}</span>
            </span>
          </label>
          <label className="card flex cursor-pointer gap-3 p-4">
            <input type="radio" name="planning" value="manual" defaultChecked={!aiAvailable} className="mt-1 accent-[#3b82f6]" />
            <span>
              <span className="block text-sm font-medium">Montar manualmente</span>
              <span className="mt-0.5 block text-xs text-muted">Você escolhe as ferramentas e parâmetros de cada tarefa.</span>
            </span>
          </label>
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton pendingText={aiAvailable ? "Criando e planejando…" : "Criando…"}>Criar missão</SubmitButton>
    </form>
  );
}
