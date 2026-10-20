import { Database } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { first, PageMessage, type SearchParams } from "@/components/page-message";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { hasPermission } from "@/lib/domain/permissions";
import { RECORD_KIND_LABEL, RECORD_STATUS_LABEL } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/utils";
import { updateRecordStatusAction } from "../actions";
import { RecordForm } from "./form";

export const metadata = { title: "Dados" };

type Kind = keyof typeof RECORD_KIND_LABEL;
type Status = keyof typeof RECORD_STATUS_LABEL;

export default async function DataPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrg();
  const sp = await searchParams;
  const kind = first(sp.kind);
  const db = await createUserClient();
  let q = db.from("records").select("id, kind, title, body, sender, status, classification, created_at").eq("org_id", ctx.orgId).order("created_at", { ascending: false }).limit(100).throwOnError();
  if (kind && kind in RECORD_KIND_LABEL) q = q.eq("kind", kind);
  const [{ data: records }, { data: workItems }, { data: reports }] = await Promise.all([
    q,
    db.from("work_items").select("id, title, priority, status, due_date, created_at, created_by_task_id").eq("org_id", ctx.orgId).order("created_at", { ascending: false }).limit(20).throwOnError(),
    db.from("reports").select("id, title, scope, content, created_at").eq("org_id", ctx.orgId).order("created_at", { ascending: false }).limit(10).throwOnError(),
  ]);
  const canWrite = hasPermission(ctx.role, "records:write");

  return (
    <>
      <PageHeader title="Dados" description="Fonte interna e controlada que as ferramentas podem ler. Conteúdo de clientes é tratado como dado não confiável pelos agentes." />
      <PageMessage params={sp} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <form className="flex flex-wrap items-end gap-2" role="search">
            <div>
              <label htmlFor="kind" className="label">Tipo</label>
              <select id="kind" name="kind" defaultValue={kind ?? ""} className="input h-9 py-0">
                <option value="">Todos</option>
                {Object.entries(RECORD_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <button type="submit" className="h-9 rounded-lg border border-border-strong px-3 text-sm text-muted hover:text-fg">Filtrar</button>
          </form>
          <Card>
            <CardHeader title="Registros" description={`${records?.length ?? 0} exibidos`} />
            {!records?.length ? (
              <EmptyState icon={Database} title="Nenhum registro" description="Cadastre mensagens de clientes, notas, contatos ou pedidos para que as missões tenham dados reais com que trabalhar." />
            ) : (
              <ul className="divide-y divide-border">
                {records.map((r) => {
                  const c = r.classification as { category: string; urgency: string } | null;
                  return (
                    <li key={r.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{r.title}</span>
                        <Badge>{RECORD_KIND_LABEL[r.kind as Kind]}</Badge>
                        {c ? <Badge tone="accent">{c.category} · urgência {c.urgency}</Badge> : null}
                      </div>
                      {r.body ? <p className="mt-1 line-clamp-2 text-sm text-muted">{r.body}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-subtle">
                        <span>{formatDateTime(r.created_at)}</span>
                        {r.sender ? <span>{r.sender}</span> : null}
                        {canWrite ? (
                          <form action={updateRecordStatusAction} className="flex items-center gap-1">
                            <input type="hidden" name="record_id" value={r.id} />
                            <label htmlFor={`st-${r.id}`} className="sr-only">Status</label>
                            <select id={`st-${r.id}`} name="status" defaultValue={r.status} className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs">
                              {Object.entries(RECORD_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            <button type="submit" className="text-accent hover:underline">Salvar</button>
                          </form>
                        ) : <span>{RECORD_STATUS_LABEL[r.status as Status]}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          {canWrite ? <Card><CardHeader title="Novo registro" /><div className="p-5"><RecordForm /></div></Card> : null}
          <Card>
            <CardHeader title="Itens de trabalho" description="Criados pelas missões" />
            {!workItems?.length ? <p className="px-5 py-5 text-sm text-muted">Nenhum item ainda.</p> : (
              <ul className="divide-y divide-border">{workItems.map((w) => <li key={w.id} className="px-5 py-3 text-sm">{w.title}<p className="text-xs text-subtle">Prioridade {w.priority} · {formatDateTime(w.created_at)}</p></li>)}</ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Relatórios" />
            {!reports?.length ? <p className="px-5 py-5 text-sm text-muted">Nenhum relatório ainda.</p> : (
              <ul className="divide-y divide-border">
                {reports.map((r) => (
                  <li key={r.id} className="px-5 py-3 text-sm">
                    <details>
                      <summary className="cursor-pointer">{r.title}<span className="block text-xs text-subtle">{r.scope} · {formatDateTime(r.created_at)}</span></summary>
                      <pre className="mt-2 overflow-auto rounded bg-bg p-2 font-mono text-xs text-muted">{JSON.stringify((r.content as { metrics: unknown }).metrics, null, 2)}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
