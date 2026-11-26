// Sprites em pixel art gerados por código (sem arquivos de imagem).
import { ITEM_MAP, AVATAR_COLORS } from '/shared/items.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function paint(rows, pal, scale = 1) {
  const h = rows.length, w = rows[0].length;
  const c = canvas(w * scale, h * scale);
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = rows[y][x];
    if (k === '.' || !pal[k]) continue;
    g.fillStyle = pal[k];
    g.fillRect(x * scale, y * scale, scale, scale);
  }
  return c;
}

function flip(src) {
  const c = canvas(src.width, src.height);
  const g = c.getContext('2d');
  g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}

// ---------------- Bonequinho 2D (12x16): menino e menina
const UPPER = {
  male: [
    '...ooooo....',
    '..ohhhhho...',
    '.ohhhhhhho..',
    '.ohsssskso..',
    '.ossssssso..',
    '..ossssSo...',
    '..occccco...',
    '.occccccco..',
    '.occccccco..',
    '.osCCCCCso..',
    '..odddddo...',
    '..odDDDdo...',
  ],
  female: [
    '...ooooo....',
    '.rohhhhho...',
    '.ohhhhhhho..',
    '.ohsssskso..',
    'ohhsssssso..',
    'ohhossssSo..',
    'ohhoccccco..',
    '.ohccccccco.',
    '.occccccco..',
    '.osCCCCCso..',
    '.odddddddo..',
    'odDDDDDDDdo.',
  ],
};
const LEGS = {
  idle: ['...olo.olo..', '...olo.olo..', '...olo.olo..', '..obbo.obbo.'],
  r0: ['..olo...olo.', '.olo.....olo', '.olo.....olo', '.obo.....obo'],
  r1: ['...olo.olo..', '...olo.olo..', '....oloolo..', '...obboobbo.'],
  r2: ['...olo.olo..', '..olo...olo.', '..olo....olo', '..obo....obo'],
  r3: ['...olo.olo..', '...olo.olo..', '....oloolo..', '...obboobbo.'],
  air: ['..olo.olo...', '..olo..olo..', '..obo...obo.', '............'],
  slide: ['...olo.olo..', '...olo.olo..', '...olo.olo..', '..obbo.obbo.'],
};
const fit = (r) => (r + '............').slice(0, 12);
const bodyOf = (skinId) => (skinId === 'skin_female' ? UPPER.female : UPPER.male);
const blinkOf = (rows) => rows.map((r, i) => (i === 3 ? r.replace('k', 'o') : r));

const heroCache = new Map();
export function heroFrames(skinId) {
  if (!ITEM_MAP[skinId] || ITEM_MAP[skinId].slot !== 'skin') skinId = 'skin_male';
  if (heroCache.has(skinId)) return heroCache.get(skinId);
  const pal = { ...ITEM_MAP[skinId].pal };
  const body = bodyOf(skinId);
  const frames = {};
  for (const [name, legs] of Object.entries(LEGS)) {
    frames[name] = paint([...body, ...legs].map(fit), pal);
    frames[name + '_blink'] = paint([...blinkOf(body), ...legs].map(fit), pal);
  }
  const out = { r: frames, l: {}, pal };
  for (const k of Object.keys(frames)) out.l[k] = flip(frames[k]);
  heroCache.set(skinId, out);
  return out;
}

// ---------------- Mascotes (8x8)
const PETS = {
  slime: { rows: ['........', '..oooo..', '.oggggo.', 'oggwgwgo', 'oggkgkgo', 'oggggggo', 'oGGGGGGo', '.oooooo.'], pal: { o: '#0f3d22', g: '#5ee37a', G: '#34a853', w: '#fff', k: '#0f3d22' } },
  bird: { rows: ['..ooo...', '.oyyyo..', 'oywkyyoo', 'oyyyyyrr', 'oyyyyyo.', '.oYYYo..', '..o.o...', '..o.o...'], pal: { o: '#4a2c00', y: '#ffd23f', Y: '#e0a800', w: '#fff', k: '#000', r: '#ff7a1a' } },
  bot: { rows: ['...a....', '..oao...', '.oggggo.', 'ogcgcgo.', 'oggggggo', '.oGGGGo.', '..o..o..', '........'], pal: { o: '#1b1f24', g: '#b8c4d0', G: '#7d8a99', c: '#3ee0ff', a: '#ff3d6e' } },
  dragon: { rows: ['.o....o.', 'oro..oro', 'orrrrrro', 'orwkrwko', 'orrrrrro', '.oRyyRo.', 'oRo..oRo', '.o....o.'], pal: { o: '#3a0d00', r: '#ff5a36', R: '#c43c00', y: '#ffd166', w: '#fff', k: '#000' } },
};
const petCache = new Map();
export function petSprite(kind) {
  if (!kind || !PETS[kind]) return null;
  if (!petCache.has(kind)) {
    const r = paint(PETS[kind].rows, PETS[kind].pal);
    petCache.set(kind, { r, l: flip(r) });
  }
  return petCache.get(kind);
}

// ---------------- Avatares (rosto do bonequinho ampliado)
const avCache = new Map();
export function avatarURL(id, size = 64) {
  const key = id + ':' + size;
  if (avCache.has(key)) return avCache.get(key);
  const [shirt, bg] = AVATAR_COLORS[id] || AVATAR_COLORS.a1;
  const n = Number(String(id).slice(1)) || 1;
  const skin = n % 2 ? 'skin_male' : 'skin_female';
  const pal = { ...ITEM_MAP[skin].pal, c: shirt, C: shade(shirt, -0.25) };
  const spr = paint(bodyOf(skin).slice(0, 10).map(fit), pal);
  const cv = canvas(size, size);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, shade(bg, 0.3)); grd.addColorStop(1, shade(bg, -0.35));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const s = Math.floor(size / 12);
  g.drawImage(spr, Math.round((size - 12 * s) / 2) + s, size - 10 * s, 12 * s, 10 * s);
  const url = cv.toDataURL();
  avCache.set(key, url);
  return url;
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  r = f(r); g = f(g); b = f(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// ---------------- Temas dos mundos
export const THEMES = {
  1: { name: 'prado', sky: ['#62b6ff', '#bfe6ff'], far: '#8fd0a0', near: '#5fb57a', top: '#6bd85c', top2: '#3f9e44', dirt: '#8b5a3c', dirt2: '#6e4330', speck: '#a8744f', plat: '#c58b4f', deco: 'cloud' },
  2: { name: 'caverna', sky: ['#120d26', '#2c1f52'], far: '#2a2050', near: '#3a2d6a', top: '#a08cff', top2: '#6b54d6', dirt: '#3f3563', dirt2: '#2b2447', speck: '#5a4c8a', plat: '#7f70b8', deco: 'crystal' },
  3: { name: 'gelo', sky: ['#8fcff0', '#e7f7ff'], far: '#cfe9f7', near: '#a9d3ea', top: '#f4fcff', top2: '#bfe6f5', dirt: '#5d7fa3', dirt2: '#46668a', speck: '#7da0c2', plat: '#d7f2ff', deco: 'snow' },
  4: { name: 'magma', sky: ['#1f0707', '#5a1a0c'], far: '#3d120c', near: '#5c1d10', top: '#ff7a3d', top2: '#c43c00', dirt: '#3b2626', dirt2: '#261818', speck: '#5c3434', plat: '#8a5a4a', deco: 'ember' },
};

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const tileCache = new Map();
export function tileSet(themeId) {
  if (tileCache.has(themeId)) return tileCache.get(themeId);
  const T = THEMES[themeId] || THEMES[1];
  const make = (fn) => { const c = canvas(16, 16); fn(c.getContext('2d')); return c; };
  const px = (g, x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const dirt = (g, seed) => {
    g.fillStyle = T.dirt; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(hash(seed, i) * 15), y = Math.floor(hash(i, seed) * 15);
      px(g, x, y, T.speck); px(g, x + 1, y, T.dirt2);
    }
    g.fillStyle = T.dirt2; g.fillRect(0, 15, 16, 1);
  };
  const set = {};
  set.mid = [0, 1, 2, 3].map((s) => make((g) => dirt(g, s + 7)));
  set.top = [0, 1, 2, 3].map((s) => make((g) => {
    dirt(g, s + 3);
    g.fillStyle = T.top; g.fillRect(0, 0, 16, 4);
    g.fillStyle = T.top2; g.fillRect(0, 4, 16, 1);
    for (let x = 0; x < 16; x++) if (hash(x, s) < 0.35) px(g, x, 5, T.top2);
    for (let x = 0; x < 16; x += 3) if (hash(s, x) < 0.5) px(g, x, 0, T.top2);
  }));
  set.ice = make((g) => {
    g.fillStyle = '#9fe3ff'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#d9f6ff'; g.fillRect(0, 0, 16, 3);
    g.fillStyle = '#ffffff'; g.fillRect(2, 1, 5, 1); g.fillRect(10, 6, 3, 1); g.fillRect(4, 9, 2, 1);
    g.fillStyle = '#6cc4e8'; g.fillRect(0, 15, 16, 1); g.fillRect(12, 10, 1, 4);
  });
  set.oneway = make((g) => {
    g.fillStyle = T.plat; g.fillRect(0, 0, 16, 5);
    g.fillStyle = shade(T.plat, 0.35); g.fillRect(0, 0, 16, 1);
    g.fillStyle = shade(T.plat, -0.4); g.fillRect(0, 4, 16, 1); g.fillRect(3, 1, 1, 3); g.fillRect(11, 1, 1, 3);
  });
  const crumble = (crack) => make((g) => {
    g.fillStyle = '#b08850'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#d9b878'; g.fillRect(0, 0, 16, 2); g.fillRect(0, 0, 2, 16);
    g.fillStyle = '#6e5028'; g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 16);
    g.fillStyle = '#5a3e1c';
    g.fillRect(4, 3, 1, 4); g.fillRect(5, 7, 1, 3); g.fillRect(10, 5, 1, 5); g.fillRect(11, 10, 2, 1);
    if (crack) { g.fillRect(6, 9, 4, 1); g.fillRect(8, 2, 1, 6); g.fillRect(2, 11, 3, 1); }
  });
  set.crumble = crumble(false);
  set.crumble2 = crumble(true);
  const spike = make((g) => {
    for (let i = 0; i < 2; i++) {
      const bx = 1 + i * 7;
      for (let r = 0; r < 7; r++) {
        const w = Math.floor(r / 2) * 2 + 1;
        const x0 = bx + 3 - Math.floor(w / 2);
        g.fillStyle = '#e8eef5'; g.fillRect(x0, 9 + r, w, 1);
        g.fillStyle = '#8a95a8'; g.fillRect(x0 + w - 1, 9 + r, 1, 1);
      }
      g.fillStyle = '#ffffff'; g.fillRect(bx + 3, 9, 1, 2);
    }
    g.fillStyle = '#4a5468'; g.fillRect(0, 15, 16, 1);
  });
  const rot = (src, ang) => { const c = canvas(16, 16); const g = c.getContext('2d'); g.translate(8, 8); g.rotate(ang); g.drawImage(src, -8, -8); return c; };
  set['^'] = spike; set['v'] = rot(spike, Math.PI); set['>'] = rot(spike, Math.PI / 2); set['<'] = rot(spike, -Math.PI / 2);
  set.spring = make((g) => {
    g.fillStyle = '#c0c8d0'; for (let y = 11; y < 15; y += 2) g.fillRect(4, y, 8, 1);
    g.fillStyle = '#ff3d6e'; g.fillRect(2, 9, 12, 3); g.fillStyle = '#ff9ab0'; g.fillRect(2, 9, 12, 1);
    g.fillStyle = '#5a6470'; g.fillRect(2, 15, 12, 1);
  });
  set.springUp = make((g) => {
    g.fillStyle = '#c0c8d0'; for (let y = 6; y < 15; y += 2) g.fillRect(5, y, 6, 1);
    g.fillStyle = '#ff3d6e'; g.fillRect(2, 3, 12, 3); g.fillStyle = '#ff9ab0'; g.fillRect(2, 3, 12, 1);
    g.fillStyle = '#5a6470'; g.fillRect(2, 15, 12, 1);
  });
  set.coin = [0, 1, 2, 3].map((f) => make((g) => {
    const w = [8, 6, 2, 6][f];
    const x0 = 8 - w / 2;
    g.fillStyle = '#b8860b'; g.fillRect(x0, 4, w, 8); g.fillRect(x0 + 1, 3, Math.max(1, w - 2), 10);
    g.fillStyle = '#ffd23f'; g.fillRect(x0 + 1, 4, Math.max(1, w - 2), 8);
    if (w > 2) { g.fillStyle = '#fff4b8'; g.fillRect(x0 + 1, 5, 1, 4); }
  }));
  const flag = (col, lit) => { const c = canvas(16, 32); const g = c.getContext('2d');
    g.fillStyle = '#5a5a6e'; g.fillRect(3, 4, 2, 28); g.fillStyle = '#9aa0b8'; g.fillRect(3, 4, 1, 28);
    g.fillStyle = col; g.fillRect(5, 5, 9, 7); g.fillStyle = shade(col, -0.3); g.fillRect(5, 11, 9, 1);
    if (lit) { g.fillStyle = shade(col, 0.5); g.fillRect(6, 6, 3, 1); }
    g.fillStyle = '#ffd23f'; g.fillRect(2, 2, 4, 3);
    return c; };
  set.cpOff = flag('#7a7a8c', false);
  set.cpOn = flag('#3ee07a', true);
  set.goal = (() => { const c = canvas(16, 32); const g = c.getContext('2d');
    g.fillStyle = '#5a5a6e'; g.fillRect(2, 2, 2, 30); g.fillStyle = '#c8cee0'; g.fillRect(2, 2, 1, 30);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(4 + x * 2, 3 + y * 2, 2, 2); }
    g.fillStyle = '#ffd23f'; g.fillRect(1, 0, 4, 3);
    return c; })();
  set.gateOff = (() => { const c = canvas(16, 32); const g = c.getContext('2d');
    g.globalAlpha = 0.35; g.drawImage(set.goal, 0, 0); return c; })();
  set.block = make((g) => { // bloco de emissor / canhão
    g.fillStyle = '#4a4f63'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#6a7088'; g.fillRect(0, 0, 16, 2); g.fillRect(0, 0, 2, 16);
    g.fillStyle = '#2c3040'; g.fillRect(0, 14, 16, 2); g.fillRect(14, 0, 2, 16);
    g.fillStyle = '#9aa0b8'; g.fillRect(3, 3, 1, 1); g.fillRect(12, 3, 1, 1); g.fillRect(3, 12, 1, 1); g.fillRect(12, 12, 1, 1);
  });
  set.T = T;
  tileCache.set(themeId, set);
  return set;
}

// fundo com parallax (montanhas geradas)
const bgCache = new Map();
export function background(themeId) {
  if (bgCache.has(themeId)) return bgCache.get(themeId);
  const T = THEMES[themeId] || THEMES[1];
  const W = 768, H = 216;
  const layer = (col, base, amp, seed, jag) => {
    const c = canvas(W, H); const g = c.getContext('2d');
    g.fillStyle = col;
    let y = base;
    for (let x = 0; x < W; x++) {
      const n = hash(Math.floor(x / jag), seed);
      const target = base - n * amp;
      y += (target - y) * 0.08;
      g.fillRect(x, Math.round(y), 1, H - Math.round(y));
    }
    return c;
  };
  const far = layer(T.far, 150, 70, 11, 40);
  const near = layer(T.near, 185, 50, 23, 24);
  const sky = canvas(1, H); { const g = sky.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, T.sky[0]); gr.addColorStop(1, T.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, 1, H); }
  const out = { sky, far, near, T };
  bgCache.set(themeId, out);
  return out;
}

// chefes desenhados proceduralmente
const BOSS_PAL = {
  golem: { o: '#1c2a12', b: '#6e8f4a', B: '#4a6630', h: '#9cc070', e: '#ffd23f', m: '#3a2a1a' },
  aranha: { o: '#120a26', b: '#8a6cff', B: '#5a3fd0', h: '#d0c4ff', e: '#ff3d6e', m: '#2a1a50' },
  yeti: { o: '#203040', b: '#f0f8ff', B: '#b8d4e8', h: '#ffffff', e: '#3d8bff', m: '#5b7a99' },
  dragao: { o: '#2a0500', b: '#ff5a36', B: '#c43c00', h: '#ffb070', e: '#ffd23f', m: '#5a1000' },
};
export function drawBoss(g, b, t) {
  const P = BOSS_PAL[b.kind] || BOSS_PAL.golem;
  const x = Math.round(b.x), y = Math.round(b.y), w = b.w, h = b.h;
  const flash = b.inv > 0 && Math.floor(t / 4) % 2 === 0;
  const squish = b.onGround ? 0 : -1;
  g.fillStyle = P.o; g.fillRect(x - 1, y - 1 + squish, w + 2, h + 2 - squish);
  g.fillStyle = flash ? '#ffffff' : P.b; g.fillRect(x, y + squish, w, h - squish);
  if (!flash) {
    g.fillStyle = P.B; g.fillRect(x, y + h - 6, w, 6);
    g.fillStyle = P.h; g.fillRect(x + 2, y + 2 + squish, w - 8, 2); g.fillRect(x + 2, y + 2, 2, 6);
  }
  // olhos olhando para a direção
  const ex = b.dir > 0 ? x + w - 13 : x + 3;
  g.fillStyle = '#fff'; g.fillRect(ex, y + 8, 4, 5); g.fillRect(ex + 6, y + 8, 4, 5);
  g.fillStyle = P.e; g.fillRect(ex + (b.dir > 0 ? 2 : 0), y + 10, 2, 3); g.fillRect(ex + 6 + (b.dir > 0 ? 2 : 0), y + 10, 2, 3);
  // sobrancelhas bravas na fase 2
  if (b.hp <= Math.ceil(b.maxHp / 2)) { g.fillStyle = P.o; g.fillRect(ex - 1, y + 6, 5, 1); g.fillRect(ex + 6, y + 6, 5, 1); }
  g.fillStyle = P.m; g.fillRect(x + w / 2 - 5, y + h - 10, 10, 2);
  if (b.kind === 'aranha') { g.fillStyle = P.o; for (let i = 0; i < 3; i++) { g.fillRect(x - 4, y + 8 + i * 5, 4, 1); g.fillRect(x + w, y + 8 + i * 5, 4, 1); } }
  if (b.kind === 'dragao') { g.fillStyle = P.h; g.fillRect(x + 4, y - 5, 3, 5); g.fillRect(x + w - 7, y - 5, 3, 5); }
  if (b.kind === 'yeti') { g.fillStyle = P.B; for (let i = 0; i < w; i += 4) g.fillRect(x + i, y - 2, 2, 2); }
  if (b.kind === 'golem') { g.fillStyle = '#4a9a3a'; g.fillRect(x + 3, y - 3, 6, 3); g.fillRect(x + w - 10, y - 2, 5, 2); }
}
