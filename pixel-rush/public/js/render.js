// Renderização do mundo em pixel art (384x216 ampliado sem suavização).
import { TILE, VIEW_W, VIEW_H, PHYS } from '/shared/constants.js';
import { platRect, sawPos, laserOn, laserWarn, laserRect, cannonBullets } from '/shared/entities.js';
import { crumbleInfo } from '/shared/sim.js';
import { ITEM_MAP } from '/shared/items.js';
import { heroFrames, petSprite, tileSet, background, drawBoss, shade } from './sprites.js';
import { drawText, drawTextCentered, textWidth } from './font.js';

const SOLIDISH = { '#': 1, 'I': 1, 'X': 1 };

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.cv.width = VIEW_W; this.cv.height = VIEW_H;
    this.g = canvas.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.frame = 0;
    this.shakeOn = true;
    this.reset();
  }

  reset(level = null, cos = {}) {
    this.level = level;
    this.cam = { x: 0, y: 0, init: false };
    this.parts = [];
    this.shake = 0;
    this.trail = [];
    this.hist = [];
    this.pet = null;
    this.anim = { sx: 1, sy: 1, run: 0, blink: 0, deadAt: -1 };
    this.springs = new Map();
    this.flash = 0;
    this.cos = cos;
    this.victory = null;
  }

  setCosmetics(cos) { this.cos = cos || {}; }

  themeFor(level, x) {
    if (!level) return 1;
    if (level.endless) return 1 + (Math.floor(x / (TILE * 160)) % 4);
    return level.theme || 1;
  }

  // ---------------- partículas
  burst(x, y, n, colors, { spd = 1.6, up = 1, life = 30, size = 1, grav = 0.08, shape = 'px' } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * spd;
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up * Math.random(), life: life * (0.6 + Math.random() * 0.6),
        max: life, color: colors[(Math.random() * colors.length) | 0], size, grav, shape,
      });
    }
  }

  onEvents(sim, events) {
    const p = sim.s.p;
    const cx = p.x + PHYS.pw / 2, by = p.y + PHYS.ph;
    for (const ev of events) {
      if (ev === 'jump' || ev === 'walljump') {
        this.anim.sx = 0.8; this.anim.sy = 1.25;
        const it = ITEM_MAP[this.cos.jump] || ITEM_MAP.jump_dust;
        this.jumpFx(it, cx, by);
      } else if (ev === 'land') {
        this.anim.sx = 1.25; this.anim.sy = 0.8;
        this.burst(cx, by, 4, ['#d8cbb0', '#ffffff'], { spd: 0.8, up: 0.3, life: 14 });
      } else if (ev === 'die') {
        const pal = heroFrames(this.cos.skin || 'skin_classic').pal;
        this.burst(cx, p.y + 6, 26, [pal.b, pal.B, pal.c, pal.o], { spd: 3, up: 1.5, life: 40, size: 2 });
        this.shake = 8; this.flash = 6;
      } else if (ev === 'coin') {
        this.burst(cx, p.y, 8, ['#ffd23f', '#fff4b8'], { spd: 1.2, life: 18 });
      } else if (ev === 'checkpoint') {
        this.burst(cx, p.y - 8, 16, ['#3ee07a', '#b6ffcf', '#ffffff'], { spd: 1.8, up: 1, life: 30 });
      } else if (ev === 'spring') {
        const key = `${Math.floor(cx / TILE)},${Math.floor((by - 1) / TILE)}`;
        this.springs.set(key, 10);
        this.anim.sx = 0.7; this.anim.sy = 1.35;
      } else if (ev === 'bossHit') {
        this.shake = 6; this.burst(cx, by, 14, ['#ffffff', '#ffd23f'], { spd: 2.5, life: 22 });
      } else if (ev === 'bossDown') {
        const b = sim.s.boss;
        this.shake = 14;
        this.burst(b.x + b.w / 2, b.y + b.h / 2, 60, ['#ffd23f', '#ff7a1a', '#ffffff', '#ff3d6e'], { spd: 4, up: 2, life: 60, size: 2 });
      } else if (ev === 'bossLand') {
        this.shake = 4;
      } else if (ev === 'crumble') {
        this.burst(cx, by + 2, 4, ['#b08850', '#6e5028'], { spd: 0.8, life: 16 });
      }
    }
  }

  jumpFx(it, x, y) {
    const c = it.colors || ['#d8cbb0', '#fff'];
    switch (it.fx) {
      case 'stars': this.burst(x, y, 7, c, { spd: 1.4, up: 0.5, life: 22, shape: 'star' }); break;
      case 'hearts': this.burst(x, y, 5, c, { spd: 1, up: 0.8, life: 28, shape: 'heart', grav: -0.02 }); break;
      case 'bolt': this.burst(x, y, 6, c, { spd: 2.2, up: 0.2, life: 12, shape: 'bolt', grav: 0 }); break;
      case 'rainbow': this.burst(x, y, 14, c, { spd: 1.8, up: 0.6, life: 26, size: 2 }); break;
      default: this.burst(x, y, 6, c, { spd: 1, up: 0.2, life: 16, grav: 0.02 });
    }
  }

  updateParts() {
    const out = [];
    for (const q of this.parts) {
      q.x += q.vx; q.y += q.vy; q.vy += q.grav; q.vx *= 0.97; q.life--;
      if (q.life > 0) out.push(q);
    }
    this.parts = out.length > 600 ? out.slice(-600) : out;
  }

  drawParts(g, ox, oy) {
    for (const q of this.parts) {
      const x = Math.round(q.x - ox), y = Math.round(q.y - oy);
      g.globalAlpha = Math.min(1, q.life / (q.max * 0.5));
      g.fillStyle = q.color;
      if (q.shape === 'star') { g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); }
      else if (q.shape === 'heart') { g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x - 1, y + 1, 3, 1); g.fillRect(x, y + 2, 1, 1); }
      else if (q.shape === 'bolt') { g.fillRect(x, y, 1, 2); g.fillRect(x + 1, y + 2, 1, 2); g.fillRect(x, y + 4, 1, 2); }
      else g.fillRect(x, y, q.size, q.size);
    }
    g.globalAlpha = 1;
  }

  // ---------------- câmera
  updateCamera(level, p, dt = 1) {
    const look = p.vx * 10;
    let tx = p.x + PHYS.pw / 2 - VIEW_W / 2 + look;
    let ty = p.y - VIEW_H * 0.55;
    const maxX = isFinite(level.widthPx) ? level.widthPx - VIEW_W : Infinity;
    tx = Math.max(0, Math.min(maxX, tx));
    ty = Math.max(-TILE * 2, Math.min(level.heightPx - VIEW_H, ty));
    if (!this.cam.init) { this.cam.x = tx; this.cam.y = ty; this.cam.init = true; }
    this.cam.x += (tx - this.cam.x) * Math.min(1, 0.14 * dt);
    this.cam.y += (ty - this.cam.y) * Math.min(1, 0.1 * dt);
  }

  // ---------------- desenho principal
  draw(sim, { ghosts = [], others = [], hud = null, emotes = [] } = {}) {
    const g = this.g;
    const { level, s } = sim;
    const p = s.p;
    this.frame++;
    this.updateCamera(level, p);
    this.updateParts();
    let ox = Math.round(this.cam.x), oy = Math.round(this.cam.y);
    if (this.shake > 0 && this.shakeOn) {
      ox += Math.round((Math.random() - 0.5) * this.shake);
      oy += Math.round((Math.random() - 0.5) * this.shake);
      this.shake *= 0.85; if (this.shake < 0.5) this.shake = 0;
    }
    const theme = this.themeFor(level, p.x);
    const ts = tileSet(theme);
    this.drawBackground(g, theme, ox, oy);

    // tiles
    const tx0 = Math.floor(ox / TILE) - 1, tx1 = Math.floor((ox + VIEW_W) / TILE) + 1;
    const ty0 = Math.floor(oy / TILE) - 2, ty1 = Math.floor((oy + VIEW_H) / TILE) + 1;
    const coinF = Math.floor(this.frame / 8) % 4;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const c = level.tileAt(tx, ty);
        if (c === '.') continue;
        const x = tx * TILE - ox, y = ty * TILE - oy;
        if (c === '#') {
          if (tx < 0 || (isFinite(level.w) && tx >= level.w)) { g.drawImage(ts.mid[0], x, y); continue; }
          const above = level.tileAt(tx, ty - 1);
          const v = ((tx * 7 + ty * 13) & 3);
          g.drawImage(SOLIDISH[above] ? ts.mid[v] : ts.top[v], x, y);
        } else if (c === 'I') g.drawImage(ts.ice, x, y);
        else if (c === 'X') {
          const st = crumbleInfo(s, tx, ty);
          if (st === 2) { g.globalAlpha = 0.15; g.drawImage(ts.crumble, x, y); g.globalAlpha = 1; }
          else if (st === 1) g.drawImage(ts.crumble2, x + ((this.frame >> 1) % 2 ? 1 : -1), y);
          else g.drawImage(ts.crumble, x, y);
        } else if (c === '-') g.drawImage(ts.oneway, x, y);
        else if (ts[c]) g.drawImage(ts[c], x, y);
        else if (c === 'S') {
          const key = tx + ',' + ty;
          const a = this.springs.get(key) || 0;
          g.drawImage(a > 0 ? ts.springUp : ts.spring, x, y);
          if (a > 0) this.springs.set(key, a - 1);
        } else if (c === 'o') {
          if (!s.coins[tx + ',' + ty]) g.drawImage(ts.coin[coinF], x, y + (Math.floor(this.frame / 12 + tx) % 2));
        } else if (c === 'C') {
          g.drawImage(s.cpKey === tx + ',' + ty ? ts.cpOn : ts.cpOff, x, y - 16);
        } else if (c === 'G') {
          const open = !level.gate || (s.boss && s.boss.defeated);
          g.drawImage(open ? ts.goal : ts.gateOff, x, y - 16);
          if (open && this.frame % 6 === 0) this.burst(tx * TILE + 8, ty * TILE - 6, 1, ['#ffd23f', '#ffffff'], { spd: 0.6, up: 0.5, life: 30, grav: -0.01 });
        }
      }
    }

    // entidades
    const ents = level.entsNear(ox + VIEW_W / 2);
    const t = s.t;
    for (const e of ents) {
      if (e.t === 'plat') {
        const r = platRect(e, t);
        const x = Math.round(r.x - ox), y = Math.round(r.y - oy);
        g.fillStyle = '#2a2f3f'; g.fillRect(x, y, r.w, 8);
        g.fillStyle = '#8a93b0'; g.fillRect(x + 1, y + 1, r.w - 2, 5);
        g.fillStyle = '#c8d0e8'; g.fillRect(x + 1, y + 1, r.w - 2, 1);
        g.fillStyle = '#ffd23f'; for (let i = 6; i < r.w - 4; i += 12) g.fillRect(x + i, y + 3, 2, 2);
      } else if (e.t === 'saw') {
        const c = sawPos(e, t);
        this.drawSaw(g, Math.round(c.x - ox), Math.round(c.y - oy), c.r, t);
        if (e.p) { // trilho
          g.fillStyle = 'rgba(0,0,0,0.25)';
          const ax = e.x * TILE + 8 - ox, ay = e.y * TILE + 8 - oy, bx = e.x2 * TILE + 8 - ox, by = e.y2 * TILE + 8 - oy;
          if (ax === bx) g.fillRect(ax - 1, Math.min(ay, by), 2, Math.abs(by - ay));
          else g.fillRect(Math.min(ax, bx), ay - 1, Math.abs(bx - ax), 2);
        }
      } else if (e.t === 'laser') {
        g.drawImage(ts.block, e.x * TILE - ox, e.y * TILE - oy);
        const r = laserRect(e);
        g.fillStyle = '#ff3d6e'; g.fillRect(e.x * TILE + 5 - ox, e.y * TILE + 5 - oy, 6, 6);
        if (laserOn(e, t)) {
          const glow = (this.frame >> 1) % 2;
          g.fillStyle = 'rgba(255,61,110,0.35)'; g.fillRect(r.x - 2 - ox, r.y - 2 - oy, r.w + 4, r.h + 4);
          g.fillStyle = '#ff3d6e'; g.fillRect(r.x - ox, r.y - oy, r.w, r.h);
          g.fillStyle = glow ? '#ffffff' : '#ffc2d1';
          if (r.w > r.h) g.fillRect(r.x - ox, r.y + 1 - oy, r.w, 2); else g.fillRect(r.x + 1 - ox, r.y - oy, 2, r.h);
        } else if (laserWarn(e, t) && (this.frame >> 2) % 2) {
          g.fillStyle = 'rgba(255,61,110,0.5)';
          if (r.w > r.h) g.fillRect(r.x - ox, r.y + 2 - oy, r.w, 1); else g.fillRect(r.x + 2 - ox, r.y - oy, 1, r.h);
        }
      } else if (e.t === 'cannon') {
        const x = e.x * TILE - ox, y = e.y * TILE - oy;
        g.drawImage(ts.block, x, y);
        g.fillStyle = '#1b1e28';
        const d = e.dir;
        if (d === 'l') g.fillRect(x - 3, y + 5, 7, 6); else if (d === 'r') g.fillRect(x + 12, y + 5, 7, 6);
        else if (d === 'd') g.fillRect(x + 5, y + 12, 6, 7); else g.fillRect(x + 5, y - 3, 6, 7);
        for (const b of cannonBullets(e, t)) {
          const bx = Math.round(b.x - ox), by = Math.round(b.y - oy);
          g.fillStyle = '#111'; g.fillRect(bx, by, 6, 6);
          g.fillStyle = '#ff7a1a'; g.fillRect(bx + 1, by + 1, 4, 4);
          g.fillStyle = '#ffd166'; g.fillRect(bx + 1, by + 1, 2, 2);
        }
      }
    }

    // chefe
    if (s.boss) {
      const b = s.boss;
      if (!b.defeated || b.deadT > 0) {
        g.save(); g.translate(-ox, -oy);
        if (b.defeated) g.globalAlpha = b.deadT / 90;
        drawBoss(g, b, this.frame);
        g.restore();
      }
      for (const q of s.proj) {
        const x = Math.round(q.x - ox), y = Math.round(q.y - oy);
        g.fillStyle = '#ff3d6e'; g.fillRect(x - 1, y - 1, 8, 8);
        g.fillStyle = '#ffd23f'; g.fillRect(x, y, 6, 6);
        g.fillStyle = '#fff'; g.fillRect(x + 1, y + 1, 2, 2);
      }
    }

    // fantasmas (recordes) e outros jogadores
    for (const gh of ghosts) {
      if (!gh.sim || gh.sim.s.p.dead > 0) continue;
      const gp = gh.sim.s.p;
      this.drawHero(g, gp, ox, oy, gh.skin || 'skin_classic', 0.4, gh.anim || (gh.anim = { sx: 1, sy: 1, run: 0, blink: 0 }), false);
      drawTextCentered(g, gh.label, gp.x + 5 - ox, gp.y - 10 - oy, gh.color || '#cfe', 1, '#000');
    }
    for (const o of others) {
      const fake = { x: o.x, y: o.y, vx: o.vx || 0, vy: 0, onGround: o.a !== 'air', face: o.f, slide: 0, dead: o.a === 'dead' ? 1 : 0 };
      if (fake.dead) continue;
      this.drawHero(g, fake, ox, oy, o.skin || 'skin_classic', 0.6, o.anim || (o.anim = { sx: 1, sy: 1, run: 0, blink: 0 }), false);
      drawTextCentered(g, o.username, o.x + 5 - ox, o.y - 10 - oy, '#ffe680', 1, '#000');
    }

    // jogador
    this.drawCosmeticsBehind(g, p, ox, oy);
    if (p.dead === 0) {
      let extra = null;
      if (this.victory) extra = this.victoryTransform();
      this.drawHero(g, p, ox, oy, this.cos.skin || 'skin_classic', 1, this.anim, true, extra);
    }
    this.drawPet(g, p, ox, oy);
    this.drawParts(g, ox, oy);
    if (this.victory) this.drawVictory(g, p, ox, oy);

    for (const em of emotes) {
      drawEmote(g, em.text, em.x - ox, em.y - oy);
    }

    if (level.endless) {
      const wx = level.wallX(s.t) - ox;
      if (wx > -40) {
        for (let y = 0; y < VIEW_H; y += 2) {
          const wob = Math.round(Math.sin((y + this.frame * 3) * 0.15) * 3);
          g.fillStyle = 'rgba(255,40,120,0.55)'; g.fillRect(0, y, Math.max(0, wx + wob), 2);
          g.fillStyle = '#ff3d9a'; g.fillRect(Math.max(0, wx + wob) - 2, y, 2, 2);
        }
      }
    }

    if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash / 12})`; g.fillRect(0, 0, VIEW_W, VIEW_H); this.flash--; }
    if (hud) hud(g);
  }

  drawBackground(g, theme, ox, oy) {
    const bg = background(theme);
    g.drawImage(bg.sky, 0, 0, VIEW_W, VIEW_H);
    const T = bg.T;
    // decoração distante
    if (T.deco === 'cloud') {
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 157 - ox * 0.1) % 520 + 520) % 520 - 60, cy = 20 + (i * 37) % 60;
        g.fillRect(cx, cy, 36, 6); g.fillRect(cx + 6, cy - 4, 20, 4); g.fillRect(cx + 4, cy + 6, 28, 3);
      }
    } else if (T.deco === 'crystal') {
      for (let i = 0; i < 10; i++) {
        const cx = ((i * 97 - ox * 0.15) % 480 + 480) % 480 - 40, cy = 10 + (i * 53) % 90;
        g.fillStyle = i % 2 ? 'rgba(160,140,255,0.35)' : 'rgba(255,120,220,0.3)';
        g.fillRect(cx, cy, 2, 2); g.fillRect(cx + 1, cy - 2, 1, 6);
      }
    } else if (T.deco === 'snow') {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 40; i++) {
        const x = ((i * 47 + this.frame * (0.3 + (i % 3) * 0.2) - ox * 0.3) % VIEW_W + VIEW_W) % VIEW_W;
        const y = ((i * 31 + this.frame * (0.5 + (i % 4) * 0.15)) % VIEW_H);
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    } else if (T.deco === 'ember') {
      for (let i = 0; i < 30; i++) {
        const x = ((i * 61 - ox * 0.3 + Math.sin(this.frame * 0.02 + i) * 8) % VIEW_W + VIEW_W) % VIEW_W;
        const y = VIEW_H - ((i * 29 + this.frame * (0.4 + (i % 3) * 0.2)) % VIEW_H);
        g.fillStyle = i % 2 ? '#ff7a1a' : '#ffd166';
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    const par = (img, f, yOff) => {
      const w = img.width;
      let x = -((ox * f) % w);
      if (x > 0) x -= w;
      const y = Math.round(yOff - oy * f * 0.5);
      for (; x < VIEW_W; x += w) g.drawImage(img, Math.round(x), y);
    };
    par(bg.far, 0.2, 10);
    par(bg.near, 0.45, 30);
    if (theme === 4) { // brilho de lava no fundo
      g.fillStyle = 'rgba(255,90,30,0.18)'; g.fillRect(0, VIEW_H - 30, VIEW_W, 30);
    }
  }

  drawSaw(g, cx, cy, r, t) {
    g.fillStyle = '#3a3f50';
    const rot = Math.floor(t / 3) % 2;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2 + rot * 0.39;
      g.fillRect(Math.round(cx + Math.cos(ang) * (r + 1)) - 1, Math.round(cy + Math.sin(ang) * (r + 1)) - 1, 3, 3);
    }
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(r * r - y * y));
      g.fillStyle = Math.abs(y) > r - 2 ? '#7a8094' : '#c7ccd9';
      g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
    g.fillStyle = '#e8ebf2'; g.fillRect(cx - r + 2, cy - 2, 3, 1);
    g.fillStyle = '#3a3f50'; g.fillRect(cx - 2, cy - 2, 5, 5);
    g.fillStyle = '#ff3d6e'; g.fillRect(cx - 1, cy - 1, 3, 3);
  }

  drawHero(g, p, ox, oy, skin, alpha, anim, main, extra = null) {
    const fr = heroFrames(skin);
    const dir = p.face < 0 ? 'l' : 'r';
    let name = 'idle';
    if (p.slide) name = 'slide';
    else if (!p.onGround) name = 'air';
    else if (Math.abs(p.vx) > 0.25) {
      anim.run += Math.abs(p.vx);
      name = 'r' + (Math.floor(anim.run / 7) % 4);
    }
    if (main) {
      anim.blink = (anim.blink + 1) % 200;
      anim.sx += (1 - anim.sx) * 0.2; anim.sy += (1 - anim.sy) * 0.2;
    }
    if (name === 'idle' && anim.blink > 192) name = 'idle_blink';
    const img = (p.slide ? (p.slide < 0 ? fr.l : fr.r) : fr[dir])[name] || fr.r.idle;
    const w = Math.round(12 * (anim.sx || 1)), h = Math.round(14 * (anim.sy || 1));
    let x = Math.round(p.x + PHYS.pw / 2 - w / 2 - ox);
    let y = Math.round(p.y + PHYS.ph - h - oy);
    g.globalAlpha = alpha;
    // faixa (bandana) esvoaçante
    const pal = fr.pal;
    const back = p.face < 0 ? x + w : x - 1;
    const speed = Math.min(1, Math.abs(p.vx) / 2.6 + (p.onGround ? 0 : 0.4));
    g.fillStyle = pal.c;
    const len = 3 + Math.round(speed * 4);
    for (let i = 0; i < len; i++) {
      const wave = Math.round(Math.sin(this.frame * 0.3 + i * 0.9) * (0.5 + speed));
      const bx = p.face < 0 ? back + i : back - i;
      g.fillRect(bx, y + 4 + Math.round(i * 0.3 * (1 - speed)) + wave, 1, 2);
    }
    if (extra && extra.rot) {
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(extra.rot); g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
    } else {
      g.drawImage(img, x, y + (extra ? extra.dy : 0), w, h);
    }
    g.globalAlpha = 1;
  }

  drawCosmeticsBehind(g, p, ox, oy) {
    const tr = ITEM_MAP[this.cos.trail];
    this.hist.push({ x: p.x, y: p.y, f: p.face });
    if (this.hist.length > 40) this.hist.shift();
    if (!tr || !tr.fx || p.dead > 0) return;
    const moving = Math.abs(p.vx) > 0.5 || !p.onGround;
    if (tr.fx === 'ghost') {
      if (this.frame % 3 === 0 && moving) this.trail.push({ x: p.x, y: p.y, f: p.face, life: 12 });
      for (const q of this.trail) {
        g.globalAlpha = q.life / 30;
        const fr = heroFrames(this.cos.skin || 'skin_classic');
        g.drawImage((q.f < 0 ? fr.l : fr.r).air, Math.round(q.x - 1 - ox), Math.round(q.y - 2 - oy));
        q.life--;
      }
      g.globalAlpha = 1;
      this.trail = this.trail.filter((q) => q.life > 0);
    } else if (tr.fx === 'fire') {
      if (moving) this.burst(p.x + 5 - p.face * 4, p.y + 8, 2, tr.colors, { spd: 0.4, up: 0.6, life: 18, grav: -0.04 });
    } else if (tr.fx === 'neon' || tr.fx === 'rainbow') {
      const pts = this.hist.slice(-16);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (Math.abs(a.x - b.x) > 20) continue;
        const cols = tr.colors;
        if (tr.fx === 'rainbow') {
          for (let k = 0; k < cols.length; k++) {
            g.fillStyle = cols[k]; g.globalAlpha = i / pts.length;
            g.fillRect(Math.round(b.x + 5 - ox), Math.round(b.y + 2 + k * 2 - oy), Math.max(1, Math.round(Math.abs(b.x - a.x)) + 1), 2);
          }
        } else {
          g.globalAlpha = i / pts.length;
          g.fillStyle = cols[i % 2];
          g.fillRect(Math.round(b.x + 4 - ox), Math.round(b.y + 5 - oy), 2, 2);
        }
      }
      g.globalAlpha = 1;
    }
  }

  drawPet(g, p, ox, oy) {
    const it = ITEM_MAP[this.cos.pet];
    const spr = it && petSprite(it.sprite);
    if (!spr) return;
    const h = this.hist[Math.max(0, this.hist.length - 16)] || p;
    const tx = h.x - (h.f || 1) * 12, ty = h.y - 10;
    if (!this.pet) this.pet = { x: tx, y: ty, f: 1 };
    this.pet.x += (tx - this.pet.x) * 0.15;
    this.pet.y += (ty - this.pet.y) * 0.15;
    this.pet.f = p.x > this.pet.x ? 1 : -1;
    const bob = Math.round(Math.sin(this.frame * 0.12) * 2);
    g.drawImage(this.pet.f < 0 ? spr.l : spr.r, Math.round(this.pet.x - ox), Math.round(this.pet.y - oy + bob));
  }

  // ---------------- animação de vitória (cosmético)
  startVictory() { this.victory = { t: 0, fx: (ITEM_MAP[this.cos.victory] || ITEM_MAP.victory_basic).fx }; }
  victoryTransform() {
    const v = this.victory;
    if (v.fx === 'spin') return { rot: Math.min(1, v.t / 40) * Math.PI * 4, dy: 0 };
    if (v.fx === 'hop' || v.fx === 'crown') return { dy: -Math.round(Math.abs(Math.sin(v.t * 0.15)) * 10) };
    return { dy: -Math.round(Math.abs(Math.sin(v.t * 0.12)) * 6) };
  }
  drawVictory(g, p, ox, oy) {
    const v = this.victory;
    v.t++;
    const cx = p.x + 5, cy = p.y;
    if (v.fx === 'confetti' && v.t % 2 === 0) this.burst(cx, cy - 30, 4, ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'], { spd: 2, up: 1, life: 50, size: 2, grav: 0.04 });
    if (v.fx === 'fireworks' && v.t % 20 === 1) {
      const fx = cx + (Math.random() - 0.5) * 120, fy = cy - 40 - Math.random() * 40;
      this.burst(fx, fy, 40, [['#ff3d6e', '#ffd23f'], ['#3ee0ff', '#ffffff'], ['#8ac926', '#ffca3a']][(v.t / 20 | 0) % 3], { spd: 2.6, up: 0, life: 40, grav: 0.03 });
    }
    if (v.fx === 'crown') {
      const dy = Math.min(0, -30 + v.t);
      const x = Math.round(cx - 5 - ox), y = Math.round(cy - 9 + dy - oy + (this.victoryTransform().dy || 0));
      g.fillStyle = '#b8860b'; g.fillRect(x, y + 3, 10, 4);
      g.fillStyle = '#ffd23f'; g.fillRect(x, y + 3, 10, 3); g.fillRect(x, y, 2, 3); g.fillRect(x + 4, y - 1, 2, 4); g.fillRect(x + 8, y, 2, 3);
      g.fillStyle = '#ff3d6e'; g.fillRect(x + 4, y + 4, 2, 1);
    }
    if (v.fx === 'hop' && v.t % 10 === 0) this.burst(cx, cy, 3, ['#ffd23f'], { spd: 1, life: 20, shape: 'star' });
  }
}

export function drawEmote(g, text, x, y) {
  const isAscii = /^[\x20-\x7E]+$/.test(text);
  const w = isAscii ? textWidth(text) + 8 : 18;
  const bx = Math.round(x - w / 2), by = Math.round(y - 26);
  g.fillStyle = '#000'; g.fillRect(bx - 1, by - 1, w + 2, 15);
  g.fillStyle = '#fff'; g.fillRect(bx, by, w, 13);
  g.fillRect(Math.round(x) - 2, by + 13, 4, 3);
  if (isAscii) drawText(g, text, bx + 4, by + 3, '#1a1030', 1, null);
  else { g.font = '10px sans-serif'; g.textBaseline = 'top'; g.fillText(text, bx + 3, by + 1); }
}

export { shade };
