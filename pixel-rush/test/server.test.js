import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createServer } from '../server/index.js';
import { advanceClock } from '../server/clock.js';
import { finalizeSeason } from '../server/seasons.js';
import { getStoryLevel } from '../shared/levels.js';
import { buildLevel } from '../shared/modes.js';
import { solve } from '../tools/solver.js';
import { prevSeasonId, seasonId, seasonRange } from '../shared/scoring.js';

let app, base;
const sol = {};

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function register(username, country = 'BR') {
  const r = await api('/api/auth/register', { method: 'POST', body: { username, password: 'segredo123', country, avatar: 'a3' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.token;
}

before(async () => {
  if (process.env.TEST_DATABASE_URL) { // banco de teste limpo a cada execução
    const pg = (await import('pg')).default;
    const c = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await c.connect();
    await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await c.end();
  }
  app = await createServer({ dbOptions: { url: process.env.TEST_DATABASE_URL, file: ':memory:' }, rateLimits: false, logger: { error() {} } });
  await new Promise((r) => app.server.listen(0, r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  sol['1-1'] = solve(getStoryLevel('1-1'), { width: 300 });
  sol['1-2'] = solve(getStoryLevel('1-2'), { width: 300 });
  assert.ok(sol['1-1'].ok && sol['1-2'].ok);
});
after(async () => { await app.close(); });

test('cadastro, login e perfil', async () => {
  const t = await register('Alice');
  const dup = await api('/api/auth/register', { method: 'POST', body: { username: 'alice', password: 'segredo123', country: 'BR' } });
  assert.equal(dup.status, 409);
  const bad = await api('/api/auth/login', { method: 'POST', body: { username: 'Alice', password: 'errada' } });
  assert.equal(bad.status, 401);
  const ok = await api('/api/auth/login', { method: 'POST', body: { username: 'alice', password: 'segredo123' } });
  assert.equal(ok.status, 200);
  const me = await api('/api/me', { token: t });
  assert.equal(me.data.user.username, 'Alice');
  assert.equal(me.data.user.country, 'BR');
  assert.ok(me.data.inventory.includes('skin_classic'));
  assert.equal((await api('/api/me')).status, 401);
});

test('resultado válido entra no ranking; fraudes são rejeitadas', async () => {
  const t = await register('Bruno', 'PT');
  // fase bloqueada
  const locked = await api('/api/run/start', { method: 'POST', token: t, body: { mode: 'level', levelId: '1-2' } });
  assert.equal(locked.status, 403);

  // enviado rápido demais (o relógio real não bate com o tempo simulado)
  let s = await api('/api/run/start', { method: 'POST', token: t, body: { mode: 'level', levelId: '1-1' } });
  let f = await api('/api/run/finish', { method: 'POST', token: t, body: { runId: s.data.runId, inputs: sol['1-1'].inputs } });
  assert.equal(f.data.valid, false);
  assert.equal(f.data.reason, 'tempo_real_incompativel');

  // entradas que não completam a fase
  s = await api('/api/run/start', { method: 'POST', token: t, body: { mode: 'level', levelId: '1-1' } });
  advanceClock(60000);
  f = await api('/api/run/finish', { method: 'POST', token: t, body: { runId: s.data.runId, inputs: [[2, 100]] } });
  assert.equal(f.data.valid, false);
  assert.equal(f.data.reason, 'fase_nao_concluida');

  // formato malicioso
  s = await api('/api/run/start', { method: 'POST', token: t, body: { mode: 'level', levelId: '1-1' } });
  advanceClock(60000);
  f = await api('/api/run/finish', { method: 'POST', token: t, body: { runId: s.data.runId, inputs: [[99, -5]] } });
  assert.equal(f.data.reason, 'entradas_invalidas');

  // válido
  s = await api('/api/run/start', { method: 'POST', token: t, body: { mode: 'level', levelId: '1-1' } });
  advanceClock(60000);
  f = await api('/api/run/finish', { method: 'POST', token: t, body: { runId: s.data.runId, inputs: sol['1-1'].inputs } });
  assert.equal(f.data.valid, true, JSON.stringify(f.data));
  assert.equal(f.data.timeMs, Math.round(sol['1-1'].ticks * 1000 / 60));
  assert.ok(f.data.score > 1000);
  assert.ok(f.data.firstClear);
  assert.ok(f.data.reward >= 55);
  assert.ok(f.data.achievements.some((a) => a.id === 'first_clear'));
  // reenviar a mesma tentativa
  const again = await api('/api/run/finish', { method: 'POST', token: t, body: { runId: s.data.runId, inputs: sol['1-1'].inputs } });
  assert.equal(again.status, 409);

  // agora a 1-2 desbloqueia
  s = await api('/api/run/start', { method: 'POST', token: t, body: { mode: 'level', levelId: '1-2' } });
  assert.equal(s.status, 200);

  const rk = await api('/api/rankings?type=world', { token: t });
  assert.equal(rk.data.entries[0].username, 'Bruno');
  assert.equal(rk.data.me.rank, 1);
  const sp = await api('/api/rankings?type=speed&level=1-1');
  assert.equal(sp.data.entries[0].value, f.data.timeMs);
  const pt = await api('/api/rankings?type=country&country=PT');
  assert.equal(pt.data.entries.length, 1);
  const br = await api('/api/rankings?type=country&country=BR');
  assert.equal(br.data.entries.length, 0);
  const eu = await api('/api/rankings?type=continent&continent=EU');
  assert.equal(eu.data.entries[0].username, 'Bruno');
  for (const type of ['weekly', 'monthly', 'history', 'distance', 'totaltime', 'daily', 'event', 'races']) {
    const r = await api('/api/rankings?type=' + type, { token: t });
    assert.equal(r.status, 200, type);
  }
  const wk = await api('/api/rankings?type=weekly', { token: t });
  assert.equal(wk.data.entries[0].username, 'Bruno');
  const top = await api('/api/top3');
  assert.equal(top.data.top3[0].username, 'Bruno');
  const ghost = await api('/api/ghost?level=1-1&who=wr', { token: t });
  assert.deepEqual(ghost.data.ghost.inputs, sol['1-1'].inputs);
  const lv = await api('/api/levels');
  assert.equal(lv.data.records['1-1'].username, 'Bruno');
});

test('modo infinito valida a distância re-simulando a semente do servidor', async () => {
  const t = await register('Carla', 'JP');
  const s = await api('/api/run/start', { method: 'POST', token: t, body: { mode: 'endless' } });
  assert.ok(s.data.seed > 0);
  const lvl = buildLevel('endless', 'endless', s.data.seed);
  const r = solve(lvl, { width: 120, maxTicks: 60 * 20 });
  const inputs = r.ok ? r.inputs : null;
  // o solver não termina o infinito; usamos a melhor sequência: correr para a direita pulando
  const seq = inputs || [[2, 600]];
  advanceClock(30000);
  const f = await api('/api/run/finish', { method: 'POST', token: t, body: { runId: s.data.runId, inputs: seq } });
  assert.equal(f.data.valid, true, JSON.stringify(f.data));
  assert.ok(f.data.distance >= 0);
  const d = await api('/api/rankings?type=distance', { token: t });
  assert.equal(d.status, 200);
});

test('desafio diário: percurso do dia validado e ranqueado', async () => {
  const t = await register('Dani', 'MX');
  const s = await api('/api/run/start', { method: 'POST', token: t, body: { mode: 'daily' } });
  assert.match(s.data.levelId, /^daily-\d{4}-\d{2}-\d{2}$/);
  const r = solve(buildLevel('daily', s.data.levelId), { width: 300, maxTicks: 60 * 120 });
  assert.ok(r.ok);
  advanceClock(Math.ceil(r.ticks * 1000 / 60) + 2000);
  const f = await api('/api/run/finish', { method: 'POST', token: t, body: { runId: s.data.runId, inputs: r.inputs } });
  assert.equal(f.data.valid, true, JSON.stringify(f.data));
  const rk = await api('/api/rankings?type=daily', { token: t });
  assert.equal(rk.data.entries[0].username, 'Dani');
  const ch = await api('/api/challenges', { token: t });
  assert.equal(ch.data.daily.myBest, f.data.timeMs);
});

test('loja: comprar e equipar sem vantagem competitiva', async () => {
  const t = await register('Duda');
  const shop = await api('/api/shop', { token: t });
  assert.equal(shop.data.coins, 100);
  let r = await api('/api/shop/buy', { method: 'POST', token: t, body: { itemId: 'skin_gold' } });
  assert.equal(r.status, 402);
  r = await api('/api/shop/buy', { method: 'POST', token: t, body: { itemId: 'skin_legend' } });
  assert.equal(r.status, 400);
  r = await api('/api/equip', { method: 'POST', token: t, body: { slot: 'skin', itemId: 'skin_mint' } });
  assert.equal(r.status, 403);
  await app.db.run('UPDATE users SET coins=1000 WHERE username=$1', ['Duda']);
  r = await api('/api/shop/buy', { method: 'POST', token: t, body: { itemId: 'skin_mint' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.coins, 1000 - 150 + 30); // preço + conquista 'Estiloso'
  assert.ok(r.data.achievements.some((a) => a.id === 'shopper'));
  r = await api('/api/shop/buy', { method: 'POST', token: t, body: { itemId: 'skin_mint' } });
  assert.equal(r.status, 409);
  r = await api('/api/equip', { method: 'POST', token: t, body: { slot: 'skin', itemId: 'skin_mint' } });
  assert.equal(r.data.equipped.skin, 'skin_mint');
});

test('amigos: pedido e aceite', async () => {
  const a = await register('Edu');
  const b = await register('Fabi');
  let r = await api('/api/friends/request', { method: 'POST', token: a, body: { username: 'fabi' } });
  assert.equal(r.data.status, 'pending');
  r = await api('/api/friends', { token: b });
  assert.equal(r.data.incoming[0].username, 'Edu');
  r = await api('/api/friends/accept', { method: 'POST', token: b, body: { username: 'Edu' } });
  assert.equal(r.data.status, 'accepted');
  r = await api('/api/friends', { token: a });
  assert.equal(r.data.friends[0].username, 'Fabi');
});

test('temporada: recompensas por posição são entregues uma única vez', async () => {
  // temporada antiga (a do mês passado já foi finalizada vazia quando o servidor iniciou)
  let prev = seasonId();
  for (let k = 0; k < 6; k++) prev = prevSeasonId(prev);
  const { start } = seasonRange(prev);
  const users = await app.db.all('SELECT id, username FROM users ORDER BY username', []);
  let i = 0;
  for (const u of users) {
    await app.db.run(
      "INSERT INTO runs (id, user_id, mode, level_id, created_at, finished_at, status, score) VALUES ($1,$2,'level','1-1',$3,$3,'valid',$4)",
      ['old' + i, u.id, start + 1000 + i, 5000 - i * 100]);
    i++;
  }
  const r1 = await finalizeSeason(app.db, prev);
  assert.ok(r1 && r1.awarded === users.length);
  const r2 = await finalizeSeason(app.db, prev);
  assert.equal(r2, null);
  const champ = await app.db.get("SELECT u.username FROM medals m JOIN users u ON u.id=m.user_id WHERE m.kind='season_gold' AND m.period=$1", [prev]);
  assert.equal(champ.username, users[0].username);
  const inv = await app.db.get("SELECT 1 AS x FROM inventory i JOIN users u ON u.id=i.user_id WHERE u.username=$1 AND item_id='frame_champion'", [users[0].username]);
  assert.ok(inv);
  const hist = await api('/api/rankings?type=history');
  assert.ok(hist.data.champions.some((c) => c.kind === 'season_gold'));
});

function wsClient(token) {
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws');
  const msgs = [];
  const waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    msgs.push(m);
    for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.res(m); }
  });
  const wait = (pred, ms = 15000) => new Promise((res, rej) => {
    const found = msgs.find(pred);
    if (found) { msgs.splice(msgs.indexOf(found), 1); return res(found); }
    const w = { pred, res: (m) => { msgs.splice(msgs.indexOf(m), 1); clearTimeout(timer); res(m); } };
    const timer = setTimeout(() => rej(new Error('timeout esperando mensagem')), ms);
    waiters.push(w);
  });
  return new Promise((res) => ws.on('open', () => { ws.send(JSON.stringify({ t: 'auth', token })); res({ ws, wait, send: (m) => ws.send(JSON.stringify(m)) }); }));
}

test('multiplayer: matchmaking, corrida e resultado validado', async () => {
  const ta = await register('Gabi', 'AR');
  const tb = await register('Hugo', 'US');
  const a = await wsClient(ta);
  const b = await wsClient(tb);
  await a.wait((m) => m.t === 'hello');
  await b.wait((m) => m.t === 'hello');
  a.send({ t: 'queue' });
  b.send({ t: 'queue' });
  const sa = await a.wait((m) => m.t === 'start', 20000);
  await b.wait((m) => m.t === 'start', 20000);
  const lvl = buildLevel('race', sa.levelId);
  const r = solve(lvl, { width: 300, maxTicks: 60 * 120 });
  assert.ok(r.ok);
  advanceClock(5000 + Math.ceil(r.ticks * 1000 / 60) + 1000);
  a.send({ t: 'finish', inputs: r.inputs });
  b.send({ t: 'finish', inputs: [[2, 30]] }); // não termina => DNF
  const res = await a.wait((m) => m.t === 'results');
  assert.equal(res.results[0].username, 'Gabi');
  assert.equal(res.results[0].place, 1);
  assert.ok(res.results[0].ratingDelta > 0);
  assert.equal(res.results[1].dnf, true);
  const races = await api('/api/rankings?type=races');
  assert.equal(races.data.entries[0].username, 'Gabi');

  // sala privada + convite
  a.send({ t: 'create' });
  const room = await a.wait((m) => m.t === 'room' && m.code && m.players.length === 1);
  a.send({ t: 'invite', username: 'hugo' });
  const inv = await b.wait((m) => m.t === 'invite');
  assert.equal(inv.code, room.code);
  b.send({ t: 'join', code: inv.code });
  await a.wait((m) => m.t === 'room' && m.players.length === 2);
  a.ws.close(); b.ws.close();
});
