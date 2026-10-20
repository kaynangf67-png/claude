import { canonicalJson, sha256 } from "@/lib/domain/canonical";
import type { Approval } from "@/lib/domain/types";

export interface ApprovalBindingInput {
  orgId: string;
  missionId: string;
  taskId: string;
  toolId: string;
  params: Record<string, unknown>;
  requestedBy: string;
  policyVersion: number;
}

/**
 * Hash that ties an approval to exactly one action. If any component
 * changes (params edited, policy updated, different task), the hash no
 * longer matches and the approval cannot be used.
 */
export function approvalBindingHash(b: ApprovalBindingInput): string {
  return sha256(
    canonicalJson({
      v: 1,
      org: b.orgId,
      mission: b.missionId,
      task: b.taskId,
      tool: b.toolId,
      params: b.params,
      requested_by: b.requestedBy,
      policy_version: b.policyVersion,
    }),
  );
}

export type ApprovalCheck =
  | { ok: true }
  | { ok: false; reason: "not_approved" | "expired" | "binding_mismatch" | "wrong_task"; message: string };

export function checkApprovalUsable(approval: Approval, current: ApprovalBindingInput, now = new Date()): ApprovalCheck {
  if (approval.task_id !== current.taskId || approval.org_id !== current.orgId) {
    return { ok: false, reason: "wrong_task", message: "A aprovação pertence a outra ação" };
  }
  if (approval.status !== "approved") {
    return { ok: false, reason: "not_approved", message: `Aprovação está ${approval.status}` };
  }
  if (new Date(approval.expires_at).getTime() <= now.getTime()) {
    return { ok: false, reason: "expired", message: "Aprovação expirada" };
  }
  if (approval.binding_hash !== approvalBindingHash(current)) {
    return { ok: false, reason: "binding_mismatch", message: "Parâmetros ou política mudaram desde a aprovação" };
  }
  return { ok: true };
}
