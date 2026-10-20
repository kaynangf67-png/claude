import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Badge, Mono, PageHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/client";
import { PageMessage, type SearchParams } from "@/components/page-message";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { getAgent } from "@/lib/domain/agents";
import { hasPermission } from "@/lib/domain/permissions";
import { listTools } from "@/lib/tools/registry";
import { formatDateTime } from "@/lib/utils";
import { runOptimizerAction } from "../../actions";
import type { OptimizerStats, OptimizerSuggestion } from "@/lib/engine/optimizer";

export const metadata = { title: "Agente" };

export default async function AgentPage({ params, searchParams }: { params: Promise<{ role: string }>; searchParams: SearchParams }) {
  const ctx = await requireOrg();
  const { role } = await params;
  const sp = await searchParams;
  const agent = getAgent(role);
  if (!agent) notFound();
  const db = await createUserClient();
  const { data: runs } = await db
    .from("agent_runs")
    .select("id, kind, status, model, input_tokens, output_tokens, error, started_at, finished_at, mission_id, task_id, input_summary, output")
    .eq("org_id", ctx.orgId)
    .eq("role", agent.role)
    .order("started_at", { ascending: false })
    .limit(30)
    .throwOnError();
  const tools = listTools().filter((t) => t.allowedRoles.includes(agent.role as "operator" | "auditor"));
  const latestOptimizer = agent.role === "optimizer" ? (runs ?? []).find((r) => r.status === "succeeded") : undefined;
  const opt = latestOptimizer?.output as { stats: OptimizerStats; suggestions: OptimizerSuggestion[]; note: string | null } | undefined;

  return (
    <>
      <div className="mb-2 text-xs text-muted"><Link href="/agents" className="hover:text-fg">Agentes</Link> / {agent.name}</div>
      <PageHeader
        title={agent.name}
        description={agent.purpose}
        actions={agent.role === "optimizer" && hasPermission(ctx.role, "missions:execute") ? <form action={runOptimizerAction}><SubmitButton pendingText="Analisando…">Analisar histórico</SubmitButton></form> : null}
      />
      <PageMessage params={sp} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Responsabilidades" />
          <ul className="list-inside list-disc space-y-1 p-5 text-sm text-fg/90">{agent.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul>
        </Card>
        <Card>
          <CardHeader title="Capacidades" />
          <ul className="list-inside list-disc space-y-1 p-5 text-sm text-fg/90">{agent.capabilities.map((r) => <li key={r}>{r}</li>)}</ul>
          {tools.length ? (
            <div className="border-t border-border px-5 py-4">
              <p className="mb-2 text-xs text-subtle">Ferramentas permitidas a este papel</p>
              <div className="flex flex-wrap gap-1.5">{tools.map((t) => <Mono key={t.id}>{t.id}</Mono>)}</div>
            </div>
          ) : null}
        </Card>
        <Card>
          <CardHeader title="Restrições" />
          <ul className="list-inside list-disc space-y-1 p-5 text-sm text-fg/90">{agent.restrictions.map((r) => <li key={r}>{r}</li>)}</ul>
        </Card>
      </div>

      {opt ? (
        <Card className="mt-6">
          <CardHeader title="Última análise" description={`${formatDateTime(latestOptimizer!.started_at)} · ${opt.stats.window_missions} missões`} />
          <div className="p-5">
            {opt.note ? <p className="mb-3 text-sm text-amber-300">{opt.note}</p> : null}
            {opt.suggestions.length === 0 ? <p className="text-sm text-muted">Sem sugestões: os dados atuais não indicam problemas recorrentes.</p> : (
              <ul className="space-y-3">
                {opt.suggestions.map((s, i) => (
                  <li key={i} className="rounded-lg border border-border p-3">
                    <p className="flex items-center gap-2 text-sm font-medium">{s.title}<Badge tone={s.source === "ai" ? "accent" : "neutral"}>{s.source === "ai" ? "IA" : "Regra"}</Badge></p>
                    <p className="mt-1 text-sm text-muted">{s.rationale}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader title="Atividade recente" />
        {!runs?.length ? <p className="px-5 py-6 text-sm text-muted">Nenhuma execução registrada para este papel.</p> : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[640px]">
              <thead><tr><th scope="col">Início</th><th scope="col">Tipo</th><th scope="col">Resumo</th><th scope="col">Status</th><th scope="col">Tokens</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="text-muted">{formatDateTime(r.started_at)}</td>
                    <td>{r.kind}</td>
                    <td className="max-w-xs">
                      {r.mission_id ? <Link href={`/missions/${r.mission_id}`} className="hover:text-accent">{r.input_summary}</Link> : r.input_summary}
                      {r.error ? <p className="text-xs text-red-300">{r.error}</p> : null}
                    </td>
                    <td><Badge tone={r.status === "succeeded" ? "success" : r.status === "failed" ? "danger" : "accent"}>{r.status === "succeeded" ? "Concluída" : r.status === "failed" ? "Falhou" : "Em execução"}</Badge></td>
                    <td className="tabular-nums text-muted">{r.input_tokens ? (r.input_tokens + (r.output_tokens ?? 0)).toLocaleString("pt-BR") : "—"}</td>
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
