import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CheckCircle2, Pause, Play, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoRefresh, ConfirmForm, SubmitButton } from "@/components/ui/client";
import { Alert, Badge, Card, CardHeader, JsonBlock, KeyValue, Mono, PageHeader } from "@/components/ui/primitives";
import { AGENT_LABEL, ApprovalStatusBadge, MissionStatusBadge, RiskBadge, TaskStatusBadge, VerificationBadge } from "@/components/ui/status";
import { PageMessage, type SearchParams } from "@/components/page-message";
import { requireOrg } from "@/lib/auth/session";
import { getMissionBundle } from "@/lib/db/queries";
import { hasPermission } from "@/lib/domain/permissions";
import { auditLabel } from "@/lib/domain/labels";
import { aiConfigured } from "@/lib/env";
import { listTools, getTool } from "@/lib/tools/registry";
import { TOOL_EXAMPLES } from "@/lib/tools/examples";
import { formatDateTime, formatDuration, formatUsd, requestTime } from "@/lib/utils";
import type { MissionReport, ReportTaskLine } from "@/lib/domain/types";
import { TASK_STATUS_LABEL, type TaskStatus } from "@/lib/domain/states";
import { approvePlanAction, decideApprovalAction, generatePlanAction, missionControlAction } from "../../actions";
import { PlanEditor } from "./plan-editor";

export const metadata = { title: "Missão" };

const DECISION_LABEL = { allow: ["Automática", "success"], require_approval: ["Exige aprovação", "warning"], deny: ["Bloqueada", "danger"] } as const;

export default async function MissionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const ctx = await requireOrg();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { mission, tasks, approvals, executions, runs, audit } = await getMissionBundle(ctx.orgId, id);
  if (!mission) notFound();

  const canWrite = hasPermission(ctx.role, "missions:write");
  const canExecute = hasPermission(ctx.role, "missions:execute");
  const canDecide = hasPermission(ctx.role, "approvals:decide");
  const preExecution = tasks.length === 0 && ["draft", "awaiting_approval"].includes(mission.status);
  const inFlight = ["planning", "queued", "running"].includes(mission.status);
  const review = mission.plan_review;
  const pending = approvals.filter((a) => a.status === "pending");
  const stale = mission.status === "running" && (!mission.locked_until || new Date(mission.locked_until).getTime() < requestTime());
  const toolOptions = listTools().map((t) => ({ id: t.id, name: t.name, description: t.description, example: TOOL_EXAMPLES[t.id] ?? {} }));
  const hidden = <input type="hidden" name="mission_id" value={mission.id} />;

  return (
    <>
      <AutoRefresh active={inFlight} />
      <div className="mb-2 text-xs text-muted"><Link href="/missions" className="hover:text-fg">Missões</Link> / {mission.name}</div>
      <PageHeader
        title={mission.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <MissionStatusBadge status={mission.status} />
            {mission.plan_source ? <Badge>{{ ai: "Plano da IA", manual: "Plano manual", edited: "Plano da IA editado" }[mission.plan_source]}</Badge> : null}
            <span className="text-xs">Criada em {formatDateTime(mission.created_at)}</span>
          </span>
        }
        actions={
          canExecute ? (
            <>
              {["queued", "running", "awaiting_approval"].includes(mission.status) && tasks.length > 0 ? (
                <form action={missionControlAction}>{hidden}<input type="hidden" name="op" value="pause" /><SubmitButton variant="secondary" size="sm"><Pause className="h-4 w-4" aria-hidden /> Pausar</SubmitButton></form>
              ) : null}
              {mission.status === "paused" ? (
                <form action={missionControlAction}>{hidden}<input type="hidden" name="op" value="resume" /><SubmitButton size="sm"><Play className="h-4 w-4" aria-hidden /> Retomar</SubmitButton></form>
              ) : null}
              {stale ? (
                <form action={missionControlAction}>{hidden}<input type="hidden" name="op" value="run" /><SubmitButton variant="secondary" size="sm"><RefreshCw className="h-4 w-4" aria-hidden /> Continuar execução</SubmitButton></form>
              ) : null}
              {!["completed", "failed", "cancelled"].includes(mission.status) ? (
                <ConfirmForm
                  action={missionControlAction}
                  title="Cancelar missão?"
                  description="Tarefas pendentes serão canceladas e aprovações em aberto deixarão de valer. Ações externas já concluídas não são desfeitas."
                  confirmLabel="Cancelar missão"
                  trigger={<Button variant="danger" size="sm" type="button"><Ban className="h-4 w-4" aria-hidden /> Cancelar</Button>}
                >
                  {hidden}
                  <input type="hidden" name="op" value="cancel" />
                </ConfirmForm>
              ) : null}
            </>
          ) : null
        }
      />
      <PageMessage params={sp} />

      <Card className="mb-6 p-5">
        <p className="text-xs font-medium text-subtle">Objetivo</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-fg/90">{mission.objective}</p>
      </Card>

      {mission.status === "planning" ? <div className="mb-6"><Alert tone="info" title="Planejando">O Estrategista está montando o plano. Esta página atualiza sozinha.</Alert></div> : null}

      {preExecution ? (
        <div className="space-y-6">
          {mission.plan ? (
            <Card>
              <CardHeader
                title="Revisão do plano"
                description={review ? `Validado contra a política v${review.policy_version}. Decisões calculadas no servidor, não pela IA.` : undefined}
                action={
                  canExecute && review?.valid ? (
                    <form action={approvePlanAction}>{hidden}<SubmitButton size="sm" pendingText="Aprovando…"><CheckCircle2 className="h-4 w-4" aria-hidden /> Aprovar e executar</SubmitButton></form>
                  ) : undefined
                }
              />
              <div className="space-y-4 p-5">
                {review && !review.valid ? <Alert tone="danger" title="O plano não pode ser executado">{review.errors.map((e) => <p key={e}>{e}</p>)}</Alert> : null}
                {mission.plan.summary ? <p className="text-sm text-fg/90">{mission.plan.summary}</p> : null}
                <ol className="space-y-3">
                  {mission.plan.tasks.map((t) => {
                    const r = review?.tasks.find((x) => x.key === t.key);
                    const tool = getTool(t.tool);
                    return (
                      <li key={t.key} className="rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Mono>{t.key}</Mono>
                          <span className="text-sm font-medium">{t.title}</span>
                          {r ? <Badge tone={DECISION_LABEL[r.decision][1]}>{DECISION_LABEL[r.decision][0]}</Badge> : null}
                          {r ? <RiskBadge risk={r.risk} /> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {tool ? tool.name : <span className="text-red-300">Ferramenta não registrada: {t.tool}</span>}
                          {t.depends_on.length ? ` · depende de ${t.depends_on.join(", ")}` : ""}
                        </p>
                        {r && (r.reasons.length || r.param_errors.length) ? (
                          <ul className="mt-2 list-inside list-disc text-xs text-muted">
                            {[...r.reasons, ...r.param_errors].map((x) => <li key={x}>{x}</li>)}
                          </ul>
                        ) : null}
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-accent">Parâmetros</summary>
                          <div className="mt-2"><JsonBlock value={t.params} /></div>
                        </details>
                      </li>
                    );
                  })}
                </ol>
                {(mission.plan.assumptions.length || mission.plan.risks.length || mission.plan.success_criteria.length) ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    {([["Premissas", mission.plan.assumptions], ["Riscos", mission.plan.risks], ["Critérios de sucesso", mission.plan.success_criteria]] as const).map(([label, items]) => (
                      <div key={label}>
                        <p className="text-xs font-medium text-subtle">{label}</p>
                        {items.length ? <ul className="mt-1 list-inside list-disc text-sm text-fg/85">{items.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="mt-1 text-sm text-subtle">—</p>}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : (
            <Alert tone="info" title="Esta missão ainda não tem plano">
              {aiConfigured() ? "Gere um plano com o Estrategista ou monte-o manualmente abaixo." : "O provedor de IA não está configurado. Monte o plano manualmente abaixo."}
            </Alert>
          )}

          {canWrite ? (
            <div className="flex flex-wrap gap-3">
              {aiConfigured() ? (
                <form action={generatePlanAction}>{hidden}<SubmitButton variant="secondary" pendingText="Planejando…"><Sparkles className="h-4 w-4" aria-hidden /> {mission.plan ? "Gerar novo plano com IA" : "Gerar plano com IA"}</SubmitButton></form>
              ) : null}
            </div>
          ) : null}

          {canWrite ? (
            <Card>
              <details open={!mission.plan || mission.plan_source !== "ai"}>
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">{mission.plan ? "Editar plano" : "Montar plano manualmente"}</summary>
                <div className="border-t border-border p-5">
                  <PlanEditor missionId={mission.id} objective={mission.objective} plan={mission.plan} tools={toolOptions} />
                </div>
              </details>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <div className="space-y-6">
          {pending.length > 0 ? (
            <Card>
              <CardHeader title="Aguardando sua decisão" description="A execução destas tarefas está pausada até a aprovação." />
              <ul className="divide-y divide-border">
                {pending.map((a) => (
                  <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{getTool(a.tool_id)?.name ?? a.tool_id} <span className="text-muted">→ {a.target}</span></p>
                      <p className="mt-0.5 text-xs text-muted">{a.impact}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge risk={a.risk} />
                      <Link href={`/approvals#${a.id}`} className="text-xs text-accent hover:underline">Detalhes</Link>
                      {canDecide ? (
                        <>
                          <form action={decideApprovalAction}>
                            <input type="hidden" name="approval_id" value={a.id} /><input type="hidden" name="decision" value="approved" /><input type="hidden" name="return_to" value={`/missions/${mission.id}`} />
                            <SubmitButton size="sm">Aprovar</SubmitButton>
                          </form>
                          <form action={decideApprovalAction}>
                            <input type="hidden" name="approval_id" value={a.id} /><input type="hidden" name="decision" value="rejected" /><input type="hidden" name="return_to" value={`/missions/${mission.id}`} />
                            <SubmitButton size="sm" variant="danger">Rejeitar</SubmitButton>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Tarefas" description={`${tasks.length} tarefa(s) · ${mission.action_count} ação(ões) executada(s)`} />
            <div className="overflow-x-auto">
              <table className="table-base min-w-[760px]">
                <thead><tr><th scope="col">Tarefa</th><th scope="col">Agente</th><th scope="col">Status</th><th scope="col">Verificação</th><th scope="col">Tentativas</th><th scope="col">Atualizada</th></tr></thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/tasks/${t.id}`} className="font-medium hover:text-accent">{t.title}</Link>
                        <p className="mt-0.5 text-xs text-muted"><Mono>{t.tool_id}</Mono>{t.requires_approval ? " · exige aprovação" : ""}</p>
                        {t.error_message ? <p className="mt-1 text-xs text-red-300">{t.error_code}: {t.error_message}</p> : null}
                      </td>
                      <td className="text-muted">{AGENT_LABEL[t.agent_role]}</td>
                      <td><TaskStatusBadge status={t.status} /></td>
                      <td><VerificationBadge status={t.verification_status} /></td>
                      <td className="tabular-nums text-muted">{t.attempts}/{t.max_attempts}</td>
                      <td className="text-muted">{formatDateTime(t.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {mission.report ? <ReportCard report={mission.report} /> : null}

          <Card>
            <CardHeader title="Evidências de execução" description="Cada chamada de ferramenta, o que retornou e como foi verificada." />
            {executions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Nenhuma ferramenta foi executada ainda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {executions.map((e) => (
                  <li key={e.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Mono>{e.tool_id}</Mono>
                      <span className="text-muted">tentativa {e.attempt}</span>
                      <Badge tone={e.status === "succeeded" ? "success" : e.status === "failed" ? "danger" : "info"}>{e.status === "succeeded" ? "Ferramenta retornou sucesso" : e.status === "failed" ? "Falhou" : "Iniciada"}</Badge>
                      <VerificationBadge status={e.verification_status} />
                      <span className="text-xs text-subtle">{formatDateTime(e.started_at)}</span>
                    </div>
                    {e.error_message ? <p className="mt-1 text-xs text-red-300">{e.error_code}: {e.error_message}</p> : null}
                    {e.evidence.length ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {e.evidence.map((ev) => <li key={`${ev.kind}:${ev.id}`}><Badge tone="info">{ev.kind}: {ev.label}</Badge></li>)}
                      </ul>
                    ) : null}
                    {e.verification_checks.length ? (
                      <ul className="mt-2 space-y-0.5 text-xs">
                        {e.verification_checks.map((c) => <li key={c.name} className={c.passed ? "text-green-300" : "text-red-300"}>{c.passed ? "✓" : "✗"} {c.name}{c.detail ? ` — ${c.detail}` : ""}</li>)}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Execuções de agentes" />
          {runs.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Nenhuma execução registrada.</p> : (
            <ul className="divide-y divide-border">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span>{AGENT_LABEL[r.role as keyof typeof AGENT_LABEL]} <span className="text-muted">· {r.kind}</span></span>
                  <span className="flex items-center gap-2 text-xs text-subtle">
                    {r.input_tokens ? <span>{(r.input_tokens + (r.output_tokens ?? 0)).toLocaleString("pt-BR")} tokens</span> : null}
                    <Badge tone={r.status === "succeeded" ? "success" : r.status === "failed" ? "danger" : "accent"}>{r.status === "succeeded" ? "Concluída" : r.status === "failed" ? "Falhou" : "Em execução"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Histórico" description="Eventos de auditoria desta missão" />
          <ul className="max-h-96 divide-y divide-border overflow-auto">
            {audit.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className={a.outcome === "failure" || a.outcome === "denied" ? "text-red-300" : ""}>{auditLabel(a.action)}</span>
                <span className="text-xs text-subtle">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {approvals.some((a) => a.status !== "pending") ? (
        <Card className="mt-6">
          <CardHeader title="Aprovações anteriores" />
          <ul className="divide-y divide-border">
            {approvals.filter((a) => a.status !== "pending").map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span>{getTool(a.tool_id)?.name ?? a.tool_id} → <span className="text-muted">{a.target}</span></span>
                <span className="flex items-center gap-2"><ApprovalStatusBadge status={a.status} /><span className="text-xs text-subtle">{formatDateTime(a.decided_at ?? a.created_at)}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function ReportCard({ report }: { report: MissionReport }) {
  const section = (title: string, lines: ReportTaskLine[], tone: string) => (
    <div>
      <p className="text-xs font-medium text-subtle">{title} ({lines.length})</p>
      {lines.length ? (
        <ul className="mt-1 space-y-1 text-sm">
          {lines.map((l) => <li key={l.task_id} className={tone}>{l.title}{l.detail ? <span className="text-xs text-muted"> — {l.detail}</span> : null}</li>)}
        </ul>
      ) : <p className="mt-1 text-sm text-subtle">—</p>}
    </div>
  );
  return (
    <Card>
      <CardHeader title="Relatório final" description={`Gerado em ${formatDateTime(report.generated_at)}`} />
      <div className="space-y-5 p-5">
        <KeyValue items={[
          ["Duração", formatDuration(report.duration_ms)],
          ["Custo estimado de IA", report.ai_usage_records === 0 ? "Sem uso de IA" : formatUsd(report.ai_cost_usd)],
          ["Chamadas de IA", String(report.ai_usage_records)],
          ["Totais", Object.entries(report.totals).map(([k, v]) => `${TASK_STATUS_LABEL[k as TaskStatus] ?? k}: ${v}`).join(" · ")],
        ]} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {section("Concluídas", report.completed, "text-fg/90")}
          {section("Verificadas", report.verified, "text-green-300")}
          {section("Não verificadas", report.unverified, "text-amber-300")}
          {section("Falharam", report.failed, "text-red-300")}
          {section("Aguardando aprovação", report.pending_approvals, "text-amber-300")}
          {section("Ignoradas ou canceladas", report.skipped, "text-muted")}
        </div>
        <ul className="space-y-1 border-t border-border pt-4 text-xs text-muted">{report.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </div>
    </Card>
  );
}
