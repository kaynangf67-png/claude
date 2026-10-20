import "server-only";
import { createServiceClient } from "@/lib/db/clients";
import { SupabaseEngineRepository } from "@/lib/db/repository";
import { SupabaseDataPort } from "@/lib/db/data";
import { GmailAdapter, isGmailConnected } from "@/lib/integrations/gmail";
import { getAiProvider } from "@/lib/ai";
import { MissionEngine } from "./engine";

export function getEngine(): MissionEngine {
  const db = createServiceClient();
  return new MissionEngine({
    repo: new SupabaseEngineRepository(db),
    data: new SupabaseDataPort(db),
    gmail: new GmailAdapter(db),
    ai: getAiProvider(),
    isIntegrationConnected: (orgId) => isGmailConnected(db, orgId),
  });
}
