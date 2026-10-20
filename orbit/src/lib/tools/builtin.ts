import { z } from "zod";
import { canonicalJson, sha256 } from "@/lib/domain/canonical";
import { UNTRUSTED_DATA_RULE, wrapUntrusted } from "@/lib/ai/provider";
import type { RiskLevel } from "@/lib/domain/types";
import { ToolError, type ToolDefinition } from "./types";

/* ------------------------------------------------------------------ */
/* records.search                                                       */
/* ------------------------------------------------------------------ */

const RECORD_KINDS = ["customer_message", "note", "contact", "order"] as const;
const RECORD_STATUSES = ["open", "in_progress", "closed"] as const;

const searchInput = z
  .object({
    kind: z.enum(RECORD_KINDS).optional(),
    status: z.enum(RECORD_STATUSES).optional(),
    text: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

export const recordsSearch: ToolDefinition<z.infer<typeof searchInput>> = {
  id: "records.search",
  name: "Consultar registros",
  description: "Lê registros de negócio da organização (mensagens de clientes, notas, contatos, pedidos). Somente leitura.",
  input: searchInput,
  inputJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      kind: { type: "string", enum: [...RECORD_KINDS] },
      status: { type: "string", enum: [...RECORD_STATUSES] },
      text: { type: "string", description: "Busca por texto no título/corpo" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
  },
  permission: "records:read",
  risk: "low",
  mutating: false,
  external: false,
  idempotent: true,
  defaultMode: "auto",
  minimumMode: "auto",
  requiresIntegration: null,
  requiresAi: false,
  allowedRoles: ["operator", "auditor"],
  verification: "none",
  timeoutMs: 10_000,
  retry: { maxAttempts: 3, backoffMs: 500 },
  describeTarget: (i) => `Registros${i.kind ? ` do tipo ${i.kind}` : ""}`,
  describeImpact: () => "Nenhuma alteração. Apenas leitura de dados internos.",
  async execute(ctx, input) {
    const rows = await ctx.data.searchRecords(ctx.orgId, { kind: input.kind, status: input.status, text: input.text, limit: input.limit });
    return {
      output: {
        count: rows.length,
        records: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, status: r.status, category: r.classification?.category ?? null })),
      },
      evidence: [{ kind: "records_query", id: sha256(canonicalJson(input)).slice(0, 16), label: `${rows.length} registro(s) lidos` }],
    };
  },
  async verify() {
    return { status: "not_applicable", checks: [{ name: "read_only", passed: true, detail: "Operação de leitura não requer verificação" }] };
  },
};

/* ------------------------------------------------------------------ */
/* records.classify                                                     */
/* ------------------------------------------------------------------ */

const classifyInput = z
  .object({
    categories: z.array(z.string().min(2).max(40)).min(2).max(10),
    status: z.enum(RECORD_STATUSES).default("open"),
    only_unclassified: z.boolean().default(true),
    limit: z.number().int().min(1).max(25).default(10),
  })
  .strict();

const classificationBatch = (categories: string[], ids: string[]) =>
  z.object({
    items: z
      .array(
        z.object({
          record_id: z.enum(ids as [string, ...string[]]),
          category: z.enum(categories as [string, ...string[]]),
          urgency: z.enum(["low", "normal", "high"]),
          rationale: z.string().max(300),
        }),
      )
      .max(ids.length),
  });

export const recordsClassify: ToolDefinition<z.infer<typeof classifyInput>> = {
  id: "records.classify",
  name: "Classificar mensagens de clientes",
  description:
    "Classifica mensagens de clientes em categorias definidas no plano, com urgência. Usa IA e grava a classificação no registro.",
  input: classifyInput,
  inputJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["categories"],
    properties: {
      categories: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10 },
      status: { type: "string", enum: [...RECORD_STATUSES] },
      only_unclassified: { type: "boolean" },
      limit: { type: "integer", minimum: 1, maximum: 25 },
    },
  },
  permission: "records:write",
  risk: "low",
  mutating: true,
  external: false,
  idempotent: true,
  defaultMode: "auto",
  minimumMode: "auto",
  requiresIntegration: null,
  requiresAi: true,
  allowedRoles: ["operator"],
  verification: "read_back",
  timeoutMs: 60_000,
  retry: { maxAttempts: 2, backoffMs: 2_000 },
  describeTarget: (i) => `Até ${i.limit} mensagens de clientes (${i.status})`,
  describeImpact: (i) => `Grava categoria (${i.categories.join(", ")}) e urgência nos registros internos.`,
  async execute(ctx, input) {
    if (!ctx.ai) throw new ToolError("AI_UNAVAILABLE", "Provedor de IA não configurado");
    const rows = await ctx.data.searchRecords(ctx.orgId, {
      kind: "customer_message",
      status: input.status,
      unclassifiedOnly: input.only_unclassified,
      limit: input.limit,
    });
    if (rows.length === 0) {
      return { output: { classified: [], message: "Nenhuma mensagem elegível encontrada" }, evidence: [] };
    }
    const ids = rows.map((r) => r.id);
    const payload = rows
      .map((r) => wrapUntrusted("customer_message", `record_id: ${r.id}\nremetente: ${r.sender ?? "desconhecido"}\nassunto: ${r.title}\n\n${r.body.slice(0, 4000)}`))
      .join("\n\n");
    const res = await ctx.ai.generateStructured({
      system:
        "Você é o agente Operador do ORBIT executando a ferramenta de classificação. Classifique cada mensagem em exatamente uma das categorias permitidas e atribua urgência. " +
        UNTRUSTED_DATA_RULE,
      user: `Categorias permitidas: ${JSON.stringify(input.categories)}\n\nMensagens:\n${payload}`,
      schemaName: "classification_batch",
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["record_id", "category", "urgency", "rationale"],
              properties: {
                record_id: { type: "string", enum: ids },
                category: { type: "string", enum: input.categories },
                urgency: { type: "string", enum: ["low", "normal", "high"] },
                rationale: { type: "string" },
              },
            },
          },
        },
      },
      schema: classificationBatch(input.categories, ids),
      maxTokens: 4000,
      signal: ctx.signal,
    });
    const now = new Date().toISOString();
    const written: { record_id: string; category: string; urgency: string }[] = [];
    for (const item of res.data.items) {
      await ctx.data.setRecordClassification(ctx.orgId, item.record_id, {
        category: item.category,
        urgency: item.urgency,
        rationale: item.rationale,
        model: res.usage.model,
        task_id: ctx.taskId,
        classified_at: now,
      });
      written.push({ record_id: item.record_id, category: item.category, urgency: item.urgency });
    }
    return {
      output: { classified: written, requested: rows.length },
      evidence: written.map((w) => ({ kind: "record", id: w.record_id, label: `Classificado como ${w.category}` })),
      usage: [res.usage],
    };
  },
  async verify(ctx, _input, result) {
    const out = result.output as { classified: { record_id: string; category: string }[]; requested?: number };
    if (out.classified.length === 0) {
      return out.requested
        ? { status: "unverified", checks: [{ name: "coverage", passed: false, detail: `0 de ${out.requested} mensagens classificadas` }] }
        : { status: "not_applicable", checks: [{ name: "nothing_to_classify", passed: true }] };
    }
    const checks = [];
    for (const c of out.classified) {
      const rec = await ctx.data.getRecord(ctx.orgId, c.record_id);
      const ok = rec?.classification?.category === c.category && rec.classification.task_id === ctx.taskId;
      checks.push({ name: `record:${c.record_id}`, passed: ok, detail: ok ? "Classificação confirmada por leitura" : "Classificação não encontrada" });
    }
    if (out.requested !== undefined && out.classified.length < out.requested) {
      checks.push({ name: "coverage", passed: false, detail: `${out.classified.length} de ${out.requested} mensagens classificadas` });
    }
    const allWritten = checks.filter((c) => c.name.startsWith("record:")).every((c) => c.passed);
    return { status: allWritten ? (checks.every((c) => c.passed) ? "verified" : "unverified") : "failed", checks };
  },
};

/* ------------------------------------------------------------------ */
/* work_items.create                                                    */
/* ------------------------------------------------------------------ */

const workItemInput = z
  .object({
    title: z.string().min(3).max(140),
    description: z.string().max(2000).default(""),
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    due_date: z.iso.date().optional(),
    related_record_id: z.uuid().optional(),
  })
  .strict();

export const workItemsCreate: ToolDefinition<z.infer<typeof workItemInput>> = {
  id: "work_items.create",
  name: "Criar item de trabalho",
  description: "Cria um item de trabalho (tarefa de negócio) na organização atual.",
  input: workItemInput,
  inputJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      priority: { type: "string", enum: ["low", "normal", "high"] },
      due_date: { type: "string", description: "AAAA-MM-DD" },
      related_record_id: { type: "string", description: "UUID de um registro existente" },
    },
  },
  permission: "work_items:write",
  risk: "low",
  mutating: true,
  external: false,
  idempotent: true,
  defaultMode: "auto",
  minimumMode: "auto",
  requiresIntegration: null,
  requiresAi: false,
  allowedRoles: ["operator"],
  verification: "read_back",
  timeoutMs: 10_000,
  retry: { maxAttempts: 3, backoffMs: 500 },
  describeTarget: (i) => `Item: ${i.title}`,
  describeImpact: (i) => `Cria um item de trabalho interno com prioridade ${i.priority}.`,
  async execute(ctx, input) {
    if (input.related_record_id) {
      const rec = await ctx.data.getRecord(ctx.orgId, input.related_record_id);
      if (!rec) throw new ToolError("NOT_FOUND", "Registro relacionado não existe nesta organização");
    }
    const existing = await ctx.data.findWorkItemByKey(ctx.orgId, ctx.idempotencyKey);
    const item =
      existing ??
      (await ctx.data.insertWorkItem({
        org_id: ctx.orgId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        due_date: input.due_date ?? null,
        related_record_id: input.related_record_id ?? null,
        idempotency_key: ctx.idempotencyKey,
        created_by_task_id: ctx.taskId,
      }));
    return {
      output: { work_item_id: item.id, title: item.title, reused: Boolean(existing) },
      evidence: [{ kind: "work_item", id: item.id, label: item.title }],
    };
  },
  async verify(ctx, input, result) {
    const out = result.output as { work_item_id: string };
    const item = await ctx.data.getWorkItem(ctx.orgId, out.work_item_id);
    const checks = [
      { name: "exists", passed: Boolean(item) },
      { name: "title_matches", passed: item?.title === input.title },
      { name: "same_org", passed: item?.org_id === ctx.orgId },
    ];
    return { status: checks.every((c) => c.passed) ? "verified" : "failed", checks };
  },
};

/* ------------------------------------------------------------------ */
/* reports.generate                                                     */
/* ------------------------------------------------------------------ */

const reportInput = z
  .object({
    title: z.string().min(3).max(140),
    scope: z.enum(["records", "work_items", "missions"]),
    period_days: z.number().int().min(1).max(365).default(30),
  })
  .strict();

export const reportsGenerate: ToolDefinition<z.infer<typeof reportInput>> = {
  id: "reports.generate",
  name: "Gerar relatório",
  description:
    "Gera um relatório com contagens reais a partir dos dados autorizados da organização (registros, itens de trabalho ou missões). Não inventa métricas.",
  input: reportInput,
  inputJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "scope"],
    properties: {
      title: { type: "string" },
      scope: { type: "string", enum: ["records", "work_items", "missions"] },
      period_days: { type: "integer", minimum: 1, maximum: 365 },
    },
  },
  permission: "reports:write",
  risk: "low",
  mutating: true,
  external: false,
  idempotent: true,
  defaultMode: "auto",
  minimumMode: "auto",
  requiresIntegration: null,
  requiresAi: false,
  allowedRoles: ["operator"],
  verification: "read_back",
  timeoutMs: 15_000,
  retry: { maxAttempts: 3, backoffMs: 500 },
  describeTarget: (i) => `Relatório: ${i.title}`,
  describeImpact: (i) => `Salva um relatório interno sobre ${i.scope} dos últimos ${i.period_days} dias.`,
  async execute(ctx, input) {
    const existing = await ctx.data.findReportByKey(ctx.orgId, ctx.idempotencyKey);
    if (existing) {
      return { output: { report_id: existing.id, checksum: existing.checksum, reused: true }, evidence: [{ kind: "report", id: existing.id, label: existing.title }] };
    }
    const since = new Date(Date.now() - input.period_days * 86_400_000).toISOString();
    const metrics =
      input.scope === "records"
        ? await ctx.data.countRecords(ctx.orgId, since)
        : input.scope === "work_items"
          ? await ctx.data.countWorkItems(ctx.orgId, since)
          : await ctx.data.countMissions(ctx.orgId, since);
    const content = { scope: input.scope, period_days: input.period_days, since, generated_at: new Date().toISOString(), metrics };
    const checksum = sha256(canonicalJson(content));
    const report = await ctx.data.insertReport({
      org_id: ctx.orgId,
      title: input.title,
      scope: input.scope,
      content,
      checksum,
      idempotency_key: ctx.idempotencyKey,
      created_by_task_id: ctx.taskId,
    });
    return { output: { report_id: report.id, checksum, metrics }, evidence: [{ kind: "report", id: report.id, label: report.title }] };
  },
  async verify(ctx, _input, result) {
    const out = result.output as { report_id: string; checksum: string };
    const r = await ctx.data.getReport(ctx.orgId, out.report_id);
    const checks = [
      { name: "exists", passed: Boolean(r) },
      { name: "checksum", passed: r ? sha256(canonicalJson(r.content)) === out.checksum : false, detail: "Conteúdo salvo confere com o gerado" },
    ];
    return { status: checks.every((c) => c.passed) ? "verified" : "failed", checks };
  },
};

/* ------------------------------------------------------------------ */
/* email.create_draft / email.send (Gmail)                              */
/* ------------------------------------------------------------------ */

const emailInput = z
  .object({
    to: z.array(z.email()).min(1).max(10),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(20_000),
  })
  .strict();
type EmailInput = z.infer<typeof emailInput>;

const emailJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["to", "subject", "body"],
  properties: {
    to: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10 },
    subject: { type: "string" },
    body: { type: "string" },
  },
};

export function recipientsOutsideAllowlist(to: string[], allowed: string[]): string[] {
  const allow = allowed.map((d) => d.toLowerCase().replace(/^@/, ""));
  return to.filter((addr) => {
    const domain = addr.split("@")[1]?.toLowerCase() ?? "";
    return !allow.includes(domain);
  });
}

export const emailCreateDraft: ToolDefinition<EmailInput> = {
  id: "email.create_draft",
  name: "Criar rascunho de e-mail",
  description: "Cria um rascunho no Gmail conectado. Não envia nada.",
  input: emailInput,
  inputJsonSchema: emailJsonSchema,
  permission: "email:draft",
  risk: "medium",
  mutating: true,
  external: true,
  idempotent: false,
  defaultMode: "auto",
  minimumMode: "auto",
  requiresIntegration: "gmail",
  requiresAi: false,
  allowedRoles: ["operator"],
  verification: "external_read_back",
  timeoutMs: 20_000,
  retry: { maxAttempts: 1, backoffMs: 0 },
  describeTarget: (i) => i.to.join(", "),
  describeImpact: (i) => `Cria um rascunho "${i.subject}" no Gmail. Nada é enviado.`,
  async execute(ctx, input) {
    const r = await ctx.gmail.createDraft(ctx.orgId, input);
    return { output: { draft_id: r.draftId, message_id: r.messageId }, evidence: [{ kind: "gmail_draft", id: r.draftId, label: input.subject }] };
  },
  async verify(ctx, input, result) {
    const out = result.output as { draft_id: string };
    const d = await ctx.gmail.getDraft(ctx.orgId, out.draft_id);
    const checks = [
      { name: "draft_exists", passed: Boolean(d), detail: "Rascunho lido de volta na API do Gmail" },
      { name: "subject_matches", passed: d?.subject === input.subject },
    ];
    return { status: checks.every((c) => c.passed) ? "verified" : "failed", checks };
  },
};

export const emailSend: ToolDefinition<EmailInput> = {
  id: "email.send",
  name: "Enviar e-mail",
  description: "Envia um e-mail pelo Gmail conectado. Sempre exige aprovação humana; destinatários fora da lista permitida são bloqueados.",
  input: emailInput,
  inputJsonSchema: emailJsonSchema,
  permission: "email:send",
  risk: "high",
  mutating: true,
  external: true,
  idempotent: false,
  defaultMode: "approval",
  minimumMode: "approval",
  requiresIntegration: "gmail",
  requiresAi: false,
  allowedRoles: ["operator"],
  verification: "external_read_back",
  timeoutMs: 20_000,
  retry: { maxAttempts: 1, backoffMs: 0 },
  assessRisk(input, ctx) {
    const allowed = ctx.policy.email_allowed_domains;
    if (allowed.length === 0) {
      return { risk: "high", deny: "Nenhum domínio de destinatário está liberado nas políticas da organização" };
    }
    const outside = recipientsOutsideAllowlist(input.to, allowed);
    if (outside.length > 0) return { risk: "critical", deny: `Destinatário(s) fora da lista permitida: ${outside.join(", ")}` };
    const risk: RiskLevel = input.to.length > 3 ? "critical" : "high";
    return { risk };
  },
  describeTarget: (i) => i.to.join(", "),
  describeImpact: (i) => `Envia o e-mail "${i.subject}" para ${i.to.length} destinatário(s). Ação externa e irreversível.`,
  async execute(ctx, input) {
    const r = await ctx.gmail.sendMessage(ctx.orgId, input);
    return { output: { message_id: r.messageId, thread_id: r.threadId }, evidence: [{ kind: "gmail_message", id: r.messageId, label: input.subject }] };
  },
  async verify(ctx, _input, result) {
    const out = result.output as { message_id: string };
    const labels = await ctx.gmail.getMessageLabels(ctx.orgId, out.message_id);
    const checks = [
      { name: "message_exists", passed: labels !== null },
      { name: "in_sent", passed: Boolean(labels?.includes("SENT")), detail: "Mensagem consta em Enviados. Isso não comprova que o destinatário leu." },
    ];
    return { status: checks.every((c) => c.passed) ? "verified" : "failed", checks };
  },
};
