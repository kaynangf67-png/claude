import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolError, type BusinessRecord, type DataPort, type RecordClassification, type StoredReport, type WorkItem } from "@/lib/tools/types";
import { DatabaseError } from "./repository";

const MAX_AGGREGATE_ROWS = 10_000;

function must<T>(op: string, res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new DatabaseError(op, res.error.message);
  return res.data;
}

function group<T>(rows: T[], key: (r: T) => string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Business data used by tools. Service role + explicit org_id filter on every query. */
export class SupabaseDataPort implements DataPort {
  constructor(private readonly db: SupabaseClient) {}

  async searchRecords(orgId: string, q: Parameters<DataPort["searchRecords"]>[1]): Promise<BusinessRecord[]> {
    let query = this.db.from("records").select("id, org_id, kind, title, body, sender, status, classification, created_at").eq("org_id", orgId);
    if (q.kind) query = query.eq("kind", q.kind);
    if (q.status) query = query.eq("status", q.status);
    if (q.unclassifiedOnly) query = query.is("classification", null);
    if (q.text) {
      const term = q.text.replace(/[%_,()]/g, " ").trim();
      if (term) query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
    }
    return must("searchRecords", await query.order("created_at", { ascending: false }).limit(q.limit)) as BusinessRecord[];
  }

  async getRecord(orgId: string, id: string): Promise<BusinessRecord | null> {
    return must("getRecord", await this.db.from("records").select("*").eq("org_id", orgId).eq("id", id).maybeSingle()) as BusinessRecord | null;
  }

  async setRecordClassification(orgId: string, id: string, c: RecordClassification): Promise<void> {
    must("setRecordClassification", await this.db.from("records").update({ classification: c }).eq("org_id", orgId).eq("id", id));
  }

  private async rowsSince<T>(table: string, columns: string, orgId: string, sinceIso: string): Promise<T[]> {
    const res = await this.db.from(table).select(columns, { count: "exact" }).eq("org_id", orgId).gte("created_at", sinceIso).limit(MAX_AGGREGATE_ROWS);
    if (res.error) throw new DatabaseError(`rowsSince:${table}`, res.error.message);
    if ((res.count ?? 0) > MAX_AGGREGATE_ROWS) {
      throw new ToolError("TOO_MANY_ROWS", `Mais de ${MAX_AGGREGATE_ROWS} linhas no período; reduza o período do relatório`);
    }
    return res.data as T[];
  }

  async countRecords(orgId: string, sinceIso: string) {
    const rows = await this.rowsSince<{ kind: string; status: string; classification: { category?: string } | null }>("records", "kind, status, classification", orgId, sinceIso);
    return {
      total: rows.length,
      byKind: group(rows, (r) => r.kind),
      byStatus: group(rows, (r) => r.status),
      byCategory: group(rows, (r) => r.classification?.category),
    };
  }

  async findWorkItemByKey(orgId: string, key: string): Promise<WorkItem | null> {
    return must("findWorkItemByKey", await this.db.from("work_items").select("*").eq("org_id", orgId).eq("idempotency_key", key).maybeSingle()) as WorkItem | null;
  }

  async insertWorkItem(w: Omit<WorkItem, "id" | "created_at" | "status">): Promise<WorkItem> {
    // Upsert on the idempotency key so a retried attempt never duplicates the item.
    const res = await this.db.from("work_items").upsert(w, { onConflict: "org_id,idempotency_key", ignoreDuplicates: true }).select("*").maybeSingle();
    const row = must("insertWorkItem", res) as WorkItem | null;
    return row ?? ((await this.findWorkItemByKey(w.org_id, w.idempotency_key)) as WorkItem);
  }

  async getWorkItem(orgId: string, id: string): Promise<WorkItem | null> {
    return must("getWorkItem", await this.db.from("work_items").select("*").eq("org_id", orgId).eq("id", id).maybeSingle()) as WorkItem | null;
  }

  async countWorkItems(orgId: string, sinceIso: string) {
    const rows = await this.rowsSince<{ priority: string; status: string }>("work_items", "priority, status", orgId, sinceIso);
    return { total: rows.length, byPriority: group(rows, (r) => r.priority), byStatus: group(rows, (r) => r.status) };
  }

  async countMissions(orgId: string, sinceIso: string) {
    const rows = await this.rowsSince<{ status: string }>("missions", "status", orgId, sinceIso);
    return { total: rows.length, byStatus: group(rows, (r) => r.status) };
  }

  async findReportByKey(orgId: string, key: string): Promise<StoredReport | null> {
    return must("findReportByKey", await this.db.from("reports").select("*").eq("org_id", orgId).eq("idempotency_key", key).maybeSingle()) as StoredReport | null;
  }

  async insertReport(r: Omit<StoredReport, "id" | "created_at">): Promise<StoredReport> {
    return must("insertReport", await this.db.from("reports").insert(r).select("*").single()) as StoredReport;
  }

  async getReport(orgId: string, id: string): Promise<StoredReport | null> {
    return must("getReport", await this.db.from("reports").select("*").eq("org_id", orgId).eq("id", id).maybeSingle()) as StoredReport | null;
  }
}
