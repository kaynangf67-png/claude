// Sessão de jogo: loop de passo fixo (60 Hz), gravação das entradas,
// fantasmas, HUD, corrida online e envio do resultado para validação.
import { TPS, VIEW_W, VIEW_H, ticksToMs, fmtTime, TILE } from '/shared/constants.js';
import { createSim, step } from '/shared/sim.js';
import { InputRecorder, expandRle } from '/shared/replay.js';
import { buildLevel, endlessDistance } from '/shared/modes.js';
import { levelMeta, LEVEL_IDS } from '/shared/levels.js';
import { levelMedal } from '/shared/scoring.js';
import { ITEM_MAP } from '/shared/items.js';
import { BOSSES } from '/shared/entities.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { drawText, drawTextCentered, textWidth } from './font.js';
import { sfx, playMusic, stopMusic } from './audio.js';
import { api } from './api.js';

const STEP_MS = 1000 / TPS;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class GameSession {
  constructor(app, opts) {
    this.app = app;
    this.opts = opts;
    this.mode = opts.mode;
    this.levelId = opts.levelId;
    this.root = document.getElementById('game-wrap');
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.renderer.shakeOn = app.settings.shake !== false;
    this.input = new Input();
    this.input.on('restart', () => this.restart());
    this.input.on('pause', () => this.togglePause());
    this.input.on('emote', (i) => this.sendEmote(i));
    this.running = false;
    this.paused = false;
    this.ghosts = [];
    this.others = new Map();
    this.emotes = [];
    this.raf = 0;
    this.unsubs = [];
    this.overlay = this.root.querySelector('.game-overlay');
    this.input.bindTouch(this.root);
    this.onVis = () => { if (document.hidden && this.running && !this.opts.race && !this.paused && this.sim && !this.done) this.togglePause(); };
    document.addEventListener('visibilitychange', this.onVis);
  }

  async begin() {
    this.root.classList.add('active');
    this.root.classList.toggle('touch', this.app.isTouch());
    this.input.enabled = true;
    this.cos = this.app.me ? this.app.me.equipped : {};
    this.renderer.setCosmetics(this.cos);
    if (this.opts.race) return this.beginRace();
    this.showMessage('Preparando...');
    try {
      const tok = await (this.nextRun || this.requestRun());
      this.nextRun = null;
      this.setupRun(tok);
      if (this.opts.ghosts && this.mode !== 'endless') this.loadGhosts();
      this.nextRun = this.requestRun().catch(() => null);
      this.startLoop();
    } catch (e) {
      this.showError(e.message);
    }
  }

  requestRun() {
    return api('/api/run/start', { method: 'POST', body: { mode: this.mode, levelId: this.levelId } });
  }

  setupRun(tok) {
    this.run = tok;
    this.levelId = tok.levelId;
    this.level = buildLevel(this.mode, tok.levelId, tok.seed);
    this.sim = createSim(this.level);
    this.rec = new InputRecorder();
    this.renderer.reset(this.level, this.cos);
    this.done = false;
    this.result = null;
    this.readyT = 50; // contagem "VAI!" antes de liberar a física
    this.endT = 0;
    this.meta = this.mode === 'level' ? levelMeta(tok.levelId) : null;
    this.title = this.opts.title || (this.meta ? `${this.meta.id}  ${this.meta.name}` : this.level.name);
    for (const g of this.ghosts) g.sim = createSim(this.level);
    this.hideOverlay();
    playMusic(this.mode === 'level' ? this.meta.world : 0);
  }

  async loadGhosts() {
    const want = [];
    if (this.opts.ghosts.includes('wr')) want.push(['wr', 'RECORDE', '#ffd23f']);
    if (this.opts.ghosts.includes('pb')) want.push(['pb', 'VOCÊ', '#7fe0ff']);
    for (const [who, label, color] of want) {
      try {
        const { ghost } = await api(`/api/ghost?level=${encodeURIComponent(this.levelId)}&who=${who}`);
        if (!ghost) continue;
        if (who === 'pb' && this.ghosts.some((g) => g.username === ghost.username && g.timeMs === ghost.timeMs)) continue;
        this.ghosts.push({
          username: ghost.username, timeMs: ghost.timeMs, label: who === 'wr' ? `${label} ${ghost.username}` : label,
          color, inputs: expandRle(ghost.inputs), sim: createSim(this.level), skin: 'skin_ghost',
        });
      } catch { /* sem fantasma */ }
    }
  }

  // ------------------------------------------------------------ corrida online
  beginRace() {
    const r = this.opts.race;
    const live = this.app.live;
    this.level = buildLevel('race', r.levelId);
    this.levelId = r.levelId;
    this.sim = createSim(this.level);
    this.rec = new InputRecorder();
    this.renderer.reset(this.level, this.cos);
    this.done = false;
    this.title = 'CORRIDA ONLINE';
    this.readyT = 0;
    this.raceStartAt = r.startAt;
    this.raceFinished = [];
    this.hideOverlay();
    playMusic(0);
    this.unsubs.push(live.on('pos', (m) => {
      let o = this.others.get(m.u);
      if (!o) { o = { username: m.u, x: m.x, y: m.y, skin: this.opts.race.skins?.[m.u] }; this.others.set(m.u, o); }
      o.tx = m.x; o.ty = m.y; o.f = m.f; o.a = m.a; o.k = m.k;
    }));
    this.unsubs.push(live.on('pfinish', (m) => { this.raceFinished.push(m); if (m.username !== this.app.me.user.username) sfx.beep(); }));
    this.unsubs.push(live.on('emote', (m) => {
      const o = this.others.get(m.u);
      if (o) this.emotes.push({ text: m.text, who: m.u, life: 120 });
    }));
    this.unsubs.push(live.on('results', (m) => this.showRaceResults(m)));
    this.unsubs.push(live.on('rejected', (m) => this.app.toast('Resultado rejeitado pelo servidor: ' + m.reason, 'error')));
    this.startLoop();
  }

  sendEmote(i) {
    if (!this.opts.race || !this.app.me) return;
    const emotes = this.app.me.inventory.filter((id) => ITEM_MAP[id]?.slot === 'emote');
    const eq = this.app.me.equipped.emote;
    const ordered = [eq, ...emotes.filter((e) => e !== eq)];
    const id = ordered[i];
    if (!id) return;
    this.app.live.send({ t: 'emote', id });
    this.emotes.push({ text: ITEM_MAP[id].text, who: null, life: 120 });
  }

  // ------------------------------------------------------------ loop
  startLoop() {
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    cancelAnimationFrame(this.raf);
    const frame = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(frame);
      let dt = now - this.last;
      this.last = now;
      if (dt > 250) dt = 250;
      if (!this.paused) {
        this.acc += dt;
        let n = 0;
        while (this.acc >= STEP_MS && n < 8) { this.tick(); this.acc -= STEP_MS; n++; }
        if (n === 8) this.acc = 0;
      }
      this.draw();
    };
    this.raf = requestAnimationFrame(frame);
  }

  tick() {
    const s = this.sim.s;
    if (this.opts.race) {
      const now = this.app.live.serverNow();
      if (now < this.raceStartAt) {
        const left = Math.ceil((this.raceStartAt - now) / 1000);
        if (left !== this.lastCount) { this.lastCount = left; sfx.beep(); }
        return;
      }
      if (!this.raceGo) { this.raceGo = true; sfx.go(); }
      // corrida usa o relógio do servidor: compensa atrasos de quadro
    } else if (this.readyT > 0) {
      this.readyT--;
      if (this.readyT === 0) sfx.go();
      return;
    }
    if (this.done) {
      this.endT++;
      return;
    }
    const mask = this.input.mask();
    this.rec.push(mask);
    step(this.sim, mask);
    if (s.ev.length) {
      this.renderer.onEvents(this.sim, s.ev);
      for (const ev of s.ev) if (sfx[ev]) sfx[ev]();
    }
    const k = this.rec.ticks - 1;
    for (const g of this.ghosts) {
      if (!g.sim.s.finished && k < g.inputs.length) step(g.sim, g.inputs[k]);
    }
    if (this.opts.race && this.rec.ticks % 4 === 0) {
      const p = s.p;
      this.app.live.send({ t: 'pos', x: p.x, y: p.y, f: p.face, a: p.dead ? 'dead' : p.onGround ? 'run' : 'air', k: this.rec.ticks });
    }
    if (s.finished || s.over) this.onRunEnd();
  }

  draw() {
    // interpolação dos outros jogadores
    for (const o of this.others.values()) {
      if (o.tx == null) continue;
      const dx = o.tx - o.x;
      o.vx = dx * 0.35;
      o.x += dx * 0.35; o.y += (o.ty - o.y) * 0.35;
    }
    const em = [];
    for (const e of this.emotes) {
      e.life--;
      const src = e.who ? this.others.get(e.who) : this.sim.s.p;
      if (src) em.push({ text: e.text, x: src.x + 5, y: src.y });
    }
    this.emotes = this.emotes.filter((e) => e.life > 0);
    this.renderer.draw(this.sim, {
      ghosts: this.app.settings.ghosts === false ? [] : this.ghosts,
      others: [...this.others.values()], emotes: em, hud: (g) => this.drawHud(g),
    });
  }

  drawHud(g) {
    const s = this.sim.s;
    const ticks = s.finished ? s.finishT : s.t;
    const ms = ticksToMs(ticks);
    // barra superior
    g.fillStyle = 'rgba(10,8,24,0.55)';
    g.fillRect(0, 0, VIEW_W, 14);
    drawText(g, this.title.slice(0, 34), 4, 4, '#ffffff', 1, '#000');
    if (this.mode === 'endless') {
      const d = endlessDistance(this.level, this.sim);
      const t = `${d} M`;
      drawText(g, t, VIEW_W - textWidth(t, 2) - 6, 18, '#ffd23f', 2);
      const best = this.app.me?.user.endlessBest || 0;
      drawText(g, `RECORDE ${best} M`, VIEW_W - textWidth(`RECORDE ${best} M`) - 6, 36, '#9fe3ff');
    } else {
      const ts = fmtTime(ms);
      drawText(g, ts, VIEW_W - textWidth(ts) - 4, 4, s.finished ? '#3ee07a' : '#ffd23f');
    }
    // mortes e moedas
    const info = `x${s.deaths}`;
    g.fillStyle = '#fff'; g.fillRect(4, 18, 5, 5); g.fillStyle = '#000'; g.fillRect(5, 20, 1, 1); g.fillRect(7, 20, 1, 1);
    drawText(g, info, 12, 17, '#fff');
    g.fillStyle = '#ffd23f'; g.fillRect(4, 28, 5, 5); g.fillStyle = '#fff4b8'; g.fillRect(5, 29, 1, 2);
    drawText(g, `x${s.coinCount}`, 12, 27, '#ffd23f');

    // chefe
    if (s.boss && !s.boss.defeated) {
      const b = s.boss;
      const name = (BOSSES[b.kind] || BOSSES.golem).name;
      const w = 140;
      const x = (VIEW_W - w) / 2;
      drawTextCentered(g, name, VIEW_W / 2, 18, '#ffb3c0');
      g.fillStyle = '#000'; g.fillRect(x - 1, 27, w + 2, 6);
      g.fillStyle = '#4a0d1a'; g.fillRect(x, 28, w, 4);
      g.fillStyle = '#ff3d6e'; g.fillRect(x, 28, Math.round((w * b.hp) / b.maxHp), 4);
    }

    // comparação com fantasmas
    if (this.ghosts.length && !s.finished) {
      let y = 40;
      for (const gh of this.ghosts) {
        drawText(g, `${gh.label.slice(0, 18)} ${fmtTime(gh.timeMs)}`, 4, y, gh.color);
        y += 9;
      }
    }

    // corrida: posição dos rivais
    if (this.opts.race) {
      let y = 40;
      const me = this.app.me.user.username;
      const list = [{ username: me, x: this.sim.s.maxX, me: true }, ...[...this.others.values()].map((o) => ({ username: o.username, x: o.x }))];
      list.sort((a, b) => b.x - a.x);
      list.forEach((o, i) => {
        const fin = this.raceFinished.find((f) => f.username === o.username);
        drawText(g, `${i + 1}. ${o.username}${fin ? ' ' + fmtTime(fin.timeMs) : ''}`, 4, y, o.me ? '#7fe0ff' : '#ffe680');
        y += 9;
      });
      const now = this.app.live.serverNow();
      if (now < this.raceStartAt) {
        const left = Math.ceil((this.raceStartAt - now) / 1000);
        drawTextCentered(g, String(left), VIEW_W / 2, 80, '#ffd23f', 5);
      } else if (now < this.raceStartAt + 800) drawTextCentered(g, 'VAI!', VIEW_W / 2, 80, '#3ee07a', 5);
      const total = isFinite(this.level.widthPx) ? this.level.widthPx : 1;
      // barra de progresso
      const bw = 200, bx = (VIEW_W - bw) / 2, by = VIEW_H - 10;
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(bx, by, bw, 4);
      for (const o of list) {
        g.fillStyle = o.me ? '#7fe0ff' : '#ffe680';
        g.fillRect(bx + Math.min(bw - 2, Math.round((o.x / total) * bw)), by - 1, 2, 6);
      }
    } else if (this.readyT > 0) {
      drawTextCentered(g, this.readyT > 20 ? 'PRONTO?' : 'VAI!', VIEW_W / 2, 84, this.readyT > 20 ? '#ffffff' : '#3ee07a', 4);
    }
    if (this.done && !this.opts.race && this.mode !== 'endless') {
      drawTextCentered(g, 'CHEGADA!', VIEW_W / 2, 70, '#ffd23f', 4);
    }
    if (this.mode === 'endless' && this.sim.s.over) drawTextCentered(g, 'FIM DE JOGO', VIEW_W / 2, 80, '#ff3d6e', 4);
  }

  // ------------------------------------------------------------ fim da tentativa
  async onRunEnd() {
    if (this.done) return;
    this.done = true;
    const s = this.sim.s;
    if (s.finished) { this.renderer.startVictory(); sfx.finish(); }
    if (this.opts.race) {
      this.app.live.send({ t: 'finish', inputs: this.rec.rle });
      this.showMessage('Chegada! Validando no servidor e aguardando os outros corredores...', [['Desistir da sala', () => this.exit()]]);
      return;
    }
    const runId = this.run.runId;
    const inputs = this.rec.rle;
    await new Promise((r) => setTimeout(r, this.mode === 'endless' ? 900 : 1200));
    if (!this.running) return;
    this.showMessage('Validando seu resultado no servidor...');
    try {
      const res = await api('/api/run/finish', { method: 'POST', body: { runId, inputs } });
      this.result = res;
      if (res.valid) {
        if (res.worldRecord) sfx.record();
        this.app.onRunResult?.(res);
      }
      this.showResults(res);
    } catch (e) {
      this.showError('Não foi possível enviar o resultado: ' + e.message, true);
    }
  }

  async restart() {
    if (this.opts.race || !this.running) return;
    if (this.done && !this.result && this.overlay.classList.contains('busy')) return;
    this.paused = false;
    try {
      this.showMessage('Reiniciando...');
      const tok = await (this.nextRun || this.requestRun());
      this.nextRun = this.requestRun().catch(() => null);
      if (!tok) throw new Error('Falha ao iniciar');
      this.setupRun(tok);
      this.readyT = 30;
    } catch (e) {
      this.nextRun = null;
      this.showError(e.message);
    }
  }

  togglePause() {
    if (!this.running || this.done) return;
    if (this.paused) { this.paused = false; this.hideOverlay(); this.last = performance.now(); return; }
    this.paused = !this.opts.race; // na corrida o tempo não para
    const btns = this.opts.race
      ? [['Voltar à corrida', () => { this.hideOverlay(); }], ['Desistir', () => { this.app.live.send({ t: 'giveup' }); this.exit(); }]]
      : [['Continuar', () => this.togglePause()], ['Reiniciar (R)', () => this.restart()], ['Sair', () => this.exit()]];
    this.showMessage(this.opts.race ? 'Menu (a corrida continua!)' : 'PAUSADO', btns, 'pause');
  }

  // ------------------------------------------------------------ overlays
  hideOverlay() { this.overlay.className = 'game-overlay'; this.overlay.innerHTML = ''; }

  showMessage(text, buttons = [], cls = 'busy') {
    this.overlay.className = 'game-overlay show ' + cls;
    this.overlay.innerHTML = `<div class="panel"><p>${esc(text)}</p><div class="row">${buttons.map((b, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-i="${i}">${esc(b[0])}</button>`).join('')}</div></div>`;
    this.overlay.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { sfx.click(); buttons[+b.dataset.i][1](); }));
    const first = this.overlay.querySelector('button');
    if (first) first.focus();
  }

  showError(msg, canRetry = false) {
    const btns = [['Voltar ao menu', () => this.exit()]];
    if (canRetry) btns.unshift(['Tentar novamente', () => this.restart()]);
    this.showMessage(msg, btns, 'error');
  }

  showResults(res) {
    const lines = [];
    let title;
    if (!res.valid) {
      title = 'Resultado rejeitado';
      const why = {
        tempo_real_incompativel: 'O tempo real não corresponde ao tempo da partida (possível alteração de velocidade).',
        fase_nao_concluida: 'As entradas enviadas não completam a fase.',
        entradas_invalidas: 'Dados de entrada inválidos.',
      }[res.reason] || res.reason;
      lines.push(`<p class="bad">${esc(why)}</p>`);
    } else if (res.mode === 'endless') {
      title = res.newBest ? 'NOVO RECORDE PESSOAL!' : 'Fim de jogo';
      lines.push(`<div class="big">${res.distance} m</div>`);
      lines.push(`<p>Pontuação: <b>${res.score}</b> · Posição no ranking de distância: <b>#${res.levelRank}</b></p>`);
    } else {
      title = res.worldRecord ? '🏆 RECORDE MUNDIAL!' : res.newBest ? 'Novo recorde pessoal!' : 'Fase concluída!';
      const medal = this.meta ? levelMedal(this.meta.par, res.timeMs) : null;
      lines.push(`<div class="big">${fmtTime(res.timeMs)}</div>`);
      if (medal) lines.push(`<div class="medal m-${medal}">Medalha ${medal.toUpperCase()}</div>`);
      const pb = res.prevBestMs != null ? ` · Recorde anterior: ${fmtTime(res.prevBestMs)}` : '';
      lines.push(`<p>Mortes: <b>${res.deaths}</b> · Moedas: <b>${res.coins}</b>${pb}</p>`);
      lines.push(`<p>Posição nesta fase: <b>#${res.levelRank}</b>${res.score ? ` · Pontos: <b>${res.score}</b>` : ''}</p>`);
    }
    if (res.valid) {
      lines.push(`<p class="ok">✔ Validado pelo servidor${res.globalRank ? ` · Ranking mundial: <b>#${res.globalRank}</b>` : ''}</p>`);
      if (res.reward) lines.push(`<p class="coins">+${res.reward} moedas</p>`);
      for (const a of res.achievements || []) lines.push(`<p class="ach">🏅 Conquista: <b>${esc(a.name)}</b> (+${a.reward})</p>`);
    }
    const btns = [['Tentar de novo (R)', () => this.restart()]];
    if (this.mode === 'level' && res.valid) {
      const i = LEVEL_IDS.indexOf(this.levelId);
      if (i >= 0 && i < LEVEL_IDS.length - 1) btns.push(['Próxima fase', () => this.app.startLevel(LEVEL_IDS[i + 1], this.opts)]);
    }
    btns.push(['Menu', () => this.exit()]);
    this.overlay.className = 'game-overlay show results';
    this.overlay.innerHTML = `<div class="panel"><h2>${esc(title)}</h2>${lines.join('')}<div class="row">${btns.map((b, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-i="${i}">${esc(b[0])}</button>`).join('')}</div></div>`;
    this.overlay.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { sfx.click(); btns[+b.dataset.i][1](); }));
  }

  showRaceResults(m) {
    this.done = true;
    const me = this.app.me.user.username;
    const rows = m.results.map((r) => `<tr class="${r.username === me ? 'me' : ''}"><td>${r.place ? r.place + 'º' : '—'}</td><td>${esc(r.username)}</td>
      <td>${r.dnf ? 'Não terminou' : fmtTime(r.timeMs)}</td><td>${m.rated ? (r.ratingDelta >= 0 ? '+' : '') + r.ratingDelta : '—'}</td><td>${r.reward ? '+' + r.reward : ''}</td></tr>`).join('');
    const mine = m.results.find((r) => r.username === me);
    if (mine && mine.place === 1) sfx.record();
    this.overlay.className = 'game-overlay show results';
    this.overlay.innerHTML = `<div class="panel"><h2>${mine && mine.place === 1 ? '🏆 VITÓRIA!' : 'Resultado da corrida'}</h2>
      <table class="race-res"><thead><tr><th>#</th><th>Jogador</th><th>Tempo</th><th>Rating</th><th>Moedas</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="ok">✔ Tempos validados pelo servidor${m.rated ? '' : ' · partida não ranqueada (1 jogador)'}</p>
      <div class="row"><button class="btn primary" data-a="lobby">Voltar à sala</button><button class="btn" data-a="menu">Menu</button></div></div>`;
    this.overlay.querySelector('[data-a=lobby]').onclick = () => { this.exit(false); this.app.show('multiplayer'); };
    this.overlay.querySelector('[data-a=menu]').onclick = () => { this.app.live.send({ t: 'leave' }); this.exit(); };
    this.app.refreshMe();
  }

  exit(toMenu = true) {
    this.destroy();
    if (toMenu) this.app.afterGame(this.opts);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    document.removeEventListener('visibilitychange', this.onVis);
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.root.classList.remove('active');
    this.hideOverlay();
    stopMusic();
    if (this.app.game === this) this.app.game = null;
  }
}
