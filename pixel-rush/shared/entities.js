// Entidades móveis descritas como funções puras do tick global `t`.
// Assim cliente, servidor e fantasmas calculam posições idênticas sem estado.
import { TILE } from './constants.js';

export function pingpong(t, p, o) {
  const ph = (t + (o || 0)) % (2 * p);
  return ph < p ? ph / p : (2 * p - ph) / p;
}

export function platRect(e, t) {
  const u = pingpong(t, e.p, e.o);
  return {
    x: (e.x + (e.x2 - e.x) * u) * TILE,
    y: (e.y + (e.y2 - e.y) * u) * TILE,
    w: e.w * TILE,
    h: 8,
  };
}

export function sawPos(e, t) {
  const u = e.p ? pingpong(t, e.p, e.o) : 0;
  return {
    x: (e.x + (e.x2 - e.x) * u) * TILE + TILE / 2,
    y: (e.y + (e.y2 - e.y) * u) * TILE + TILE / 2,
    r: e.r || 7,
  };
}

export function laserOn(e, t) {
  return (t + (e.o || 0)) % (e.on + e.off) < e.on;
}
// aviso visual: o laser pisca antes de ligar
export function laserWarn(e, t) {
  const ph = (t + (e.o || 0)) % (e.on + e.off);
  return ph >= e.on + e.off - 30;
}

export function laserRect(e) {
  const L = e.len * TILE;
  const cx = e.x * TILE, cy = e.y * TILE;
  switch (e.dir) {
    case 'r': return { x: cx + TILE, y: cy + 6, w: L, h: 4 };
    case 'l': return { x: cx - L, y: cy + 6, w: L, h: 4 };
    case 'd': return { x: cx + 6, y: cy + TILE, w: 4, h: L };
    default:  return { x: cx + 6, y: cy - L, w: 4, h: L }; // 'u'
  }
}

const DIRS = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] };

// Projéteis do canhão: calculados a partir do tick, sem estado.
export function cannonBullets(e, t) {
  const out = [];
  const [dx, dy] = DIRS[e.dir] || DIRS.r;
  const life = Math.floor((e.range * TILE) / e.speed);
  const every = e.every;
  const mx = e.x * TILE + TILE / 2 + dx * 9 - 3;
  const my = e.y * TILE + TILE / 2 + dy * 9 - 3;
  let f = t - ((t + (e.o || 0)) % every);
  while (t - f < life && f >= 0) {
    const age = t - f;
    out.push({ x: mx + dx * e.speed * age, y: my + dy * e.speed * age, w: 6, h: 6 });
    f -= every;
  }
  return out;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleRect(cx, cy, r, rc) {
  const nx = cx < rc.x ? rc.x : cx > rc.x + rc.w ? rc.x + rc.w : cx;
  const ny = cy < rc.y ? rc.y : cy > rc.y + rc.h ? rc.y + rc.h : cy;
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export const BOSSES = {
  golem:   { name: 'Golem de Musgo',     hp: 3, w: 28, h: 28, speed: 0.9, jumpEvery: 150, jumpV: 7.0, shootEvery: 0,   pattern: null },
  aranha:  { name: 'Aranha de Cristal',  hp: 4, w: 28, h: 24, speed: 1.15, jumpEvery: 120, jumpV: 7.2, shootEvery: 130, pattern: 'side' },
  yeti:    { name: 'Yeti Glacial',       hp: 4, w: 28, h: 30, speed: 1.3, jumpEvery: 100, jumpV: 7.8, shootEvery: 110, pattern: 'arc' },
  dragao:  { name: 'Dragão de Magma',    hp: 5, w: 30, h: 30, speed: 1.45, jumpEvery: 95,  jumpV: 8.0, shootEvery: 85,  pattern: 'spread' },
};

// ---------- armadilhas "trollagem" (disparam quando o jogador chega perto) ----------
export const DROP_DELAY = 6;  // ticks entre o disparo e o bloco começar a cair
// Bloco que cai: posição a partir do tick do disparo (null = ainda não disparou)
export function dropRect(e, trig, t) {
  const w = (e.w || 1) * TILE;
  const x = e.x * TILE, y0 = e.y * TILE;
  const max = (e.fall || 6) * TILE;
  if (trig == null) return { x, y: y0, w, h: TILE, state: 'armed' };
  const dt = t - trig - DROP_DELAY;
  if (dt <= 0) return { x: x + ((t >> 1) % 2 ? 1 : -1), y: y0, w, h: TILE, state: 'shake' };
  const off = Math.min(max, 0.3 * dt * dt);
  return { x, y: y0 + off, w, h: TILE, state: off >= max ? 'landed' : 'falling' };
}
// Espinhos escondidos: retângulos que matam depois de disparados
export function popRects(e) {
  const out = [];
  for (let i = 0; i < (e.n || 1); i++) out.push({ x: (e.x + i) * TILE + 2, y: e.y * TILE + 9, w: 12, h: 7 });
  return out;
}
