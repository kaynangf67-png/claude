// Camada de banco: PostgreSQL em produção (DATABASE_URL — funciona com Supabase,
// Neon, RDS...) ou SQLite embutido (node:sqlite) para desenvolvimento local.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_lc TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL,
    country TEXT NOT NULL,
    continent TEXT NOT NULL,
    avatar TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    last_seen BIGINT NOT NULL,
    total_score BIGINT NOT NULL DEFAULT 0,
    levels_done BIGINT NOT NULL DEFAULT 0,
    play_ms BIGINT NOT NULL DEFAULT 0,
    coins BIGINT NOT NULL DEFAULT 0,
    coins_collected BIGINT NOT NULL DEFAULT 0,
    deaths_total BIGINT NOT NULL DEFAULT 0,
    runs_total BIGINT NOT NULL DEFAULT 0,
    endless_best BIGINT NOT NULL DEFAULT 0,
    race_rating BIGINT NOT NULL DEFAULT 1000,
    race_wins BIGINT NOT NULL DEFAULT 0,
    races BIGINT NOT NULL DEFAULT 0,
    purchases BIGINT NOT NULL DEFAULT 0,
    equipped TEXT NOT NULL,
    prefs TEXT NOT NULL DEFAULT '{}',
    banned BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS users_score ON users (total_score DESC)`,
  `CREATE INDEX IF NOT EXISTS users_country ON users (country, total_score DESC)`,
  `CREATE INDEX IF NOT EXISTS users_continent ON users (continent, total_score DESC)`,
  `CREATE INDEX IF NOT EXISTS users_endless ON users (endless_best DESC)`,
  `CREATE INDEX IF NOT EXISTS users_race ON users (race_rating DESC)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    level_id TEXT NOT NULL,
    seed BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    finished_at BIGINT,
    status TEXT NOT NULL,
    time_ms BIGINT,
    distance BIGINT,
    score BIGINT,
    deaths BIGINT,
    coins BIGINT,
    reward BIGINT NOT NULL DEFAULT 0,
    inputs TEXT,
    reason TEXT,
    room TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS runs_user ON runs (user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS runs_period ON runs (status, finished_at)`,
  `CREATE TABLE IF NOT EXISTS bests (
    user_id TEXT NOT NULL,
    level_id TEXT NOT NULL,
    score BIGINT NOT NULL DEFAULT 0,
    time_ms BIGINT,
    distance BIGINT,
    run_id TEXT,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, level_id)
  )`,
  `CREATE INDEX IF NOT EXISTS bests_time ON bests (level_id, time_ms)`,
  `CREATE INDEX IF NOT EXISTS bests_dist ON bests (level_id, distance DESC)`,
  `CREATE TABLE IF NOT EXISTS inventory (
    user_id TEXT NOT NULL, item_id TEXT NOT NULL, acquired_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS achievements (
    user_id TEXT NOT NULL, ach_id TEXT NOT NULL, unlocked_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, ach_id)
  )`,
  `CREATE TABLE IF NOT EXISTS medals (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, period TEXT NOT NULL,
    rank BIGINT NOT NULL, created_at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS medals_user ON medals (user_id)`,
  `CREATE TABLE IF NOT EXISTS periods (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, finalized_at BIGINT NOT NULL, winners TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS friends (
    user_id TEXT NOT NULL, friend_id TEXT NOT NULL, status TEXT NOT NULL, created_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, friend_id)
  )`,
  `CREATE INDEX IF NOT EXISTS friends_rev ON friends (friend_id)`,
];

function toSqlite(sql) { return sql.replace(/\$(\d+)/g, '?$1'); }

class Mutex {
  constructor() { this.p = Promise.resolve(); }
  run(fn) {
    const r = this.p.then(fn, fn);
    this.p = r.then(() => {}, () => {});
    return r;
  }
}

async function openSqlite(file) {
  const { DatabaseSync } = await import('node:sqlite');
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = OFF;');
  const stmts = new Map();
  const prep = (sql) => {
    let s = stmts.get(sql);
    if (!s) { s = raw.prepare(toSqlite(sql)); stmts.set(sql, s); }
    return s;
  };
  const norm = (p) => p.map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : v));
  const q = {
    async all(sql, p = []) { return prep(sql).all(...norm(p)).map((r) => ({ ...r })); },
    async get(sql, p = []) { const r = prep(sql).get(...norm(p)); return r ? { ...r } : undefined; },
    async run(sql, p = []) { const r = prep(sql).run(...norm(p)); return { changes: Number(r.changes) }; },
  };
  const mutex = new Mutex();
  const db = {
    kind: 'sqlite',
    ...q,
    // As operações do SQLite são síncronas; a transação é serializada com um mutex.
    tx(fn) {
      return mutex.run(async () => {
        raw.exec('BEGIN IMMEDIATE');
        try { const r = await fn(q); raw.exec('COMMIT'); return r; }
        catch (e) { raw.exec('ROLLBACK'); throw e; }
      });
    },
    async close() { raw.close(); },
  };
  // escritas fora de transação também passam pelo mutex para não intercalar
  for (const k of ['run']) {
    const orig = db[k];
    db[k] = (sql, p) => mutex.run(() => orig(sql, p));
  }
  for (const s of SCHEMA) raw.exec(s);
  return db;
}

async function openPg(url) {
  const pg = (await import('pg')).default;
  pg.types.setTypeParser(20, (v) => parseInt(v, 10));     // int8
  pg.types.setTypeParser(1700, (v) => parseFloat(v));     // numeric (SUM)
  const ssl = /sslmode=require|supabase|neon\.tech/.test(url) ? { rejectUnauthorized: false } : undefined;
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.PG_POOL || 10), ssl });
  const wrap = (c) => ({
    async all(sql, p = []) { return (await c.query(sql, p)).rows; },
    async get(sql, p = []) { return (await c.query(sql, p)).rows[0]; },
    async run(sql, p = []) { const r = await c.query(sql, p); return { changes: r.rowCount }; },
  });
  const db = {
    kind: 'postgres',
    ...wrap(pool),
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const r = await fn(wrap(c));
        await c.query('COMMIT');
        return r;
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
      finally { c.release(); }
    },
    async close() { await pool.end(); },
  };
  for (const s of SCHEMA) await pool.query(s);
  return db;
}

export async function openDb({ url = process.env.DATABASE_URL, file = process.env.SQLITE_FILE || 'data/pixelrush.db' } = {}) {
  return url ? openPg(url) : openSqlite(file);
}
