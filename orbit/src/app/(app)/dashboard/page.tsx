import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Plus, Rocket, ShieldCheck } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { MissionStatusBadge, TaskStatusBadge, AGENT_LABEL } from "@/components/ui/status";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { hasPermission, ROLE_LABEL } from "@/lib/domain/permissions";
import { auditLabel } from "@/lib/domain/labels";
import { aiConfigured } from "@/lib/env";
import { formatRelative, formatUsd } from "@/lib/utils";
import type { MissionStatus, TaskStatus } from "@/lib/domain/states";

export const metadata = { title: "Painel" };

export default async function DashboardPage() {
  const ctx = await requireOrg();
  const db = await createUserClient();
  const org = ctx.orgId;
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const canSeeCost = hasPermission(ctx.role, "policies:manage");

  const [active, pendingApprovals, completed, failed, totalMissions, missions, activity, runs, usage, records] = await Promise.all([
    count(db.from("missions").select("id", { count: "exact", head: true }).eq("org_id", org).in("status", ["planning", "awaiting_approval", "queued", "running", "paused"]).throwOnError()),
    count(db.from("approvals").select("id", { count: "exact", head: true }).eq("org_id", org).eq("status", "pending").throwOnError()),
    count(db.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", org).eq("status", "succeeded").throwOnError()),
    count(db.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", org).in("status", ["failed", "verification_failed"]).throwOnError()),
    count(db.from("missions").select("id", { count: "exact", head: true }).eq("org_id", org).throwOnError()),
    db.from("missions").select("id, name, status, updated_at").eq("org_id", org).order("updated_at", { ascending: false }).limit(6).throwOnError(),
    db.from("audit_logs").select("id, action, outcome, created_at, entity_type").eq("org_id", org).order("created_at", { ascending: false }).limit(8).throwOnError(),
    db.from("agent_runs").select("role, status").eq("org_id", org).gte("started_at", monthStart).limit(2000).throwOnError(),
    canSeeCost ? db.from("usage_records").select("cost_usd, input_tokens, output_tokens").eq("org_id", org).gte("created_at", monthStart).limit(5000).throwOnError() : Promise.resolve({ data: null }),
    count(db.from("records").select("id", { count: "exact", head: true }).eq("org_id", org).throwOnError()),
  ]);

  const usageRows = (usage.data ?? []) as { cost_usd: string | null; input_tokens: number; output_tokens: number }[];
  const unknownCost = usageRows.some((u) => u.cost_usd === null);
  const cost = usageRows.reduce((s, u) => s + Number(u.cost_usd ?? 0), 0);
  const tokens = usageRows.reduce((s, u) => s + u.input_tokens + u.output_tokens, 0);
  const roleStats = (["strategist", "operator", "auditor", "optimizer"] as const).map((r) => {
    const rows = (runs.data ?? []).filter((x) => x.role === r);
    return { role: r, total: rows.length, failed: rows.filter((x) => x.status === "failed").length, running: rows.filter((x) => x.status === "running").length };
  });

  if (totalMissions === 0) {
    return (
      <>
        <PageHeader title="Painel" description={`Bem-vindo à ${ctx.orgName}.`} />
        <Card>
          <EmptyState
            icon={Rocket}
            title="Nenhuma missão ainda"
            description={
              <>
                Comece cadastrando alguns registros em <Link className="text-accent hover:underline" href="/data">Dados</Link> e depois crie uma missão, por exemplo: “Classificar as mensagens de clientes abertas e criar itens de trabalho para as urgentes”.
                {!aiConfigured() ? " O provedor de IA não está configurado, então o plano será montado manualmente." : ""}
              </>
            }
            action={hasPermission(ctx.role, "missions:write") ? <LinkButton href="/missions/new"><Plus className="h-4 w-4" aria-hidden /> Criar missão</LinkButton> : undefined}
          />
        </Card>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Registros cadastrados" value={records} hint="Dados que as ferramentas podem ler" />
          <Stat label="Provedor de IA" value={aiConfigured() ? "Configurado" : "Indisponível"} />
          <Stat label="Seu papel" value={ROLE_LABEL[ctx.role]} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Painel"
        description="Números calculados a partir dos registros desta organização."
        actions={hasPermission(ctx.role, "missions:write") ? <LinkButton href="/missions/new"><Plus className="h-4 w-4" aria-hidden /> Nova missão</LinkButton> : null}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Missões ativas" value={active} icon={Rocket} />
        <Stat label="Aprovações pendentes" value={pendingApprovals} icon={ShieldCheck} hint={pendingApprovals ? <Link href="/approvals" className="text-accent hover:underline">Revisar agora</Link> : "Nada aguardando"} />
        <Stat label="Tarefas concluídas" value={completed} icon={CheckCircle2} />
        <Stat label="Tarefas com falha" value={failed} icon={AlertTriangle} hint="Inclui falhas de verificação" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Missões recentes" action={<Link href="/missions" className="text-xs text-accent hover:underline">Ver todas</Link>} />
          <ul className="divide-y divide-border">
            {(missions.data ?? []).map((m) => (
              <li key={m.id}>
                <Link href={`/missions/${m.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-2">
                  <span className="truncate text-sm font-medium">{m.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="hidden text-xs text-subtle sm:inline">{formatRelative(m.updated_at)}</span>
                    <MissionStatusBadge status={m.status as MissionStatus} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Uso de IA neste mês" description={canSeeCost ? "Estimativa a partir dos tokens registrados" : undefined} />
          <div className="space-y-3 px-5 py-4 text-sm">
            {!canSeeCost ? (
              <p className="text-muted">Visível apenas para administradores.</p>
            ) : usageRows.length === 0 ? (
              <p className="text-muted">Nenhum uso registrado neste mês.</p>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted">Chamadas</span><span className="tabular-nums">{usageRows.length}</span></div>
                <div className="flex justify-between"><span className="text-muted">Tokens</span><span className="tabular-nums">{tokens.toLocaleString("pt-BR")}</span></div>
                <div className="flex justify-between"><span className="text-muted">Custo estimado</span><span className="tabular-nums">{formatUsd(cost)}{unknownCost ? "*" : ""}</span></div>
                {unknownCost ? <p className="text-xs text-subtle">* Há chamadas com modelo de preço desconhecido, não incluídas.</p> : null}
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Agentes neste mês" description="Execuções registradas por papel" />
          <ul className="divide-y divide-border">
            {roleStats.map((r) => (
              <li key={r.role}>
                <Link href={`/agents/${r.role}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-2">
                  <span>{AGENT_LABEL[r.role]}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {r.running ? <span className="flex items-center gap-1 text-blue-300"><Clock className="h-3 w-3" aria-hidden />{r.running} em execução</span> : null}
                    <span className="tabular-nums">{r.total} execuções</span>
                    {r.failed ? <TaskStatusBadge status={"failed" as TaskStatus} /> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Atividade recente" action={<Link href="/audit" className="text-xs text-accent hover:underline">Auditoria completa</Link>} />
          <ul className="divide-y divide-border">
            {(activity.data ?? []).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                <span className={a.outcome === "failure" || a.outcome === "denied" ? "text-red-300" : "text-fg/90"}>{auditLabel(a.action)}</span>
                <span className="text-xs text-subtle">{formatRelative(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
