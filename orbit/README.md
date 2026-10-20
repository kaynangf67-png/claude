# ORBIT

AI agent orchestration SaaS: a user describes a business objective, ORBIT plans it as typed tasks, executes only server-authorized tools, pauses for human approval when policy requires it, verifies outcomes by reading results back, and records everything in an append-only audit log. UI language: pt-BR.

> Status: MVP. Everything listed under "Verified" below was actually executed in this repository's test suites. Items under "Not verified" are implemented but were not exercised against the real external service.

## Stack

Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript strict, Tailwind CSS 4, Zod 4, Supabase (Auth + Postgres + RLS) via `@supabase/ssr`, Anthropic SDK (`claude-opus-5-5`, structured outputs, server-side refusal fallback), Vitest, Playwright.

Deliberate deviations from the original brief:
- **No shadcn/ui or React Hook Form.** Components are a small hand-written set in `src/components/ui`. `@hookform/resolvers@6` currently has an unresolvable peer-dependency tree with Zod 4; forms use Server Actions + `useActionState` with Zod validation on the server, which is where validation must happen anyway.
- **No job queue.** Execution is a database-backed state machine with a per-mission lease lock. Runs start via `after()` right after the user action and are resumed by `/api/cron/tick`.

## Architecture

```
Browser ──(user JWT, RLS: SELECT only)──────────────► Postgres
   │
   └─ Server Actions / Route Handlers
         │ authenticate (Supabase Auth) + membership + permission check
         ▼
      MissionEngine (src/lib/engine/engine.ts)
         ├─ planner.ts      Strategist: AI plan → Zod validation → bounded retry
         ├─ policy/engine   server-side decision: allow | require_approval | deny
         ├─ policy/approvals binding hash (org, mission, task, tool, params, requester, policy version)
         ├─ tools/registry  the ONLY executable tools
         └─ ports.ts        storage interface (Supabase adapter in src/lib/db, in-memory adapter for tests only)
                 │ service role, every query filtered by org_id
                 ▼
              Postgres (RLS on every table, audit_logs append-only by trigger)
```

### Security model

- **Reads**: pages query with the user's JWT; RLS limits rows to organizations the user belongs to. Cost/usage rows are owner/admin only.
- **Writes**: `authenticated` has **no** INSERT/UPDATE/DELETE grants. All writes go through server code after explicit permission checks, using the service role and an explicit `org_id` filter. A leaked anon key cannot change missions, approvals, policies or logs.
- **Secrets**: OAuth tokens are AES-256-GCM encrypted (`ORBIT_ENCRYPTION_KEY`, AAD = integration id) in `integration_secrets`, which has RLS on, no policies and no grants for client roles. API keys exist only as server env vars and are never shown.
- **Audit log**: `audit_logs` rejects UPDATE/DELETE/TRUNCATE via trigger, for every role including the service role.
- **Untrusted content** (customer messages, objectives, connector data) is wrapped in `<untrusted_data>` and every agent prompt says it carries no authority. The model never controls authorization: tool existence, params, permission, risk and approval are decided by `evaluatePolicy` in code. The AI's `risk_hint`/`approval_hint` are stored but ignored.
- Agents cannot run SQL, shell, code or file access: no such tools exist in the registry.

### Mission lifecycle

`draft → planning → awaiting_approval (plan review) → queued → running ⇄ awaiting_approval (task approval) → completed | failed | cancelled` (+ `paused`). Task states: `pending, ready, running, awaiting_approval, succeeded, failed, skipped, cancelled, verification_failed`. Transitions are enforced by `src/lib/domain/states.ts` and every status write is compare-and-set (`update … where status in (expected)`), so concurrent runners cannot double-execute.

Execution details:
- Per-mission lease lock (`orbit_acquire_mission_lock`), time-boxed runs, resumable by the cron tick.
- Crash recovery: a task found `running` under a fresh lock is re-queued if its tool is idempotent; a non-idempotent external call with unknown outcome is failed as `UNKNOWN_OUTCOME` instead of being repeated.
- Idempotency: `tool_executions(org_id, idempotency_key)` unique per attempt; internal writes (`work_items`, `reports`) are deduplicated by a per-task key.
- Retries with exponential backoff only for errors marked retryable; timeouts per tool and per org.
- Approvals are single-use (`consumed`), expire, and are invalidated if params or the policy version change.
- Distinguishes recommendation (plan), planned action (task), attempted action (`tool_executions.status=started`), tool response (`succeeded`), and verified outcome (`verification_status=verified`). A tool success that fails read-back becomes `verification_failed`.
- Final report lists completed, verified, unverified, failed, skipped and pending items, duration, and AI cost only when every usage row has a known price (otherwise `null`, never guessed).

### Agents

Logical roles in one engine, not separate AI systems:
- **Strategist** – AI plan generation (structured output + Zod), no tool access.
- **Operator** – executes registered tools (deterministic code; `records.classify` calls the AI).
- **Auditor** – runs each tool's verification (read-back), no writes.
- **Optimizer** – aggregates history; rule-based suggestions, plus AI suggestions when configured. Cannot change policies.

### Tools (`src/lib/tools`)

| id | effect | default | notes |
|---|---|---|---|
| `records.search` | read | auto | |
| `records.classify` | internal write | auto | requires AI; verified by read-back |
| `work_items.create` | internal write | auto | idempotent; verified by read-back |
| `reports.generate` | internal write | auto | deterministic counts only; checksum verified |
| `email.create_draft` | Gmail draft | auto | requires Gmail; verified via `drafts.get` |
| `email.send` | Gmail send | **always approval** | blocked unless all recipients are in the org's domain allowlist; >3 recipients = critical |

Orgs can tighten any tool (`approval`, `blocked`) but cannot loosen below a tool's floor.

## Setup

### 1. Supabase

1. Create a project. In **Authentication > URL configuration** set Site URL to your app URL and add `https://YOUR-APP/auth/callback` to the redirect allow list.
2. Apply the migration: `supabase db push` (CLI linked to the project) or paste `supabase/migrations/20261020000000_orbit_core.sql` into the SQL editor.
3. Copy URL, anon key and service-role key into `.env.local` (see `.env.example`).

### 2. Optional services

- **AI**: set `ANTHROPIC_API_KEY`. Without it the app works with manual plans; AI features show as unavailable.
- **Gmail**: create a Google OAuth client (Web), add redirect URI `${NEXT_PUBLIC_APP_URL}/api/integrations/gmail/callback`, enable the Gmail API, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ORBIT_ENCRYPTION_KEY`. Scopes requested: `openid email gmail.compose`.
- **Background resume**: set `CRON_SECRET` and call `GET /api/cron/tick` with `Authorization: Bearer $CRON_SECRET` every few minutes. `vercel.json` schedules it every 5 minutes (sub-daily crons need a paid Vercel plan).

`/setup` shows which services are configured without revealing values.

### 3. Run

```bash
cd orbit
npm install
npm run dev          # http://localhost:3000
```

### Deploy (Vercel)

Create a project with **Root Directory = `orbit`**, add the env vars, deploy. Any Node 20+ host running `npm run build && npm run start` also works; call the cron endpoint from an external scheduler there.

## Tests

```bash
npm run typecheck && npm run lint
npm test                 # unit: state machines, policy engine, approval binding, mission engine, crypto, MIME
npm run test:db          # RLS/grants/constraints/RPCs against a real Postgres (needs local Postgres, see script)
npx playwright test      # public pages + unconfigured behaviour
# Full E2E against real auth + DB without Docker:
bash scripts/local-stack.sh up          # Postgres must be running; downloads GoTrue + PostgREST
set -a; . ./.env.e2e; set +a
E2E_FULL=1 npx playwright test
bash scripts/local-stack.sh down
```

`scripts/local-stack.sh` runs Supabase Auth (GoTrue) and PostgREST binaries behind a tiny gateway, so the app talks to the same APIs it uses in production. It is a test harness, not a production setup.

## Verified vs not verified

**Verified (executed and passing):**
- 50 unit tests (engine lifecycle, retries, recovery, locks, approvals incl. invalidation on param/policy change, tenant isolation in the engine, AI plan retry and budget, untrusted-data wrapping, crypto, MIME).
- 11 database tests on PostgreSQL 16 with the committed migration: cross-org isolation, anon denied, client writes denied, secrets unreachable, RPCs not callable by clients, audit immutability, lock semantics, constraints.
- Playwright E2E against GoTrue v2.180 + PostgREST 12 + Postgres 16: sign-up, onboarding, records, manual plan, execution with verification and evidence, Gmail tool blocked when not connected, policy change, approval pause and decision, audit trail, and a second organization unable to see the first one's data.
- Production build, typecheck, lint.

**Not verified (no credentials in the build environment):**
- Real Anthropic API calls (planning, classification, optimizer). The provider compiles against SDK types and is covered by fakes; the first real call may surface prompt/schema issues.
- Real Google OAuth and Gmail API calls.
- Hosted Supabase (the migration ran on vanilla Postgres 16 with a Supabase-compatible auth shim and on a real GoTrue).
- Supabase password-reset and invite e-mails (the local stack auto-confirms and has no SMTP).

## Known limitations / next steps

- Task params cannot reference outputs of earlier tasks (deliberate: no templating means the approved params are exactly the executed params). Needed for "draft a reply to each classified message".
- Notification preferences are stored but no e-mail notifications are sent yet.
- No billing; pricing on the landing page is labelled illustrative.
- Team invites rely on Supabase's built-in invite e-mail.
- Aggregate reports refuse periods with more than 10,000 rows rather than sampling.
- Recurring missions are not implemented (the cron tick only resumes existing missions).
- The original brief arrived truncated at section 11; sections after that were not available.
