// Simulação determinística do jogo. Executada no navegador (jogo e fantasmas)
// e no servidor (validação das tentativas). Nenhum uso de Math.sin/cos/random.
import { TILE, PHYS, IN_LEFT, IN_RIGHT, IN_JUMP } from './constants.js';
import { SOLID } from './level.js';
import {
  platRect, sawPos, laserOn, laserRect, cannonBullets, rectsOverlap, circleRect, BOSSES,
  dropRect, popRects,
} from './entities.js';

const PW = PHYS.pw, PH = PHYS.ph;

function newBoss(def) {
  const k = BOSSES[def.kind] || BOSSES.golem;
  return {
    kind: def.kind, x: def.x * TILE, y: (def.y + 1) * TILE - k.h, w: k.w, h: k.h,
    dir: -1, vy: 0, hp: k.hp, maxHp: k.hp, inv: 0, timer: 0, onGround: false,
    defeated: false, deadT: 0,
  };
}

export function createSim(level) {
  const s = {
    t: 0,
    p: {
      x: level.start.x, y: level.start.y, vx: 0, vy: 0,
      onGround: false, onIce: false, coyote: 0, buf: 0, held: false,
      face: 1, lock: 0, lockDir: 0, spring: false, ride: -1, dead: 0, slide: 0,
    },
    cp: { x: level.start.x, y: level.start.y }, cpKey: null,
    deaths: 0, coinCount: 0, coins: {}, cr: {}, tr: {},
    boss: level.boss ? newBoss(level.boss) : null,
    proj: [],
    finished: false, finishT: 0, over: false,
    maxX: level.start.x, ev: [],
  };
  return { level, s };
}

export function cloneSim(sim) {
  return { level: sim.level, s: structuredClone(sim.s) };
}

// ---- tiles --------------------------------------------------------------
function crumbleGone(s, key) {
  const trig = s.cr[key];
  if (trig === undefined) return false;
  const d = s.t - trig;
  return d >= PHYS.crumbleDelay && d < PHYS.crumbleDelay + PHYS.crumbleRespawn;
}

export function isSolid(level, s, tx, ty) {
  const c = level.tileAt(tx, ty);
  if (!SOLID[c]) return false;
  if (c === 'X') return !crumbleGone(s, tx + ',' + ty);
  return true;
}

export function crumbleInfo(s, tx, ty) {
  const trig = s.cr[tx + ',' + ty];
  if (trig === undefined) return 0; // intacto
  const d = s.t - trig;
  if (d < PHYS.crumbleDelay) return 1; // tremendo
  if (d < PHYS.crumbleDelay + PHYS.crumbleRespawn) return 2; // sumiu
  return 0;
}

function rectHitsSolid(level, s, x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.0001) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.0001) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (isSolid(level, s, tx, ty)) return { tx, ty };
  return null;
}

function wallSide(level, s, p) {
  const y0 = Math.floor((p.y + 2) / TILE), y1 = Math.floor((p.y + PH - 2) / TILE);
  const lx = Math.floor((p.x - 2) / TILE), rx = Math.floor((p.x + PW + 1.9999) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    if (isSolid(level, s, rx, ty)) return 1;
    if (isSolid(level, s, lx, ty)) return -1;
  }
  return 0;
}

const SPIKE = {
  '^': [2, 9, 12, 7], 'v': [2, 0, 12, 7], '>': [0, 2, 7, 12], '<': [9, 2, 7, 12],
};

function kill(sim) {
  const { s, level } = sim;
  if (s.p.dead > 0 || s.finished) return;
  s.p.dead = PHYS.respawnTicks;
  s.deaths++;
  s.ev.push('die');
  if (level.endless) { s.over = true; }
}

function respawn(sim) {
  const { s, level } = sim;
  const p = s.p;
  p.x = s.cp.x; p.y = s.cp.y; p.vx = 0; p.vy = 0;
  p.onGround = false; p.coyote = 0; p.buf = 0; p.ride = -1; p.lock = 0; p.spring = false;
  s.cr = {};
  s.tr = {}; // armadilhas se rearmam a cada vida
  s.proj = [];
  if (level.boss && s.boss && !s.boss.defeated) s.boss = newBoss(level.boss);
  s.ev.push('respawn');
}

// ---- passo principal ----------------------------------------------------
export function step(sim, input) {
  const { s, level } = sim;
  s.ev.length = 0;
  if (s.finished || s.over) return;
  s.t++;
  const p = s.p;
  const t = s.t;

  if (p.dead > 0) {
    p.held = !!(input & IN_JUMP);
    p.dead--;
    if (p.dead === 0) respawn(sim);
    return;
  }

  // -- entrada horizontal
  let dir = ((input & IN_RIGHT) ? 1 : 0) - ((input & IN_LEFT) ? 1 : 0);
  if (p.lock > 0) { p.lock--; if (dir === -p.lockDir) dir = 0; }
  const ground = p.onGround;
  const ice = ground && p.onIce;
  if (dir !== 0) {
    const acc = ground ? (ice ? PHYS.accIce : PHYS.accGround) : PHYS.accAir;
    if (p.vx * dir < PHYS.maxRun) {
      p.vx += dir * acc;
      if (p.vx * dir > PHYS.maxRun) p.vx = dir * PHYS.maxRun;
    } else {
      p.vx -= dir * PHYS.overDecay;
      if (p.vx * dir < PHYS.maxRun) p.vx = dir * PHYS.maxRun;
    }
    p.face = dir;
  } else {
    const dec = ground ? (ice ? PHYS.decIce : PHYS.decGround) : PHYS.decAir;
    if (p.vx > 0) p.vx = Math.max(0, p.vx - dec);
    else if (p.vx < 0) p.vx = Math.min(0, p.vx + dec);
  }

  // -- pulo (buffer + coyote time + pulo na parede)
  const jumpDown = !!(input & IN_JUMP);
  if (jumpDown && !p.held) p.buf = PHYS.jumpBuffer;
  else if (p.buf > 0) p.buf--;
  p.held = jumpDown;
  const ws = ground ? 0 : wallSide(level, s, p);
  if (p.buf > 0) {
    if (ground || p.coyote > 0) {
      p.vy = -PHYS.jumpV; p.buf = 0; p.coyote = 0; p.onGround = false; p.spring = false; p.ride = -1;
      s.ev.push('jump');
    } else if (ws !== 0) {
      p.vy = -PHYS.wallJumpVY; p.vx = -ws * PHYS.wallJumpVX; p.buf = 0;
      p.lock = PHYS.wallLock; p.lockDir = -ws; p.face = -ws; p.spring = false;
      s.ev.push('walljump');
    }
  }
  if (!p.held && p.vy < -PHYS.jumpCut && !p.spring) p.vy = -PHYS.jumpCut;

  // -- gravidade
  p.vy += p.vy < 0 ? PHYS.gUp : PHYS.gDown;
  if (p.vy > PHYS.maxFall) p.vy = PHYS.maxFall;
  p.slide = 0;
  if (ws !== 0 && dir === ws && p.vy > PHYS.wallSlide) { p.vy = PHYS.wallSlide; p.slide = ws; }
  else if (ws !== 0 && dir === ws && p.vy > 0) p.slide = ws;
  if (p.vy >= 0) p.spring = false;

  // -- plataforma móvel carregando o jogador
  const ents = level.entsNear(p.x);
  let carryX = 0;
  if (p.ride >= 0) {
    const e = ents.find((q) => q.id === p.ride && q.t === 'plat');
    if (e) {
      const r0 = platRect(e, t - 1), r1 = platRect(e, t);
      carryX = r1.x - r0.x;
      p.y += r1.y - r0.y;
    }
    p.ride = -1;
  }

  // -- movimento X
  const dx = p.vx + carryX;
  p.x += dx;
  const hx = rectHitsSolid(level, s, p.x, p.y, PW, PH);
  if (hx) {
    if (dx > 0) p.x = hx.tx * TILE - PW;
    else if (dx < 0) p.x = (hx.tx + 1) * TILE;
    else { // empurrado sem velocidade: sai para o lado mais próximo
      const cx = p.x + PW / 2, tcx = hx.tx * TILE + TILE / 2;
      p.x = cx < tcx ? hx.tx * TILE - PW : (hx.tx + 1) * TILE;
    }
    p.vx = 0;
  }

  // -- movimento Y
  const prevBottom = p.y + PH;
  p.y += p.vy;
  let landed = false;
  let landTile = null;
  {
    const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + PW - 0.0001) / TILE);
    const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + PH - 0.0001) / TILE);
    let hit = null;
    for (let ty = y0; ty <= y1 && !hit; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (isSolid(level, s, tx, ty)) { hit = { tx, ty }; break; }
        if (p.vy > 0 && level.tileAt(tx, ty) === '-' && prevBottom <= ty * TILE + 0.001) { hit = { tx, ty }; break; }
      }
    if (hit) {
      if (p.vy > 0) { p.y = hit.ty * TILE - PH; landed = true; landTile = hit; }
      else if (p.vy < 0) { p.y = (hit.ty + 1) * TILE; }
      else { p.y = hit.ty * TILE - PH; landed = true; landTile = hit; }
      p.vy = 0;
    }
  }
  // plataformas móveis (atravessáveis por baixo)
  if (!landed && p.vy >= 0) {
    for (const e of ents) {
      if (e.t !== 'plat') continue;
      const r1 = platRect(e, t), r0 = platRect(e, t - 1);
      if (p.x < r1.x + r1.w && p.x + PW > r1.x &&
          prevBottom <= Math.max(r0.y, r1.y) + 0.5 && p.y + PH >= r1.y) {
        p.y = r1.y - PH; p.vy = 0; landed = true; p.ride = e.id;
        break;
      }
    }
  }
  if (landed && !p.onGround && prevBottom < p.y + PH + 0.5) {
    // pouso
  }
  if (landed && !ground) s.ev.push('land');
  p.onGround = landed;
  p.onIce = false;
  if (landed) {
    p.coyote = PHYS.coyote;
    p.spring = false;
    // detecta tile sob os pés (gelo / desmoronar)
    const fy = Math.floor((p.y + PH + 1) / TILE);
    const fx0 = Math.floor(p.x / TILE), fx1 = Math.floor((p.x + PW - 0.0001) / TILE);
    for (let tx = fx0; tx <= fx1; tx++) {
      const c = level.tileAt(tx, fy);
      if (c === 'I') p.onIce = true;
      if (c === 'X') {
        const key = tx + ',' + fy;
        const trig = s.cr[key];
        if (trig === undefined || s.t - trig >= PHYS.crumbleDelay + PHYS.crumbleRespawn) {
          s.cr[key] = s.t; s.ev.push('crumble');
        }
      }
    }
  } else if (p.coyote > 0) p.coyote--;

  // -- gatilhos de tiles (molas, moedas, checkpoints, chegada, espinhos)
  const hurt = { x: p.x + 1, y: p.y + 1, w: PW - 2, h: PH - 2 };
  const body = { x: p.x, y: p.y, w: PW, h: PH };
  {
    const x0 = Math.floor((p.x - 1) / TILE), x1 = Math.floor((p.x + PW) / TILE);
    const y0 = Math.floor((p.y - 16) / TILE), y1 = Math.floor((p.y + PH) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const c = level.tileAt(tx, ty);
        if (c === '.' || c === '#') continue;
        const bx = tx * TILE, by = ty * TILE;
        const sp = SPIKE[c];
        if (sp) {
          if (rectsOverlap(hurt, { x: bx + sp[0], y: by + sp[1], w: sp[2], h: sp[3] })) { kill(sim); return; }
        } else if (c === 'S') {
          if (p.vy >= 0 && rectsOverlap(body, { x: bx + 1, y: by + 10, w: 14, h: 6 })) {
            p.vy = -PHYS.springV; p.spring = true; p.onGround = false; p.coyote = 0; p.ride = -1;
            p.buf = 0;
            s.ev.push('spring');
          }
        } else if (c === 'o') {
          const key = tx + ',' + ty;
          if (!s.coins[key] && rectsOverlap(body, { x: bx + 3, y: by + 3, w: 10, h: 10 })) {
            s.coins[key] = 1; s.coinCount++; s.ev.push('coin');
          }
        } else if (c === 'C') {
          const key = tx + ',' + ty;
          if (s.cpKey !== key && rectsOverlap(body, { x: bx, y: by - 8, w: 16, h: 24 })) {
            s.cpKey = key; s.cp = { x: bx + 3, y: by + TILE - PH }; s.ev.push('checkpoint');
          }
        } else if (c === 'G') {
          if ((!level.gate || (s.boss && s.boss.defeated)) &&
              rectsOverlap(body, { x: bx + 2, y: by - 16, w: 12, h: 32 })) {
            s.finished = true; s.finishT = t; s.ev.push('finish');
            return;
          }
        }
      }
    }
  }

  // -- entidades perigosas
  for (const e of ents) {
    if (e.t === 'saw') {
      const c = sawPos(e, t);
      if (circleRect(c.x, c.y, c.r - 1, hurt)) { kill(sim); return; }
    } else if (e.t === 'laser') {
      if (laserOn(e, t) && rectsOverlap(hurt, laserRect(e))) { kill(sim); return; }
    } else if (e.t === 'cannon') {
      const bl = cannonBullets(e, t);
      for (const b of bl) if (rectsOverlap(hurt, b)) { kill(sim); return; }
    } else if (e.t === 'drop' || e.t === 'pop') {
      const cx = p.x + PW / 2;
      const inRange = cx >= e.tx0 * TILE && cx < (e.tx1 + 1) * TILE;
      if (s.tr[e.id] === undefined && inRange) {
        if (e.t === 'drop' && p.y > e.y * TILE) { s.tr[e.id] = t; s.ev.push('trap'); }
        if (e.t === 'pop' && (e.air === false || !p.onGround)) { s.tr[e.id] = t; s.ev.push('trap'); }
      }
      const trig = s.tr[e.id];
      if (trig === undefined) continue;
      if (e.t === 'drop') {
        const r = dropRect(e, trig, t);
        if (r.state === 'falling' && rectsOverlap(hurt, r)) { kill(sim); return; }
      } else {
        for (const r of popRects(e)) if (rectsOverlap(hurt, r)) { kill(sim); return; }
      }
    }
  }

  // -- chefe
  if (s.boss) {
    stepBoss(sim, prevBottom);
    if (p.dead > 0) return;
  }

  // -- queda / parede perseguidora
  if (!level.endless && p.y > level.heightPx + 24) { kill(sim); return; }
  if (level.endless) {
    if (p.y > level.heightPx + 24) { kill(sim); return; }
    if (p.x < level.wallX(t)) { kill(sim); return; }
  }
  if (p.x > s.maxX) s.maxX = p.x;
}

function bossHitsSolid(level, s, b) {
  return rectHitsSolid(level, s, b.x, b.y, b.w, b.h);
}

function stepBoss(sim, prevBottom) {
  const { s, level } = sim;
  const b = s.boss, p = s.p;
  const k = BOSSES[b.kind] || BOSSES.golem;
  // projéteis
  if (s.proj.length) {
    const keep = [];
    for (const q of s.proj) {
      q.x += q.vx; q.y += q.vy; q.vy += q.g; q.age++;
      const tx = Math.floor((q.x + 3) / TILE), ty = Math.floor((q.y + 3) / TILE);
      if (q.age > 420 || q.y > level.heightPx || isSolid(level, s, tx, ty)) continue;
      keep.push(q);
    }
    s.proj = keep;
  }
  if (b.defeated) { if (b.deadT > 0) b.deadT--; return; }
  b.timer++;
  if (b.inv > 0) b.inv--;
  const angry = b.hp <= Math.ceil(b.maxHp / 2);
  const spd = k.speed * (angry ? 1.4 : 1);
  if (b.timer % 200 === 0) b.dir = p.x + 5 < b.x + b.w / 2 ? -1 : 1;
  b.x += b.dir * spd;
  const hx = bossHitsSolid(level, s, b);
  if (hx) {
    if (b.dir > 0) b.x = hx.tx * TILE - b.w; else b.x = (hx.tx + 1) * TILE;
    b.dir = -b.dir;
  }
  b.vy += 0.4; if (b.vy > 8) b.vy = 8;
  b.y += b.vy;
  b.onGround = false;
  const hy = bossHitsSolid(level, s, b);
  if (hy) {
    if (b.vy > 0) { b.y = hy.ty * TILE - b.h; b.onGround = true; if (b.vy > 3) s.ev.push('bossLand'); }
    else b.y = (hy.ty + 1) * TILE;
    b.vy = 0;
  }
  if (b.onGround && b.timer % k.jumpEvery === 0) b.vy = -k.jumpV;
  if (k.shootEvery && b.timer % (angry ? Math.floor(k.shootEvery * 0.75) : k.shootEvery) === 0) {
    const cx = b.x + b.w / 2 - 3, cy = b.y + b.h - 12;
    const add = (vx, vy, g) => s.proj.push({ x: cx, y: cy, vx, vy, g, age: 0 });
    if (k.pattern === 'side') { add(-2.2, 0, 0); add(2.2, 0, 0); }
    else if (k.pattern === 'arc') { add(-1.6, -4, 0.15); add(1.6, -4, 0.15); }
    else if (k.pattern === 'spread') { add(-1.5, -4.2, 0.15); add(1.5, -4.2, 0.15); add(-2.6, -2.2, 0.15); add(2.6, -2.2, 0.15); }
    s.ev.push('bossShoot');
  }
  // colisão jogador x chefe
  const body = { x: p.x, y: p.y, w: PHYS.pw, h: PHYS.ph };
  const hurt = { x: p.x + 1, y: p.y + 1, w: PHYS.pw - 2, h: PHYS.ph - 2 };
  if (rectsOverlap(body, b)) {
    if (b.inv === 0 && prevBottom <= b.y + 8 && p.vy >= 0) {
      b.hp--; b.inv = 50; p.vy = -6.5; p.spring = true; p.onGround = false;
      s.ev.push('bossHit');
      if (b.hp <= 0) { b.defeated = true; b.deadT = 90; s.proj = []; s.ev.push('bossDown'); }
    } else if (b.inv === 0 && rectsOverlap(hurt, { x: b.x + 3, y: b.y + 4, w: b.w - 6, h: b.h - 4 })) {
      kill(sim); return;
    }
  }
  for (const q of s.proj) {
    if (rectsOverlap(hurt, { x: q.x, y: q.y, w: 6, h: 6 })) { kill(sim); return; }
  }
}

// Executa uma sequência de entradas (RLE) até terminar. Usado no servidor.
export function runInputs(level, rle, maxTicks) {
  const sim = createSim(level);
  let n = 0;
  outer: for (const [mask, count] of rle) {
    for (let i = 0; i < count; i++) {
      step(sim, mask);
      n++;
      if (sim.s.finished || sim.s.over || n >= maxTicks) break outer;
    }
  }
  return { sim, ticks: n };
}
