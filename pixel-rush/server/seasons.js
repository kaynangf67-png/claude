// Temporadas competitivas (mensais) e Eventos Mundiais (semanais).
// Ao fim de cada período o servidor distribui medalhas, moedas e itens exclusivos.
// A linha em `periods` funciona como trava: cada período é finalizado uma única vez.
import {
  seasonId, seasonRange, prevSeasonId, eventId, eventRange, SEASON_REWARDS, EVENT_REWARDS,
} from '../shared/scoring.js';
import { newId } from './auth.js';
import { clearRankingCache } from './rankings.js';

async function award(q, userId, kind, period, rank, coins, items) {
  const now = Date.now();
  await q.run('INSERT INTO medals (id, user_id, kind, period, rank, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
    [newId(), userId, kind, period, rank, now]);
  if (coins) await q.run('UPDATE users SET coins = coins + $2 WHERE id=$1', [userId, coins]);
  for (const it of items || []) {
    await q.run('INSERT INTO inventory (user_id, item_id, acquired_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, it, now]);
  }
}

export async function finalizeSeason(db, sid) {
  const { start, end } = seasonRange(sid);
  if (Date.now() < end) return null;
  return db.tx(async (q) => {
    const lock = await q.run("INSERT INTO periods (id, kind, finalized_at) VALUES ($1,'season',$2) ON CONFLICT DO NOTHING", ['season-' + sid, Date.now()]);
    if (!lock.changes) return null;
    const rows = await q.all(
      `SELECT t.user_id, t.total FROM (
         SELECT user_id, SUM(best) AS total FROM (
           SELECT user_id, level_id, MAX(score) AS best FROM runs
           WHERE status='valid' AND mode IN ('level','endless') AND finished_at >= $1 AND finished_at < $2
           GROUP BY user_id, level_id) x GROUP BY user_id
       ) t JOIN users u ON u.id=t.user_id WHERE u.banned=0 ORDER BY t.total DESC LIMIT 100`, [start, end]);
    const winners = [];
    for (let i = 0; i < rows.length; i++) {
      const pos = i + 1;
      const tier = SEASON_REWARDS.find((r) => pos >= r.from && pos <= r.to);
      if (!tier) continue;
      await award(q, rows[i].user_id, tier.medal, sid, pos, tier.coins, tier.items);
      if (pos <= 3) winners.push({ userId: rows[i].user_id, pos, total: rows[i].total });
    }
    await q.run('UPDATE periods SET winners=$2 WHERE id=$1', ['season-' + sid, JSON.stringify(winners)]);
    return { season: sid, awarded: rows.length };
  });
}

export async function finalizeEvent(db, eid) {
  const { end } = eventRange(eid);
  if (Date.now() < end + 15 * 60000) return null; // tolerância para envios em andamento
  return db.tx(async (q) => {
    const lock = await q.run("INSERT INTO periods (id, kind, finalized_at) VALUES ($1,'event',$2) ON CONFLICT DO NOTHING", [eid, Date.now()]);
    if (!lock.changes) return null;
    const rows = await q.all(
      `SELECT b.user_id, b.time_ms FROM bests b JOIN users u ON u.id=b.user_id
       WHERE b.level_id=$1 AND b.time_ms IS NOT NULL AND u.banned=0 ORDER BY b.time_ms ASC, b.updated_at ASC LIMIT 25`, [eid]);
    for (let i = 0; i < rows.length; i++) {
      const pos = i + 1;
      const tier = EVENT_REWARDS.find((r) => pos >= r.from && pos <= r.to);
      if (tier) await award(q, rows[i].user_id, tier.medal, eid, pos, tier.coins, []);
    }
    return { event: eid, awarded: rows.length };
  });
}

export async function runFinalizers(db, now = Date.now()) {
  const out = [];
  // temporadas: verifica os últimos 3 meses
  let sid = prevSeasonId(seasonId(now));
  for (let i = 0; i < 3; i++) {
    const r = await finalizeSeason(db, sid);
    if (r) out.push(r);
    sid = prevSeasonId(sid);
  }
  // eventos: últimas 3 semanas
  for (let w = 1; w <= 3; w++) {
    const r = await finalizeEvent(db, eventId(now - w * 7 * 86400000));
    if (r) out.push(r);
  }
  if (out.length) clearRankingCache();
  return out;
}

export function seasonInfo(now = Date.now()) {
  const sid = seasonId(now);
  const { start, end } = seasonRange(sid);
  const [y, m] = sid.split('-');
  const names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return { id: sid, name: `Temporada ${names[+m - 1]} ${y}`, startsAt: start, endsAt: end, rewards: SEASON_REWARDS };
}
