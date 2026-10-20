"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/client";
import type { OrgPolicy, ToolMode } from "@/lib/domain/types";
import { addMemberAction, updateOrgAction, updatePolicyAction, updateProfileAction } from "../actions";

export function OrgForm({ name, disabled }: { name: string; disabled: boolean }) {
  const [state, action] = useActionState(updateOrgAction, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="org-name" className="label">Nome</label>
        <input id="org-name" name="name" defaultValue={name} disabled={disabled} className="input" maxLength={120} />
        <FieldError state={state} name="name" />
      </div>
      <FormMessage state={state} />
      {!disabled ? <SubmitButton size="sm">Salvar</SubmitButton> : null}
    </form>
  );
}

export function ProfileForm({ fullName, notifyApprovals, notifyFailures }: { fullName: string; notifyApprovals: boolean; notifyFailures: boolean }) {
  const [state, action] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="full_name" className="label">Nome</label>
        <input id="full_name" name="full_name" defaultValue={fullName} className="input" maxLength={120} />
        <FieldError state={state} name="full_name" />
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Notificações</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_approvals" defaultChecked={notifyApprovals} className="accent-[#3b82f6]" /> Novas aprovações pendentes</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_failures" defaultChecked={notifyFailures} className="accent-[#3b82f6]" /> Falhas de missão</label>
        <p className="hint">As preferências ficam salvas. O envio de notificações por e-mail ainda não está implementado nesta versão; acompanhe pelo painel e pela caixa de aprovações.</p>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton size="sm">Salvar perfil</SubmitButton>
    </form>
  );
}

export function AddMemberForm({ canAddOwner }: { canAddOwner: boolean }) {
  const [state, action] = useActionState(addMemberAction, null);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="member-email" className="label">E-mail</label>
        <input id="member-email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label htmlFor="member-role" className="label">Papel</label>
        <select id="member-role" name="role" defaultValue="member" className="input">
          {canAddOwner ? <option value="owner">Proprietário</option> : null}
          <option value="admin">Administrador</option>
          <option value="member">Membro</option>
          <option value="viewer">Leitor</option>
        </select>
      </div>
      <SubmitButton>Adicionar</SubmitButton>
      <div className="sm:basis-full"><FormMessage state={state} /></div>
    </form>
  );
}

const MODE_LABEL: Record<ToolMode | "default", string> = { default: "Padrão", auto: "Automática", approval: "Exige aprovação", blocked: "Bloqueada" };

export function PolicyForm({ policy, tools, disabled }: { policy: OrgPolicy; tools: { id: string; name: string; defaultMode: ToolMode; minimumMode: ToolMode; risk: string }[]; disabled: boolean }) {
  const [state, action] = useActionState(updatePolicyAction, null);
  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={disabled} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["max_actions_per_mission", "Máx. de ações por missão", policy.max_actions_per_mission, 1, 200],
            ["max_task_duration_s", "Tempo máx. por tarefa (s)", Math.round(policy.max_task_duration_ms / 1000), 1, 300],
            ["missions_per_hour", "Missões por hora (limite)", policy.missions_per_hour, 1, 1000],
            ["monthly_ai_budget_usd", "Orçamento mensal de IA (US$)", policy.monthly_ai_budget_usd, 0, 100000],
            ["approval_ttl_hours", "Validade de aprovações (h)", policy.approval_ttl_hours, 1, 720],
          ] as const).map(([name, label, value, min, max]) => (
            <div key={name}>
              <label htmlFor={name} className="label">{label}</label>
              <input id={name} name={name} type="number" step={name === "monthly_ai_budget_usd" ? "0.01" : "1"} min={min} max={max} defaultValue={value} className="input" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="require_plan_review" defaultChecked={policy.require_plan_review} className="accent-[#3b82f6]" /> Exigir revisão humana de planos gerados pela IA</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="require_distinct_approver" defaultChecked={policy.require_distinct_approver} className="accent-[#3b82f6]" /> Exigir que outra pessoa aprove ações de missões criadas por mim</label>
        </div>
        <div>
          <label htmlFor="email_allowed_domains" className="label">Domínios liberados para envio de e-mail</label>
          <input id="email_allowed_domains" name="email_allowed_domains" defaultValue={policy.email_allowed_domains.join(", ")} className="input" placeholder="suaempresa.com.br, cliente.com.br" />
          <p className="hint">Sem domínios, o envio de e-mails fica bloqueado. Rascunhos não são afetados.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base min-w-[560px]">
            <thead><tr><th scope="col">Ferramenta</th><th scope="col">Risco base</th><th scope="col">Modo</th></tr></thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}<p className="font-mono text-[11px] text-subtle">{t.id}</p></td>
                  <td className="text-muted">{t.risk}</td>
                  <td>
                    <label htmlFor={`mode-${t.id}`} className="sr-only">Modo de {t.name}</label>
                    <select id={`mode-${t.id}`} name={`mode:${t.id}`} defaultValue={policy.tool_modes[t.id] ?? "default"} className="input h-8 py-0 text-xs">
                      <option value="default">{MODE_LABEL.default} ({MODE_LABEL[t.defaultMode]})</option>
                      {t.minimumMode === "auto" ? <option value="auto">{MODE_LABEL.auto}</option> : null}
                      <option value="approval">{MODE_LABEL.approval}</option>
                      <option value="blocked">{MODE_LABEL.blocked}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
      <FormMessage state={state} />
      {!disabled ? <SubmitButton>Salvar políticas</SubmitButton> : <p className="text-xs text-subtle">Somente administradores alteram políticas.</p>}
    </form>
  );
}
