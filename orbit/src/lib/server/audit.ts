import "server-only";
import { createServiceClient } from "@/lib/db/clients";
import { SupabaseEngineRepository } from "@/lib/db/repository";
import type { AuditEvent } from "@/lib/engine/ports";

export async function writeAudit(e: Omit<AuditEvent, "actor_type"> & { actor_type?: AuditEvent["actor_type"] }) {
  await new SupabaseEngineRepository(createServiceClient()).insertAudit({ actor_type: "user", ...e });
}
