export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "organization.created": "Organização criada",
  "organization.updated": "Organização atualizada",
  "mission.created": "Missão criada",
  "mission.rate_limited": "Criação bloqueada por limite",
  "mission.plan_generated": "Plano gerado pela IA",
  "mission.plan_failed": "Falha ao gerar plano",
  "mission.plan_saved": "Plano salvo",
  "mission.plan_approved": "Plano aprovado",
  "mission.running": "Execução iniciada",
  "mission.paused": "Missão pausada",
  "mission.resumed": "Missão retomada",
  "mission.cancelled": "Missão cancelada",
  "mission.completed": "Missão concluída",
  "mission.failed": "Missão falhou",
  "mission.emergency_paused": "Pausada pela parada de emergência",
  "task.created": "Tarefa criada",
  "task.skipped": "Tarefa ignorada",
  "task.cancelled": "Tarefa cancelada",
  "task.recovered": "Tarefa recuperada após interrupção",
  "task.verification_failed": "Verificação falhou",
  "tool.attempted": "Ferramenta acionada",
  "tool.succeeded": "Ferramenta concluída",
  "tool.failed": "Ferramenta falhou",
  "tool.denied": "Execução negada pela política",
  "tool.retry_scheduled": "Nova tentativa agendada",
  "approval.requested": "Aprovação solicitada",
  "approval.approved": "Aprovação concedida",
  "approval.rejected": "Aprovação rejeitada",
  "approval.expired": "Aprovação expirada",
  "approval.invalidated": "Aprovação invalidada",
  "approval.denied": "Decisão de aprovação negada",
  "record.created": "Registro criado",
  "record.status_changed": "Status de registro alterado",
  "policy.updated": "Políticas alteradas",
  "policy.emergency_stop": "Parada de emergência ativada",
  "policy.emergency_resume": "Parada de emergência desativada",
  "member.added": "Membro adicionado",
  "member.removed": "Membro removido",
  "member.role_changed": "Papel de membro alterado",
  "integration.connected": "Integração conectada",
  "integration.disconnected": "Integração desconectada",
  "integration.failed": "Falha na integração",
  "optimizer.run": "Análise do Otimizador",
};

export function auditLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

export const OUTCOME_LABEL = { success: "Sucesso", failure: "Falha", denied: "Negado", info: "Info" } as const;

export const RECORD_KIND_LABEL = { customer_message: "Mensagem de cliente", note: "Nota", contact: "Contato", order: "Pedido" } as const;
export const RECORD_STATUS_LABEL = { open: "Aberto", in_progress: "Em andamento", closed: "Fechado" } as const;
