/**
 * Runs against a real Postgres with the committed migrations applied
 * (see scripts/test-db.sh). Verifies tenant isolation and write protection.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";

const url = process.env.ORBIT_DB_URL;
if (!url) throw new Error("ORBIT_DB_URL not set; run `npm run test:db`");
const pool = new pg.Pool({ connectionString: url, max: 2 });

const alice = randomUUID();
const bob = randomUUID();
const viewer = randomUUID();
let orgA: string;
let orgB: string;
let missionA: string;

async function asUser<T>(userId: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(userId ? "set local role authenticated" : "set local role anon");
    if (userId) await c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return await fn(c);
  } finally {
    await c.query("rollback");
    c.release();
  }
}

async function asService<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("set role service_role");
    return await fn(c);
  } finally {
    await c.query("reset role");
    c.release();
  }
}

beforeAll(async () => {
  for (const [id, email] of [[alice, "alice@a.com"], [bob, "bob@b.com"], [viewer, "v@a.com"]]) {
    await pool.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  }
  await asService(async (c) => {
    orgA = (await c.query("select public.orbit_create_organization($1, 'Org A') as id", [alice])).rows[0].id;
    orgB = (await c.query("select public.orbit_create_organization($1, 'Org B') as id", [bob])).rows[0].id;
    await c.query("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'viewer')", [orgA, viewer]);
    missionA = (await c.query("insert into public.missions (org_id, created_by, name, objective) values ($1, $2, 'Missão A', 'objetivo') returning id", [orgA, alice])).rows[0].id;
    await c.query("insert into public.records (org_id, kind, title) values ($1, 'customer_message', 'segredo A')", [orgA]);
    await c.query("insert into public.usage_records (org_id, provider, model, input_tokens, output_tokens, cost_usd) values ($1, 'x', 'y', 1, 1, 0.5)", [orgA]);
    await c.query("insert into public.audit_logs (org_id, actor_type, action, entity_type, outcome) values ($1, 'system', 'test', 'mission', 'info')", [orgA]);
    const integ = (await c.query("insert into public.integrations (org_id, provider, status) values ($1, 'gmail', 'connected') returning id", [orgA])).rows[0].id;
    await c.query("insert into public.integration_secrets (integration_id, org_id, ciphertext) values ($1, $2, 'enc')", [integ, orgA]);
  });
});

afterAll(async () => {
  await pool.end();
});

describe("profiles", () => {
  it("are created by the auth trigger", async () => {
    const r = await pool.query("select email from public.profiles where id = $1", [alice]);
    expect(r.rows[0]?.email).toBe("alice@a.com");
  });
});

describe("tenant isolation", () => {
  it("members see only their organization", async () => {
    const seen = await asUser(alice, (c) => c.query("select id from public.organizations"));
    expect(seen.rows.map((r) => r.id)).toEqual([orgA]);
    const missions = await asUser(bob, (c) => c.query("select id from public.missions"));
    expect(missions.rows).toHaveLength(0);
    const records = await asUser(bob, (c) => c.query("select title from public.records"));
    expect(records.rows).toHaveLength(0);
  });

  it("anon sees nothing", async () => {
    await expect(asUser(null, (c) => c.query("select * from public.missions"))).rejects.toThrow(/permission denied/);
  });

  it("users cannot see other orgs' memberships or profiles", async () => {
    const m = await asUser(bob, (c) => c.query("select user_id from public.memberships"));
    expect(m.rows.map((r) => r.user_id)).toEqual([bob]);
    const p = await asUser(bob, (c) => c.query("select id from public.profiles"));
    expect(p.rows.map((r) => r.id)).toEqual([bob]);
    const pa = await asUser(alice, (c) => c.query("select id from public.profiles order by email"));
    expect(pa.rows.map((r) => r.id).sort()).toEqual([alice, viewer].sort());
  });
});

describe("write protection", () => {
  it("authenticated users cannot write engine tables directly", async () => {
    await expect(asUser(alice, (c) => c.query("update public.missions set status = 'completed' where id = $1", [missionA]))).rejects.toThrow(/permission denied/);
    await expect(asUser(alice, (c) => c.query("insert into public.approvals (org_id, mission_id, task_id, tool_id, params, binding_hash, policy_version, requested_by, risk, expires_at) values ($1, $2, gen_random_uuid(), 'x', '{}', repeat('a', 64), 1, $3, 'low', now())", [orgA, missionA, alice]))).rejects.toThrow(/permission denied/);
    await expect(asUser(alice, (c) => c.query("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'owner')", [orgB, alice]))).rejects.toThrow(/permission denied/);
    await expect(asUser(alice, (c) => c.query("update public.org_policies set execution_paused = false"))).rejects.toThrow(/permission denied/);
  });

  it("secrets are unreachable from client roles", async () => {
    await expect(asUser(alice, (c) => c.query("select * from public.integration_secrets"))).rejects.toThrow(/permission denied/);
    await expect(asUser(alice, (c) => c.query("select * from public.oauth_states"))).rejects.toThrow(/permission denied/);
  });

  it("engine RPCs are not callable by clients", async () => {
    await expect(asUser(alice, (c) => c.query("select public.orbit_create_organization($1, 'hack')", [alice]))).rejects.toThrow(/permission denied/);
    await expect(asUser(alice, (c) => c.query("select public.orbit_acquire_mission_lock($1, $2, gen_random_uuid(), 1000)", [orgA, missionA]))).rejects.toThrow(/permission denied/);
  });

  it("audit logs are append-only even for the service role", async () => {
    await expect(asService((c) => c.query("update public.audit_logs set action = 'x'"))).rejects.toThrow();
    await expect(asService((c) => c.query("delete from public.audit_logs"))).rejects.toThrow();
    await expect(pool.query("delete from public.audit_logs")).rejects.toThrow(/append-only/);
  });
});

describe("role-restricted reads", () => {
  it("usage/cost is visible to owners, not viewers", async () => {
    const owner = await asUser(alice, (c) => c.query("select count(*)::int as n from public.usage_records"));
    expect(owner.rows[0].n).toBe(1);
    const v = await asUser(viewer, (c) => c.query("select count(*)::int as n from public.usage_records"));
    expect(v.rows[0].n).toBe(0);
  });
});

describe("engine RPCs", () => {
  it("mission lock is exclusive until released or expired", async () => {
    await asService(async (c) => {
      const t1 = randomUUID();
      const t2 = randomUUID();
      const a = await c.query("select public.orbit_acquire_mission_lock($1, $2, $3, 60000) as ok", [orgA, missionA, t1]);
      const b = await c.query("select public.orbit_acquire_mission_lock($1, $2, $3, 60000) as ok", [orgA, missionA, t2]);
      expect([a.rows[0].ok, b.rows[0].ok]).toEqual([true, false]);
      const wrongOrg = await c.query("select public.orbit_acquire_mission_lock($1, $2, $3, 60000) as ok", [orgB, missionA, t2]);
      expect(wrongOrg.rows[0].ok).toBe(false);
      await c.query("select public.orbit_release_mission_lock($1, $2, $3)", [orgA, missionA, t1]);
      const c2 = await c.query("select public.orbit_acquire_mission_lock($1, $2, $3, 1) as ok", [orgA, missionA, t2]);
      expect(c2.rows[0].ok).toBe(true);
      await new Promise((r) => setTimeout(r, 20));
      const expired = await c.query("select public.orbit_acquire_mission_lock($1, $2, $3, 60000) as ok", [orgA, missionA, t1]);
      expect(expired.rows[0].ok).toBe(true);
      await c.query("select public.orbit_release_mission_lock($1, $2, $3)", [orgA, missionA, t1]);
    });
  });

  it("constraints reject invalid states and duplicate idempotency keys", async () => {
    await asService(async (c) => {
      await expect(c.query("update public.missions set status = 'done' where id = $1", [missionA])).rejects.toThrow(/check constraint/);
      await c.query("insert into public.work_items (org_id, title, idempotency_key) values ($1, 'abc', 'k1')", [orgA]);
      await expect(c.query("insert into public.work_items (org_id, title, idempotency_key) values ($1, 'abc', 'k1')", [orgA])).rejects.toThrow(/duplicate key/);
    });
  });
});
