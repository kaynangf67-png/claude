import Link from "next/link";
import { Plus, Rocket } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { MissionStatusBadge } from "@/components/ui/status";
import { first, PageMessage, type SearchParams } from "@/components/page-message";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { hasPermission } from "@/lib/domain/permissions";
import { MISSION_STATUSES, MISSION_STATUS_LABEL, type MissionStatus } from "@/lib/domain/states";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Missões" };

export default async function MissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const status = first(params.status);
  const db = await createUserClient();
  let q = db.from("missions").select("id, name, objective, status, action_count, created_at, updated_at, plan_source").eq("org_id", ctx.orgId).order("created_at", { ascending: false }).limit(100).throwOnError();
  if (status && (MISSION_STATUSES as readonly string[]).includes(status)) q = q.eq("status", status);
  const { data: missions } = await q;
  const canCreate = hasPermission(ctx.role, "missions:write");

  return (
    <>
      <PageHeader title="Missões" description="Objetivos de negócio e o progresso da execução." actions={canCreate ? <LinkButton href="/missions/new"><Plus className="h-4 w-4" aria-hidden /> Nova missão</LinkButton> : null} />
      <PageMessage params={params} />
      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="input h-9 py-0">
            <option value="">Todos</option>
            {MISSION_STATUSES.map((s) => <option key={s} value={s}>{MISSION_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <button type="submit" className="h-9 rounded-lg border border-border-strong px-3 text-sm text-muted hover:text-fg">Filtrar</button>
      </form>
      <Card>
        {!missions?.length ? (
          <EmptyState icon={Rocket} title={status ? "Nenhuma missão com este status" : "Nenhuma missão criada"} description="Missões transformam um objetivo em tarefas executadas com controle." action={canCreate && !status ? <LinkButton href="/missions/new">Criar missão</LinkButton> : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[640px]">
              <thead><tr><th scope="col">Missão</th><th scope="col">Status</th><th scope="col">Ações</th><th scope="col">Criada</th><th scope="col">Atualizada</th></tr></thead>
              <tbody>
                {missions.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-2/60">
                    <td className="max-w-md">
                      <Link href={`/missions/${m.id}`} className="font-medium text-fg hover:text-accent">{m.name}</Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted">{m.objective}</p>
                    </td>
                    <td><MissionStatusBadge status={m.status as MissionStatus} /></td>
                    <td className="tabular-nums text-muted">{m.action_count}</td>
                    <td className="text-muted">{formatDateTime(m.created_at)}</td>
                    <td className="text-muted">{formatDateTime(m.updated_at)}</td>
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
