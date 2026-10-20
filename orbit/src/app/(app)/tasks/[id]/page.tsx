import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, JsonBlock, KeyValue, Mono, PageHeader } from "@/components/ui/primitives";
import { AGENT_LABEL, ApprovalStatusBadge, RiskBadge, TaskStatusBadge, VerificationBadge } from "@/components/ui/status";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { getTool } from "@/lib/tools/registry";
import { formatDateTime } from "@/lib/utils";
import type { Approval, Task, ToolExecution, VerificationCheck } from "@/lib/domain/types";

export const metadata = { title: "Tarefa" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createUserClient();
  const { data: task } = await db.from("tasks").select("*, missions(name)").eq("org_id", ctx.orgId).eq("id", id).maybeSingle().throwOnError();
  if (!task) notFound();
  const t = task as Task & { missions: { name: string } | null };
  const [{ data: execs }, { data: approvals }] = await Promise.all([
    db.from("tool_executions").select("*").eq("org_id", ctx.orgId).eq("task_id", id).order("attempt").throwOnError(),
    db.from("approvals").select("*").eq("org_id", ctx.orgId).eq("task_id", id).order("created_at").throwOnError(),
  ]);
  const tool = getTool(t.tool_id);
  const checks = (Array.isArray(t.verification_detail) ? t.verification_detail : []) as VerificationCheck[];

  return (
    <>
      <div className="mb-2 text-xs text-muted"><Link href="/tasks" className="hover:text-fg">Tarefas</Link> / {t.title}</div>
      <PageHeader title={t.title} description={<span className="flex flex-wrap gap-2"><TaskStatusBadge status={t.status} /><VerificationBadge status={t.verification_status} /><RiskBadge risk={t.risk} /></span>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Detalhes" />
          <div className="space-y-5 p-5">
            <KeyValue items={[
              ["Missão", <Link key="m" href={`/missions/${t.mission_id}`} className="text-accent hover:underline">{t.missions?.name ?? t.mission_id}</Link>],
              ["Agente", AGENT_LABEL[t.agent_role]],
              ["Ferramenta", <span key="t">{tool?.name ?? t.tool_id} <Mono>{t.tool_id}</Mono></span>],
              ["Exige aprovação", t.requires_approval ? "Sim" : "Não"],
              ["Tentativas", `${t.attempts} de ${t.max_attempts}`],
              ["Depende de", t.depends_on.length ? t.depends_on.join(", ") : "—"],
              ["Criada", formatDateTime(t.created_at)],
              ["Iniciada", formatDateTime(t.started_at)],
              ["Finalizada", formatDateTime(t.finished_at)],
              ["Resultado esperado", t.expected_outcome || "—"],
            ]} />
            {t.error_message ? <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-red-200">{t.error_code}: {t.error_message}</p> : null}
            <div><p className="mb-2 text-xs font-medium text-subtle">Parâmetros validados</p><JsonBlock value={t.params} /></div>
            {t.output ? <div><p className="mb-2 text-xs font-medium text-subtle">Saída da ferramenta</p><JsonBlock value={t.output} /></div> : null}
            {checks.length ? (
              <div>
                <p className="mb-2 text-xs font-medium text-subtle">Verificação do Auditor</p>
                <ul className="space-y-1 text-sm">{checks.map((c) => <li key={c.name} className={c.passed ? "text-green-300" : "text-red-300"}>{c.passed ? "✓" : "✗"} {c.name}{c.detail ? ` — ${c.detail}` : ""}</li>)}</ul>
              </div>
            ) : null}
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Tentativas" />
            <ul className="divide-y divide-border">
              {((execs ?? []) as ToolExecution[]).map((e) => (
                <li key={e.id} className="px-5 py-3 text-sm">
                  <p>Tentativa {e.attempt}: {e.status === "succeeded" ? "sucesso" : e.status === "failed" ? "falha" : "iniciada"}</p>
                  <p className="text-xs text-subtle">{formatDateTime(e.started_at)}</p>
                  {e.error_code ? <p className="text-xs text-red-300">{e.error_code}</p> : null}
                </li>
              ))}
              {!execs?.length ? <li className="px-5 py-4 text-sm text-muted">Ainda não executada.</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Aprovações" />
            <ul className="divide-y divide-border">
              {((approvals ?? []) as Approval[]).map((a) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <Link href={`/approvals#${a.id}`} className="hover:text-accent">{formatDateTime(a.created_at)}</Link>
                  <ApprovalStatusBadge status={a.status} />
                </li>
              ))}
              {!approvals?.length ? <li className="px-5 py-4 text-sm text-muted">Nenhuma aprovação solicitada.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
