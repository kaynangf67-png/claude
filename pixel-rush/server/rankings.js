// Rankings mundiais: consultas com cache curto (10 s) para suportar muitos jogadores.
import { LEVEL_IDS, levelMeta } from '../shared/levels.js';
import { seasonId, seasonRange, weekStart, dailyId, eventId, MEDALS } from '../shared/scoring.js';
import { COUNTRY_MAP, CONTINENTS, BR_STATES } from '../shared/countries.js';

const cache = new Map();
const TTL = 10000;
async function cached(key, fn) {
  const c = cache.get(key);
  if (c && c.exp > Date.now()) return c.v;
  const v = await fn();
  cache.set(key, { v, exp: Date.now() + TTL });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
}
export function clearRankingCache() { cache.clear(); }

function pub(u) {
  let eq = {};
  try { eq = JSON.parse(u.equipped || '{}'); } catch { /* */ }
  return { username: u.username, country: u.country, avatar: u.avatar, frame: eq.frame || 'frame_none', skin: eq.skin || 'skin_male' };
}

const LIMIT = 100;
const levelIn = (offset) => LEVEL_IDS.map((_, i) => '$' + (i + offset)).join(',');

function regionFilter(params, opts, startIdx) {
  if (opts.state && BR_STATES[opts.state]) { params.push(opts.state); return ` AND u.country = 'BR' AND u.state = $${startIdx}`; }
  if (opts.country && COUNTRY_MAP[opts.country]) { params.push(opts.country); return ` AND u.country = $${startIdx}`; }
  if (opts.continent && CONTINENTS[opts.continent]) { params.push(opts.continent); return ` AND u.continent = $${startIdx}`; }
  return '';
}

async function periodRanking(db, start, end, opts) {
  const params = [start, end];
  const where = regionFilter(params, opts, 3);
  const base = `
    SELECT user_id, SUM(best) AS total FROM (
      SELECT user_id, level_id, MAX(score) AS best FROM runs
      WHERE status='valid' AND mode IN ('level','endless') AND finished_at >= $1 AND finished_at < $2
      GROUP BY user_id, level_id
    ) x GROUP BY user_id`;
  const rows = await db.all(
    `SELECT u.username, u.country, u.avatar, u.equipped, t.total FROM (${base}) t JOIN users u ON u.id=t.user_id
     WHERE u.banned=0${where} ORDER BY t.total DESC, u.username ASC LIMIT ${LIMIT}`, params);
  return { rows: rows.map((r) => ({ ...pub(r), value: r.total })), base, params, where };
}

export async function getRanking(db, type, opts = {}, me = null) {
  const key = JSON.stringify([type, opts.state, opts.country, opts.continent, opts.level]);
  const data = await cached(key, () => computeRanking(db, type, opts));
  const res = { type, ...data };
  if (me) res.me = await myPosition(db, type, opts, me, data);
  return res;
}

async function computeRanking(db, type, opts) {
  const now = Date.now();
  switch (type) {
    case 'world':
    case 'state':
    case 'country':
    case 'continent': {
      const params = [];
      const where = regionFilter(params, opts, 1);
      const rows = await db.all(
        `SELECT username, country, avatar, equipped, total_score, levels_done FROM users u
         WHERE banned=0 AND total_score > 0${where} ORDER BY total_score DESC, username ASC LIMIT ${LIMIT}`, params);
      return { unit: 'pts', entries: rank(rows.map((r) => ({ ...pub(r), value: r.total_score, sub: `${r.levels_done} fases` }))) };
    }
    case 'weekly': {
      const s = weekStart(now);
      const { rows } = await periodRanking(db, s, s + 7 * 86400000, opts);
      return { unit: 'pts', endsAt: s + 7 * 86400000, entries: rank(rows) };
    }
    case 'monthly': {
      const sid = seasonId(now);
      const { start, end } = seasonRange(sid);
      const { rows } = await periodRanking(db, start, end, opts);
      return { unit: 'pts', season: sid, endsAt: end, entries: rank(rows) };
    }
    case 'speed': {
      const level = levelMeta(opts.level) ? opts.level : '1-1';
      const rows = await db.all(
        `SELECT u.username, u.country, u.avatar, u.equipped, b.time_ms FROM bests b JOIN users u ON u.id=b.user_id
         WHERE b.level_id=$1 AND b.time_ms IS NOT NULL AND u.banned=0 ORDER BY b.time_ms ASC, b.updated_at ASC LIMIT ${LIMIT}`, [level]);
      return { unit: 'time', level, entries: rank(rows.map((r) => ({ ...pub(r), value: r.time_ms }))) };
    }
    case 'daily':
    case 'event': {
      const id = type === 'daily' ? dailyId(now) : eventId(now);
      const rows = await db.all(
        `SELECT u.username, u.country, u.avatar, u.equipped, b.time_ms FROM bests b JOIN users u ON u.id=b.user_id
         WHERE b.level_id=$1 AND b.time_ms IS NOT NULL AND u.banned=0 ORDER BY b.time_ms ASC, b.updated_at ASC LIMIT ${LIMIT}`, [id]);
      return { unit: 'time', level: id, entries: rank(rows.map((r) => ({ ...pub(r), value: r.time_ms }))) };
    }
    case 'distance': {
      const rows = await db.all(
        `SELECT username, country, avatar, equipped, endless_best FROM users WHERE banned=0 AND endless_best > 0
         ORDER BY endless_best DESC, username ASC LIMIT ${LIMIT}`, []);
      return { unit: 'm', entries: rank(rows.map((r) => ({ ...pub(r), value: r.endless_best }))) };
    }
    case 'totaltime': {
      const rows = await db.all(
        `SELECT u.username, u.country, u.avatar, u.equipped, t.n, t.total FROM (
           SELECT user_id, COUNT(*) AS n, SUM(time_ms) AS total FROM bests
           WHERE time_ms IS NOT NULL AND level_id IN (${levelIn(1)}) GROUP BY user_id
         ) t JOIN users u ON u.id=t.user_id WHERE u.banned=0 ORDER BY t.n DESC, t.total ASC LIMIT ${LIMIT}`, [...LEVEL_IDS]);
      return { unit: 'time', entries: rank(rows.map((r) => ({ ...pub(r), value: r.total, sub: `${r.n}/${LEVEL_IDS.length} fases` }))) };
    }
    case 'races': {
      const rows = await db.all(
        `SELECT username, country, avatar, equipped, race_rating, race_wins, races FROM users WHERE banned=0 AND races > 0
         ORDER BY race_rating DESC, race_wins DESC LIMIT ${LIMIT}`, []);
      return { unit: 'rating', entries: rank(rows.map((r) => ({ ...pub(r), value: r.race_rating, sub: `${r.race_wins} vitórias / ${r.races}` }))) };
    }
    case 'history': {
      const champions = await db.all(
        `SELECT m.kind, m.period, m.rank, u.username, u.country, u.avatar, u.equipped FROM medals m JOIN users u ON u.id=m.user_id
         WHERE m.kind IN ('season_gold','season_silver','season_bronze','event_gold') ORDER BY m.period DESC, m.rank ASC LIMIT 60`, []);
      const recs = await db.all(
        `SELECT b.level_id, b.time_ms, u.username, u.country, u.avatar, u.equipped FROM bests b JOIN users u ON u.id=b.user_id
         WHERE b.time_ms IS NOT NULL AND u.banned=0 AND b.level_id IN (${levelIn(1)})
           AND b.time_ms = (SELECT MIN(time_ms) FROM bests c WHERE c.level_id=b.level_id)`, [...LEVEL_IDS]);
      const records = {};
      for (const r of recs) if (!records[r.level_id]) records[r.level_id] = { ...pub(r), level: r.level_id, name: levelMeta(r.level_id).name, value: r.time_ms };
      const legends = await db.all(
        `SELECT username, country, avatar, equipped, total_score FROM users WHERE banned=0 AND total_score>0 ORDER BY total_score DESC LIMIT 3`, []);
      return {
        unit: 'mixed',
        champions: champions.map((c) => ({ ...pub(c), kind: c.kind, period: c.period, rank: c.rank, medal: MEDALS[c.kind] })),
        records: LEVEL_IDS.map((id) => records[id] || { level: id, name: levelMeta(id).name, value: null }),
        legends: rank(legends.map((r) => ({ ...pub(r), value: r.total_score }))),
        entries: [],
      };
    }
    default:
      return { unit: 'pts', entries: [] };
  }
}

function rank(list) { return list.map((e, i) => ({ rank: i + 1, ...e })); }

async function myPosition(db, type, opts, me, data) {
  const found = (data.entries || []).find((e) => e.username === me.username);
  if (found) return found;
  const u = await db.get('SELECT * FROM users WHERE id=$1', [me.id]);
  const base = { ...pub(u), rank: null, value: null };
  switch (type) {
    case 'world': case 'state': case 'country': case 'continent': {
      if (!u.total_score) return base;
      const params = [u.total_score];
      const where = regionFilter(params, opts, 2);
      const r = await db.get(`SELECT COUNT(*) AS n FROM users u WHERE banned=0 AND total_score > $1${where}`, params);
      return { ...base, rank: r.n + 1, value: u.total_score };
    }
    case 'distance': {
      if (!u.endless_best) return base;
      const r = await db.get('SELECT COUNT(*) AS n FROM users WHERE banned=0 AND endless_best > $1', [u.endless_best]);
      return { ...base, rank: r.n + 1, value: u.endless_best };
    }
    case 'races': {
      if (!u.races) return base;
      const r = await db.get('SELECT COUNT(*) AS n FROM users WHERE banned=0 AND races>0 AND race_rating > $1', [u.race_rating]);
      return { ...base, rank: r.n + 1, value: u.race_rating };
    }
    case 'speed': case 'daily': case 'event': {
      const level = data.level;
      const b = await db.get('SELECT time_ms FROM bests WHERE user_id=$1 AND level_id=$2', [u.id, level]);
      if (!b || b.time_ms == null) return base;
      const r = await db.get('SELECT COUNT(*) AS n FROM bests WHERE level_id=$1 AND time_ms < $2', [level, b.time_ms]);
      return { ...base, rank: r.n + 1, value: b.time_ms };
    }
    case 'weekly': case 'monthly': {
      const now = Date.now();
      let start, end;
      if (type === 'weekly') { start = weekStart(now); end = start + 7 * 86400000; }
      else ({ start, end } = seasonRange(seasonId(now)));
      const mine = await db.get(
        `SELECT SUM(best) AS total FROM (SELECT level_id, MAX(score) AS best FROM runs WHERE user_id=$1 AND status='valid'
         AND mode IN ('level','endless') AND finished_at >= $2 AND finished_at < $3 GROUP BY level_id) x`, [u.id, start, end]);
      if (!mine || !mine.total) return base;
      const r = await db.get(
        `SELECT COUNT(*) AS n FROM (SELECT user_id, SUM(best) AS total FROM (SELECT user_id, level_id, MAX(score) AS best FROM runs
         WHERE status='valid' AND mode IN ('level','endless') AND finished_at >= $1 AND finished_at < $2 GROUP BY user_id, level_id) x
         GROUP BY user_id) t WHERE t.total > $3`, [start, end, mine.total]);
      return { ...base, rank: r.n + 1, value: mine.total };
    }
    default: return base;
  }
}

export async function top3(db) {
  return cached('top3', async () => {
    const rows = await db.all(
      `SELECT username, country, avatar, equipped, total_score, levels_done FROM users WHERE banned=0 AND total_score>0
       ORDER BY total_score DESC, username ASC LIMIT 3`, []);
    return rank(rows.map((r) => ({ ...pub(r), value: r.total_score, sub: `${r.levels_done} fases` })));
  });
}
