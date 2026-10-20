import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env, supabaseConfigured } from "@/lib/env";
import { createServiceClient } from "@/lib/db/clients";
import { SupabaseEngineRepository } from "@/lib/db/repository";
import { getEngine } from "@/lib/engine/factory";

export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = env().CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Resumes queued/running missions whose runner stopped (timeouts, deploys, crashes). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const repo = new SupabaseEngineRepository(createServiceClient());
  const engine = getEngine();
  const missions = await repo.listRunnableMissions(5);
  const results = [];
  const deadline = Date.now() + 50_000;
  for (const m of missions) {
    const remaining = deadline - Date.now();
    if (remaining < 5_000) break;
    try {
      results.push({ id: m.id, ...(await engine.runMission(m.org_id, m.id, { timeBudgetMs: Math.min(20_000, remaining - 5_000) })) });
    } catch (e) {
      results.push({ id: m.id, status: "error", error: e instanceof Error ? e.message.slice(0, 200) : "error" });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}
