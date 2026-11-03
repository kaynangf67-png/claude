import { timingSafeEqual } from "node:crypto";
import { FOREX_YAHOO } from "../forex/marketData.js";
import { agentStatus, runTick, type TickDeps } from "./agent.js";
import { brtDate } from "./risk2x0.js";
import { DEFAULT_NEWS_CONFIG } from "./news.js";
import { telegramFromEnv, type Sender } from "./telegram.js";
import { DEFAULT_CONFIG, storeFromEnv, type AgentConfig, type Store } from "./store.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export interface AgentDeps extends Partial<Pick<TickDeps, "series" | "calendar" | "now">> { store?: Store; send?: Sender; env?: Record<string, string | undefined> }

const safeEq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
function bearer(req: Request, env: Record<string, string | undefined>, ...names: string[]): boolean | "unset" {
  const secrets = names.map((n) => env[n]).filter((v): v is string => !!v);
  if (!secrets.length) return "unset";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return !!got && secrets.some((s) => safeEq(got, s));
}

const migrated = new WeakSet<Store>();
async function open(deps: AgentDeps, env: Record<string, string | undefined>): Promise<Store> {
  const store = deps.store ?? storeFromEnv(env);
  if (!migrated.has(store)) { await store.migrate(); migrated.add(store); }
  return store;
}
let shared: Store | null = null;

const num = (v: unknown, lo: number, hi: number, d: number) => { const n = typeof v === "number" ? v : NaN; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
/** Valida a configuração enviada pelo painel. Risco, limite de operações e meta NÃO existem aqui: são fixos no código. */
export function sanitizeConfig(raw: unknown, cur: AgentConfig): AgentConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = <T>(v: unknown, ok: (x: unknown) => x is T, d: T[]) => (Array.isArray(v) ? [...new Set(v.filter(ok))] : d);
  const pairs = list(r.enabledPairs, (x): x is string => typeof x === "string" && x in FOREX_YAHOO, cur.enabledPairs);
  const strategies = list(r.strategies, (x): x is number => [1, 2, 3, 4, 5, 9].includes(x as number), cur.strategies);
  const w = (r.window && typeof r.window === "object" ? r.window : {}) as Record<string, unknown>;
  const n = (r.news && typeof r.news === "object" ? r.news : {}) as Record<string, unknown>;
  const nt = (r.notify && typeof r.notify === "object" ? r.notify : {}) as Record<string, unknown>;
  const start = Math.round(num(w.startMin, 0, 1439, cur.window.startMin)), end = Math.round(num(w.endMin, 1, 1440, cur.window.endMin));
  return {
    ...cur,
    enabledPairs: pairs.length ? pairs : cur.enabledPairs,
    strategies: strategies.length ? strategies.sort((a, b) => a - b) : cur.strategies,
    style: r.style === "conservador" || r.style === "equilibrado" || r.style === "agressivo" ? r.style : cur.style,
    entryTf: r.entryTf === "M5" ? "M5" : r.entryTf === "M1" ? "M1" : cur.entryTf,
    window: end > start ? { startMin: start, endMin: end } : cur.window,
    news: { beforeMin: Math.round(num(n.beforeMin, 0, 120, cur.news.beforeMin ?? DEFAULT_NEWS_CONFIG.beforeMin)), afterMin: Math.round(num(n.afterMin, 0, 120, cur.news.afterMin ?? DEFAULT_NEWS_CONFIG.afterMin)), blockMedium: typeof n.blockMedium === "boolean" ? n.blockMedium : cur.news.blockMedium },
    costPips: num(r.costPips, 0, 5, cur.costPips), distantAtr: num(r.distantAtr, 4, 30, cur.distantAtr), intervalMin: Math.round(num(r.intervalMin, 1, 60, cur.intervalMin)),
    notify: { distant: typeof nt.distant === "boolean" ? nt.distant : cur.notify.distant, forming: typeof nt.forming === "boolean" ? nt.forming : cur.notify.forming },
    paused: typeof r.paused === "boolean" ? r.paused : cur.paused,
    armedDay: cur.armedDay, // só os botões Ligar/Desligar mexem nisto, nunca o formulário de configuração
    execution: DEFAULT_CONFIG.execution, // execução real: sempre desligada
  };
}

export async function handleAgent(request: Request, deps: AgentDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const url = new URL(request.url), action = url.searchParams.get("action") ?? "status";
  try {
    if (!deps.store && !env.DATABASE_URL) return json({ error: "DATABASE_URL não configurada: sem banco o agente não guarda o estado diário e não roda. Veja docs/TRADE-AGENT.md.", configured: false }, 503);
    const store = await open({ ...deps, store: deps.store ?? (shared ??= storeFromEnv(env)) }, env);

    if (action === "status" && request.method === "GET") return json(await agentStatus(store, (deps.now ?? Date.now)()));
    if (action === "history" && request.method === "GET") return json({ days: await store.listDays(30), trades: await store.listTrades({ limit: 200 }), alerts: await store.listAlerts(100) });
    if (action === "report" && request.method === "GET") return json((await store.getKv(`report:${url.searchParams.get("date") ?? ""}`)) ?? { error: "Sem relatório para esta data." }, 200);

    if (action === "tick" && request.method === "POST") {
      const ok = bearer(request, env, "CRON_SECRET", "AGENT_ADMIN_TOKEN");
      if (ok === "unset") return json({ error: "CRON_SECRET não configurada no servidor." }, 503);
      if (!ok) return json({ error: "Não autorizado." }, 401);
      return json(await runTick({ store, send: deps.send ?? telegramFromEnv(env), now: deps.now, series: deps.series, calendar: deps.calendar }));
    }
    if (action === "control" && request.method === "POST") {
      const ok = bearer(request, env, "AGENT_ADMIN_TOKEN");
      if (ok === "unset") return json({ error: "AGENT_ADMIN_TOKEN não configurada no servidor: controles desativados." }, 503);
      if (!ok) return json({ error: "Não autorizado." }, 401);
      const body = (await request.json().catch(() => ({}))) as { op?: string; config?: unknown };
      const cur = await store.getConfig();
      const today = brtDate(Math.floor((deps.now ?? Date.now)() / 1000));
      if (body.op === "pause" || body.op === "resume") await store.setConfig({ ...cur, paused: body.op === "pause" });
      else if (body.op === "start") await store.setConfig({ ...cur, armedDay: today, paused: false });
      else if (body.op === "stop") await store.setConfig({ ...cur, armedDay: null });
      else if (body.op === "config") await store.setConfig(sanitizeConfig(body.config, cur));
      else return json({ error: "Operação inválida (use start, stop, pause, resume ou config)." }, 400);
      return json({ ok: true, config: await store.getConfig() });
    }
    return json({ error: "Ação ou método inválido." }, 405);
  } catch (e) { return json({ error: (e as Error).message.replace(/postgres(ql)?:\/\/[^\s]+/gi, "postgres://***") }, 500); }
}
