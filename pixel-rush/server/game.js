// Regras do jogo no servidor: início/fim de tentativas, validação por
// re-simulação, recordes, moedas, conquistas e progresso.
import { randomInt } from 'node:crypto';
import { buildLevel, endlessDistance, MODES } from '../shared/modes.js';
import { runInputs } from '../shared/sim.js';
import { sanitizeRle, rleTicks } from '../shared/replay.js';
import { TPS, MAX_RUN_TICKS, ticksToMs } from '../shared/constants.js';
import { LEVEL_IDS, LEVEL_DEFS, levelMeta, prevLevelId } from '../shared/levels.js';
import { levelScore, endlessScore, runReward, DAILY_COIN_CAP, dailyId, eventId, levelMedal } from '../shared/scoring.js';
import { ACHIEVEMENTS, ACH_MAP } from '../shared/achievements.js';
import { newId } from './auth.js';
import { now as clockNow } from './clock.js';

export class GameError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

const RUN_MAX_AGE = 3 * 3600 * 1000;
const CLOCK_TOLERANCE_MS = 1500;

export async function isUnlocked(db, userId, levelId) {
  const prev = prevLevelId(levelId);
  if (!prev) return true;
  const b = await db.get('SELECT time_ms FROM bests WHERE user_id=$1 AND level_id=$2', [userId, prev]);
  return !!(b && b.time_ms != null);
}

export async function startRun(db, user, { mode, levelId }) {
  if (!MODES.includes(mode) || mode === 'race') throw new GameError(400, 'Modo inválido');
  const now = Date.now();
  if (mode === 'level') {
    if (!levelMeta(levelId)) throw new GameError(400, 'Fase inexistente');
    if (!(await isUnlocked(db, user.id, levelId))) throw new GameError(403, 'Fase bloqueada: conclua a anterior');
  } else if (mode === 'endless') levelId = 'endless';
  else if (mode === 'daily') levelId = dailyId(now);
  else if (mode === 'event') levelId = eventId(now);
  const open = await db.get("SELECT COUNT(*) AS n FROM runs WHERE user_id=$1 AND status='open' AND created_at > $2", [user.id, now - 600000]);
  if (open && open.n > 150) throw new GameError(429, 'Muitas tentativas abertas. Aguarde um pouco.');
  const seed = mode === 'endless' ? randomInt(1, 2 ** 31 - 1) : 0;
  const id = newId(16);
  await db.run(
    "INSERT INTO runs (id, user_id, mode, level_id, seed, created_at, status) VALUES ($1,$2,$3,$4,$5,$6,'open')",
    [id, user.id, mode, levelId, seed, now],
  );
  return { runId: id, mode, levelId, seed, serverNow: now };
}

// Re-simula as entradas. Retorna o resultado "verdadeiro" calculado pelo servidor.
export function simulateRun(run, rawInputs, { now = clockNow(), startedAt = run.created_at } = {}) {
  const rle = sanitizeRle(rawInputs);
  if (!rle) return { ok: false, reason: 'entradas_invalidas' };
  const level = buildLevel(run.mode, run.level_id, Number(run.seed));
  if (!level) return { ok: false, reason: 'fase_invalida' };
  const { sim, ticks } = runInputs(level, rle, MAX_RUN_TICKS);
  const s = sim.s;
  const simMs = ticksToMs(ticks);
  // O tempo de relógio real precisa ser compatível com o tempo simulado
  // (detecta "speed hack" e resultados fabricados offline).
  const elapsed = now - startedAt;
  if (elapsed + CLOCK_TOLERANCE_MS < simMs * 0.98) return { ok: false, reason: 'tempo_real_incompativel', simMs, elapsed };
  if (run.mode === 'endless') {
    const distance = endlessDistance(level, sim);
    return { ok: true, ticks, timeMs: simMs, distance, deaths: s.deaths, coins: s.coinCount, rle };
  }
  if (!s.finished) return { ok: false, reason: 'fase_nao_concluida' };
  const extra = rleTicks(rle) - s.finishT;
  if (extra > TPS * 5) return { ok: false, reason: 'entradas_excedentes' };
  return { ok: true, ticks: s.finishT, timeMs: ticksToMs(s.finishT), deaths: s.deaths, coins: s.coinCount, rle };
}

function dayStart(ms) { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }

export async function finishRun(db, user, { runId, inputs }) {
  if (typeof runId !== 'string') throw new GameError(400, 'runId ausente');
  const run = await db.get('SELECT * FROM runs WHERE id=$1', [runId]);
  if (!run || run.user_id !== user.id) throw new GameError(404, 'Tentativa não encontrada');
  if (run.status !== 'open') throw new GameError(409, 'Tentativa já enviada');
  const now = clockNow();
  if (now - run.created_at > RUN_MAX_AGE) {
    await db.run("UPDATE runs SET status='invalid', reason='expirada', finished_at=$2 WHERE id=$1", [runId, now]);
    throw new GameError(410, 'Tentativa expirada');
  }
  if (run.mode === 'daily' && run.level_id !== dailyId(now) && now - run.created_at > 15 * 60000) throw new GameError(410, 'Desafio diário encerrado');
  if (run.mode === 'event' && run.level_id !== eventId(now) && now - run.created_at > 15 * 60000) throw new GameError(410, 'Evento encerrado');

  const res = simulateRun(run, inputs, { now });
  if (!res.ok) {
    const upd = await db.run("UPDATE runs SET status='invalid', reason=$2, finished_at=$3 WHERE id=$1 AND status='open'", [runId, res.reason, now]);
    if (!upd.changes) throw new GameError(409, 'Tentativa já enviada');
    return { valid: false, reason: res.reason };
  }
  return applyResult(db, user.id, run, res, now);
}

async function playerStats(q, userId, extra = {}) {
  const u = await q.get('SELECT * FROM users WHERE id=$1', [userId]);
  const bests = await q.all('SELECT level_id, time_ms FROM bests WHERE user_id=$1', [userId]);
  const done = new Set();
  let underPar = 0, diamonds = 0, dailyDone = false, eventDone = false;
  for (const b of bests) {
    const m = levelMeta(b.level_id);
    if (m && b.time_ms != null) {
      done.add(b.level_id);
      const md = levelMedal(m.par, b.time_ms);
      if (md === 'ouro' || md === 'diamante') underPar++;
      if (md === 'diamante') diamonds++;
    }
    if (b.level_id.startsWith('daily-')) dailyDone = true;
    if (b.level_id.startsWith('event-')) eventDone = true;
  }
  const worlds = {};
  for (const w of [1, 2, 3, 4]) worlds[w] = LEVEL_DEFS.filter((d) => d.world === w).every((d) => done.has(d.id));
  const rankRow = await q.get('SELECT COUNT(*) AS n FROM users WHERE total_score > $1 AND banned=0', [u.total_score]);
  const rec = await countRecords(q, userId);
  return {
    levelsDone: done.size, worlds, underPar, diamonds, dailyDone, eventDone,
    deathsTotal: u.deaths_total, endlessBest: u.endless_best, coinsCollected: u.coins_collected,
    raceWins: u.race_wins, purchases: u.purchases, records: rec,
    rank: u.total_score > 0 ? rankRow.n + 1 : 0, flawless: false, ...extra,
  };
}

export async function countRecords(q, userId) {
  const r = await q.get(
    `SELECT COUNT(*) AS n FROM bests b WHERE b.user_id=$1 AND b.time_ms IS NOT NULL
       AND b.level_id IN (${LEVEL_IDS.map((_, i) => '$' + (i + 2)).join(',')})
       AND b.time_ms = (SELECT MIN(time_ms) FROM bests c WHERE c.level_id=b.level_id)`,
    [userId, ...LEVEL_IDS],
  );
  return r ? r.n : 0;
}

export async function grantAchievements(q, userId, extra) {
  const stats = await playerStats(q, userId, extra);
  const have = new Set((await q.all('SELECT ach_id FROM achievements WHERE user_id=$1', [userId])).map((r) => r.ach_id));
  const unlocked = [];
  const now = Date.now();
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id) || !a.check(stats)) continue;
    const r = await q.run('INSERT INTO achievements (user_id, ach_id, unlocked_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, a.id, now]);
    if (r.changes) {
      await q.run('UPDATE users SET coins = coins + $2 WHERE id=$1', [userId, a.reward]);
      unlocked.push({ id: a.id, name: a.name, desc: a.desc, reward: a.reward });
    }
  }
  return unlocked;
}

async function applyResult(db, userId, run, res, now) {
  return db.tx(async (q) => {
    const upd = await q.run("UPDATE runs SET status='valid' WHERE id=$1 AND status='open'", [run.id]);
    if (!upd.changes) throw new GameError(409, 'Tentativa já enviada');
    const mode = run.mode;
    const levelId = run.level_id;
    const prev = await q.get('SELECT * FROM bests WHERE user_id=$1 AND level_id=$2', [userId, levelId]);
    let score = 0, newBest = false, firstClear = false, worldRecord = false, prevBestMs = prev ? prev.time_ms : null;
    let scoreDelta = 0;

    if (mode === 'endless') {
      score = endlessScore(res.distance);
      const wr = await q.get("SELECT MAX(distance) AS d FROM bests WHERE level_id='endless'", []);
      worldRecord = res.distance > 0 && (!wr || wr.d == null || res.distance > wr.d);
      if (!prev || res.distance > (prev.distance || 0)) {
        newBest = true;
        scoreDelta = score - (prev ? prev.score : 0);
        await q.run(
          `INSERT INTO bests (user_id, level_id, score, distance, run_id, updated_at) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (user_id, level_id) DO UPDATE SET score=excluded.score, distance=excluded.distance, run_id=excluded.run_id, updated_at=excluded.updated_at`,
          [userId, levelId, score, res.distance, run.id, now],
        );
      }
    } else {
      const meta = mode === 'level' ? levelMeta(levelId) : null;
      score = meta ? levelScore(meta.par, res.timeMs, res.deaths) : 0;
      const wr = await q.get('SELECT MIN(time_ms) AS t FROM bests WHERE level_id=$1', [levelId]);
      worldRecord = !wr || wr.t == null || res.timeMs < wr.t;
      firstClear = !prev || prev.time_ms == null;
      const betterTime = firstClear || res.timeMs < prev.time_ms;
      const betterScore = !prev || score > prev.score;
      newBest = betterTime;
      if (betterTime || betterScore) {
        const bestScore = Math.max(score, prev ? prev.score : 0);
        const bestTime = betterTime ? res.timeMs : prev.time_ms;
        const bestRun = betterTime ? run.id : prev.run_id;
        if (meta) scoreDelta = bestScore - (prev ? prev.score : 0);
        await q.run(
          `INSERT INTO bests (user_id, level_id, score, time_ms, run_id, updated_at) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (user_id, level_id) DO UPDATE SET score=excluded.score, time_ms=excluded.time_ms, run_id=excluded.run_id, updated_at=excluded.updated_at`,
          [userId, levelId, bestScore, bestTime, bestRun, now],
        );
      }
    }

    // moedas (com limite diário para evitar "farm")
    let reward = runReward({ mode, firstClear, newBest, coins: res.coins, distance: res.distance || 0 });
    const earned = await q.get('SELECT COALESCE(SUM(reward),0) AS s FROM runs WHERE user_id=$1 AND finished_at >= $2', [userId, dayStart(now)]);
    reward = Math.max(0, Math.min(reward, DAILY_COIN_CAP - (earned ? earned.s : 0)));

    await q.run(
      `UPDATE runs SET finished_at=$2, time_ms=$3, distance=$4, score=$5, deaths=$6, coins=$7, reward=$8, inputs=$9 WHERE id=$1`,
      [run.id, now, res.timeMs, res.distance ?? null, score, res.deaths, res.coins, reward, JSON.stringify(res.rle)],
    );
    const levelsDone = (await q.get(
      `SELECT COUNT(*) AS n FROM bests WHERE user_id=$1 AND time_ms IS NOT NULL AND level_id IN (${LEVEL_IDS.map((_, i) => '$' + (i + 2)).join(',')})`,
      [userId, ...LEVEL_IDS],
    )).n;
    await q.run(
      `UPDATE users SET total_score = total_score + $2, play_ms = play_ms + $3, deaths_total = deaths_total + $4,
         coins_collected = coins_collected + $5, runs_total = runs_total + 1, coins = coins + $6,
         endless_best = CASE WHEN $7 > endless_best THEN $7 ELSE endless_best END, levels_done = $8, last_seen = $9
       WHERE id=$1`,
      [userId, scoreDelta, res.timeMs, res.deaths, mode === 'level' ? res.coins : 0, reward, mode === 'endless' ? res.distance : 0, levelsDone, now],
    );
    const flawless = res.deaths === 0 && mode !== 'endless';
    const achievements = await grantAchievements(q, userId, { flawless });
    const u = await q.get('SELECT total_score, coins FROM users WHERE id=$1', [userId]);
    const g = await q.get('SELECT COUNT(*) AS n FROM users WHERE total_score > $1 AND banned=0', [u.total_score]);
    let levelRank = null;
    if (mode === 'endless') {
      const mine = await q.get("SELECT distance FROM bests WHERE user_id=$1 AND level_id='endless'", [userId]);
      levelRank = (await q.get("SELECT COUNT(*) AS n FROM bests WHERE level_id='endless' AND distance > $1", [mine ? mine.distance : 0])).n + 1;
    } else {
      const mine = await q.get('SELECT time_ms FROM bests WHERE user_id=$1 AND level_id=$2', [userId, levelId]);
      levelRank = (await q.get('SELECT COUNT(*) AS n FROM bests WHERE level_id=$1 AND time_ms < $2', [levelId, mine.time_ms])).n + 1;
    }
    return {
      valid: true, mode, levelId, timeMs: res.timeMs, distance: res.distance ?? null, deaths: res.deaths,
      coins: res.coins, score, newBest, firstClear, prevBestMs, worldRecord, reward, achievements,
      totalScore: u.total_score, coinsBalance: u.coins, globalRank: u.total_score > 0 ? g.n + 1 : null, levelRank,
    };
  });
}

export async function getProgress(db, userId) {
  const rows = await db.all('SELECT level_id, score, time_ms, distance FROM bests WHERE user_id=$1', [userId]);
  const out = {};
  for (const r of rows) out[r.level_id] = { score: r.score, timeMs: r.time_ms, distance: r.distance };
  return out;
}

export async function levelRecords(db) {
  const rows = await db.all(
    `SELECT b.level_id, b.time_ms, u.username, u.country FROM bests b JOIN users u ON u.id=b.user_id
     WHERE b.time_ms IS NOT NULL AND u.banned=0 AND b.time_ms = (SELECT MIN(time_ms) FROM bests c WHERE c.level_id=b.level_id)`, [],
  );
  const out = {};
  for (const r of rows) if (!out[r.level_id]) out[r.level_id] = { timeMs: r.time_ms, username: r.username, country: r.country };
  return out;
}

export async function getGhost(db, userId, { level, who }) {
  let row;
  if (who === 'pb') {
    row = await db.get(
      `SELECT r.inputs, r.time_ms, r.distance, r.mode, r.level_id, r.seed, u.username FROM bests b JOIN runs r ON r.id=b.run_id JOIN users u ON u.id=b.user_id
       WHERE b.user_id=$1 AND b.level_id=$2`, [userId, level]);
  } else {
    row = await db.get(
      `SELECT r.inputs, r.time_ms, r.distance, r.mode, r.level_id, r.seed, u.username FROM bests b JOIN runs r ON r.id=b.run_id JOIN users u ON u.id=b.user_id
       WHERE b.level_id=$1 AND b.time_ms IS NOT NULL AND u.banned=0 ORDER BY b.time_ms ASC, b.updated_at ASC LIMIT 1`, [level]);
  }
  if (!row || !row.inputs) return null;
  return { username: row.username, timeMs: row.time_ms, mode: row.mode, levelId: row.level_id, inputs: JSON.parse(row.inputs) };
}
