// Multiplayer em tempo real (WebSocket): salas, convites, matchmaking e
// corridas. Cada jogador simula localmente; o servidor retransmite posições
// (fantasmas) e valida a chegada re-simulando as entradas — a colocação final
// usa o tempo validado, não a ordem de chegada das mensagens.
import { WebSocketServer } from 'ws';
import { randomInt } from 'node:crypto';
import { newId, userFromToken } from './auth.js';
import { simulateRun, grantAchievements } from './game.js';
import { runReward } from '../shared/scoring.js';
import { ITEM_MAP } from '../shared/items.js';
import { clearRankingCache } from './rankings.js';

const MAX_PLAYERS = 4;
const RACE_LIMIT_MS = 180000;
const COUNTDOWN_MS = 4000;

export function createMultiplayer({ server, db, log = () => {} }) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2 * 1024 * 1024 });
  const online = new Map();   // userId -> Set<ws>
  const rooms = new Map();    // code -> room
  let queue = [];             // [{ ws, since }]

  const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const sendUser = (userId, msg) => { for (const ws of online.get(userId) || []) send(ws, msg); };
  const broadcast = (room, msg, except) => { for (const p of room.players.values()) if (p.ws !== except) send(p.ws, msg); };

  function roomState(room) {
    return {
      t: 'room', code: room.code, host: room.hostName, public: room.public, state: room.state, levelId: room.levelId,
      players: [...room.players.values()].map((p) => ({
        username: p.username, country: p.country, avatar: p.avatar, skin: p.skin, ready: p.ready, rating: p.rating,
      })),
    };
  }
  const pushRoom = (room) => broadcast(room, roomState(room));

  function newCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c;
    do { c = Array.from({ length: 5 }, () => A[randomInt(A.length)]).join(''); } while (rooms.has(c));
    return c;
  }

  function makeRoom(hostWs, isPublic) {
    const room = {
      code: newCode(), hostId: hostWs.user.id, hostName: hostWs.user.username, public: isPublic,
      players: new Map(), state: 'lobby', levelId: null, startAt: 0, timer: null,
    };
    rooms.set(room.code, room);
    return room;
  }

  function addPlayer(room, ws) {
    const u = ws.user;
    room.players.set(u.id, {
      id: u.id, username: u.username, country: u.country, avatar: u.avatar, skin: u.skin, rating: u.rating,
      ws, ready: false, runId: null, timeMs: null, dnf: false, done: false,
    });
    ws.room = room.code;
  }

  function leaveRoom(ws) {
    const room = rooms.get(ws.room);
    ws.room = null;
    if (!room) return;
    const p = room.players.get(ws.user.id);
    if (!p || p.ws !== ws) return;
    if (room.state === 'racing' && !p.done) { p.dnf = true; p.done = true; }
    room.players.delete(ws.user.id);
    if (room.players.size === 0) { clearTimeout(room.timer); rooms.delete(room.code); return; }
    if (room.hostId === ws.user.id) {
      const nh = room.players.values().next().value;
      room.hostId = nh.id; room.hostName = nh.username;
    }
    broadcast(room, { t: 'left', username: ws.user.username });
    if (room.state === 'racing') maybeEndRace(room);
    pushRoom(room);
  }

  async function startRace(room) {
    room.state = 'racing';
    room.levelId = `race-${room.code}-${newId(6)}`;
    room.startAt = Date.now() + COUNTDOWN_MS;
    for (const p of room.players.values()) {
      p.runId = newId(16); p.timeMs = null; p.dnf = false; p.done = false;
      await db.run(
        "INSERT INTO runs (id, user_id, mode, level_id, seed, created_at, status, room) VALUES ($1,$2,'race',$3,0,$4,'open',$5)",
        [p.runId, p.id, room.levelId, room.startAt, room.code]);
    }
    broadcast(room, { t: 'start', levelId: room.levelId, startAt: room.startAt, serverNow: Date.now(), limitMs: RACE_LIMIT_MS });
    pushRoom(room);
    clearTimeout(room.timer);
    room.timer = setTimeout(() => endRace(room).catch((e) => log('race', e)), COUNTDOWN_MS + RACE_LIMIT_MS + 3000);
  }

  function maybeEndRace(room) {
    if (room.state !== 'racing') return;
    if ([...room.players.values()].every((p) => p.done)) endRace(room).catch((e) => log('race', e));
  }

  async function endRace(room) {
    if (room.state !== 'racing') return;
    room.state = 'results';
    clearTimeout(room.timer);
    const ps = [...room.players.values()];
    for (const p of ps) if (!p.done) { p.dnf = true; p.done = true; }
    ps.sort((a, b) => (a.dnf - b.dnf) || ((a.timeMs ?? 1e12) - (b.timeMs ?? 1e12)));
    const rated = ps.length >= 2;
    const deltas = new Map(ps.map((p) => [p.id, 0]));
    if (rated) {
      const K = 32 / (ps.length - 1);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        if (a.dnf && b.dnf) continue;
        const ea = 1 / (1 + 10 ** ((b.rating - a.rating) / 400));
        const d = Math.round(K * (1 - ea));
        deltas.set(a.id, deltas.get(a.id) + d);
        deltas.set(b.id, deltas.get(b.id) - d);
      }
    }
    const results = [];
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const place = p.dnf ? null : i + 1;
      const delta = deltas.get(p.id);
      const reward = place && rated ? runReward({ mode: 'race', place }) : 0;
      let ach = [];
      try {
        ach = await db.tx(async (q) => {
          await q.run(
            `UPDATE users SET races = races + $2, race_wins = race_wins + $3, race_rating = race_rating + $4, coins = coins + $5
             WHERE id=$1`, [p.id, rated ? 1 : 0, rated && place === 1 ? 1 : 0, delta, reward]);
          if (p.dnf) await q.run("UPDATE runs SET status='invalid', reason='dnf', finished_at=$2 WHERE id=$1 AND status='open'", [p.runId, Date.now()]);
          return grantAchievements(q, p.id, {});
        });
      } catch (e) { log('race-db', e); }
      p.rating += delta;
      if (p.ws.user) p.ws.user.rating = p.rating;
      results.push({ username: p.username, country: p.country, place, timeMs: p.timeMs, dnf: p.dnf, ratingDelta: delta, rating: p.rating, reward });
      if (ach.length) send(p.ws, { t: 'achievements', list: ach });
    }
    clearRankingCache();
    broadcast(room, { t: 'results', results, rated });
    room.state = 'lobby';
    for (const p of room.players.values()) p.ready = false;
    pushRoom(room);
  }

  async function onFinish(ws, msg) {
    const room = rooms.get(ws.room);
    if (!room || room.state !== 'racing') return;
    const p = room.players.get(ws.user.id);
    if (!p || p.done) return;
    const run = { id: p.runId, mode: 'race', level_id: room.levelId, seed: 0, created_at: room.startAt };
    const res = simulateRun(run, msg.inputs, { startedAt: room.startAt });
    p.done = true;
    if (!res.ok) {
      p.dnf = true;
      await db.run("UPDATE runs SET status='invalid', reason=$2, finished_at=$3 WHERE id=$1", [p.runId, res.reason, Date.now()]);
      send(ws, { t: 'rejected', reason: res.reason });
    } else {
      p.timeMs = res.timeMs;
      await db.run(
        "UPDATE runs SET status='valid', finished_at=$2, time_ms=$3, deaths=$4, coins=$5, inputs=$6 WHERE id=$1",
        [p.runId, Date.now(), res.timeMs, res.deaths, res.coins, JSON.stringify(res.rle)]);
      await db.run('UPDATE users SET play_ms = play_ms + $2, deaths_total = deaths_total + $3 WHERE id=$1', [p.id, res.timeMs, res.deaths]);
      broadcast(room, { t: 'pfinish', username: p.username, timeMs: res.timeMs });
    }
    maybeEndRace(room);
  }

  // ---- matchmaking
  function matchmake() {
    queue = queue.filter((e) => e.ws.readyState === 1 && !e.ws.room);
    if (queue.length < 2) return;
    queue.sort((a, b) => a.since - b.since);
    const used = new Set();
    for (const head of queue) {
      if (used.has(head)) continue;
      const waited = (Date.now() - head.since) / 1000;
      const tol = 150 + waited * 25;
      const group = [head];
      for (const e of queue) {
        if (e === head || used.has(e) || group.length >= MAX_PLAYERS) continue;
        if (Math.abs(e.ws.user.rating - head.ws.user.rating) <= tol) group.push(e);
      }
      if (group.length >= 2 && (group.length === MAX_PLAYERS || waited >= 5)) {
        group.forEach((e) => used.add(e));
        const room = makeRoom(head.ws, true);
        for (const e of group) { addPlayer(room, e.ws); send(e.ws, { t: 'matched', code: room.code }); }
        startRace(room).catch((e) => log('mm', e));
      }
    }
    queue = queue.filter((e) => !used.has(e));
    for (const e of queue) send(e.ws, { t: 'queued', size: queue.length, waited: Math.round((Date.now() - e.since) / 1000) });
  }
  const mmTimer = setInterval(matchmake, 1000);

  // ---- conexões
  wss.on('connection', (ws) => {
    ws.user = null;
    ws.room = null;
    ws.posBudget = { t: 0, n: 0 };
    const authTimeout = setTimeout(() => { if (!ws.user) ws.close(4001, 'auth'); }, 8000);
    ws.on('message', async (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;
      try {
        if (!ws.user) {
          if (msg.t !== 'auth') return;
          const u = await userFromToken(db, msg.token);
          if (!u) { send(ws, { t: 'error', msg: 'Sessão inválida' }); ws.close(4001, 'auth'); return; }
          clearTimeout(authTimeout);
          const eq = JSON.parse(u.equipped || '{}');
          const inv = await db.all('SELECT item_id FROM inventory WHERE user_id=$1', [u.id]);
          ws.user = {
            id: u.id, username: u.username, country: u.country, avatar: u.avatar, skin: eq.skin || 'skin_male',
            rating: u.race_rating, items: new Set(inv.map((r) => r.item_id)),
          };
          if (!online.has(u.id)) online.set(u.id, new Set());
          online.get(u.id).add(ws);
          send(ws, { t: 'hello', online: online.size });
          return;
        }
        await handle(ws, msg);
      } catch (e) {
        log('ws', e);
        send(ws, { t: 'error', msg: 'Erro interno' });
      }
    });
    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (!ws.user) return;
      queue = queue.filter((e) => e.ws !== ws);
      leaveRoom(ws);
      const set = online.get(ws.user.id);
      if (set) { set.delete(ws); if (!set.size) online.delete(ws.user.id); }
    });
  });

  async function handle(ws, msg) {
    const u = ws.user;
    switch (msg.t) {
      case 'ping': send(ws, { t: 'pong', now: Date.now(), online: online.size }); break;
      case 'queue':
        if (ws.room) leaveRoom(ws);
        if (!queue.some((e) => e.ws === ws)) queue.push({ ws, since: Date.now() });
        send(ws, { t: 'queued', size: queue.length, waited: 0 });
        break;
      case 'unqueue':
        queue = queue.filter((e) => e.ws !== ws);
        send(ws, { t: 'unqueued' });
        break;
      case 'create': {
        if (ws.room) leaveRoom(ws);
        queue = queue.filter((e) => e.ws !== ws);
        const room = makeRoom(ws, false);
        addPlayer(room, ws);
        pushRoom(room);
        break;
      }
      case 'join': {
        const code = String(msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) return send(ws, { t: 'error', msg: 'Sala não encontrada' });
        if (room.players.has(u.id) && room.players.get(u.id).ws === ws) return pushRoom(room);
        if (room.state !== 'lobby') return send(ws, { t: 'error', msg: 'A corrida já começou' });
        if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'error', msg: 'Sala cheia' });
        if (ws.room) leaveRoom(ws);
        queue = queue.filter((e) => e.ws !== ws);
        addPlayer(room, ws);
        pushRoom(room);
        break;
      }
      case 'leave': leaveRoom(ws); send(ws, { t: 'room', code: null }); break;
      case 'ready': {
        const room = rooms.get(ws.room);
        if (!room || room.state !== 'lobby') return;
        room.players.get(u.id).ready = !!msg.v;
        pushRoom(room);
        break;
      }
      case 'start': {
        const room = rooms.get(ws.room);
        if (!room || room.state !== 'lobby') return;
        if (room.hostId !== u.id) return send(ws, { t: 'error', msg: 'Apenas o anfitrião inicia a corrida' });
        const notReady = [...room.players.values()].filter((p) => p.id !== u.id && !p.ready);
        if (notReady.length) return send(ws, { t: 'error', msg: 'Aguardando todos ficarem prontos' });
        await startRace(room);
        break;
      }
      case 'invite': {
        const room = rooms.get(ws.room);
        if (!room) return send(ws, { t: 'error', msg: 'Crie uma sala antes de convidar' });
        const target = await db.get('SELECT id, username FROM users WHERE username_lc=$1', [String(msg.username || '').toLowerCase()]);
        if (!target || !online.has(target.id)) return send(ws, { t: 'error', msg: 'Jogador offline ou inexistente' });
        sendUser(target.id, { t: 'invite', from: u.username, code: room.code });
        send(ws, { t: 'info', msg: `Convite enviado para ${target.username}` });
        break;
      }
      case 'pos': {
        const room = rooms.get(ws.room);
        if (!room || room.state !== 'racing') return;
        const now = Date.now();
        if (now - ws.posBudget.t > 1000) ws.posBudget = { t: now, n: 0 };
        if (++ws.posBudget.n > 30) return;
        const num = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 10) / 10 : 0);
        broadcast(room, { t: 'pos', u: u.username, x: num(msg.x), y: num(msg.y), f: msg.f === -1 ? -1 : 1, a: String(msg.a || '').slice(0, 8), k: num(msg.k) }, ws);
        break;
      }
      case 'emote': {
        const room = rooms.get(ws.room);
        const it = ITEM_MAP[msg.id];
        if (!room || !it || it.slot !== 'emote' || !u.items.has(it.id)) return;
        broadcast(room, { t: 'emote', u: u.username, text: it.text });
        break;
      }
      case 'finish': await onFinish(ws, msg); break;
      case 'giveup': {
        const room = rooms.get(ws.room);
        if (!room || room.state !== 'racing') return;
        const p = room.players.get(u.id);
        if (p && !p.done) { p.done = true; p.dnf = true; maybeEndRace(room); }
        break;
      }
      default: break;
    }
  }

  return {
    wss,
    isOnline: (id) => online.has(id),
    onlineCount: () => online.size,
    notify: sendUser,
    refreshItems: async (userId) => {
      const inv = await db.all('SELECT item_id FROM inventory WHERE user_id=$1', [userId]);
      for (const ws of online.get(userId) || []) if (ws.user) ws.user.items = new Set(inv.map((r) => r.item_id));
    },
    close() { clearInterval(mmTimer); for (const r of rooms.values()) clearTimeout(r.timer); wss.close(); },
  };
}
