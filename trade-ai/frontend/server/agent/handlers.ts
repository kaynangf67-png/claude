import { timingSafeEqual } from "node:crypto";
import { FOREX_YAHOO } from "../forex/marketData.js";
import { agentStatus, runTick, type TickDeps } from "./agent.js";
import { brtDate } from "./risk2x0.js";
import { DEFAULT_NEWS_CONFIG } from "./news.js";
import { telegramFromEnv, type Sender } from "./telegram.js";
import { DEFAULT_CONFIG, storeFromEnv, type AgentConfig, type Store } from "./store.js";
import { loadState, runCycle, view as zyonView } from "../zyon/cycle.js";
import { loadMt5, poll as mt5Poll, publicView as mt5View, report as mt5Report, setEnabled as mt5SetEnabled, toText as mt5Text } from "../zyon/mt5.js";

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
    style: r.style === "conservador" || r.style === "equilibrado" || r.style === "agressivo" || r.style === "livre" ? r.style : cur.style,
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

    // ZYON: mesa multiagente SIMULADA. Leitura e ciclo são públicos (o ciclo tem intervalo mínimo e trava contra execução dupla).
    const nowS = Math.floor((deps.now ?? Date.now)() / 1000);
    if (action === "zyon" && request.method === "GET") return json({ ...zyonView(await loadState(store), nowS), mt5: mt5View(await loadMt5(store), nowS) });
    if (action === "zyon-cycle" && request.method === "POST") {
      const r = await runCycle({ store, now: deps.now, series: deps.series, calendar: deps.calendar });
      return json({ ...zyonView(r.state, nowS), mt5: mt5View(await loadMt5(store), nowS), ran: r.ran, cycleNote: r.note });
    }
    // PONTE MT5: só o Expert Advisor chama estas duas rotas, com o token MT5_BRIDGE_TOKEN (texto simples, fácil de ler em MQL5)
    if ((action === "mt5-poll" || action === "mt5-report") && request.method === "POST") {
      const ok = bearer(request, env, "MT5_BRIDGE_TOKEN");
      const text = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
      if (ok === "unset") return text("ERROR|MT5_BRIDGE_TOKEN não configurada no servidor\n", 503);
      if (!ok) return text("ERROR|token inválido\n", 401);
      const p = new URLSearchParams(await request.text());
      if (action === "mt5-poll") return text(mt5Text(await mt5Poll(store, p, nowS)));
      const r = await mt5Report(store, p, nowS);
      return text(`${r.ok ? "OK" : "ERROR"}|${r.note}\n`, r.ok ? 200 : 409);
    }
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
      else if (body.op === "mt5-on" || body.op === "mt5-off") { await mt5SetEnabled(store, body.op === "mt5-on", Math.floor((deps.now ?? Date.now)() / 1000)); return json({ ok: true, mt5: mt5View(await loadMt5(store), Math.floor((deps.now ?? Date.now)() / 1000)) }); }
      else if (body.op === "config") await store.setConfig(sanitizeConfig(body.config, cur));
      else return json({ error: "Operação inválida (use start, stop, pause, resume ou config)." }, 400);
      return json({ ok: true, config: await store.getConfig() });
    }
    return json({ error: "Ação ou método inválido." }, 405);
  } catch (e) { return json({ error: (e as Error).message.replace(/postgres(ql)?:\/\/[^\s]+/gi, "postgres://***") }, 500); }
}
