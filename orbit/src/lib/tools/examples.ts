/** Starter params shown in the manual plan editor. */
export const TOOL_EXAMPLES: Record<string, Record<string, unknown>> = {
  "records.search": { kind: "customer_message", status: "open", limit: 20 },
  "records.classify": { categories: ["suporte", "vendas", "financeiro"], status: "open", only_unclassified: true, limit: 10 },
  "work_items.create": { title: "Retornar contato do cliente", description: "", priority: "normal" },
  "reports.generate": { title: "Resumo de mensagens dos últimos 7 dias", scope: "records", period_days: 7 },
  "email.create_draft": { to: ["cliente@exemplo.com.br"], subject: "Sobre sua solicitação", body: "Olá, ..." },
  "email.send": { to: ["cliente@exemplo.com.br"], subject: "Sobre sua solicitação", body: "Olá, ..." },
};
