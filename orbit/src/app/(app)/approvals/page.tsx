import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ConfirmForm, SubmitButton } from "@/components/ui/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, JsonBlock, KeyValue, Mono, PageHeader } from "@/components/ui/primitives";
import { ApprovalStatusBadge, RiskBadge } from "@/components/ui/status";
import { PageMessage, type SearchParams } from "@/components/page-message";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { hasPermission } from "@/lib/domain/permissions";
import { getTool } from "@/lib/tools/registry";
import { formatDateTime, formatRelative, requestTime } from "@/lib/utils";
import type { Approval } from "@/lib/domain/types";
import { decideApprovalAction } from "../actions";

export const metadata = { title: "Aprovações" };

type Row = Approval & { missions: { name: string } | null; tasks: { title: string } | null };

export default async function ApprovalsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const db = await createUserClient();
  const [pendingRes, historyRes] = await Promise.all([
    db.from("approvals").select("*, missions(name), tasks!approvals_task_id_fkey(title)").eq("org_id", ctx.orgId).eq("status", "pending").order("created_at").throwOnError(),
    db.from("approvals").select("*, missions(name), tasks!approvals_task_id_fkey(title)").eq("org_id", ctx.orgId).neq("status", "pending").order("created_at", { ascending: false }).limit(50).throwOnError(),
  ]);
  const pending = (pendingRes.data ?? []) as Row[];
  const history = (historyRes.data ?? []) as Row[];
  const canDecide = hasPermission(ctx.role, "approvals:decide");
  const now = requestTime();

  return (
    <>
      <PageHeader title="Aprovações" description="Cada aprovação autoriza uma única ação com exatamente estes parâmetros. Se algo mudar, ela deixa de valer." />
      <PageMessage params={sp} />
      {!canDecide ? <p className="mb-4 text-sm text-muted">Seu papel permite acompanhar, mas não decidir aprovações.</p> : null}

      {pending.length === 0 ? (
        <Card><EmptyState icon={ShieldCheck} title="Nada aguardando aprovação" description="Quando uma tarefa precisar de decisão humana, ela aparece aqui e a execução fica pausada." /></Card>
      ) : (
        <div className="space-y-4">
          {pending.map((a) => {
            const tool = getTool(a.tool_id);
            const expired = new Date(a.expires_at).getTime() <= now;
            return (
              <Card key={a.id}>
                <div id={a.id} className="scroll-mt-20" />
                <CardHeader
                  title={<span className="flex flex-wrap items-center gap-2">{tool?.name ?? a.tool_id} <RiskBadge risk={a.risk} /></span>}
                  description={<>Missão <Link href={`/missions/${a.mission_id}`} className="text-accent hover:underline">{a.missions?.name}</Link> · tarefa {a.tasks?.title}</>}
                />
                <div className="space-y-4 p-5">
                  <KeyValue items={[
                    ["Ação solicitada", <span key="t">{tool?.name ?? a.tool_id} <Mono>{a.tool_id}</Mono></span>],
                    ["Destino", a.target],
                    ["Por que exige aprovação", a.reason],
                    ["Impacto esperado", a.impact],
                    ["Solicitada", `${formatDateTime(a.created_at)} (política v${a.policy_version})`],
                    ["Expira", expired ? "Expirada" : `${formatDateTime(a.expires_at)} (${formatRelative(a.expires_at)})`],
                  ]} />
                  <div><p className="mb-2 text-xs font-medium text-subtle">Parâmetros exatos que serão usados</p><JsonBlock value={a.params} /></div>
                  {a.evidence ? <details><summary className="cursor-pointer text-xs text-accent">Contexto disponível</summary><div className="mt-2"><JsonBlock value={a.evidence} /></div></details> : null}
                  <p className="text-xs text-subtle">Vínculo: <Mono>{a.binding_hash.slice(0, 16)}…</Mono></p>
                  {canDecide && !expired ? (
                    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
                      <form action={decideApprovalAction} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                        <input type="hidden" name="approval_id" value={a.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <div className="flex-1">
                          <label htmlFor={`note-${a.id}`} className="label">Observação (opcional)</label>
                          <input id={`note-${a.id}`} name="note" maxLength={1000} className="input" />
                        </div>
                        <SubmitButton pendingText="Aprovando…">Aprovar esta ação</SubmitButton>
                      </form>
                      <ConfirmForm
                        action={decideApprovalAction}
                        title="Rejeitar esta ação?"
                        description="A tarefa será ignorada e as que dependem dela também."
                        confirmLabel="Rejeitar"
                        trigger={<Button type="button" variant="danger">Rejeitar</Button>}
                      >
                        <input type="hidden" name="approval_id" value={a.id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <label htmlFor={`rnote-${a.id}`} className="label mt-4">Motivo</label>
                        <input id={`rnote-${a.id}`} name="note" maxLength={1000} className="input" />
                      </ConfirmForm>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-8">
        <CardHeader title="Histórico" description="Últimas 50 decisões e encerramentos" />
        {history.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Nenhuma decisão registrada.</p> : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[640px]">
              <thead><tr><th scope="col">Ação</th><th scope="col">Missão</th><th scope="col">Status</th><th scope="col">Decisão</th></tr></thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id} id={a.id}>
                    <td>{getTool(a.tool_id)?.name ?? a.tool_id}<p className="text-xs text-muted">{a.target}</p></td>
                    <td><Link href={`/missions/${a.mission_id}`} className="text-muted hover:text-fg">{a.missions?.name}</Link></td>
                    <td><ApprovalStatusBadge status={a.status} /></td>
                    <td className="text-muted">{formatDateTime(a.decided_at ?? a.created_at)}{a.decision_note ? <p className="text-xs">“{a.decision_note}”</p> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
