import "server-only";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/clients";
import { SupabaseEngineRepository } from "@/lib/db/repository";
import { getAiProvider } from "@/lib/ai";
import { estimateCostUsd, UNTRUSTED_DATA_RULE } from "@/lib/ai/provider";

export interface OptimizerStats {
  window_missions: number;
  missions_by_status: Record<string, number>;
  tools: { tool_id: string; total: number; failed: number; verification_failed: number; unverified: number; error_codes: Record<string, number> }[];
  approvals: { total: number; rejected: number; expired: number; invalidated: number };
}

export interface OptimizerSuggestion {
  title: string;
  rationale: string;
  source: "rule" | "ai";
}

/** Pure, deterministic suggestions derived only from counted data. */
export function ruleSuggestions(s: OptimizerStats): OptimizerSuggestion[] {
  const out: OptimizerSuggestion[] = [];
  for (const t of s.tools) {
    if (t.total >= 3 && t.failed / t.total >= 0.3) {
      const top = Object.entries(t.error_codes).sort((a, b) => b[1] - a[1])[0];
      out.push({ source: "rule", title: `Revisar uso de ${t.tool_id}`, rationale: `${t.failed} de ${t.total} execuções falharam${top ? ` (mais comum: ${top[0]}, ${top[1]}x)` : ""}.` });
    }
    if (t.verification_failed > 0) {
      out.push({ source: "rule", title: `Investigar verificações de ${t.tool_id}`, rationale: `${t.verification_failed} execução(ões) relataram sucesso sem confirmação na leitura de volta.` });
    }
  }
  if (s.approvals.total >= 3 && s.approvals.rejected / s.approvals.total >= 0.5) {
    out.push({ source: "rule", title: "Planos geram ações rejeitadas com frequência", rationale: `${s.approvals.rejected} de ${s.approvals.total} pedidos de aprovação foram rejeitados. Detalhe melhor os objetivos ou revise o plano antes de aprovar.` });
  }
  if (s.approvals.expired > 0) {
    out.push({ source: "rule", title: "Aprovações expirando sem decisão", rationale: `${s.approvals.expired} pedido(s) expiraram. Considere ajustar a validade ou as notificações.` });
  }
  return out;
}

export async function collectStats(orgId: string): Promise<OptimizerStats> {
  const db = createServiceClient();
  const { data: missions } = await db.from("missions").select("id, status").eq("org_id", orgId).order("created_at", { ascending: false }).limit(50);
  const ids = (missions ?? []).map((m) => m.id);
  const missions_by_status: Record<string, number> = {};
  for (const m of missions ?? []) missions_by_status[m.status] = (missions_by_status[m.status] ?? 0) + 1;
  const tasks = ids.length ? ((await db.from("tasks").select("tool_id, status, error_code, verification_status").eq("org_id", orgId).in("mission_id", ids)).data ?? []) : [];
  const approvals = ids.length ? ((await db.from("approvals").select("status").eq("org_id", orgId).in("mission_id", ids)).data ?? []) : [];
  const byTool = new Map<string, OptimizerStats["tools"][number]>();
  for (const t of tasks) {
    const row: OptimizerStats["tools"][number] = byTool.get(t.tool_id) ?? { tool_id: t.tool_id, total: 0, failed: 0, verification_failed: 0, unverified: 0, error_codes: {} };
    if (["succeeded", "failed", "verification_failed"].includes(t.status)) row.total++;
    if (t.status === "failed") row.failed++;
    if (t.status === "verification_failed") row.verification_failed++;
    if (t.status === "succeeded" && t.verification_status === "unverified") row.unverified++;
    if (t.error_code && t.status === "failed") row.error_codes[t.error_code] = (row.error_codes[t.error_code] ?? 0) + 1;
    byTool.set(t.tool_id, row);
  }
  const count = (s: string) => approvals.filter((a) => a.status === s).length;
  return {
    window_missions: ids.length,
    missions_by_status,
    tools: [...byTool.values()],
    approvals: { total: approvals.length, rejected: count("rejected"), expired: count("expired"), invalidated: count("invalidated") },
  };
}

const AiSuggestions = z.object({ suggestions: z.array(z.object({ title: z.string().max(140), rationale: z.string().max(600) })).max(6) });

/**
 * Optimizer role: read-only analysis. It can only produce text suggestions;
 * it has no tool access and cannot change policies or permissions.
 */
export async function runOptimizer(orgId: string, userId: string) {
  const db = createServiceClient();
  const repo = new SupabaseEngineRepository(db);
  const stats = await collectStats(orgId);
  const run = await repo.insertAgentRun({ org_id: orgId, mission_id: null, task_id: null, role: "optimizer", kind: "optimize", input_summary: `${stats.window_missions} missões analisadas` });
  const suggestions = ruleSuggestions(stats);
  const ai = getAiProvider();
  let aiNote: string | null = ai ? null : "Provedor de IA não configurado: apenas sugestões por regra.";
  let usage: { model: string; input_tokens: number; output_tokens: number } | null = null;
  if (ai && stats.window_missions > 0) {
    const policy = await repo.getPolicy(orgId);
    const spend = await repo.sumUsageCostSince(orgId, new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString());
    if (spend >= policy.monthly_ai_budget_usd) {
      aiNote = "Orçamento mensal de IA esgotado: apenas sugestões por regra.";
    } else {
      try {
        const res = await ai.generateStructured({
          system: `Você é o Otimizador do ORBIT. Analise apenas as estatísticas fornecidas e sugira melhorias operacionais concretas. Não invente números, não proponha alterar permissões ou políticas de segurança, e diga quando os dados forem insuficientes. ${UNTRUSTED_DATA_RULE}`,
          user: `Estatísticas agregadas (JSON):\n${JSON.stringify(stats)}`,
          schemaName: "optimizer_suggestions",
          jsonSchema: { type: "object", additionalProperties: false, required: ["suggestions"], properties: { suggestions: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "rationale"], properties: { title: { type: "string" }, rationale: { type: "string" } } } } } },
          schema: AiSuggestions,
          maxTokens: 3000,
        });
        usage = res.usage;
        await repo.insertUsage({ org_id: orgId, mission_id: null, agent_run_id: run.id, provider: res.usage.provider, model: res.usage.model, input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens, cost_usd: estimateCostUsd(res.usage) });
        suggestions.push(...res.data.suggestions.map((s) => ({ ...s, source: "ai" as const })));
      } catch (e) {
        aiNote = `A análise por IA falhou: ${e instanceof Error ? e.message.slice(0, 200) : "erro"}`;
      }
    }
  }
  await repo.finishAgentRun(orgId, run.id, { status: "succeeded", output: { stats, suggestions, note: aiNote }, error: null, model: usage?.model ?? null, input_tokens: usage?.input_tokens ?? null, output_tokens: usage?.output_tokens ?? null });
  await repo.insertAudit({ org_id: orgId, actor_type: "user", actor_id: userId, action: "optimizer.run", entity_type: "agent_run", entity_id: run.id, outcome: "success", details: { suggestions: suggestions.length } });
}
