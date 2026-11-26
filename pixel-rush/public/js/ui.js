// Interface do ESTRESSE: telas, navegação e integração com a API.
import { api, auth, Live } from './api.js';
import { GameSession } from './game.js';
import { DemoView, DanceView } from './demo.js';
import { avatarURL, skinAvatarURL, heroFrames, petSprite } from './sprites.js';
import { logoCanvas, trophyURL, AnimatedTitle } from './art.js';
import { ditherCanvas, noEmoji } from './mono.js';
import { initAudio, setVolumes, sfx, playMusic, audioReady } from './audio.js';
import { fmtTime } from '/shared/constants.js';
import { COUNTRIES, COUNTRY_MAP, CONTINENTS, BR_STATES, flagEmoji } from '/shared/countries.js';
import { ITEMS, ITEM_MAP, SLOTS, AVATARS, GEM_PACKS } from '/shared/items.js';
import { LEVEL_DEFS, WORLDS, LEVEL_IDS, levelMeta } from '/shared/levels.js';
import { levelMedal, MEDALS } from '/shared/scoring.js';
import { ACHIEVEMENTS } from '/shared/achievements.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lvNum = (id) => LEVEL_IDS.indexOf(id);
// ícones das duas moedas (SVG, não somem com o filtro de emojis)
const COIN = '<svg class="cur-ico" viewBox="0 0 16 16" aria-label="moedas"><circle cx="8" cy="8" r="7" fill="#b8860b"/><circle cx="8" cy="8" r="5.6" fill="#ffd23f"/><rect x="7" y="4.5" width="2" height="7" rx="1" fill="#b8860b"/></svg>';
const GEM = '<svg class="cur-ico" viewBox="0 0 16 16" aria-label="diamantes"><path d="M4 2h8l3 4-7 8-7-8z" fill="#3ee0ff"/><path d="M4 2l2 4h4l2-4M1 6h14M6 6l2 8 2-8" fill="none" stroke="#0b6f8a" stroke-width="1"/><path d="M5 3l1 2" stroke="#fff" stroke-width="1"/></svg>';
const priceTag = (it) => `${it.cur === 'gem' ? GEM : COIN}<b>${Number(it.price).toLocaleString('pt-BR')}</b>`;
const num = (n) => Number(n || 0).toLocaleString('pt-BR');
const flag = (c) => (COUNTRY_MAP[c] ? `<img class="flag-img" src="/flags/${c.toLowerCase()}.svg" alt="${esc(COUNTRY_MAP[c].name)}" title="${esc(COUNTRY_MAP[c].name)}">` : '');
const avatar = (id, frame = 'frame_none', cls = '', skin = null) => `<img class="avatar ${cls} ${esc(ITEM_MAP[frame]?.css || 'frame-none')}" src="${skin ? skinAvatarURL(skin, 64) : avatarURL(id || 'a1', 64)}" alt="">`;
const fmtDur = (ms) => { const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h ? `${h}h ${m}min` : `${m}min ${Math.floor((ms % 60000) / 1000)}s`; };
function countdown(ts) {
  const d = Math.max(0, ts - Date.now());
  const days = Math.floor(d / 86400000), h = Math.floor((d % 86400000) / 3600000), m = Math.floor((d % 3600000) / 60000), s = Math.floor((d % 60000) / 1000);
  return (days ? `${days}d ` : '') + `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function fmtValue(v, unit) {
  if (v == null) return '—';
  if (unit === 'time') return fmtTime(v);
  if (unit === 'm') return `${num(v)} m`;
  if (unit === 'rating') return `${num(v)}`;
  return `${num(v)} pts`;
}

const RANK_TABS = [['world', 'Global'], ['regional', 'Regional']];
const RANK_TYPES = ['world', 'regional', 'brasil', 'country', 'continent', 'weekly', 'monthly', 'history', 'speed', 'distance', 'totaltime', 'daily', 'event'];

export class App {
  constructor() {
    this.ui = $('#ui');
    this.me = null;
    this.game = null;
    this.live = new Live();
    this.settings = { music: 0.35, sfx: 0.6, shake: true, ghosts: true, touch: 'auto', storyGhosts: false, ...JSON.parse(localStorage.getItem('pixelrush.settings') || '{}') };
    setVolumes(this.settings);
    this.mp = { queued: false, size: 0, room: null };
    this.timers = [];
    this.views = [];
    this.levelsCache = null;
    document.addEventListener('pointerdown', () => initAudio(), { once: false });
    window.addEventListener('hashchange', () => this.route());
    $('#btn-pause').addEventListener('click', () => this.game?.togglePause());
    setInterval(() => {
      for (const el of document.querySelectorAll('[data-countdown]')) el.textContent = countdown(Number(el.dataset.countdown));
    }, 1000);
    this.bindLive();
    const strip = (node) => {
      const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) { const v = noEmoji(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; }
    };
    new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) strip(n); else if (n.nodeType === 3) strip(n.parentNode || n); })
      .observe(document.body, { childList: true, subtree: true });
  }

  isTouch() {
    if (this.settings.touch === 'on') return true;
    if (this.settings.touch === 'off') return false;
    return matchMedia('(pointer: coarse)').matches;
  }

  saveSettings() {
    localStorage.setItem('pixelrush.settings', JSON.stringify(this.settings));
    setVolumes(this.settings);
  }

  async init() {
    if (/access_token=|error_description=/.test(location.hash + location.search)) await this.finishSocialLogin();
    if (auth.token) {
      try { await this.refreshMe(); }
      catch { auth.token = null; }
    }
    this.route();
    if (this.pendingAuthError) { const el = document.getElementById('auth-err'); if (el) el.textContent = this.pendingAuthError; this.pendingAuthError = null; }
  }

  async refreshMe() {
    this.me = await api('/api/me');
    this.updateTopbar();
    return this.me;
  }

  // ------------------------------------------------------------ navegação
  go(path) { if (location.hash === '#/' + path) this.route(); else location.hash = '#/' + path; }
  show(path) { this.go(path); }

  route() {
    if (this.game) return; // durante o jogo a interface fica por baixo
    const [path, qs] = (location.hash.replace(/^#\/?/, '') || 'home').split('?');
    const [name, ...rest] = path.split('/');
    this.hashQuery = new URLSearchParams(qs || '');
    const modal = document.getElementById('modal');
    if (modal && !modal.hidden) { modal.hidden = true; modal.innerHTML = ''; } // janelas não ficam abertas entre páginas
    this.menuMusic();
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    for (const v of this.views) v.stop();
    this.views = [];
    if (!this.me && name !== 'auth') return this.renderAuth();
    const screens = {
      auth: () => this.renderAuth(), home: () => this.renderHome(),
      ranking: () => this.renderRanking(rest[0]), customize: () => this.renderVault(rest[0]), vault: () => this.renderVault(rest[0]), shop: () => this.renderShop(rest[0]),
      profile: () => this.renderProfile(rest[0] ? decodeURIComponent(rest[0]) : null), settings: () => this.renderSettings(),
    };
    document.body.classList.toggle('is-home', !screens[name] || name === 'home');
    (screens[name] || screens.home)();
    window.scrollTo(0, 0);
  }

  // trilha do menu (composição própria em chiptune); o navegador só libera som após um clique/tecla
  menuMusic() {
    if (!this.me) return;
    if (audioReady()) { playMusic('menu'); return; }
    if (this.musicArmed) return;
    this.musicArmed = true;
    const start = () => {
      window.removeEventListener('pointerdown', start); window.removeEventListener('keydown', start);
      initAudio();
      if (!this.game) playMusic('menu');
    };
    window.addEventListener('pointerdown', start); window.addEventListener('keydown', start);
  }

  topbar(title, back = 'home') {
    return `<header class="pagebar"><button class="link-back" data-go="${back}" aria-label="Voltar">‹</button><h1>${esc(title || '')}</h1></header>`;
  }

  updateTopbar() {
    const c = $('#coin-pill');
    if (c && this.me) c.textContent = `${num(this.me.user.coins)} moedas`;
    const o = $('#online-pill');
    if (o && this.onlineCount != null) o.textContent = `${this.onlineCount} online`;
  }

  mount(html, handlers = {}) {
    this.ui.innerHTML = noEmoji(html);
    this.ui.onclick = async (e) => {
      const el = e.target.closest('[data-go],[data-act]');
      if (!el) return;
      sfx.click();
      if (el.dataset.go) return this.go(el.dataset.go);
      const fn = handlers[el.dataset.act];
      if (fn) {
        try { await fn(el, e); } catch (err) { this.toast(err.message, 'error'); }
      }
    };
  }

  toast(msg, type = 'info', actions = []) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = noEmoji(`<div>${msg}</div>${actions.length ? `<div class="row">${actions.map((a, i) => `<button class="btn small ${i ? '' : 'primary'}" data-i="${i}">${esc(a[0])}</button>`).join('')}</div>` : ''}`);
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { actions[+b.dataset.i][1](); el.remove(); }));
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), actions.length ? 15000 : 5000);
    if (type === 'error') sfx.error();
  }

  modal(html, onBind) {
    const m = $('#modal');
    m.innerHTML = noEmoji(`<div class="panel">${html}</div>`);
    m.hidden = false;
    const close = () => { m.hidden = true; m.innerHTML = ''; };
    m.onclick = (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); };
    onBind?.(m, close);
    return close;
  }

  // ------------------------------------------------------------ autenticação
  renderAuth() {
    const G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>';
    const F = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.95.93-1.95 1.87v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"/><path fill="#fff" d="M16.67 15.56l.53-3.49h-3.33V9.82c0-.94.46-1.87 1.95-1.87h1.52V4.98s-1.38-.24-2.69-.24c-2.74 0-4.53 1.67-4.53 4.69v2.66H7.08v3.49h3.05V24a12.1 12.1 0 003.75 0v-8.44h2.79z"/></svg>';
    const U = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4.2" fill="#fff"/><path fill="#fff" d="M3.5 21c.6-4.4 4.1-7.2 8.5-7.2s7.9 2.8 8.5 7.2z"/></svg>';
    this.ui.innerHTML = `<div class="login">
        <canvas class="login-title" id="logo-anim" aria-label="Estresse"></canvas>
        <div class="login-bottom">
          <div class="login-buttons">
            <button class="login-btn google" data-login="google">${G}<span>Google</span></button>
            <button class="login-btn facebook" data-login="facebook">${F}<span>Facebook</span></button>
            <button class="login-btn guest" data-login="guest">${U}<span>Convidado</span></button>
          </div>
          <p class="err" id="auth-err"></p>
          <button class="login-link" data-login="password">Já tenho conta com usuário e senha</button>
        </div>
      </div>`;
    this.views.push(new AnimatedTitle($('#logo-anim')));
    const guess = (navigator.language || 'pt-BR').split('-')[1] || 'BR';
    const country = COUNTRY_MAP[guess] ? guess : 'BR';
    this.ui.onclick = async (e) => {
      const b = e.target.closest('[data-login]');
      if (!b) return;
      initAudio(); sfx.click();
      const kind = b.dataset.login;
      $('#auth-err').textContent = '';
      if (kind === 'password') return this.passwordLogin();
      if (kind === 'guest') {
        b.disabled = true;
        try {
          const r = await api('/api/auth/guest', { method: 'POST', body: { country } });
          auth.token = r.token;
          await this.refreshMe();
          sfx.checkpoint();
          this.go('home');
        } catch (err) { $('#auth-err').textContent = err.message; sfx.error(); }
        finally { b.disabled = false; }
        return;
      }
      // Google / Facebook: confere se o provedor está ativo e redireciona
      try {
        const pv = await api('/api/auth/providers');
        if (!pv[kind]) {
          $('#auth-err').textContent = `O login com ${kind === 'google' ? 'Google' : 'Facebook'} ainda não foi ativado. Entre como Convidado por enquanto.`;
          sfx.error();
          return;
        }
        localStorage.setItem('estresse.country', country);
        location.href = `/api/auth/oauth/${kind}`;
      } catch (err) { $('#auth-err').textContent = err.message; }
    };
  }

  // volta do Google/Facebook: o Supabase devolve o token no fragmento da URL
  async finishSocialLogin() {
    const h = new URLSearchParams(location.hash.slice(1));
    const token = h.get('access_token');
    const errDesc = h.get('error_description') || new URLSearchParams(location.search).get('error_description');
    history.replaceState(null, '', '/');
    if (errDesc) { this.pendingAuthError = errDesc; return; }
    if (!token) return;
    try {
      const r = await api('/api/auth/oauth', { method: 'POST', body: { access_token: token, country: localStorage.getItem('estresse.country') || 'BR' } });
      auth.token = r.token;
    } catch (e) { this.pendingAuthError = e.message; }
  }

  passwordLogin() {
    this.modal(`<h2>Entrar</h2>
      <form id="pw-form" autocomplete="on">
        <label for="f-user">Nome de usuário</label><input id="f-user" name="username" required autocomplete="username">
        <label for="f-pass">Senha</label><input id="f-pass" name="password" type="password" required autocomplete="current-password">
        <p class="err" id="pw-err"></p>
        <div class="row"><button class="btn primary" type="submit">Entrar</button><button class="btn ghost" type="button" data-close>Cancelar</button></div>
      </form>`, (m, close) => {
      $('#pw-form', m).onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          const r = await api('/api/auth/login', { method: 'POST', body: { username: fd.get('username').trim(), password: fd.get('password') } });
          auth.token = r.token;
          await this.refreshMe();
          close();
          this.go('home');
        } catch (err) { $('#pw-err', m).textContent = err.message; sfx.error(); }
      };
    });
  }

  // ------------------------------------------------------------ início
  renderHome() {
    const items = [['shop', 'Loja'], ['vault', 'Cofre'], ['profile', 'Perfil'], ['ranking', 'Ranking'], ['settings', 'Configurações']];
    this.mount(`<canvas class="home-title" id="logo" aria-label="Estresse"></canvas>
      <canvas class="home-dancer" id="dancer" aria-hidden="true"></canvas>
      <button class="menu-link play-right" data-act="play">Jogar</button>
      <nav class="corner-menu" aria-label="Menu principal">
        ${items.map(([k, n]) => `<button class="menu-link" data-go="${k}">${n}</button>`).join('')}
      </nav>
      <div class="corner-user">${esc(this.me.user.username)}</div>`, {
      play: () => this.startLevel(this.nextLevelId(), { from: 'home' }),
    });
    const lc = logoCanvas(); const logo = $('#logo'); logo.width = lc.width; logo.height = lc.height; logo.getContext('2d').drawImage(lc, 0, 0);
    this.views.push(new DanceView($('#dancer'), this.me.equipped.skin || 'skin_male'));
  }

  // ------------------------------------------------------------ evento
  async renderEvent() {
    this.mount(`${this.topbar('Evento')}<div id="ev" class="loading">Carregando</div>`, { challenge: (b) => this.startMode(b.dataset.mode) });
    const [ch, season] = await Promise.all([api('/api/challenges').catch(() => null), api('/api/season').catch(() => null)]);
    if (!$('#ev')) return;
    $('#ev').className = 'stack page-narrow';
    $('#ev').innerHTML = (ch ? `<section class="card">${this.challengeCard('event', ch.event)}</section><section class="card">${this.challengeCard('daily', ch.daily)}</section>` : '<p class="err">Não foi possível carregar os eventos.</p>')
      + (season ? `<section class="card"><div class="challenge"><div class="t">🏁 ${esc(season.name)}</div>
          <div>Termina em <span class="countdown" data-countdown="${season.endsAt}">${countdown(season.endsAt)}</span></div>
          <div class="row"><button class="btn small ghost" data-go="ranking/monthly">Ranking da temporada</button></div></div></section>` : '');
  }

  challengeCard(kind, c) {
    const name = kind === 'daily' ? '📅 Desafio Diário' : '🌍 Evento Mundial da Semana';
    const desc = kind === 'daily' ? 'Mesmo percurso para todos os jogadores do mundo hoje.' : 'Percurso difícil e exclusivo da semana. TOP 3 ganha medalhas exclusivas.';
    return `<div class="challenge"><div class="t">${name}</div><div class="muted">${desc}</div>
      <div>Recorde: ${c.wr ? `<b>${fmtTime(c.wr.time_ms)}</b> por ${esc(c.wr.username)} ${flag(c.wr.country)}` : '<i>ninguém ainda — seja o primeiro!</i>'}</div>
      <div>Seu melhor: <b>${c.myBest != null ? fmtTime(c.myBest) : '—'}</b> · ${num(c.players)} participantes · termina em <span class="countdown" data-countdown="${c.endsAt}">${countdown(c.endsAt)}</span></div>
      <div class="row"><button class="btn small primary" data-act="challenge" data-mode="${kind}">Jogar</button>
      <button class="btn small ghost" data-go="ranking/${kind}">Ranking</button></div></div>`;
  }

  podium(list, unit) {
    const spot = (e, cls, kind) => e
      ? `<div class="spot ${cls}" data-go="profile/${encodeURIComponent(e.username)}"><img class="trophy-svg" src="${trophyURL(kind)}" alt="troféu ${kind}" style="width:${cls === 'p1' ? 56 : 44}px;height:auto">
          <div>${avatar(e.avatar, e.frame, 'md', e.skin)}</div><div class="name">${esc(e.username)} ${flag(e.country)}</div>
          <div class="base">${cls === 'p1' ? '1º' : cls === 'p2' ? '2º' : '3º'}<div class="val">${fmtValue(e.value, unit)}</div></div></div>`
      : `<div class="spot ${cls} empty"><img class="trophy-svg" src="${trophyURL(kind)}" alt="" style="opacity:.35"><div class="name">—</div><div class="base">${cls === 'p1' ? '1º' : cls === 'p2' ? '2º' : '3º'}<div class="val">vago</div></div></div>`;
    return `<div class="podium">${spot(list[1], 'p2', 'silver')}${spot(list[0], 'p1', 'gold')}${spot(list[2], 'p3', 'bronze')}</div>`;
  }

  // ------------------------------------------------------------ modos
  // próxima fase a jogar: a primeira ainda não concluída
  nextLevelId() {
    return LEVEL_IDS.find((id) => this.me.progress[id]?.timeMs == null) || LEVEL_IDS[LEVEL_IDS.length - 1];
  }

  async levels() {
    if (!this.levelsCache || Date.now() - this.levelsCache.at > 30000) this.levelsCache = { at: Date.now(), data: await api('/api/levels') };
    return this.levelsCache.data;
  }

  unlocked(id) {
    const i = LEVEL_IDS.indexOf(id);
    return i === 0 || (this.me.progress[LEVEL_IDS[i - 1]]?.timeMs != null);
  }

  async renderEndless() {
    this.mount(`${this.topbar('Modo Infinito')}
      <div class="grid g2">
        <section class="card"><h3>♾️ Corrida sem fim</h3>
          <p>As plataformas são geradas enquanto você avança e ficam mais difíceis a cada trecho. Uma parede de energia te persegue e acelera com o tempo.</p>
          <p>Uma vida só. Cada metro vale <b>3 pontos</b> no ranking mundial.</p>
          <div class="stats"><div class="stat"><b>${num(this.me.user.endlessBest)} m</b><span>Seu recorde</span></div><div class="stat"><b id="wr-dist">—</b><span>Recorde mundial</span></div></div>
          <div class="row" style="margin-top:14px"><button class="btn primary" data-act="go">▶ Começar</button><button class="btn ghost" data-go="ranking/distance">Ranking de distância</button></div>
        </section>
        <section class="card"><h3>🏃 Top 10 distância</h3><div id="dist" class="loading">Carregando</div></section>
      </div>`, { go: () => this.startMode('endless') });
    const r = await api('/api/rankings?type=distance').catch(() => null);
    if (!r || !$('#dist')) return;
    $('#wr-dist').textContent = r.entries[0] ? `${num(r.entries[0].value)} m` : '—';
    $('#dist').outerHTML = this.rankList(r.entries.slice(0, 10), 'm', null);
  }

  startLevel(id, opts = {}) {
    this.launch({ ...opts, mode: 'level', levelId: id, from: opts.from || 'home' });
  }

  startMode(mode) {
    this.launch({ mode, from: mode === 'endless' ? 'endless' : 'event', title: mode === 'daily' ? 'DESAFIO DIÁRIO' : mode === 'event' ? 'EVENTO MUNDIAL' : null, ghosts: mode === 'endless' ? null : ['wr', 'pb'] });
  }

  launch(opts) {
    initAudio();
    if (this.game) this.game.destroy();
    for (const v of this.views) v.stop();
    this.views = [];
    this.game = new GameSession(this, opts);
    this.game.begin();
  }

  async afterGame(opts) {
    this.game = null;
    try { await this.refreshMe(); } catch { /* */ }
    this.levelsCache = null;
    const target = opts.race ? 'multiplayer' : (opts.from || 'home');
    if (location.hash === '#/' + target) this.route(); else this.go(target);
  }

  onRunResult(res) {
    if (res.coinsBalance != null && this.me) this.me.user.coins = res.coinsBalance;
    this.refreshMe().catch(() => {});
  }

  // ------------------------------------------------------------ multiplayer
  bindLive() {
    const L = this.live;
    L.on('hello', (m) => { this.onlineCount = m.online; this.updateTopbar(); });
    L.on('pong', (m) => { this.onlineCount = m.online; this.updateTopbar(); });
    L.on('queued', (m) => { this.mp.queued = true; this.mp.size = m.size; this.mp.waited = m.waited; this.refreshMp(); });
    L.on('unqueued', () => { this.mp.queued = false; this.refreshMp(); });
    L.on('matched', () => { this.mp.queued = false; this.toast('Partida encontrada! Preparando a corrida...'); });
    L.on('room', (m) => { this.mp.room = m.code ? m : null; this.refreshMp(); });
    L.on('error', (m) => this.toast(esc(m.msg), 'error'));
    L.on('info', (m) => this.toast(esc(m.msg)));
    L.on('invite', (m) => this.toast(`🎮 <b>${esc(m.from)}</b> convidou você para uma corrida (sala ${esc(m.code)})`, 'gold', [
      ['Entrar', () => { L.send({ t: 'join', code: m.code }); if (!this.game) this.go('multiplayer'); }], ['Recusar', () => {}]]));
    L.on('friend', (m) => this.toast(m.kind === 'request' ? `👋 <b>${esc(m.from)}</b> quer ser seu amigo` : `🤝 <b>${esc(m.from)}</b> aceitou seu pedido de amizade`, 'info',
      m.kind === 'request' ? [['Aceitar', () => api('/api/friends/accept', { method: 'POST', body: { username: m.from } }).then(() => this.refreshMp(true))]] : []));
    L.on('achievements', (m) => m.list.forEach((a) => this.toast(`🏅 Conquista: <b>${esc(a.name)}</b> (+${a.reward})`, 'gold')));
    L.on('start', (m) => {
      const room = this.mp.room;
      const skins = {};
      for (const p of room?.players || []) skins[p.username] = p.skin;
      this.launch({ mode: 'race', from: 'multiplayer', race: { levelId: m.levelId, startAt: m.startAt, limitMs: m.limitMs, skins } });
    });
  }

  refreshMp() { /* multiplayer removido da interface */ }


  // ------------------------------------------------------------ ranking
  async renderRanking(type = 'world') {
    if (!RANK_TYPES.includes(type)) type = 'world';
    const st = this.rankState || (this.rankState = { country: this.me.user.country, continent: this.me.user.continent, level: '1-1' });
    this.mount(`${this.topbar('Ranking')}
      <div class="tabs" role="tablist">${RANK_TABS.map(([k, n]) => `<button class="tab ${k === type ? 'on' : ''}" data-go="ranking/${k}">${n}</button>`).join('')}</div>
      <div class="filters" id="filters"></div>
      <div id="rank-body" class="loading">Carregando ranking</div>`);
    const f = $('#filters');
    if (type === 'country') f.innerHTML = `<select id="sel-country">${COUNTRIES.map((c) => `<option value="${c.code}" ${c.code === st.country ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
    if (type === 'continent') f.innerHTML = `<select id="sel-cont">${Object.entries(CONTINENTS).map(([k, n]) => `<option value="${k}" ${k === st.continent ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    if (type === 'speed') f.innerHTML = `<select id="sel-level">${LEVEL_IDS.map((id) => `<option value="${id}" ${id === st.level ? 'selected' : ''}>Fase ${lvNum(id)} — ${esc(levelMeta(id).name)}</option>`).join('')}</select>`;
    f.onchange = (e) => {
      if (e.target.id === 'sel-country') st.country = e.target.value;
      if (e.target.id === 'sel-cont') st.continent = e.target.value;
      if (e.target.id === 'sel-level') st.level = e.target.value;
      this.loadRanking(type);
    };
    this.loadRanking(type);
  }

  async loadRanking(type) {
    const st = this.rankState;
    const u = this.me.user;
    if (type === 'regional' && u.country === 'BR' && !u.state) return this.askState();
    let qtype = type === 'brasil' ? 'country' : type;
    if (type === 'regional') qtype = u.country === 'BR' ? 'state' : 'country';
    const q = new URLSearchParams({ type: qtype });
    if (type === 'regional') { if (u.country === 'BR') q.set('state', u.state); else q.set('country', u.country); }
    if (type === 'brasil') q.set('country', 'BR');
    if (type === 'country') q.set('country', st.country);
    if (type === 'continent') q.set('continent', st.continent);
    if (type === 'speed') q.set('level', st.level);
    const body = $('#rank-body');
    body.className = 'loading'; body.innerHTML = 'Carregando ranking';
    let r;
    try { r = await api('/api/rankings?' + q); } catch (e) { body.className = ''; body.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    if (!$('#rank-body')) return;
    body.className = '';
    if (type === 'history') return this.renderHistory(body, r);
    const head = {
      world: 'TOP 100 do mundo todo',
      regional: u.country === 'BR' ? `TOP 100 — ${esc(BR_STATES[u.state] || '')} <button class="btn small ghost" data-act="change-state">Trocar estado</button>` : `TOP 100 — ${esc(COUNTRY_MAP[u.country]?.name || '')}`,
      brasil: 'TOP 100 — Brasil', country: `TOP 100 — ${esc(COUNTRY_MAP[st.country]?.name || '')}`,
      continent: `TOP 100 — ${esc(CONTINENTS[st.continent])}`, weekly: 'Pontos conquistados nesta semana (reinicia toda segunda-feira, UTC)',
      monthly: `Temporada ${esc(r.season || '')} — pontos do mês. Ao final: troféus, moedas e itens exclusivos`,
      speed: `Menor tempo na fase ${lvNum(r.level)} — ${esc(levelMeta(r.level)?.name || '')}`, distance: 'Maior distância no Modo Infinito',
      totaltime: 'Menor tempo somado em todas as fases da História (quem completou mais fases fica à frente)',
      daily: 'Desafio Diário de hoje — menor tempo', event: 'Evento Mundial da semana — menor tempo', races: 'Rating das corridas online',
    }[type];
    setTimeout(() => { const b = $('[data-act=change-state]'); if (b) b.onclick = () => this.askState(); });
    const ends = r.endsAt ? ` · termina em <span class="countdown" data-countdown="${r.endsAt}">${countdown(r.endsAt)}</span>` : '';
    body.innerHTML = `<p class="muted">${head}${ends}</p>
      ${r.entries.length ? this.rankList(r.entries, r.unit, r.me) : '<div class="empty-state card">Ninguém pontuou aqui ainda. Que tal ser o primeiro? 🚀</div>'}
      ${r.me && !r.entries.some((e) => e.username === r.me.username) ? `<div class="me-sticky">${this.rankRow(r.me, r.unit, true)}</div>` : ''}`;
  }

  stateSelect(id, cur = '') {
    return `<select id="${id}"><option value="">Escolha seu estado</option>${Object.entries(BR_STATES).map(([k, n]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  }

  askState() {
    const body = $('#rank-body');
    body.className = 'page-narrow';
    body.innerHTML = `<p>Para ver o ranking do seu estado, escolha onde você mora:</p>${this.stateSelect('pick-state', this.me.user.state)}`;
    $('#pick-state').onchange = async (e) => {
      if (!e.target.value) return;
      try {
        await api('/api/me', { method: 'PATCH', body: { state: e.target.value } });
        await this.refreshMe();
        this.loadRanking('regional');
      } catch (err) { this.toast(err.message, 'error'); }
    };
  }

  rankRow(e, unit, me) {
    return `<div class="rank-row ${me ? 'me' : ''} ${e.rank && e.rank <= 3 ? 'r' + e.rank : ''}" data-go="profile/${encodeURIComponent(e.username)}">
      <div class="pos">${e.rank ? (e.rank <= 3 ? e.rank + 'º' : '#' + e.rank) : '—'}</div>
      ${avatar(e.avatar, e.frame, '', e.skin)}
      <div class="who"><b>${esc(e.username)} ${flag(e.country)}</b><small>${me && !e.rank ? 'você ainda não pontuou aqui' : esc(e.sub || '')}</small></div>
      <div class="val">${fmtValue(e.value, unit)}</div></div>`;
  }

  rankList(entries, unit, me) {
    if (!entries.length) return '<div class="empty-state">Sem registros ainda.</div>';
    return `<div class="rank-list">${entries.map((e) => this.rankRow(e, unit, me && e.username === me.username)).join('')}</div>`;
  }

  renderHistory(body, r) {
    const bySeason = {};
    for (const c of r.champions) (bySeason[c.period] ||= []).push(c);
    body.innerHTML = `<div class="grid g2">
      <section class="card"><h3>👑 Lendas atuais (TOP 3 histórico)</h3>${this.rankList(r.legends, 'pts', null)}</section>
      <section class="card"><h3>🏆 Campeões das temporadas e eventos</h3>${Object.keys(bySeason).length ? Object.entries(bySeason).map(([per, list]) => `
        <div style="margin-bottom:10px"><b>${esc(per.startsWith('event-') ? 'Evento ' + per.slice(6) : 'Temporada ' + per)}</b>
        ${list.map((c) => `<div class="room-player" data-go="profile/${encodeURIComponent(c.username)}" style="cursor:pointer">${c.medal.icon} ${avatar(c.avatar, c.frame, 'sm', c.skin)} <b>${esc(c.username)}</b> ${flag(c.country)} <small class="muted">${esc(c.medal.name)}</small></div>`).join('')}</div>`).join('')
        : '<p class="muted">A primeira temporada ainda está em andamento. Os campeões aparecerão aqui para sempre.</p>'}</section>
      <section class="card" style="grid-column:1/-1"><h3>⏱️ Recordes mundiais de todos os tempos</h3>
        <table><thead><tr><th>Fase</th><th>Nome</th><th>Tempo</th><th>Recordista</th></tr></thead><tbody>
        ${r.records.map((x) => `<tr><td>${lvNum(x.level)}</td><td>${esc(x.name)}</td><td class="mono">${x.value != null ? fmtTime(x.value) : '—'}</td><td>${x.username ? `${flag(x.country)} <a href="#/profile/${encodeURIComponent(x.username)}">${esc(x.username)}</a>` : '—'}</td></tr>`).join('')}
        </tbody></table></section></div>`;
  }

  // ------------------------------------------------------------ personalização e loja
  itemPreview(it) {
    if (it.slot === 'skin') {
      const c = document.createElement('canvas'); c.width = 12; c.height = 14;
      c.getContext('2d').drawImage(heroFrames(it.id).r.idle, 0, 0);
      return `<div class="prev"><img src="${c.toDataURL()}" style="height:70px;image-rendering:pixelated" alt=""></div>`;
    }
    if (it.slot === 'pet') {
      const s = petSprite(it.sprite);
      if (!s) return '<div class="prev">∅</div>';
      const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').drawImage(s.r, 0, 0);
      return `<div class="prev"><img src="${ditherCanvas(c).toDataURL()}" style="height:56px;image-rendering:pixelated" alt=""></div>`;
    }
    if (it.slot === 'frame') return `<div class="prev">${avatar(this.me.user.avatar, it.id, 'md')}</div>`;
    if (it.slot === 'emote') return `<div class="prev"><span style="background:#fff;color:#1a1030;border-radius:8px;padding:4px 10px">${esc(it.text)}</span></div>`;
    // efeitos (vitória, pulo, trilha): o personagem + as cores do efeito
    const c = document.createElement('canvas'); c.width = 12; c.height = 16;
    c.getContext('2d').drawImage(heroFrames(this.me.equipped.skin).r.idle, 0, 0);
    const cols = it.colors || { hop: ['#ffd23f'], spin: ['#ffffff', '#9a9a9a'], confetti: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4'], fireworks: ['#ff3d6e', '#ffd23f', '#3ee0ff'], crown: ['#ffd23f', '#b8860b'], ghost: ['#efeaff', '#9b8cff'] }[it.fx] || [];
    const sw = cols.map((col) => `<i style="background:${col}"></i>`).join('');
    return `<div class="prev fx-prev"><img src="${c.toDataURL()}" style="height:56px;image-rendering:pixelated" alt=""><div class="swatches">${sw || '<span>sem efeito</span>'}</div></div>`;
  }

  // Cofre: as duas carteiras (moedas e diamantes) + itens que você tem
  async renderVault(slot = 'skin') {
    if (!SLOTS[slot]) slot = 'skin';
    const owned = new Set(this.me.inventory);
    const eq = this.me.equipped;
    const u = this.me.user;
    const list = ITEMS.filter((i) => i.slot === slot && (owned.has(i.id) || i.price === 0));
    const pay = this.hashQuery?.get('pagamento');
    this.mount(`${this.topbar('Cofre')}
      <div class="vault">
        <section class="vault-hero">
          <canvas class="vault-dancer" id="vault-dancer" aria-label="Seu personagem"></canvas>
          <div class="vault-equipped">${esc(ITEM_MAP[eq.skin]?.name || '')}</div>
        </section>
        <section class="wallets">
          <div class="wallet">
            <div class="wallet-ico">${COIN.replace('cur-ico', 'cur-ico big')}</div>
            <div class="wallet-info"><b>${num(u.coins)}</b><span>Moedas</span><small>Ganhe jogando: fases, recordes e conquistas</small></div>
            <button class="btn small" data-go="shop">Gastar na loja</button>
          </div>
          <div class="wallet gem">
            <div class="wallet-ico">${GEM.replace('cur-ico', 'cur-ico big')}</div>
            <div class="wallet-info"><b>${num(u.gems)}</b><span>Diamantes</span><small>Compre com dinheiro (Pix ou cartão)</small></div>
            <button class="btn small primary" data-act="buy-gems">Comprar diamantes</button>
          </div>
        </section>
      </div>
      <h2 class="vault-sub">Seus itens</h2>
      <div class="tabs">${Object.entries(SLOTS).map(([k, n]) => `<button class="tab ${k === slot ? 'on' : ''}" data-go="vault/${k}">${n}</button>`).join('')}</div>
      <div class="items">${list.map((it) => `<div class="item ${eq[slot] === it.id ? 'equipped' : ''}">${this.itemPreview(it)}
        <div class="nm">${esc(it.name)}</div>
        ${eq[slot] === it.id ? '<button class="btn small" disabled>Em uso</button>' : `<button class="btn small green" data-act="equip" data-id="${it.id}">Usar</button>`}</div>`).join('')}
        ${slot !== 'skin' ? `<button class="item item-more" data-go="shop/${slot}"><span>+</span><div class="nm">Mais na loja</div></button>` : ''}</div>`, {
      equip: async (b) => {
        const r = await api('/api/equip', { method: 'POST', body: { slot, itemId: b.dataset.id } });
        this.me.equipped = r.equipped;
        this.renderVault(slot);
      },
      'buy-gems': () => this.gemStore(),
    });
    this.views.push(new DanceView($('#vault-dancer'), eq.skin || 'skin_male'));
    if (pay === 'ok') { this.toast('Pagamento aprovado! Seus diamantes chegam em instantes.', 'gold'); setTimeout(() => this.refreshMe().then(() => { if (location.hash.startsWith('#/vault')) this.renderVault(slot); }), 4000); }
    if (pay === 'pendente') this.toast('Pagamento em análise. Os diamantes entram assim que for aprovado.');
    if (pay === 'falhou') this.toast('O pagamento não foi concluído.', 'error');
    if (pay) history.replaceState(null, '', '#/vault');
  }

  // loja de diamantes (Mercado Pago)
  async gemStore() {
    let info = { enabled: false, packs: GEM_PACKS };
    try { info = await api('/api/payments/packs'); } catch { /* usa a lista local */ }
    const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    this.modal(`<h2>Comprar diamantes</h2>
      <p class="muted">Diamantes compram itens lendários na loja. São só visuais: não dão vantagem no jogo.</p>
      <div class="gem-packs">${info.packs.map((p) => `<button class="gem-pack" data-pack="${p.id}">
        <div class="gp-ico">${GEM.replace('cur-ico', 'cur-ico big')}</div><b>${num(p.gems)}</b>${p.bonus ? `<span class="gp-bonus">+${p.bonus}% bônus</span>` : '<span class="gp-bonus">&nbsp;</span>'}
        <span class="gp-price">${brl(p.price)}</span></button>`).join('')}</div>
      <p class="err" id="gem-err">${info.enabled ? '' : 'Os pagamentos ainda não foram ativados neste servidor.'}</p>
      <p class="muted" style="font-size:12px">Pagamento processado pelo Mercado Pago (Pix ou cartão). Os diamantes entram na sua conta assim que o pagamento é aprovado.</p>
      <div class="row center"><button class="btn ghost" data-close>Fechar</button></div>`, (m) => {
      m.querySelectorAll('[data-pack]').forEach((b) => b.onclick = async () => {
        const err = $('#gem-err', m);
        if (!info.enabled) { err.textContent = 'Os pagamentos ainda não foram ativados neste servidor.'; sfx.error(); return; }
        b.disabled = true;
        try {
          const r = await api('/api/payments/checkout', { method: 'POST', body: { pack: b.dataset.pack } });
          location.href = r.url;
        } catch (e) { err.textContent = e.message; b.disabled = false; }
      });
    });
  }

  async renderShop(slot = 'victory') {
    if (!SLOTS[slot] || slot === 'skin') slot = 'victory';
    const owned = new Set(this.me.inventory);
    const list = ITEMS.filter((i) => i.slot === slot && i.price !== 0);
    this.mount(`${this.topbar('Loja')}
      <div class="balances"><span class="balance">${COIN}<b>${num(this.me.user.coins)}</b></span><span class="balance">${GEM}<b>${num(this.me.user.gems)}</b></span>
        <button class="btn small primary" data-act="buy-gems">Comprar diamantes</button></div>
      <div class="tabs">${Object.entries(SLOTS).filter(([k]) => k !== 'skin').map(([k, n]) => `<button class="tab ${k === slot ? 'on' : ''}" data-go="shop/${k}">${n}</button>`).join('')}</div>
      <div class="items">${list.map((it) => `<div class="item r-${it.rarity}">${this.itemPreview(it)}
        <div class="nm">${esc(it.name)}</div><div class="rar rar-${it.rarity}">${it.rarity}</div>
        ${owned.has(it.id) ? `<button class="btn small" data-go="vault/${slot}">Você possui</button>`
          : it.price == null ? '<div class="muted" style="font-size:12px">Exclusivo: recompensa de temporada</div>'
          : `<div class="price">${priceTag(it)}</div><button class="btn small gold" data-act="buy" data-id="${it.id}" ${(it.cur === 'gem' ? this.me.user.gems : this.me.user.coins) < it.price ? 'disabled' : ''}>Comprar</button>`}
        ${['victory', 'jump', 'trail', 'pet', 'skin'].includes(slot) ? `<button class="btn small ghost" data-act="preview" data-id="${it.id}">Prévia</button>` : ''}</div>`).join('')}</div>`, {
      'buy-gems': () => this.gemStore(),
      buy: async (b) => {
        const it = ITEM_MAP[b.dataset.id];
        b.disabled = true;
        const r = await api('/api/shop/buy', { method: 'POST', body: { itemId: it.id } });
        sfx.buy();
        this.toast(`Você comprou <b>${esc(it.name)}</b>!`, 'gold', [['Equipar agora', async () => { await api('/api/equip', { method: 'POST', body: { slot: it.slot, itemId: it.id } }); await this.refreshMe(); }]]);
        for (const a of r.achievements || []) this.toast(`🏅 Conquista: <b>${esc(a.name)}</b> (+${a.reward})`, 'gold');
        await this.refreshMe();
        this.renderShop(slot);
      },
      preview: (b) => {
        const it = ITEM_MAP[b.dataset.id];
        let view;
        const close = this.modal(`<h2>${esc(it.name)}</h2><canvas class="hero-preview" id="pv"></canvas><div class="row center" style="margin-top:12px"><button class="btn" data-close>Fechar</button></div>`, (m) => {
          view = new DemoView($('#pv', m), { ...this.me.equipped, [it.slot]: it.id }, { theme: 3, label: it.name });
        });
        const obs = new MutationObserver(() => { if ($('#modal').hidden) { view?.stop(); obs.disconnect(); } });
        obs.observe($('#modal'), { attributes: true });
        return close;
      },
    });
  }

  // ------------------------------------------------------------ perfil
  async renderProfile(username) {
    const own = !username || username.toLowerCase() === this.me.user.username.toLowerCase();
    this.mount(`${this.topbar(own ? 'Meu perfil' : 'Perfil')}<div id="prof" class="loading">Carregando perfil</div>`);
    let p;
    try { p = await api('/api/profile/' + encodeURIComponent(username || this.me.user.username)); }
    catch (e) { $('#prof').className = ''; $('#prof').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    if (!$('#prof')) return;
    const have = new Set(p.achievements);
    const histRows = p.history.map((h) => `<tr><td>${new Date(h.finished_at).toLocaleString('pt-BR')}</td><td>${{ level: 'História', endless: 'Infinito', daily: 'Diário', event: 'Evento', race: 'Corrida' }[h.mode] || h.mode}</td>
      <td>${esc(levelMeta(h.level_id)?.name || (h.mode === 'endless' ? '—' : h.level_id.replace(/-[A-Za-z0-9_-]{6}$/, '')))}</td>
      <td class="mono">${h.mode === 'endless' ? num(h.distance) + ' m' : fmtTime(h.time_ms)}</td><td>${h.deaths ?? 0}</td><td class="mono">${h.score ? num(h.score) : '—'}</td></tr>`).join('');
    $('#prof').className = 'stack';
    $('#prof').innerHTML = `
      <section class="card profile-head">${avatar(p.avatar, p.equipped.frame, 'lg', p.equipped.skin)}
        <div><h1>${esc(p.username)} ${flag(p.country)}</h1><div class="muted">${esc(COUNTRY_MAP[p.country]?.name || '')} · ${esc(CONTINENTS[p.continent] || '')} · membro desde ${new Date(p.createdAt).toLocaleDateString('pt-BR')}
          ${p.online ? ' · <span style="color:var(--green)">● online</span>' : ''}</div>
          <div class="row" style="margin-top:10px">${p.rank ? `<span class="pill rank">#${num(p.rank)} no mundo</span>` : '<span class="pill">Sem posição ainda</span>'}<span class="pill coins">${num(p.totalScore)} pts</span>
          ${own ? '<button class="btn small ghost" data-act="edit">Editar avatar/país</button>' : `<button class="btn small cyan" data-act="friend">Adicionar amigo</button>`}</div></div></section>
      <section class="card"><h3>Estatísticas</h3><div class="stats">
        <div class="stat"><b>${p.rank ? '#' + num(p.rank) : '—'}</b><span>Posição mundial</span></div>
        <div class="stat"><b>${num(p.totalScore)}</b><span>Pontuação</span></div>
        <div class="stat"><b>${num(p.records)}</b><span>Recordes mundiais</span></div>
        <div class="stat"><b>${num(p.levelsDone)}/${LEVEL_IDS.length}</b><span>Fases concluídas</span></div>
        <div class="stat"><b>${fmtDur(p.playMs)}</b><span>Tempo total de jogo</span></div>
        <div class="stat"><b>${num(p.endlessBest)} m</b><span>Recorde no Infinito</span></div>
        <div class="stat"><b>${num(p.raceRating)}</b><span>Rating de corrida</span></div>
        <div class="stat"><b>${num(p.raceWins)}/${num(p.races)}</b><span>Vitórias em corridas</span></div></div></section>
      <section class="card"><h3>Medalhas exclusivas</h3><div class="medals">${p.medals.length ? p.medals.map((m) => `<span class="medal-chip" style="border-color:${m.info?.color}">${m.info?.icon} ${esc(m.info?.name)} <small class="muted">${esc(m.period)}${m.rank ? ' · #' + m.rank : ''}</small></span>`).join('') : '<span class="muted">Termine uma temporada no TOP 100 ou um Evento Mundial no TOP 25 para ganhar medalhas.</span>'}</div></section>
      <section class="card"><h3>Conquistas (${have.size}/${ACHIEVEMENTS.length})</h3><div class="achs">${ACHIEVEMENTS.map((a) => `<div class="ach ${have.has(a.id) ? '' : 'locked'}"><span class="i">${have.has(a.id) ? '🏅' : '🔒'}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)} (+${a.reward})</small></div></div>`).join('')}</div></section>
      <section class="card"><h3>Histórico de resultados</h3>${histRows ? `<div style="overflow:auto"><table><thead><tr><th>Quando</th><th>Modo</th><th>Fase</th><th>Resultado</th><th>Mortes</th><th>Pontos</th></tr></thead><tbody>${histRows}</tbody></table></div>` : '<p class="muted">Nenhum resultado ainda.</p>'}</section>`;
    this.ui.onclick = async (e) => {
      const g = e.target.closest('[data-go]');
      if (g) return this.go(g.dataset.go);
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'friend') {
        try { const r = await api('/api/friends/request', { method: 'POST', body: { username: p.username } }); this.toast(r.status === 'accepted' ? 'Agora vocês são amigos!' : 'Pedido enviado'); }
        catch (err) { this.toast(err.message, 'error'); }
      }
      if (a.dataset.act === 'edit') this.editProfile();
    };
  }

  editProfile() {
    let av = this.me.user.avatar;
    this.modal(`<h2>Editar perfil</h2><label>Avatar</label><div class="avatars">${AVATARS.map((a) => `<button type="button" class="${a === av ? 'on' : ''}" data-av="${a}"><img src="${avatarURL(a, 64)}" alt=""></button>`).join('')}</div>
      <label for="ed-country">País</label><select id="ed-country">${COUNTRIES.map((c) => `<option value="${c.code}" ${c.code === this.me.user.country ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <label for="ed-state">Estado (Brasil)</label>${this.stateSelect('ed-state', this.me.user.state)}
      <div class="row" style="margin-top:14px"><button class="btn primary" id="ed-save">Salvar</button><button class="btn ghost" data-close>Cancelar</button></div>`, (m, close) => {
      m.querySelectorAll('[data-av]').forEach((b) => b.onclick = () => { av = b.dataset.av; m.querySelectorAll('[data-av]').forEach((x) => x.classList.toggle('on', x === b)); });
      $('#ed-save', m).onclick = async () => {
        try {
          const country = $('#ed-country', m).value;
          await api('/api/me', { method: 'PATCH', body: { avatar: av, country, state: country === 'BR' ? $('#ed-state', m).value : '' } });
          await this.refreshMe();
          close();
          this.renderProfile();
        } catch (e) { this.toast(e.message, 'error'); }
      };
    });
  }

  // ------------------------------------------------------------ configurações
  renderSettings() {
    const s = this.settings;
    this.mount(`${this.topbar('Configurações')}
      <div class="grid g2">
        <section class="card"><h3>Áudio</h3>
          <label for="st-music">Música: <span id="v-music">${Math.round(s.music * 100)}%</span></label><input id="st-music" type="range" min="0" max="1" step="0.05" value="${s.music}">
          <label for="st-sfx">Efeitos: <span id="v-sfx">${Math.round(s.sfx * 100)}%</span></label><input id="st-sfx" type="range" min="0" max="1" step="0.05" value="${s.sfx}">
        </section>
        <section class="card"><h3>Jogo</h3>
          <label class="row" style="color:var(--text)"><input type="checkbox" id="st-shake" style="width:auto" ${s.shake ? 'checked' : ''}> Tremor de tela</label>
          <label class="row" style="color:var(--text)"><input type="checkbox" id="st-ghosts" style="width:auto" ${s.ghosts ? 'checked' : ''}> Mostrar fantasmas</label>
          <label for="st-touch">Controles de toque</label>
          <select id="st-touch"><option value="auto" ${s.touch === 'auto' ? 'selected' : ''}>Automático</option><option value="on" ${s.touch === 'on' ? 'selected' : ''}>Sempre mostrar</option><option value="off" ${s.touch === 'off' ? 'selected' : ''}>Ocultar</option></select>
        </section>
        <section class="card"><h3>Controles</h3>
          <table><tbody>
            <tr><td>Mover</td><td><span class="kbd">←</span> <span class="kbd">→</span> ou <span class="kbd">A</span> <span class="kbd">D</span> · analógico/D-pad</td></tr>
            <tr><td>Pular</td><td><span class="kbd">Espaço</span> <span class="kbd">↑</span> <span class="kbd">W</span> <span class="kbd">Z</span> · botão A. Segure para pular mais alto.</td></tr>
            <tr><td>Pulo na parede</td><td>Encoste na parede no ar e pule</td></tr>
            <tr><td>Reinício rápido</td><td><span class="kbd">R</span> · botão Y/Select</td></tr>
            <tr><td>Pausar</td><td><span class="kbd">Esc</span> <span class="kbd">P</span> · Start</td></tr>
            <tr><td>Emotes (corrida)</td><td><span class="kbd">1</span>–<span class="kbd">4</span></td></tr>
          </tbody></table></section>
        <section class="card"><h3>Conta</h3><p>Conectado como <b>${esc(this.me.user.username)}</b>.</p>
          <p class="muted">Seu progresso, itens e recordes ficam salvos no servidor e sincronizam em qualquer dispositivo.</p>
          <button class="btn primary" data-act="logout">Sair da conta</button></section>
      </div>`, {
      logout: async () => {
        await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
        auth.token = null; this.me = null; this.live.close();
        this.go('auth');
      },
    });
    const bind = (id, key, fmt) => {
      const el = $('#' + id);
      el.oninput = () => {
        s[key] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
        if (fmt) $(fmt).textContent = Math.round(s[key] * 100) + '%';
        this.saveSettings();
        api('/api/me', { method: 'PATCH', body: { prefs: s } }).catch(() => {});
      };
      el.onchange = el.oninput;
    };
    bind('st-music', 'music', '#v-music'); bind('st-sfx', 'sfx', '#v-sfx'); bind('st-shake', 'shake'); bind('st-ghosts', 'ghosts'); bind('st-touch', 'touch');
  }
}
