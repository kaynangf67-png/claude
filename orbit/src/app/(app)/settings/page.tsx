import { ConfirmForm, SubmitButton } from "@/components/ui/client";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardHeader, KeyValue, PageHeader } from "@/components/ui/primitives";
import { PageMessage, type SearchParams } from "@/components/page-message";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { toPolicy } from "@/lib/db/repository";
import { hasPermission, ROLE_LABEL } from "@/lib/domain/permissions";
import { aiConfigured, env } from "@/lib/env";
import { listTools } from "@/lib/tools/registry";
import { formatUsd } from "@/lib/utils";
import type { MemberRole } from "@/lib/domain/types";
import { changeMemberAction, emergencyStopAction } from "../actions";
import { AddMemberForm, OrgForm, PolicyForm, ProfileForm } from "./forms";

export const metadata = { title: "Configurações" };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const db = await createUserClient();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const [{ data: policyRow }, { data: profile }, { data: members }, { data: usage }] = await Promise.all([
    db.from("org_policies").select("*").eq("org_id", ctx.orgId).maybeSingle().throwOnError(),
    db.from("profiles").select("full_name, notify_approvals, notify_failures").eq("id", ctx.user.id).maybeSingle().throwOnError(),
    db.from("memberships").select("user_id, role, created_at").eq("org_id", ctx.orgId).order("created_at").throwOnError(),
    db.from("usage_records").select("cost_usd").eq("org_id", ctx.orgId).gte("created_at", monthStart).limit(5000).throwOnError(),
  ]);
  // memberships.user_id references auth.users, so profiles are fetched separately (RLS limits them to co-members).
  const { data: profiles } = await db.from("profiles").select("id, email, full_name").in("id", (members ?? []).map((m) => m.user_id)).throwOnError();
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const policy = toPolicy(policyRow, ctx.orgId);
  const canManage = hasPermission(ctx.role, "policies:manage");
  const canManageMembers = ctx.role === "owner" || ctx.role === "admin";
  const spend = (usage ?? []).reduce((s, u) => s + Number(u.cost_usd ?? 0), 0);
  const tools = listTools().map((t) => ({ id: t.id, name: t.name, defaultMode: t.defaultMode, minimumMode: t.minimumMode, risk: t.risk }));

  return (
    <>
      <PageHeader title="Configurações" />
      <PageMessage params={sp} />
      <div className="space-y-6">
        <Card className={policy.execution_paused ? "border-danger/50" : ""}>
          <CardHeader
            title="Parada de emergência"
            description="Suspende imediatamente a execução de qualquer tarefa da organização. Missões em andamento pausam antes da próxima ação."
            action={policy.execution_paused ? <Badge tone="danger">Ativa</Badge> : <Badge tone="success">Execuções liberadas</Badge>}
          />
          <div className="p-5">
            {canManage ? (
              policy.execution_paused ? (
                <form action={emergencyStopAction}><input type="hidden" name="paused" value="false" /><SubmitButton>Liberar execuções</SubmitButton></form>
              ) : (
                <ConfirmForm action={emergencyStopAction} title="Ativar parada de emergência?" description="Nenhuma tarefa será executada até que você libere novamente. Aprovações pendentes deixarão de valer porque a versão da política muda." confirmLabel="Parar tudo" trigger={<Button type="button" variant="danger">Ativar parada de emergência</Button>}>
                  <input type="hidden" name="paused" value="true" />
                </ConfirmForm>
              )
            ) : <p className="text-sm text-muted">Somente administradores usam este controle.</p>}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader title="Organização" /><div className="p-5"><OrgForm name={ctx.orgName} disabled={!hasPermission(ctx.role, "org:manage")} /></div></Card>
          <Card><CardHeader title="Seu perfil" description={ctx.user.email} /><div className="p-5"><ProfileForm fullName={profile?.full_name ?? ""} notifyApprovals={profile?.notify_approvals ?? true} notifyFailures={profile?.notify_failures ?? true} /></div></Card>
        </div>

        <Card>
          <CardHeader title="Equipe" description="Papéis: proprietário e administrador decidem aprovações e políticas; membros criam e executam missões; leitores apenas acompanham." />
          <ul className="divide-y divide-border">
            {(members ?? []).map((m) => {
              const p = profileById.get(m.user_id);
              const self = m.user_id === ctx.user.id;
              return (
                <li key={m.user_id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <p className="font-medium">{p?.full_name || p?.email || m.user_id}{self ? <span className="text-muted"> (você)</span> : null}</p>
                    <p className="text-xs text-muted">{p?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageMembers && !self ? (
                      <>
                        <form action={changeMemberAction} className="flex items-center gap-1">
                          <input type="hidden" name="user_id" value={m.user_id} /><input type="hidden" name="op" value="role" />
                          <label htmlFor={`role-${m.user_id}`} className="sr-only">Papel</label>
                          <select id={`role-${m.user_id}`} name="role" defaultValue={m.role} className="input h-8 py-0 text-xs">
                            {(["owner", "admin", "member", "viewer"] as const).filter((r) => r !== "owner" || ctx.role === "owner").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>
                          <SubmitButton size="sm" variant="secondary">Salvar</SubmitButton>
                        </form>
                        <ConfirmForm action={changeMemberAction} title="Remover membro?" description="A pessoa perderá acesso imediato a esta organização." confirmLabel="Remover" trigger={<Button type="button" size="sm" variant="ghost">Remover</Button>}>
                          <input type="hidden" name="user_id" value={m.user_id} /><input type="hidden" name="op" value="remove" />
                        </ConfirmForm>
                      </>
                    ) : <Badge>{ROLE_LABEL[m.role as MemberRole]}</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
          {canManageMembers ? <div className="border-t border-border p-5"><AddMemberForm canAddOwner={ctx.role === "owner"} /></div> : null}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Provedor de IA" />
            <div className="p-5">
              {aiConfigured() ? (
                <KeyValue items={[["Provedor", "Anthropic"], ["Modelo", env().ORBIT_AI_MODEL], ["Chave", "Configurada no servidor (não exibida)"]]} />
              ) : (
                <Alert tone="warning">Nenhum provedor configurado. Defina <code>ANTHROPIC_API_KEY</code> no servidor. Chaves nunca são cadastradas ou exibidas pela interface.</Alert>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Uso e limites" />
            <div className="p-5">
              <KeyValue items={[
                ["Gasto estimado de IA no mês", canManage ? formatUsd(spend) : "Visível para administradores"],
                ["Orçamento mensal", formatUsd(policy.monthly_ai_budget_usd)],
                ["Ações por missão", String(policy.max_actions_per_mission)],
                ["Missões por hora", String(policy.missions_per_hour)],
                ["Versão da política", `v${policy.version}`],
              ]} />
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Políticas de autonomia" description="Decisões aplicadas no servidor a cada tarefa. Alterar qualquer item cria uma nova versão e invalida aprovações pendentes." />
          <div className="p-5"><PolicyForm policy={policy} tools={tools} disabled={!canManage} /></div>
        </Card>
      </div>
    </>
  );
}
