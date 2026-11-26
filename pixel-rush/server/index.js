// ESTRESSE — servidor HTTP + WebSocket.
import http from 'node:http';
import { timingSafeEqual, randomInt } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import {
  hashPassword, verifyPassword, createSession, userFromToken, deleteSession, newId, validUsername, RateLimiter,
} from './auth.js';
import {
  startRun, finishRun, GameError, getProgress, levelRecords, getGhost, countRecords, grantAchievements,
} from './game.js';
import { getRanking, top3, clearRankingCache } from './rankings.js';
import { runFinalizers, seasonInfo } from './seasons.js';
import { createMultiplayer } from './multiplayer.js';
import { COUNTRY_MAP, BR_STATES } from '../shared/countries.js';
import { ITEMS, ITEM_MAP, DEFAULT_ITEMS, DEFAULT_EQUIPPED, AVATARS, SLOTS, GEM_PACKS, GEM_PACK_MAP } from '../shared/items.js';
import { LEVEL_DEFS, WORLDS } from '../shared/levels.js';
import { dailyId, eventId, dailyRange, eventRange, EVENT_REWARDS, MEDALS } from '../shared/scoring.js';
import { ACHIEVEMENTS } from '../shared/achievements.js';

const RAW = Symbol('resposta já enviada');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; script-src 'self'",
};

export async function createServer({ dbOptions, logger = console, rateLimits = process.env.DISABLE_RATE_LIMITS !== '1', serverless = false, oauth = null } = {}) {
  const db = await openDb({ ...dbOptions, serverless });
  const log = (...a) => logger.error?.(...a);
  const rl = {
    auth: new RateLimiter(rateLimits ? 20 : 1e6, 15 * 60000),
    register: new RateLimiter(rateLimits ? 6 : 1e6, 3600000),
    guest: new RateLimiter(rateLimits ? 20 : 1e6, 3600000),
    api: new RateLimiter(rateLimits ? 600 : 1e9, 60000),
    run: new RateLimiter(rateLimits ? 90 : 1e9, 60000),
  };

  let mp = null;
  const routes = [];
  const route = (method, path, handler, opts = {}) => {
    const keys = [];
    const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, auth: opts.auth !== false && opts.auth !== 'optional', optional: opts.auth === 'optional' });
  };

  const meUser = (u) => ({
    username: u.username, country: u.country, continent: u.continent, state: u.state || '', avatar: u.avatar, coins: u.coins, gems: u.gems || 0,
    totalScore: u.total_score, levelsDone: u.levels_done, playMs: u.play_ms, endlessBest: u.endless_best,
    raceRating: u.race_rating, raceWins: u.race_wins, races: u.races, deathsTotal: u.deaths_total,
    coinsCollected: u.coins_collected, runsTotal: u.runs_total, createdAt: u.created_at,
  });

  const fixEquip = (eq) => { const out = { ...DEFAULT_EQUIPPED, ...eq }; for (const k of Object.keys(out)) if (!ITEM_MAP[out[k]]) out[k] = DEFAULT_EQUIPPED[k]; return out; };

  async function globalRank(u) {
    if (!u.total_score) return null;
    const r = await db.get('SELECT COUNT(*) AS n FROM users WHERE total_score > $1 AND banned=0', [u.total_score]);
    return r.n + 1;
  }

  // ---------------- autenticação
  route('POST', '/api/auth/register', async ({ body, ip }) => {
    if (!rl.register.hit(ip)) throw new GameError(429, 'Muitos cadastros deste endereço. Tente mais tarde.');
    const { username, password, country, avatar } = body;
    if (!validUsername(username)) throw new GameError(400, 'Nome de usuário: 3 a 16 caracteres (letras, números ou _).');
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) throw new GameError(400, 'A senha precisa ter de 6 a 72 caracteres.');
    const c = COUNTRY_MAP[country];
    if (!c) throw new GameError(400, 'Selecione um país válido.');
    const av = AVATARS.includes(avatar) ? avatar : 'a1';
    const state = c.code === 'BR' && BR_STATES[body.state] ? body.state : '';
    const equipped = { ...DEFAULT_EQUIPPED, skin: body.skin === 'skin_female' ? 'skin_female' : 'skin_male' };
    const exists = await db.get('SELECT id FROM users WHERE username_lc=$1', [username.toLowerCase()]);
    if (exists) throw new GameError(409, 'Esse nome de usuário já existe.');
    const id = newId();
    const now = Date.now();
    const ph = await hashPassword(password);
    try {
      await db.tx(async (q) => {
        await q.run(
          `INSERT INTO users (id, username, username_lc, pass_hash, country, continent, avatar, created_at, last_seen, coins, equipped, state)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11)`,
          [id, username, username.toLowerCase(), ph, c.code, c.continent, av, now, 100, JSON.stringify(equipped), state]);
        for (const it of DEFAULT_ITEMS) await q.run('INSERT INTO inventory (user_id, item_id, acquired_at) VALUES ($1,$2,$3)', [id, it, now]);
      });
    } catch (e) {
      if (/unique|UNIQUE|duplicate/.test(String(e.message))) throw new GameError(409, 'Esse nome de usuário já existe.');
      throw e;
    }
    const token = await createSession(db, id);
    return { token, username };
  }, { auth: false });

  // ---------------- login social (Supabase Auth: Google/Facebook) e convidado
  const SUPA_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const SUPA_KEY = process.env.SUPABASE_ANON_KEY || '';
  // Confere o token devolvido pelo Supabase Auth e devolve { sub, name, provider }
  const verifyOAuth = oauth?.verify || (async (accessToken) => {
    if (!SUPA_URL || !SUPA_KEY) throw new GameError(503, 'Login social ainda não configurado.');
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) throw new GameError(401, 'Login expirado. Tente de novo.');
    const u = await r.json();
    const md = u.user_metadata || {};
    return { sub: 'supabase:' + u.id, name: md.full_name || md.name || md.user_name || (u.email || '').split('@')[0], provider: u.app_metadata?.provider || 'social' };
  });
  const providerStatus = oauth?.providers || (async () => {
    if (!SUPA_URL || !SUPA_KEY) return { google: false, facebook: false };
    try {
      const r = await fetch(`${SUPA_URL}/auth/v1/settings`, { headers: { apikey: SUPA_KEY } });
      const j = await r.json();
      return { google: !!j.external?.google, facebook: !!j.external?.facebook };
    } catch { return { google: false, facebook: false }; }
  });

  function baseName(name, fallback) {
    const clean = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_ ]/g, '').trim().split(/\s+/)[0] || '';
    return (clean.length >= 3 ? clean : fallback).slice(0, 10);
  }

  async function createAccount({ base, authSub, country, state, skin }) {
    const c = COUNTRY_MAP[country] || COUNTRY_MAP.BR;
    const st = c.code === 'BR' && BR_STATES[state] ? state : '';
    const equipped = { ...DEFAULT_EQUIPPED, skin: skin === 'skin_female' ? 'skin_female' : 'skin_male' };
    const now = Date.now();
    for (let tries = 0; tries < 20; tries++) {
      const username = `${base}_${randomInt(1000, 99999)}`.slice(0, 16);
      const id = newId();
      try {
        await db.tx(async (q) => {
          await q.run(
            `INSERT INTO users (id, username, username_lc, pass_hash, country, continent, avatar, created_at, last_seen, coins, equipped, state, auth_sub)
             VALUES ($1,$2,$3,'!',$4,$5,'a1',$6,$6,100,$7,$8,$9)`,
            [id, username, username.toLowerCase(), c.code, c.continent, now, JSON.stringify(equipped), st, authSub]);
          for (const it of DEFAULT_ITEMS) await q.run('INSERT INTO inventory (user_id, item_id, acquired_at) VALUES ($1,$2,$3)', [id, it, now]);
        });
        return { id, username };
      } catch (e) {
        if (!/unique|UNIQUE|duplicate/.test(String(e.message))) throw e;
        if (authSub) { const ex = await db.get('SELECT id, username FROM users WHERE auth_sub=$1', [authSub]); if (ex) return ex; }
      }
    }
    throw new GameError(500, 'Não foi possível criar a conta. Tente de novo.');
  }

  route('GET', '/api/auth/providers', async () => ({ ...(await providerStatus()), guest: true }), { auth: false });

  // redireciona para a tela de login do Google/Facebook (Supabase Auth)
  route('GET', '/api/auth/oauth/:provider', async ({ params, req, res }) => {
    const provider = params.provider;
    if (!['google', 'facebook'].includes(provider)) throw new GameError(400, 'Provedor inválido');
    if (!SUPA_URL) throw new GameError(503, 'Login social ainda não configurado.');
    const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const to = `${SUPA_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(origin + '/?login=social')}`;
    res.writeHead(302, { Location: to, 'Cache-Control': 'no-store' });
    res.end();
    return RAW;
  }, { auth: false });

  route('POST', '/api/auth/oauth', async ({ body, ip }) => {
    if (!rl.auth.hit(ip)) throw new GameError(429, 'Muitas tentativas. Aguarde alguns minutos.');
    if (typeof body.access_token !== 'string' || body.access_token.length > 5000) throw new GameError(400, 'Token inválido');
    const info = await verifyOAuth(body.access_token);
    let u = await db.get('SELECT id, username, banned FROM users WHERE auth_sub=$1', [info.sub]);
    if (u && u.banned) throw new GameError(403, 'Conta suspensa por violação das regras.');
    if (!u) u = await createAccount({ base: baseName(info.name, 'Jogador'), authSub: info.sub, country: body.country, state: body.state, skin: body.skin });
    const token = await createSession(db, u.id);
    return { token, username: u.username };
  }, { auth: false });

  route('POST', '/api/auth/guest', async ({ body, ip }) => {
    if (!rl.guest.hit(ip)) throw new GameError(429, 'Muitas contas de convidado deste endereço. Tente mais tarde.');
    const u = await createAccount({ base: 'Convidado', authSub: 'guest:' + newId(), country: body.country, state: body.state, skin: body.skin });
    const token = await createSession(db, u.id);
    return { token, username: u.username, guest: true };
  }, { auth: false });

  route('POST', '/api/auth/login', async ({ body, ip }) => {
    if (!rl.auth.hit(ip)) throw new GameError(429, 'Muitas tentativas. Aguarde alguns minutos.');
    const u = await db.get('SELECT * FROM users WHERE username_lc=$1', [String(body.username || '').toLowerCase()]);
    if (!u || !(await verifyPassword(String(body.password || ''), u.pass_hash))) throw new GameError(401, 'Usuário ou senha incorretos.');
    if (u.banned) throw new GameError(403, 'Conta suspensa por violação das regras.');
    const token = await createSession(db, u.id);
    return { token, username: u.username };
  }, { auth: false });

  route('POST', '/api/auth/logout', async ({ token }) => { await deleteSession(db, token); return { ok: true }; });

  // ---------------- perfil
  route('GET', '/api/me', async ({ user }) => {
    const [inv, ach, medals, progress] = await Promise.all([
      db.all('SELECT item_id FROM inventory WHERE user_id=$1', [user.id]),
      db.all('SELECT ach_id, unlocked_at FROM achievements WHERE user_id=$1', [user.id]),
      db.all('SELECT kind, period, rank, created_at FROM medals WHERE user_id=$1 ORDER BY created_at DESC', [user.id]),
      getProgress(db, user.id),
    ]);
    await db.run('UPDATE users SET last_seen=$2 WHERE id=$1', [user.id, Date.now()]);
    return {
      user: meUser(user), equipped: fixEquip(JSON.parse(user.equipped)), prefs: JSON.parse(user.prefs || '{}'),
      inventory: [...new Set([...DEFAULT_ITEMS, ...inv.map((r) => r.item_id)])].filter((id) => ITEM_MAP[id]), achievements: ach.map((a) => ({ id: a.ach_id, at: a.unlocked_at })),
      medals: medals.map((m) => ({ ...m, info: MEDALS[m.kind] })), progress,
      globalRank: await globalRank(user), records: await countRecords(db, user.id),
    };
  });

  route('PATCH', '/api/me', async ({ user, body }) => {
    const sets = [], vals = [user.id];
    if (body.avatar !== undefined) {
      if (!AVATARS.includes(body.avatar)) throw new GameError(400, 'Avatar inválido');
      vals.push(body.avatar); sets.push(`avatar=$${vals.length}`);
    }
    if (body.country !== undefined) {
      const c = COUNTRY_MAP[body.country];
      if (!c) throw new GameError(400, 'País inválido');
      vals.push(c.code); sets.push(`country=$${vals.length}`);
      vals.push(c.continent); sets.push(`continent=$${vals.length}`);
    }
    if (body.state !== undefined) {
      if (body.state !== '' && !BR_STATES[body.state]) throw new GameError(400, 'Estado inválido');
      vals.push(body.state); sets.push(`state=$${vals.length}`);
    }
    if (body.prefs !== undefined) {
      const s = JSON.stringify(body.prefs);
      if (s.length > 2000) throw new GameError(400, 'Preferências muito grandes');
      vals.push(s); sets.push(`prefs=$${vals.length}`);
    }
    if (sets.length) await db.run(`UPDATE users SET ${sets.join(', ')} WHERE id=$1`, vals);
    clearRankingCache();
    return { ok: true };
  });

  route('GET', '/api/profile/:username', async ({ params }) => {
    const u = await db.get('SELECT * FROM users WHERE username_lc=$1 AND banned=0', [decodeURIComponent(params.username).toLowerCase()]);
    if (!u) throw new GameError(404, 'Jogador não encontrado');
    const [ach, medals, history] = await Promise.all([
      db.all('SELECT ach_id FROM achievements WHERE user_id=$1', [u.id]),
      db.all('SELECT kind, period, rank FROM medals WHERE user_id=$1 ORDER BY created_at DESC', [u.id]),
      db.all(`SELECT mode, level_id, time_ms, distance, score, deaths, finished_at FROM runs WHERE user_id=$1 AND status='valid'
              ORDER BY finished_at DESC LIMIT 15`, [u.id]),
    ]);
    const eq = JSON.parse(u.equipped);
    return {
      username: u.username, country: u.country, continent: u.continent, avatar: u.avatar, equipped: eq,
      totalScore: u.total_score, levelsDone: u.levels_done, playMs: u.play_ms, endlessBest: u.endless_best,
      raceRating: u.race_rating, raceWins: u.race_wins, races: u.races, createdAt: u.created_at,
      rank: await globalRank(u), records: await countRecords(db, u.id), online: mp.isOnline(u.id),
      achievements: ach.map((a) => a.ach_id), medals: medals.map((m) => ({ ...m, info: MEDALS[m.kind] })), history,
    };
  }, { auth: 'optional' });

  route('GET', '/api/history', async ({ user }) => {
    const rows = await db.all(
      `SELECT mode, level_id, status, time_ms, distance, score, deaths, coins, reward, reason, finished_at FROM runs
       WHERE user_id=$1 AND status IN ('valid','invalid') ORDER BY finished_at DESC LIMIT 50`, [user.id]);
    return { runs: rows };
  });

  // ---------------- conteúdo do jogo
  route('GET', '/api/levels', async () => ({
    worlds: WORLDS,
    levels: LEVEL_DEFS.map((d) => ({ id: d.id, world: d.world, name: d.name, par: d.par, boss: !!d.boss })),
    records: await levelRecords(db),
  }), { auth: 'optional' });

  route('GET', '/api/meta', async () => ({
    items: ITEMS, slots: SLOTS, achievements: ACHIEVEMENTS.map(({ check, ...a }) => a), medals: MEDALS, avatars: AVATARS,
  }), { auth: false });

  // ---------------- tentativas (validação no servidor)
  route('POST', '/api/run/start', async ({ user, body }) => {
    if (!rl.run.hit(user.id)) throw new GameError(429, 'Calma! Muitas tentativas em pouco tempo.');
    return startRun(db, user, { mode: body.mode, levelId: body.levelId });
  });

  route('POST', '/api/run/finish', async ({ user, body }) => {
    const r = await finishRun(db, user, { runId: body.runId, inputs: body.inputs });
    if (r.valid) clearRankingCache();
    return r;
  });

  route('GET', '/api/ghost', async ({ user, query }) => {
    const g = await getGhost(db, user.id, { level: String(query.level || ''), who: query.who === 'pb' ? 'pb' : 'wr' });
    return { ghost: g };
  });

  // ---------------- rankings
  route('GET', '/api/rankings', async ({ user, query }) => getRanking(db, String(query.type || 'world'), {
    country: query.country, continent: query.continent, state: query.state, level: query.level,
  }, user), { auth: 'optional' });

  route('GET', '/api/top3', async () => ({ top3: await top3(db) }), { auth: false });

  route('GET', '/api/season', async () => ({ ...seasonInfo(), now: Date.now() }), { auth: false });

  route('GET', '/api/challenges', async ({ user }) => {
    const now = Date.now();
    const out = {};
    for (const [k, id, range] of [['daily', dailyId(now), dailyRange], ['event', eventId(now), eventRange]]) {
      const wr = await db.get(
        `SELECT b.time_ms, u.username, u.country FROM bests b JOIN users u ON u.id=b.user_id WHERE b.level_id=$1 AND b.time_ms IS NOT NULL
         ORDER BY b.time_ms ASC LIMIT 1`, [id]);
      const mine = user ? await db.get('SELECT time_ms FROM bests WHERE user_id=$1 AND level_id=$2', [user.id, id]) : null;
      const players = await db.get('SELECT COUNT(*) AS n FROM bests WHERE level_id=$1', [id]);
      out[k] = { id, endsAt: range(id).end, wr: wr || null, myBest: mine ? mine.time_ms : null, players: players.n };
    }
    out.event.rewards = EVENT_REWARDS;
    out.online = mp.onlineCount();
    return out;
  }, { auth: 'optional' });

  // ---------------- loja e personalização
  route('GET', '/api/shop', async ({ user }) => {
    const inv = await db.all('SELECT item_id FROM inventory WHERE user_id=$1', [user.id]);
    return { coins: user.coins, owned: inv.map((r) => r.item_id), equipped: fixEquip(JSON.parse(user.equipped)), items: ITEMS };
  });

  route('POST', '/api/shop/buy', async ({ user, body }) => {
    const it = ITEM_MAP[body.itemId];
    if (!it || it.price == null) throw new GameError(400, 'Item indisponível para compra');
    const r = await db.tx(async (q) => {
      const owned = await q.get('SELECT 1 AS x FROM inventory WHERE user_id=$1 AND item_id=$2', [user.id, it.id]);
      if (owned) throw new GameError(409, 'Você já possui este item');
      const col = it.cur === 'gem' ? 'gems' : 'coins';
      const upd = await q.run(`UPDATE users SET ${col} = ${col} - $2, purchases = purchases + 1 WHERE id=$1 AND ${col} >= $2`, [user.id, it.price]);
      if (!upd.changes) throw new GameError(402, it.cur === 'gem' ? 'Diamantes insuficientes' : 'Moedas insuficientes');
      await q.run('INSERT INTO inventory (user_id, item_id, acquired_at) VALUES ($1,$2,$3)', [user.id, it.id, Date.now()]);
      const ach = await grantAchievements(q, user.id, {});
      const u = await q.get('SELECT coins, gems FROM users WHERE id=$1', [user.id]);
      return { ok: true, coins: u.coins, gems: u.gems, achievements: ach };
    });
    await mp.refreshItems(user.id);
    return r;
  });

  route('POST', '/api/equip', async ({ user, body }) => {
    const it = ITEM_MAP[body.itemId];
    if (!it || it.slot !== body.slot) throw new GameError(400, 'Item inválido');
    const owned = it.price === 0 || await db.get('SELECT 1 AS x FROM inventory WHERE user_id=$1 AND item_id=$2', [user.id, it.id]);
    if (!owned) throw new GameError(403, 'Você não possui este item');
    const eq = { ...DEFAULT_EQUIPPED, ...JSON.parse(user.equipped) };
    if (!ITEM_MAP[eq.skin]) eq.skin = DEFAULT_EQUIPPED.skin;
    eq[it.slot] = it.id;
    await db.run('UPDATE users SET equipped=$2 WHERE id=$1', [user.id, JSON.stringify(eq)]);
    clearRankingCache();
    return { equipped: eq };
  });

  // ---------------- amigos
  route('GET', '/api/friends', async ({ user }) => {
    const rows = await db.all(
      `SELECT f.status, f.user_id, f.friend_id, u.username, u.country, u.avatar, u.total_score, u.id AS uid FROM friends f
       JOIN users u ON u.id = CASE WHEN f.user_id=$1 THEN f.friend_id ELSE f.user_id END
       WHERE f.user_id=$1 OR f.friend_id=$1`, [user.id]);
    const friends = [], incoming = [], outgoing = [];
    const seen = new Set();
    for (const r of rows) {
      const item = { username: r.username, country: r.country, avatar: r.avatar, totalScore: r.total_score, online: mp.isOnline(r.uid) };
      if (r.status === 'accepted') { if (!seen.has(r.uid)) { seen.add(r.uid); friends.push(item); } }
      else if (r.friend_id === user.id) incoming.push(item);
      else outgoing.push(item);
    }
    friends.sort((a, b) => b.online - a.online || a.username.localeCompare(b.username));
    return { friends, incoming, outgoing };
  });

  route('POST', '/api/friends/request', async ({ user, body }) => {
    const t = await db.get('SELECT id, username FROM users WHERE username_lc=$1', [String(body.username || '').toLowerCase()]);
    if (!t) throw new GameError(404, 'Jogador não encontrado');
    if (t.id === user.id) throw new GameError(400, 'Você não pode adicionar a si mesmo');
    const back = await db.get('SELECT status FROM friends WHERE user_id=$1 AND friend_id=$2', [t.id, user.id]);
    const now = Date.now();
    if (back) { // o outro já tinha pedido: aceita direto
      await db.tx(async (q) => {
        await q.run("UPDATE friends SET status='accepted' WHERE user_id=$1 AND friend_id=$2", [t.id, user.id]);
        await q.run("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES ($1,$2,'accepted',$3) ON CONFLICT DO NOTHING", [user.id, t.id, now]);
      });
      mp.notify(t.id, { t: 'friend', kind: 'accepted', from: user.username });
      return { status: 'accepted' };
    }
    await db.run("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES ($1,$2,'pending',$3) ON CONFLICT DO NOTHING", [user.id, t.id, now]);
    mp.notify(t.id, { t: 'friend', kind: 'request', from: user.username });
    return { status: 'pending' };
  });

  route('POST', '/api/friends/accept', async ({ user, body }) => {
    const t = await db.get('SELECT id FROM users WHERE username_lc=$1', [String(body.username || '').toLowerCase()]);
    if (!t) throw new GameError(404, 'Jogador não encontrado');
    const r = await db.tx(async (q) => {
      const u = await q.run("UPDATE friends SET status='accepted' WHERE user_id=$1 AND friend_id=$2 AND status='pending'", [t.id, user.id]);
      if (!u.changes) throw new GameError(404, 'Pedido não encontrado');
      await q.run("INSERT INTO friends (user_id, friend_id, status, created_at) VALUES ($1,$2,'accepted',$3) ON CONFLICT DO NOTHING", [user.id, t.id, Date.now()]);
      return { status: 'accepted' };
    });
    mp.notify(t.id, { t: 'friend', kind: 'accepted', from: user.username });
    return r;
  });

  route('POST', '/api/friends/remove', async ({ user, body }) => {
    const t = await db.get('SELECT id FROM users WHERE username_lc=$1', [String(body.username || '').toLowerCase()]);
    if (!t) throw new GameError(404, 'Jogador não encontrado');
    await db.run('DELETE FROM friends WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)', [user.id, t.id]);
    return { ok: true };
  });

  // moderação: banir/desbanir trapaceiros (replays de todos os recordes ficam disponíveis para revisão)
  // ---------------- diamantes (pagamento pelo Mercado Pago: Pix e cartão)
  const MP_TOKEN = process.env.MP_ACCESS_TOKEN || '';
  const payments = { enabled: !!MP_TOKEN };
  const siteOrigin = (req) => process.env.PUBLIC_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

  route('GET', '/api/payments/packs', async () => ({ enabled: payments.enabled, packs: GEM_PACKS }), { auth: false });

  route('POST', '/api/payments/checkout', async ({ user, body, req }) => {
    const pack = GEM_PACK_MAP[body.pack];
    if (!pack) throw new GameError(400, 'Pacote inválido');
    if (!payments.enabled) throw new GameError(503, 'A compra de diamantes ainda não foi ativada.');
    const id = newId(16);
    const cents = Math.round(pack.price * 100);
    await db.run("INSERT INTO orders (id, user_id, pack, gems, amount_cents, status, created_at) VALUES ($1,$2,$3,$4,$5,'pending',$6)",
      [id, user.id, pack.id, pack.gems, cents, Date.now()]);
    const origin = siteOrigin(req);
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MP_TOKEN}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': id },
      body: JSON.stringify({
        items: [{ id: pack.id, title: `ESTRESSE — ${pack.gems} diamantes`, quantity: 1, currency_id: 'BRL', unit_price: pack.price }],
        external_reference: id,
        notification_url: `${origin}/api/payments/webhook`,
        back_urls: { success: `${origin}/#/vault?pagamento=ok`, pending: `${origin}/#/vault?pagamento=pendente`, failure: `${origin}/#/vault?pagamento=falhou` },
        auto_return: 'approved',
      }),
    });
    const pref = await r.json().catch(() => ({}));
    if (!r.ok || !pref.init_point) { log('mercadopago', r.status, pref); throw new GameError(502, 'Não foi possível abrir o pagamento. Tente de novo.'); }
    await db.run('UPDATE orders SET provider_id=$2 WHERE id=$1', [id, String(pref.id || '')]);
    return { url: pref.init_point, order: id };
  });

  // Credita os diamantes uma única vez, só depois de confirmar o pagamento com o próprio Mercado Pago.
  async function creditOrder(orderId, providerPaymentId) {
    return db.tx(async (q) => {
      const o = await q.get('SELECT * FROM orders WHERE id=$1', [orderId]);
      if (!o) return false;
      const upd = await q.run("UPDATE orders SET status='paid', paid_at=$2, provider_id=$3 WHERE id=$1 AND status='pending'", [orderId, Date.now(), providerPaymentId]);
      if (!upd.changes) return false;
      await q.run('UPDATE users SET gems = gems + $2 WHERE id=$1', [o.user_id, o.gems]);
      return true;
    });
  }

  route('POST', '/api/payments/webhook', async ({ body, query }) => {
    if (!payments.enabled) return { ok: true };
    const pid = String(query['data.id'] || query.id || body?.data?.id || '');
    const type = String(query.type || query.topic || body?.type || '');
    if (!pid || !/^\d+$/.test(pid) || (type && type !== 'payment')) return { ok: true };
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${pid}`, { headers: { Authorization: `Bearer ${MP_TOKEN}` } });
    if (!r.ok) return { ok: true };
    const pay = await r.json();
    if (pay.status !== 'approved' || !pay.external_reference) return { ok: true };
    const o = await db.get('SELECT amount_cents FROM orders WHERE id=$1', [pay.external_reference]);
    if (!o || Math.round(Number(pay.transaction_amount) * 100) !== Number(o.amount_cents)) return { ok: true };
    await creditOrder(pay.external_reference, pid);
    return { ok: true };
  }, { auth: false });

  route('GET', '/api/payments/orders', async ({ user }) => ({
    orders: await db.all('SELECT id, pack, gems, amount_cents, status, created_at, paid_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [user.id]),
  }));

  route('POST', '/api/admin/gems', async ({ req, body }) => {
    const want = process.env.ADMIN_TOKEN;
    const got = String(req.headers['x-admin-token'] || '');
    if (!want || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) throw new GameError(403, 'Proibido');
    const n = Number(body.amount);
    if (!Number.isInteger(n) || Math.abs(n) > 100000) throw new GameError(400, 'Quantidade inválida');
    const r = await db.run('UPDATE users SET gems = gems + $2 WHERE username_lc=$1', [String(body.username || '').toLowerCase(), n]);
    if (!r.changes) throw new GameError(404, 'Jogador não encontrado');
    return { ok: true };
  }, { auth: false });

  route('POST', '/api/admin/ban', async ({ req, body }) => {
    const want = process.env.ADMIN_TOKEN;
    const got = String(req.headers['x-admin-token'] || '');
    if (!want || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) throw new GameError(403, 'Proibido');
    const u = await db.get('SELECT id FROM users WHERE username_lc=$1', [String(body.username || '').toLowerCase()]);
    if (!u) throw new GameError(404, 'Jogador não encontrado');
    const ban = body.ban === false ? 0 : 1;
    await db.run('UPDATE users SET banned=$2 WHERE id=$1', [u.id, ban]);
    if (ban) await db.run('DELETE FROM sessions WHERE user_id=$1', [u.id]);
    clearRankingCache();
    return { ok: true, banned: !!ban };
  }, { auth: false });

  route('GET', '/api/status', async () => ({ ok: true, db: db.kind, online: mp.onlineCount(), now: Date.now() }), { auth: false });

  // ---------------- HTTP
  async function readBody(req) {
    // No Vercel o corpo pode já vir lido (req.body); fora dele, lemos o stream.
    if (serverless && req.body !== undefined && req.body !== null) {
      const b = req.body;
      if (Buffer.isBuffer(b)) { if (b.length > 4 * 1024 * 1024) throw new GameError(413, 'Corpo muito grande'); try { return b.length ? JSON.parse(b.toString('utf8')) : {}; } catch { throw new GameError(400, 'JSON inválido'); } }
      if (typeof b === 'string') { try { return b ? JSON.parse(b) : {}; } catch { throw new GameError(400, 'JSON inválido'); } }
      if (typeof b === 'object') return b;
    }
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > 4 * 1024 * 1024) throw new GameError(413, 'Corpo muito grande');
      chunks.push(c);
    }
    if (!size) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new GameError(400, 'JSON inválido'); }
  }

  async function serveStatic(req, res, pathname) {
    let base = join(ROOT, 'public');
    let rel = pathname;
    if (pathname.startsWith('/shared/')) { base = join(ROOT, 'shared'); rel = pathname.slice(7); }
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = normalize(join(base, rel));
    if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
    try {
      const st = await stat(file);
      if (!st.isFile()) throw new Error('not file');
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] || 'application/octet-stream',
        'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=300',
        ...SECURITY_HEADERS,
      });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Não encontrado');
    }
  }

  const handle = async (req, res) => {
    if (serverless) await maintenance();
    const url = new URL(req.url, 'http://x');
    const ip = (process.env.TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      return serveStatic(req, res, url.pathname);
    }
    const json = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
      res.end(JSON.stringify(obj));
    };
    try {
      if (!rl.api.hit(ip)) throw new GameError(429, 'Muitas requisições');
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) throw new GameError(404, 'Rota inexistente');
      const m = url.pathname.match(r.re);
      const params = Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]]));
      const auth = String(req.headers.authorization || '');
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      let user = null;
      if (r.auth || r.optional) {
        user = token ? await userFromToken(db, token) : null;
        if (r.auth && !user) throw new GameError(401, 'Faça login para continuar');
      }
      const body = req.method === 'POST' || req.method === 'PATCH' ? await readBody(req) : {};
      const out = await r.handler({ req, res, user, body, params, query: Object.fromEntries(url.searchParams), token, ip });
      if (out !== RAW) json(200, out);
    } catch (e) {
      if (e instanceof GameError) json(e.status, { error: e.message });
      else { log('erro', e); json(500, { error: 'Erro interno do servidor' }); }
    }
  };
  const server = http.createServer(handle);

  // Em hospedagem serverless (Vercel) não há WebSocket nem timers: a manutenção
  // (fechar temporadas, limpar sessões) roda no máximo a cada 10 min durante as requisições.
  let lastMaint = 0;
  async function maintenance() {
    const now = Date.now();
    if (now - lastMaint < 10 * 60000) return;
    lastMaint = now;
    // aguardado (nada fica rodando "solto" depois da resposta, quando a função é congelada)
    try {
      await runFinalizers(db);
      await db.run("DELETE FROM runs WHERE status='open' AND created_at < $1", [now - 6 * 3600000]);
      await db.run('DELETE FROM sessions WHERE expires_at < $1', [now]);
    } catch (e) { log('manutenção', e); }
  }
  if (serverless) {
    const mpStub = { isOnline: () => false, onlineCount: () => 0, notify() {}, refreshItems: async () => {}, close() {} };
    mp = mpStub;
    return { server, db, mp, handle, async close() { await db.close(); } };
  }

  mp = createMultiplayer({ server, db, log });
  const finalizer = setInterval(() => runFinalizers(db).catch((e) => log('finalizer', e)), 10 * 60000);
  const cleanup = setInterval(() => {
    const now = Date.now();
    db.run("DELETE FROM runs WHERE status='open' AND created_at < $1", [now - 6 * 3600000]).catch((e) => log('cleanup', e));
    db.run('DELETE FROM sessions WHERE expires_at < $1', [now]).catch((e) => log('cleanup', e));
  }, 30 * 60000);
  runFinalizers(db).catch((e) => log('finalizer', e));

  return {
    server, db, mp, handle,
    async close() {
      clearInterval(finalizer); clearInterval(cleanup);
      mp.close();
      await new Promise((r) => server.close(r));
      await db.close();
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const port = Number(process.env.PORT || 3000);
  const app = await createServer();
  app.server.listen(port, () => {
    console.log(`ESTRESSE rodando em http://localhost:${port} (banco: ${app.db.kind})`);
  });
  const stop = async () => { await app.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
