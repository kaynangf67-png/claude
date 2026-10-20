import { describe, expect, it } from "vitest";
import { evaluatePolicy, effectiveMode } from "@/lib/policy/engine";
import { approvalBindingHash, checkApprovalUsable } from "@/lib/policy/approvals";
import { getTool } from "@/lib/tools/registry";
import { DEFAULT_POLICY, type Approval, type OrgPolicy } from "@/lib/domain/types";
import { recipientsOutsideAllowlist } from "@/lib/tools/builtin";

const policy = (p: Partial<OrgPolicy> = {}): OrgPolicy => ({ ...DEFAULT_POLICY, org_id: "o", ...p });
const base = {
  agentRole: "operator" as const,
  memberRole: "owner" as const,
  missionActionCount: 0,
  aiAvailable: true,
  integrationConnected: () => true,
  aiSpendThisMonthUsd: 0,
};

describe("policy engine", () => {
  it("allows safe internal tools automatically", () => {
    const r = evaluatePolicy({ ...base, tool: getTool("work_items.create"), toolId: "work_items.create", params: { title: "Ligar" }, policy: policy() });
    expect(r.decision).toBe("allow");
    expect(r.params).toMatchObject({ title: "Ligar", priority: "normal" });
  });

  it("denies unknown tools", () => {
    expect(evaluatePolicy({ ...base, tool: undefined, toolId: "sql.exec", params: {}, policy: policy() }).decision).toBe("deny");
  });

  it("denies auditors from using mutating tools", () => {
    const r = evaluatePolicy({ ...base, agentRole: "auditor", tool: getTool("work_items.create"), toolId: "work_items.create", params: { title: "abc" }, policy: policy() });
    expect(r.decision).toBe("deny");
  });

  it("strategist/optimizer cannot execute tools", () => {
    for (const role of ["strategist", "optimizer"] as const) {
      expect(evaluatePolicy({ ...base, agentRole: role, tool: getTool("records.search"), toolId: "records.search", params: {}, policy: policy() }).decision).toBe("deny");
    }
  });

  it("requires a connected integration", () => {
    const r = evaluatePolicy({ ...base, integrationConnected: () => false, tool: getTool("email.create_draft"), toolId: "email.create_draft", params: { to: ["a@b.com"], subject: "s", body: "b" }, policy: policy() });
    expect(r.decision).toBe("deny");
    expect(r.reasons[0]).toContain("gmail");
  });

  it("escalates email.send by recipient count and blocks outside the allowlist", () => {
    const p = policy({ email_allowed_domains: ["acme.com"] });
    const tool = getTool("email.send");
    expect(evaluatePolicy({ ...base, tool, toolId: "email.send", params: { to: ["a@acme.com"], subject: "s", body: "b" }, policy: p })).toMatchObject({ decision: "require_approval", risk: "high" });
    expect(evaluatePolicy({ ...base, tool, toolId: "email.send", params: { to: ["a@acme.com", "b@acme.com", "c@acme.com", "d@acme.com"], subject: "s", body: "b" }, policy: p })).toMatchObject({ decision: "require_approval", risk: "critical" });
    expect(evaluatePolicy({ ...base, tool, toolId: "email.send", params: { to: ["a@evil.com"], subject: "s", body: "b" }, policy: p }).decision).toBe("deny");
  });

  it("viewers are denied every tool", () => {
    const r = evaluatePolicy({ ...base, memberRole: "viewer", tool: getTool("work_items.create"), toolId: "work_items.create", params: { title: "abc" }, policy: policy() });
    expect(r.decision).toBe("deny");
  });

  it("blocked mode wins; minimum mode cannot be loosened", () => {
    const tool = getTool("records.search")!;
    expect(effectiveMode(tool, policy({ tool_modes: { "records.search": "blocked" } }))).toBe("blocked");
    expect(effectiveMode(getTool("email.send")!, policy({ tool_modes: { "email.send": "auto" } }))).toBe("approval");
  });

  it("matches recipient domains case-insensitively", () => {
    expect(recipientsOutsideAllowlist(["A@ACME.com", "b@x.com"], ["@acme.com"])).toEqual(["b@x.com"]);
  });
});

describe("approval binding", () => {
  const binding = { orgId: "o", missionId: "m", taskId: "t", toolId: "email.send", params: { to: ["a@b.com"], subject: "x", body: "y" }, requestedBy: "u", policyVersion: 1 };
  const approval = (p: Partial<Approval> = {}): Approval => ({
    id: "a", org_id: "o", mission_id: "m", task_id: "t", tool_id: "email.send", params: binding.params, binding_hash: approvalBindingHash(binding), policy_version: 1, requested_by: "u",
    risk: "high", reason: "", impact: "", target: "", evidence: null, status: "approved", expires_at: new Date(Date.now() + 60_000).toISOString(), decided_by: "x", decided_at: null, decision_note: null, created_at: "", ...p,
  });

  it("is independent of key order", () => {
    expect(approvalBindingHash({ ...binding, params: { body: "y", subject: "x", to: ["a@b.com"] } })).toBe(approvalBindingHash(binding));
  });

  it("detects any change", () => {
    expect(checkApprovalUsable(approval(), binding)).toEqual({ ok: true });
    expect(checkApprovalUsable(approval(), { ...binding, params: { ...binding.params, to: ["c@b.com"] } })).toMatchObject({ ok: false, reason: "binding_mismatch" });
    expect(checkApprovalUsable(approval(), { ...binding, policyVersion: 2 })).toMatchObject({ ok: false, reason: "binding_mismatch" });
    expect(checkApprovalUsable(approval(), { ...binding, taskId: "other" })).toMatchObject({ ok: false, reason: "wrong_task" });
    expect(checkApprovalUsable(approval({ status: "consumed" }), binding)).toMatchObject({ ok: false, reason: "not_approved" });
    expect(checkApprovalUsable(approval({ expires_at: new Date(Date.now() - 1).toISOString() }), binding)).toMatchObject({ ok: false, reason: "expired" });
  });
});
