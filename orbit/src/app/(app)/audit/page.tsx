import Link from "next/link";
import { History } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { first, type SearchParams } from "@/components/page-message";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { AUDIT_ACTION_LABEL, auditLabel, OUTCOME_LABEL } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Auditoria" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const action = first(sp.action);
  const outcome = first(sp.outcome);
  const actor = first(sp.actor);
  const q = first(sp.q)?.trim().slice(0, 100);
  const page = Math.max(0, Number(first(sp.page) ?? 0) || 0);

  const db = await createUserClient();
  let query = db.from("audit_logs").select("id, action, outcome, actor_type, actor_id, entity_type, entity_id, details, created_at", { count: "exact" }).eq("org_id", ctx.orgId).throwOnError();
  if (action && action in AUDIT_ACTION_LABEL) query = query.eq("action", action);
  else if (action?.endsWith(".*")) query = query.like("action", `${action.slice(0, -2).replace(/[^a-z_]/g, "")}.%`);
  if (outcome && outcome in OUTCOME_LABEL) query = query.eq("outcome", outcome);
  if (actor && ["user", "agent", "system"].includes(actor)) query = query.eq("actor_type", actor);
  if (q && /^[0-9a-f-]{36}$/i.test(q)) query = query.or(`entity_id.eq.${q},actor_id.eq.${q}`);
  else if (q) query = query.ilike("action", `%${q.replace(/[%_]/g, "")}%`);
  const { data: rows, count } = await query.order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);

  const { data: members } = await db.from("profiles").select("id, email, full_name").throwOnError();
  const who = new Map((members ?? []).map((m) => [m.id, m.full_name || m.email]));
  const link = (p: number) => {
    const s = new URLSearchParams(Object.entries({ action, outcome, actor, q, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/audit?${s}`;
  };
  const href = (r: { entity_type: string; entity_id: string | null }) =>
    !r.entity_id ? null : r.entity_type === "mission" ? `/missions/${r.entity_id}` : r.entity_type === "task" ? `/tasks/${r.entity_id}` : r.entity_type === "approval" ? `/approvals#${r.entity_id}` : null;

  return (
    <>
      <PageHeader title="Auditoria" description="Registro imutável gerado pelo servidor. Nenhum usuário ou agente pode alterar ou apagar estes eventos." />
      <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="search">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="label">Buscar</label>
          <input id="q" name="q" defaultValue={q} className="input h-9" placeholder="Ação ou ID de entidade/usuário" />
        </div>
        <div>
          <label htmlFor="action" className="label">Categoria</label>
          <select id="action" name="action" defaultValue={action ?? ""} className="input h-9 py-0">
            <option value="">Todas</option>
            {["mission", "task", "tool", "approval", "policy", "member", "integration", "record"].map((c) => <option key={c} value={`${c}.*`}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="outcome" className="label">Resultado</label>
          <select id="outcome" name="outcome" defaultValue={outcome ?? ""} className="input h-9 py-0">
            <option value="">Todos</option>
            {Object.entries(OUTCOME_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="actor" className="label">Ator</label>
            <select id="actor" name="actor" defaultValue={actor ?? ""} className="input h-9 py-0">
              <option value="">Todos</option><option value="user">Usuário</option><option value="agent">Agente</option><option value="system">Sistema</option>
            </select>
          </div>
          <button type="submit" className="h-9 rounded-lg border border-border-strong px-3 text-sm text-muted hover:text-fg">Filtrar</button>
        </div>
      </form>
      <Card>
        {!rows?.length ? (
          <EmptyState icon={History} title="Nenhum evento encontrado" description="Ajuste os filtros ou execute uma missão para gerar eventos." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[860px]">
              <thead><tr><th scope="col">Quando</th><th scope="col">Evento</th><th scope="col">Resultado</th><th scope="col">Ator</th><th scope="col">Detalhes</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const h = href(r);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</td>
                      <td>{h ? <Link href={h} className="hover:text-accent">{auditLabel(r.action)}</Link> : auditLabel(r.action)}<p className="font-mono text-[11px] text-subtle">{r.action}</p></td>
                      <td><Badge tone={r.outcome === "success" ? "success" : r.outcome === "failure" ? "danger" : r.outcome === "denied" ? "warning" : "neutral"}>{OUTCOME_LABEL[r.outcome as keyof typeof OUTCOME_LABEL]}</Badge></td>
                      <td className="text-muted">{r.actor_type === "user" ? (who.get(r.actor_id ?? "") ?? "Usuário") : r.actor_type === "agent" ? "Agente" : "Sistema"}</td>
                      <td className="max-w-sm"><details><summary className="cursor-pointer text-xs text-accent">Ver</summary><pre className="mt-1 max-h-48 overflow-auto font-mono text-[11px] text-muted">{JSON.stringify(r.details, null, 2)}</pre></details></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>{count ?? 0} evento(s)</span>
        <div className="flex gap-3">
          {page > 0 ? <Link href={link(page - 1)} className="text-accent hover:underline">Anterior</Link> : null}
          {(count ?? 0) > (page + 1) * PAGE ? <Link href={link(page + 1)} className="text-accent hover:underline">Próxima</Link> : null}
        </div>
      </div>
    </>
  );
}
