import Link from "next/link";
import { Bot } from "lucide-react";
import { Alert, Badge, PageHeader } from "@/components/ui/primitives";
import { requireOrg } from "@/lib/auth/session";
import { createUserClient } from "@/lib/db/clients";
import { AGENTS } from "@/lib/domain/agents";
import { aiConfigured, env } from "@/lib/env";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Agentes" };

export default async function AgentsPage() {
  const ctx = await requireOrg();
  const db = await createUserClient();
  const { data: runs } = await db.from("agent_runs").select("role, status, started_at").eq("org_id", ctx.orgId).order("started_at", { ascending: false }).limit(1000).throwOnError();
  const ai = aiConfigured();
  return (
    <>
      <PageHeader title="Agentes" description="Papéis lógicos do motor de orquestração. Eles compartilham o mesmo provedor de IA, mas têm instruções e permissões separadas." />
      <div className="mb-6">
        <Alert tone={ai ? "info" : "warning"} title={ai ? `Provedor de IA: Anthropic (${env().ORBIT_AI_MODEL})` : "Provedor de IA não configurado"}>
          {ai ? "Estrategista e Otimizador usam este modelo. Operador e Auditor executam código determinístico, exceto a ferramenta de classificação." : "Estrategista (planejamento por IA), classificação e sugestões por IA estão indisponíveis. O restante funciona normalmente."}
        </Alert>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {AGENTS.map((a) => {
          const mine = (runs ?? []).filter((r) => r.role === a.role);
          const running = mine.filter((r) => r.status === "running").length;
          const usesAi = a.role === "strategist" || a.role === "optimizer";
          return (
            <Link key={a.role} href={`/agents/${a.role}`} className="card block p-5 transition-colors hover:border-border-strong">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold"><Bot className="h-4 w-4 text-accent" aria-hidden />{a.name}</span>
                {usesAi && !ai ? <Badge tone="warning">Indisponível</Badge> : running ? <Badge tone="accent">Em execução</Badge> : <Badge tone="success">Disponível</Badge>}
              </div>
              <p className="mt-2 text-sm text-muted">{a.purpose}</p>
              <p className="mt-4 text-xs text-subtle">{mine.length} execução(ões) registradas{mine[0] ? ` · última ${formatRelative(mine[0].started_at)}` : ""}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
