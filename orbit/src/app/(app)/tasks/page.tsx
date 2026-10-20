import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { Card, EmptyState, Mono, PageHeader } from "@/components/ui/primitives";
import { AGENT_LABEL, TaskStatusBadge, VerificationBadge } from "@/components/ui/status";
import { first, type SearchParams } from "@/components/page-message";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { TASK_STATUSES, TASK_STATUS_LABEL, type TaskStatus } from "@/lib/domain/states";
import { listTools } from "@/lib/tools/registry";
import { formatDateTime } from "@/lib/utils";
import type { AgentRole, VerificationStatus } from "@/lib/domain/types";

export const metadata = { title: "Tarefas" };

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const status = first(sp.status);
  const tool = first(sp.tool);
  const approval = first(sp.approval);
  const db = await createUserClient();
  let q = db
    .from("tasks")
    .select("id, title, tool_id, agent_role, status, verification_status, requires_approval, created_at, updated_at, mission_id, missions(name)")
    .eq("org_id", ctx.orgId)
    .order("updated_at", { ascending: false })
    .limit(200)
    .throwOnError();
  if (status && (TASK_STATUSES as readonly string[]).includes(status)) q = q.eq("status", status);
  if (tool && listTools().some((t) => t.id === tool)) q = q.eq("tool_id", tool);
  if (approval === "yes") q = q.eq("requires_approval", true);
  const { data: tasks } = await q;

  return (
    <>
      <PageHeader title="Tarefas" description="Todas as tarefas das missões desta organização." />
      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="input h-9 py-0">
            <option value="">Todos</option>
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tool" className="label">Ferramenta</label>
          <select id="tool" name="tool" defaultValue={tool ?? ""} className="input h-9 py-0">
            <option value="">Todas</option>
            {listTools().map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="approval" className="label">Aprovação</label>
          <select id="approval" name="approval" defaultValue={approval ?? ""} className="input h-9 py-0">
            <option value="">Indiferente</option>
            <option value="yes">Exige aprovação</option>
          </select>
        </div>
        <button type="submit" className="h-9 rounded-lg border border-border-strong px-3 text-sm text-muted hover:text-fg">Filtrar</button>
      </form>
      <Card>
        {!tasks?.length ? (
          <EmptyState icon={CheckSquare} title="Nenhuma tarefa encontrada" description="Tarefas aparecem aqui quando o plano de uma missão é aprovado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[860px]">
              <thead><tr><th scope="col">Tarefa</th><th scope="col">Missão</th><th scope="col">Agente</th><th scope="col">Status</th><th scope="col">Verificação</th><th scope="col">Criada</th><th scope="col">Atualizada</th></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tasks/${t.id}`} className="font-medium hover:text-accent">{t.title}</Link>
                      <p className="mt-0.5 text-xs text-muted"><Mono>{t.tool_id}</Mono>{t.requires_approval ? " · exige aprovação" : ""}</p>
                    </td>
                    <td><Link href={`/missions/${t.mission_id}`} className="text-muted hover:text-fg">{(t.missions as unknown as { name: string } | null)?.name ?? "—"}</Link></td>
                    <td className="text-muted">{AGENT_LABEL[t.agent_role as AgentRole]}</td>
                    <td><TaskStatusBadge status={t.status as TaskStatus} /></td>
                    <td><VerificationBadge status={t.verification_status as VerificationStatus} /></td>
                    <td className="text-muted">{formatDateTime(t.created_at)}</td>
                    <td className="text-muted">{formatDateTime(t.updated_at)}</td>
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
