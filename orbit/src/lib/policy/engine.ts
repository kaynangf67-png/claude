import { hasPermission } from "@/lib/domain/permissions";
import { maxRisk, type AgentRole, type MemberRole, type OrgPolicy, type RiskLevel, type ToolMode } from "@/lib/domain/types";
import type { AnyTool } from "@/lib/tools/registry";

export type PolicyDecision = "allow" | "require_approval" | "deny";

export interface PolicyInput {
  tool: AnyTool | undefined;
  toolId: string;
  /** Raw params; validated here with the tool's schema. */
  params: unknown;
  agentRole: AgentRole;
  /** Role of the user on whose behalf the mission runs. */
  memberRole: MemberRole;
  policy: OrgPolicy;
  missionActionCount: number;
  aiAvailable: boolean;
  integrationConnected: (id: "gmail") => boolean;
  /** Current month AI spend; only checked for tools that call the AI. */
  aiSpendThisMonthUsd: number;
}

export interface PolicyResult {
  decision: PolicyDecision;
  risk: RiskLevel;
  reasons: string[];
  paramErrors: string[];
  /** Parsed, defaulted params. Only present when validation passed. */
  params?: Record<string, unknown>;
  policyVersion: number;
}

const MODE_ORDER: Record<ToolMode, number> = { auto: 0, approval: 1, blocked: 2 };

export function effectiveMode(tool: AnyTool, policy: OrgPolicy): ToolMode {
  const configured = policy.tool_modes[tool.id] ?? tool.defaultMode;
  // An org may tighten, never loosen below the tool's floor.
  return MODE_ORDER[configured] >= MODE_ORDER[tool.minimumMode] ? configured : tool.minimumMode;
}

/**
 * Server-side authorization for a single tool call. The AI's own risk label
 * and approval hint are deliberately not inputs to this function.
 */
export function evaluatePolicy(input: PolicyInput): PolicyResult {
  const { tool, policy } = input;
  const base = { policyVersion: policy.version, paramErrors: [] as string[] };

  if (!tool) {
    return { ...base, decision: "deny", risk: "critical", reasons: [`Ferramenta não registrada: ${input.toolId}`] };
  }

  const parsed = tool.input.safeParse(input.params);
  if (!parsed.success) {
    return {
      ...base,
      decision: "deny",
      risk: tool.risk,
      reasons: ["Parâmetros inválidos"],
      paramErrors: parsed.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`),
    };
  }
  const params = parsed.data as Record<string, unknown>;

  const deny = (reason: string, risk: RiskLevel = tool.risk): PolicyResult => ({ ...base, params, decision: "deny", risk, reasons: [reason] });

  if (policy.execution_paused) return deny("Parada de emergência ativa: execuções suspensas pela organização");
  if (!tool.allowedRoles.includes(input.agentRole as "operator" | "auditor")) {
    return deny(`O agente ${input.agentRole} não pode usar ${tool.id}`);
  }
  if (!hasPermission(input.memberRole, tool.permission)) {
    return deny(`Seu papel (${input.memberRole}) não tem a permissão ${tool.permission}`);
  }
  if (input.missionActionCount >= policy.max_actions_per_mission) {
    return deny(`Limite de ${policy.max_actions_per_mission} ações por missão atingido`);
  }
  if (tool.requiresAi) {
    if (!input.aiAvailable) return deny("Provedor de IA não configurado");
    if (input.aiSpendThisMonthUsd >= policy.monthly_ai_budget_usd) {
      return deny(`Orçamento mensal de IA (US$ ${policy.monthly_ai_budget_usd.toFixed(2)}) esgotado`);
    }
  }
  if (tool.requiresIntegration && !input.integrationConnected(tool.requiresIntegration)) {
    return deny(`Integração ${tool.requiresIntegration} não conectada`);
  }

  const mode = effectiveMode(tool, policy);
  if (mode === "blocked") return deny("Ferramenta bloqueada pela política da organização");

  let risk = tool.risk;
  const reasons: string[] = [];
  if (tool.assessRisk) {
    const a = tool.assessRisk(params, { policy });
    risk = maxRisk(risk, a.risk);
    if (a.deny) return deny(a.deny, risk);
    if (a.requireApproval) reasons.push(a.requireApproval);
  }

  const needsApproval = mode === "approval" || risk === "high" || risk === "critical" || reasons.length > 0;
  if (needsApproval) {
    if (mode === "approval") reasons.push(tool.minimumMode === "approval" ? "Esta ação sempre exige aprovação humana" : "A política da organização exige aprovação para esta ferramenta");
    if (risk === "high" || risk === "critical") reasons.push(`Risco ${risk === "high" ? "alto" : "crítico"}`);
    return { ...base, params, decision: "require_approval", risk, reasons };
  }
  return { ...base, params, decision: "allow", risk, reasons: ["Permitido automaticamente pela política"] };
}
