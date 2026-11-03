import pg from "pg";
import type { NewsConfig } from "./news.js";
import { DEFAULT_NEWS_CONFIG } from "./news.js";
import type { DayState } from "./risk2x0.js";

/** Persistência do TRADE AGENT. Duas implementações com o mesmo contrato: memória (testes) e PostgreSQL (produção). */

export interface AgentConfig {
  enabledPairs: string[];
  strategies: number[];
  style: "conservador" | "equilibrado" | "agressivo";
  entryTf: "M1" | "M5";
  /** Horário operacional em minutos desde 00:00, fuso America/Sao_Paulo. */
  window: { startMin: number; endMin: number };
  news: NewsConfig;
  paused: boolean;
  /** Custo simulado (spread + slippage) em pips, descontado do R de cada operação simulada. */
  costPips: number;
  /** Até quantos ATR(M5) de uma região H1 o preço conta como "oportunidade distante". */
  distantAtr: number;
  intervalMin: number;
  notify: { distant: boolean; forming: boolean };
  /** Execução real: DESLIGADA e sem implementação nesta versão. Só existe para a arquitetura futura. */
  execution: { enabled: false; broker: null };
}
export const DEFAULT_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY"];
export const DEFAULT_CONFIG: AgentConfig = {
  enabledPairs: DEFAULT_PAIRS, strategies: [1, 2, 3, 4, 5, 9], style: "equilibrado", entryTf: "M1",
  window: { startMin: 5 * 60, endMin: 17 * 60 }, news: DEFAULT_NEWS_CONFIG, paused: false, costPips: 1.2, distantAtr: 12, intervalMin: 5,
  notify: { distant: false, forming: true }, execution: { enabled: false, broker: null },
};

/** Operação SIMULADA: o agente nunca envia ordem. O resultado vem das velas reais depois da entrada. */
export interface JournalTrade {
  id: string; day: string; setupId: string; symbol: string; label: string; dir: "BUY" | "SELL"; strategy: string; strategyId: number;
  openedAt: number; entry: number; sl: number; tps: (number | null)[]; rr: (number | null)[]; riskDist: number; pip: number; score: number;
  status: "OPEN" | "WIN" | "LOSS" | "UNKNOWN"; closedAt?: number; outcome?: "tp1" | "stop" | "ambiguo" | "expirado"; r?: number; brl?: number;
  thesis?: string[]; dataAgeSec?: number;
}
export type RadarClass = "DISTANTE" | "FORMACAO" | "CONFIRMADA";
export interface AlertRecord { key: string; setupId: string; cls: RadarClass | "INVALIDADO" | "RESULTADO" | "NOTICIA" | "RELATORIO" | "SAUDE" | "META"; day: string; at: number; title: string; text: string; sent: boolean; error?: string }
export interface ScanRecord { at: number; day: string; symbol: string; label: string; decision: string; state: string; cls: RadarClass | null; score: number | null; strategy: string | null; setupId: string | null; discard: string | null; dataAgeSec: number | null }
export interface Heartbeat { at: number; ok: boolean; durationMs: number; pairsOk: number; pairsFailed: number; lastDataAt: number | null; lastError: string | null; consecutiveFailures: number; paused: boolean; marketOpen: boolean; lastTickAction: string }

export interface Store {
  migrate(): Promise<void>;
  getKv<T>(key: string): Promise<T | null>;
  setKv(key: string, value: unknown): Promise<void>;
  getConfig(): Promise<AgentConfig>;
  setConfig(c: AgentConfig): Promise<void>;
  /** Dia de risco. putDay é compare-and-set: `prevVersion` null = o dia não pode existir ainda. Devolve false se perdeu a corrida. */
  getDay(date: string): Promise<DayState | null>;
  latestDay(): Promise<DayState | null>;
  putDay(d: DayState, prevVersion: number | null): Promise<boolean>;
  listDays(limit: number): Promise<DayState[]>;
  putTrade(t: JournalTrade): Promise<void>;
  getTrade(id: string): Promise<JournalTrade | null>;
  listTrades(f: { day?: string; status?: JournalTrade["status"]; limit?: number }): Promise<JournalTrade[]>;
  /** Grava o alerta se a chave ainda não existe. false = já existia (duplicado). */
  addAlert(a: AlertRecord): Promise<boolean>;
  markAlert(key: string, sent: boolean, error?: string): Promise<void>;
  listAlerts(limit: number): Promise<AlertRecord[]>;
  logScans(rows: ScanRecord[]): Promise<void>;
  listScans(day: string): Promise<ScanRecord[]>;
  /** Trava de execução: só uma varredura por vez. */
  acquireLease(name: string, ttlSec: number, nowSec: number): Promise<boolean>;
  releaseLease(name: string): Promise<void>;
  close(): Promise<void>;
}

export const SCHEMA = `
create table if not exists agent_kv (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table if not exists agent_days (date text primary key, version int not null, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists agent_trades (id text primary key, day text not null, status text not null, data jsonb not null, updated_at timestamptz not null default now());
create index if not exists agent_trades_day on agent_trades (day);
create index if not exists agent_trades_status on agent_trades (status);
create table if not exists agent_alerts (key text primary key, at bigint not null, data jsonb not null);
create index if not exists agent_alerts_at on agent_alerts (at desc);
create table if not exists agent_scans (id bigserial primary key, day text not null, at bigint not null, data jsonb not null);
create index if not exists agent_scans_day on agent_scans (day);
create table if not exists agent_lease (name text primary key, until_at bigint not null);
`;

const SCAN_RETENTION_DAYS = 21;

// ---------------------------------------------------------------- memória (testes)
export class MemoryStore implements Store {
  kv = new Map<string, unknown>(); days = new Map<string, DayState>(); trades = new Map<string, JournalTrade>();
  alerts = new Map<string, AlertRecord>(); scans: ScanRecord[] = []; leases = new Map<string, number>();
  async migrate() {}
  async getKv<T>(k: string) { return (this.kv.has(k) ? structuredClone(this.kv.get(k)) : null) as T | null; }
  async setKv(k: string, v: unknown) { this.kv.set(k, structuredClone(v)); }
  async getConfig() { return { ...DEFAULT_CONFIG, ...((await this.getKv<Partial<AgentConfig>>("config")) ?? {}), execution: DEFAULT_CONFIG.execution }; }
  async setConfig(c: AgentConfig) { await this.setKv("config", c); }
  async getDay(date: string) { const d = this.days.get(date); return d ? structuredClone(d) : null; }
  async latestDay() { const k = [...this.days.keys()].sort().at(-1); return k ? structuredClone(this.days.get(k)!) : null; }
  async putDay(d: DayState, prev: number | null) {
    const cur = this.days.get(d.date);
    if (prev === null ? !!cur : !cur || cur.version !== prev) return false;
    this.days.set(d.date, structuredClone(d)); return true;
  }
  async listDays(limit: number) { return [...this.days.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit).map((d) => structuredClone(d)); }
  async putTrade(t: JournalTrade) { this.trades.set(t.id, structuredClone(t)); }
  async getTrade(id: string) { const t = this.trades.get(id); return t ? structuredClone(t) : null; }
  async listTrades(f: { day?: string; status?: JournalTrade["status"]; limit?: number }) {
    return [...this.trades.values()].filter((t) => (!f.day || t.day === f.day) && (!f.status || t.status === f.status)).sort((a, b) => b.openedAt - a.openedAt).slice(0, f.limit ?? 200).map((t) => structuredClone(t));
  }
  async addAlert(a: AlertRecord) { if (this.alerts.has(a.key)) return false; this.alerts.set(a.key, structuredClone(a)); return true; }
  async markAlert(key: string, sent: boolean, error?: string) { const a = this.alerts.get(key); if (a) { a.sent = sent; a.error = error; } }
  async listAlerts(limit: number) { return [...this.alerts.values()].sort((a, b) => b.at - a.at).slice(0, limit).map((a) => structuredClone(a)); }
  async logScans(rows: ScanRecord[]) { this.scans.push(...structuredClone(rows)); }
  async listScans(day: string) { return this.scans.filter((s) => s.day === day).map((s) => structuredClone(s)); }
  async acquireLease(name: string, ttl: number, now: number) { const u = this.leases.get(name); if (u !== undefined && u > now) return false; this.leases.set(name, now + ttl); return true; }
  async releaseLease(name: string) { this.leases.delete(name); }
  async close() {}
}

// ---------------------------------------------------------------- PostgreSQL (produção)
export class PgStore implements Store {
  pool: pg.Pool;
  /** `DATABASE_URL` de qualquer Postgres (Neon, Supabase, Railway...). Em funções serverless, prefira a URL com pooler. */
  constructor(url: string, opts: { max?: number } = {}) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    this.pool = new pg.Pool({ connectionString: url, max: opts.max ?? 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000, ssl: local ? undefined : { rejectUnauthorized: false } });
  }
  async migrate() { await this.pool.query(SCHEMA); }
  async getKv<T>(key: string) { const r = await this.pool.query("select value from agent_kv where key=$1", [key]); return (r.rows[0]?.value ?? null) as T | null; }
  async setKv(key: string, value: unknown) { await this.pool.query("insert into agent_kv(key,value) values($1,$2::jsonb) on conflict(key) do update set value=excluded.value, updated_at=now()", [key, JSON.stringify(value)]); }
  async getConfig() { return { ...DEFAULT_CONFIG, ...((await this.getKv<Partial<AgentConfig>>("config")) ?? {}), execution: DEFAULT_CONFIG.execution } as AgentConfig; }
  async setConfig(c: AgentConfig) { await this.setKv("config", c); }
  async getDay(date: string) { const r = await this.pool.query("select data from agent_days where date=$1", [date]); return (r.rows[0]?.data ?? null) as DayState | null; }
  async latestDay() { const r = await this.pool.query("select data from agent_days order by date desc limit 1"); return (r.rows[0]?.data ?? null) as DayState | null; }
  async putDay(d: DayState, prev: number | null) {
    if (prev === null) {
      const r = await this.pool.query("insert into agent_days(date,version,data) values($1,$2,$3::jsonb) on conflict(date) do nothing", [d.date, d.version, JSON.stringify(d)]);
      return (r.rowCount ?? 0) === 1;
    }
    const r = await this.pool.query("update agent_days set version=$2, data=$3::jsonb, updated_at=now() where date=$1 and version=$4", [d.date, d.version, JSON.stringify(d), prev]);
    return (r.rowCount ?? 0) === 1;
  }
  async listDays(limit: number) { const r = await this.pool.query("select data from agent_days order by date desc limit $1", [limit]); return r.rows.map((x) => x.data as DayState); }
  async putTrade(t: JournalTrade) {
    await this.pool.query("insert into agent_trades(id,day,status,data) values($1,$2,$3,$4::jsonb) on conflict(id) do update set status=excluded.status, data=excluded.data, updated_at=now()", [t.id, t.day, t.status, JSON.stringify(t)]);
  }
  async getTrade(id: string) { const r = await this.pool.query("select data from agent_trades where id=$1", [id]); return (r.rows[0]?.data ?? null) as JournalTrade | null; }
  async listTrades(f: { day?: string; status?: JournalTrade["status"]; limit?: number }) {
    const r = await this.pool.query("select data from agent_trades where ($1::text is null or day=$1) and ($2::text is null or status=$2) order by (data->>'openedAt')::bigint desc limit $3", [f.day ?? null, f.status ?? null, f.limit ?? 200]);
    return r.rows.map((x) => x.data as JournalTrade);
  }
  async addAlert(a: AlertRecord) { const r = await this.pool.query("insert into agent_alerts(key,at,data) values($1,$2,$3::jsonb) on conflict(key) do nothing", [a.key, a.at, JSON.stringify(a)]); return (r.rowCount ?? 0) === 1; }
  async markAlert(key: string, sent: boolean, error?: string) {
    await this.pool.query("update agent_alerts set data = data || jsonb_build_object('sent', $2::boolean, 'error', $3::text) where key=$1", [key, sent, error ?? null]);
  }
  async listAlerts(limit: number) { const r = await this.pool.query("select data from agent_alerts order by at desc limit $1", [limit]); return r.rows.map((x) => x.data as AlertRecord); }
  async logScans(rows: ScanRecord[]) {
    if (!rows.length) return;
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      for (const s of rows) await c.query("insert into agent_scans(day,at,data) values($1,$2,$3::jsonb)", [s.day, s.at, JSON.stringify(s)]);
      await c.query("delete from agent_scans where at < $1", [rows[0].at - SCAN_RETENTION_DAYS * 86400]);
      await c.query("commit");
    } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
  }
  async listScans(day: string) { const r = await this.pool.query("select data from agent_scans where day=$1 order by at asc", [day]); return r.rows.map((x) => x.data as ScanRecord); }
  async acquireLease(name: string, ttl: number, now: number) {
    const r = await this.pool.query("insert into agent_lease(name,until_at) values($1,$2) on conflict(name) do update set until_at=excluded.until_at where agent_lease.until_at <= $3", [name, now + ttl, now]);
    return (r.rowCount ?? 0) === 1;
  }
  async releaseLease(name: string) { await this.pool.query("delete from agent_lease where name=$1", [name]); }
  async close() { await this.pool.end(); }
}

/** Escolhe a implementação pelo ambiente. Sem DATABASE_URL o agente não tem onde guardar o dia: não roda. */
export function storeFromEnv(env: Record<string, string | undefined> = process.env): Store {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada: sem banco o agente não pode guardar o estado diário (e sem ele o limite 2x0 não se sustenta).");
  return new PgStore(url);
}
