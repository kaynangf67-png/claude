/**
 * In-memory implementations of the engine ports. TEST-ONLY: the application
 * always uses the Supabase-backed adapters.
 */
import { randomUUID } from "node:crypto";
import type { Approval, Mission, OrgPolicy, Task, ToolExecution } from "@/lib/domain/types";
import { DEFAULT_POLICY, type MemberRole } from "@/lib/domain/types";
import type { AuditEvent, EngineRepository, UsageRecord } from "@/lib/engine/ports";
import type { BusinessRecord, DataPort, GmailPort, StoredReport, WorkItem } from "@/lib/tools/types";
import { IntegrationUnavailableError } from "@/lib/tools/types";

const iso = () => new Date().toISOString();
const clone = <T>(x: T): T => structuredClone(x);

export class MemoryRepo implements EngineRepository {
  missions = new Map<string, Mission>();
  tasks = new Map<string, Task>();
  approvals = new Map<string, Approval>();
  executions = new Map<string, ToolExecution>();
  audit: AuditEvent[] = [];
  usage: UsageRecord[] = [];
  runs = new Map<string, Record<string, unknown>>();
  memberships = new Map<string, MemberRole>();
  policies = new Map<string, OrgPolicy>();

  addMember(orgId: string, userId: string, role: MemberRole) {
    this.memberships.set(`${orgId}:${userId}`, role);
  }
  setPolicy(orgId: string, p: Partial<OrgPolicy>) {
    this.policies.set(orgId, { ...DEFAULT_POLICY, ...this.policies.get(orgId), ...p, org_id: orgId });
  }

  async getMembershipRole(orgId: string, userId: string) {
    return this.memberships.get(`${orgId}:${userId}`) ?? null;
  }
  async getPolicy(orgId: string) {
    return clone(this.policies.get(orgId) ?? { ...DEFAULT_POLICY, org_id: orgId });
  }
  async insertMission(m: Parameters<EngineRepository["insertMission"]>[0]) {
    const row: Mission = {
      id: randomUUID(),
      status: "draft",
      plan: null,
      plan_source: null,
      plan_review: null,
      report: null,
      action_count: 0,
      lock_token: null,
      locked_until: null,
      started_at: null,
      finished_at: null,
      created_at: iso(),
      updated_at: iso(),
      ...m,
    };
    this.missions.set(row.id, row);
    return clone(row);
  }
  async getMission(orgId: string, id: string) {
    const m = this.missions.get(id);
    return m && m.org_id === orgId ? clone(m) : null;
  }
  async updateMissionIf(orgId: string, id: string, expected: Mission["status"][], patch: Partial<Mission>) {
    const m = this.missions.get(id);
    if (!m || m.org_id !== orgId || !expected.includes(m.status)) return null;
    Object.assign(m, clone(patch), { updated_at: iso() });
    return clone(m);
  }
  async acquireMissionLock(orgId: string, id: string, token: string, ttlMs: number) {
    const m = this.missions.get(id);
    if (!m || m.org_id !== orgId) return false;
    if (m.lock_token && m.locked_until && new Date(m.locked_until).getTime() > Date.now()) return false;
    m.lock_token = token;
    m.locked_until = new Date(Date.now() + ttlMs).toISOString();
    return true;
  }
  async releaseMissionLock(orgId: string, id: string, token: string) {
    const m = this.missions.get(id);
    if (m && m.org_id === orgId && m.lock_token === token) {
      m.lock_token = null;
      m.locked_until = null;
    }
  }
  async incrementActionCount(orgId: string, id: string) {
    const m = this.missions.get(id)!;
    if (m.org_id !== orgId) throw new Error("cross-org");
    m.action_count += 1;
    return m.action_count;
  }
  async countMissionsCreatedSince(orgId: string, since: string) {
    return [...this.missions.values()].filter((m) => m.org_id === orgId && m.created_at >= since).length;
  }
  async listRunnableMissions(limit: number) {
    return [...this.missions.values()]
      .filter((m) => ["queued", "running"].includes(m.status) && (!m.locked_until || new Date(m.locked_until).getTime() < Date.now()))
      .slice(0, limit)
      .map((m) => ({ id: m.id, org_id: m.org_id, created_by: m.created_by }));
  }
  async insertTasks(tasks: Parameters<EngineRepository["insertTasks"]>[0]) {
    return tasks.map((t) => {
      const row: Task = {
        id: randomUUID(),
        approval_id: null,
        attempts: 0,
        output: null,
        error_code: null,
        error_message: null,
        verification_status: "pending",
        verification_detail: null,
        next_attempt_at: null,
        started_at: null,
        finished_at: null,
        created_at: iso(),
        updated_at: iso(),
        ...clone(t),
      };
      this.tasks.set(row.id, row);
      return clone(row);
    });
  }
  async listTasks(orgId: string, missionId: string) {
    return [...this.tasks.values()].filter((t) => t.org_id === orgId && t.mission_id === missionId).map(clone);
  }
  async getTask(orgId: string, id: string) {
    const t = this.tasks.get(id);
    return t && t.org_id === orgId ? clone(t) : null;
  }
  async updateTaskIf(orgId: string, id: string, expected: Task["status"][], patch: Partial<Task>) {
    const t = this.tasks.get(id);
    if (!t || t.org_id !== orgId || !expected.includes(t.status)) return null;
    Object.assign(t, clone(patch), { updated_at: iso() });
    return clone(t);
  }
  async insertApproval(a: Parameters<EngineRepository["insertApproval"]>[0]) {
    const row: Approval = { id: randomUUID(), created_at: iso(), decided_by: null, decided_at: null, decision_note: null, status: "pending", ...clone(a) };
    this.approvals.set(row.id, row);
    return clone(row);
  }
  async getApproval(orgId: string, id: string) {
    const a = this.approvals.get(id);
    return a && a.org_id === orgId ? clone(a) : null;
  }
  async updateApprovalIf(orgId: string, id: string, expected: Approval["status"][], patch: Partial<Approval>) {
    const a = this.approvals.get(id);
    if (!a || a.org_id !== orgId || !expected.includes(a.status)) return null;
    Object.assign(a, clone(patch));
    return clone(a);
  }
  async listApprovalsForMission(orgId: string, missionId: string) {
    return [...this.approvals.values()].filter((a) => a.org_id === orgId && a.mission_id === missionId).map(clone);
  }
  async findToolExecution(orgId: string, key: string) {
    const e = [...this.executions.values()].find((x) => x.org_id === orgId && x.idempotency_key === key);
    return e ? clone(e) : null;
  }
  async insertToolExecution(e: Parameters<EngineRepository["insertToolExecution"]>[0]) {
    if ([...this.executions.values()].some((x) => x.org_id === e.org_id && x.idempotency_key === e.idempotency_key)) throw new Error("duplicate idempotency key");
    const row: ToolExecution = { id: randomUUID(), started_at: iso(), finished_at: null, ...clone(e) };
    this.executions.set(row.id, row);
    return clone(row);
  }
  async updateToolExecution(orgId: string, id: string, patch: Partial<ToolExecution>) {
    const e = this.executions.get(id);
    if (e && e.org_id === orgId) Object.assign(e, clone(patch));
  }
  async listToolExecutions(orgId: string, missionId: string) {
    return [...this.executions.values()].filter((e) => e.org_id === orgId && e.mission_id === missionId).map(clone);
  }
  async insertAgentRun(r: Parameters<EngineRepository["insertAgentRun"]>[0]) {
    const id = randomUUID();
    this.runs.set(id, { ...r, id, status: "running" });
    return { id };
  }
  async finishAgentRun(_orgId: string, id: string, patch: Parameters<EngineRepository["finishAgentRun"]>[2]) {
    Object.assign(this.runs.get(id)!, patch);
  }
  async insertAudit(e: AuditEvent) {
    this.audit.push(clone(e));
  }
  async insertUsage(u: UsageRecord) {
    this.usage.push(u);
  }
  async sumUsageCostSince(orgId: string) {
    return this.usage.filter((u) => u.org_id === orgId).reduce((s, u) => s + (u.cost_usd ?? 0), 0);
  }
  async sumUsageForMission(orgId: string, missionId: string) {
    const rows = this.usage.filter((u) => u.org_id === orgId && u.mission_id === missionId);
    return { count: rows.length, cost: rows.some((r) => r.cost_usd === null) ? null : rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0) };
  }
}

export class MemoryData implements DataPort {
  records = new Map<string, BusinessRecord>();
  workItems = new Map<string, WorkItem>();
  reports = new Map<string, StoredReport>();
  /** Test hook: make setRecordClassification silently drop writes. */
  dropClassificationWrites = false;

  addRecord(r: Partial<BusinessRecord> & { org_id: string }) {
    const row: BusinessRecord = { id: randomUUID(), kind: "customer_message", title: "Mensagem", body: "", sender: null, status: "open", classification: null, created_at: iso(), ...r };
    this.records.set(row.id, row);
    return row;
  }
  async searchRecords(orgId: string, q: Parameters<DataPort["searchRecords"]>[1]) {
    return [...this.records.values()]
      .filter((r) => r.org_id === orgId && (!q.kind || r.kind === q.kind) && (!q.status || r.status === q.status) && (!q.unclassifiedOnly || !r.classification))
      .slice(0, q.limit)
      .map(clone);
  }
  async getRecord(orgId: string, id: string) {
    const r = this.records.get(id);
    return r && r.org_id === orgId ? clone(r) : null;
  }
  async setRecordClassification(orgId: string, id: string, c: NonNullable<BusinessRecord["classification"]>) {
    if (this.dropClassificationWrites) return;
    const r = this.records.get(id);
    if (r && r.org_id === orgId) r.classification = clone(c);
  }
  async countRecords(orgId: string) {
    const rows = [...this.records.values()].filter((r) => r.org_id === orgId);
    const group = (f: (r: BusinessRecord) => string | undefined) => rows.reduce<Record<string, number>>((acc, r) => { const k = f(r); if (k) acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
    return { total: rows.length, byKind: group((r) => r.kind), byStatus: group((r) => r.status), byCategory: group((r) => r.classification?.category) };
  }
  async findWorkItemByKey(orgId: string, key: string) {
    return [...this.workItems.values()].find((w) => w.org_id === orgId && w.idempotency_key === key) ?? null;
  }
  async insertWorkItem(w: Parameters<DataPort["insertWorkItem"]>[0]) {
    const row: WorkItem = { id: randomUUID(), status: "open", created_at: iso(), ...w };
    this.workItems.set(row.id, row);
    return clone(row);
  }
  async getWorkItem(orgId: string, id: string) {
    const w = this.workItems.get(id);
    return w && w.org_id === orgId ? clone(w) : null;
  }
  async countWorkItems(orgId: string) {
    const rows = [...this.workItems.values()].filter((w) => w.org_id === orgId);
    return { total: rows.length, byPriority: {}, byStatus: {} };
  }
  async countMissions() {
    return { total: 0, byStatus: {} };
  }
  async findReportByKey(orgId: string, key: string) {
    return [...this.reports.values()].find((r) => r.org_id === orgId && r.idempotency_key === key) ?? null;
  }
  async insertReport(r: Parameters<DataPort["insertReport"]>[0]) {
    const row: StoredReport = { id: randomUUID(), created_at: iso(), ...clone(r) };
    this.reports.set(row.id, row);
    return clone(row);
  }
  async getReport(orgId: string, id: string) {
    const r = this.reports.get(id);
    return r && r.org_id === orgId ? clone(r) : null;
  }
}

export class FakeGmail implements GmailPort {
  connected = false;
  sent: { to: string[]; subject: string }[] = [];
  drafts = new Map<string, { subject: string; to: string }>();
  private guard() {
    if (!this.connected) throw new IntegrationUnavailableError("gmail", "não conectado");
  }
  async createDraft(_o: string, m: { to: string[]; subject: string }) {
    this.guard();
    const id = randomUUID();
    this.drafts.set(id, { subject: m.subject, to: m.to.join(",") });
    return { draftId: id, messageId: randomUUID() };
  }
  async getDraft(_o: string, id: string) {
    const d = this.drafts.get(id);
    return d ? { draftId: id, subject: d.subject, to: d.to } : null;
  }
  async sendMessage(_o: string, m: { to: string[]; subject: string }) {
    this.guard();
    this.sent.push(m);
    return { messageId: `m${this.sent.length}`, threadId: "t" };
  }
  async getMessageLabels() {
    return ["SENT"];
  }
}
