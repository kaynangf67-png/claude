// Geração procedural determinística (mesma semente => mesmo percurso no
// cliente e no servidor). Usada no Modo Infinito, desafio diário, evento
// mundial semanal e corridas multiplayer.
import { TILE } from './constants.js';
import { mulberry32, hash2, hashString, randInt } from './prng.js';
import { CHUNK_PX } from './level.js';

export const CW = 32;  // largura do bloco em tiles (CHUNK_PX / TILE)
export const GH = 15;  // altura do mundo gerado

function makeChunk() {
  return Array.from({ length: GH }, () => new Array(CW).fill('.'));
}

function genChunk(seed, k, g0, diff, opts) {
  const rng = mulberry32(hash2(seed, k + 1));
  const rows = makeChunk();
  const ents = [];
  let g = g0;
  let x = 0;
  const col = (cx, top, c = '#') => { for (let y = top; y < GH; y++) rows[y][cx] = c; };
  const flat = (n) => { for (let i = 0; i < n && x < CW; i++, x++) col(x, g); };
  const put = (cx, cy, c) => { if (cx >= 0 && cx < CW && cy >= 0 && cy < GH) rows[cy][cx] = c; };
  const coinsAbove = (cx0, n, h = 2) => { for (let i = 0; i < n; i++) put(cx0 + i, g - h, 'o'); };
  const id = (i) => k * 100 + i;
  const bx = k * CW; // deslocamento global em tiles

  if (k === 0) {
    flat(10);
    put(2, g - 1, 'P');
  }
  if (opts.checkpointEvery && k > 0 && k % opts.checkpointEvery === 0) {
    flat(3);
    put(x - 2, g - 1, 'C');
  }

  const pieces = [
    { w: 1, min: 0, fn: () => { const n = randInt(rng, 3, 6); flat(n); if (rng() < 0.35) coinsAbove(x - n + 1, Math.min(3, n - 1), 2 + randInt(rng, 0, 1)); } },
    { w: 1, min: 0, fn: () => { // degrau
      const up = rng() < 0.5;
      const dh = randInt(rng, 1, 2);
      g = Math.max(7, Math.min(12, g + (up ? -dh : dh)));
      flat(randInt(rng, 3, 5));
    } },
    { w: 1.2, min: 0, fn: () => { // buraco
      const n = randInt(rng, 2, 2 + Math.round(2 * diff));
      flat(2); x += n; flat(3);
    } },
    { w: 1, min: 0.05, fn: () => { // espinhos
      const n = randInt(rng, 1, 1 + Math.round(2 * diff));
      flat(2);
      for (let i = 0; i < n && x < CW; i++, x++) { col(x, g); put(x, g - 1, '^'); }
      flat(3);
    } },
    { w: 1, min: 0.15, fn: () => { // plataformas flutuantes
      flat(2);
      const n = randInt(rng, 2, 3);
      for (let i = 0; i < n; i++) {
        x += randInt(rng, 2, 3);
        const h = randInt(rng, 1, 2);
        put(x, g - h, '#'); put(x + 1, g - h, '#');
        if (rng() < 0.5) put(x, g - h - 2, 'o');
        x += 2;
      }
      x += randInt(rng, 2, 3);
      flat(3);
    } },
    { w: 1, min: 0.2, fn: () => { // serra vertical
      flat(2);
      const sx = x + 2;
      flat(5);
      ents.push({ t: 'saw', id: id(ents.length), x: bx + sx, y: g - 5, x2: bx + sx, y2: g - 1, p: randInt(rng, 55, 85), o: randInt(rng, 0, 60) });
    } },
    { w: 0.9, min: 0.25, fn: () => { // plataforma móvel sobre o abismo
      flat(2);
      const n = randInt(rng, 7, 9);
      const x0 = x;
      x += n;
      const range = n - 3;
      ents.push({ t: 'plat', id: id(ents.length), x: bx + x0, y: g - 1, x2: bx + x0 + range, y2: g - 1, w: 3, p: Math.round((range * TILE) / 0.8), o: 0 });
      flat(3);
    } },
    { w: 0.8, min: 0.3, fn: () => { // mola + muro alto
      if (g < 10) { flat(3); return; }
      flat(2);
      put(x, g - 1, 'S'); col(x, g); x++;
      flat(1);
      const top = g - 5;
      for (let i = 0; i < 4 && x < CW; i++, x++) col(x, top);
      coinsAbove(x - 3, 2, 6);
      g = Math.min(12, top + randInt(rng, 2, 3));
      flat(3);
    } },
    { w: 0.9, min: 0.35, fn: () => { // ponte que desmorona
      flat(2);
      const n = randInt(rng, 4, 7);
      for (let i = 0; i < n && x < CW; i++, x++) put(x, g, 'X');
      flat(3);
    } },
    { w: 0.8, min: 0.5, fn: () => { // laser vertical
      flat(2);
      const lx = x + 2;
      flat(5);
      put(lx, g - 6, '#');
      ents.push({ t: 'laser', id: id(ents.length), x: bx + lx, y: g - 6, dir: 'd', len: 5, on: 45, off: 60, o: randInt(rng, 0, 100) });
    } },
    { w: 0.7, min: 0.6, fn: () => { // canhão
      flat(8);
      const cx = x;
      col(x, g - 1); x++;
      ents.push({ t: 'cannon', id: id(ents.length), x: bx + cx, y: g - 1, dir: 'l', range: 7, every: randInt(rng, 80, 110), speed: 2, o: randInt(rng, 0, 60) });
      flat(2);
    } },
  ];
  if (opts.traps) {
    // armadilhas "trollagem": bloco que cai, espinhos que saltam no pouso, chão falso
    pieces.push(
      { w: 1.3, min: 0, fn: () => { // bloco que despenca quando você passa
        flat(2);
        const x0 = x;
        flat(6);
        ents.push({ t: 'drop', id: id(ents.length), x: bx + x0 + 3, y: g - 4, fall: 3, tx0: bx + x0, tx1: bx + x0 + 3 });
      } },
      { w: 1.3, min: 0, fn: () => { // pula o buraco e os espinhos brotam onde você ia cair
        flat(3);
        x += 2;
        const px = x;
        const n = diff > 0.75 ? 2 : 1;
        flat(n + 4);
        ents.push({ t: 'pop', id: id(ents.length), x: bx + px, y: g - 1, n, tx0: bx + px - 4, tx1: bx + px - 1 });
      } },
      { w: 1.1, min: 0, fn: () => { // chão falso: parece firme, mas é buraco
        flat(3);
        const n = randInt(rng, 2, 3);
        for (let i = 0; i < n && x < CW; i++, x++) col(x, g, 'F');
        flat(3);
      } },
    );
  }
  const avail = pieces.filter((p) => diff >= p.min);
  const total = avail.reduce((a, p) => a + p.w, 0);
  while (x < CW - 12) {
    let r = rng() * total;
    let pick = avail[0];
    for (const p of avail) { r -= p.w; if (r <= 0) { pick = p; break; } }
    pick.fn();
  }
  flat(CW - x);
  return { rows, ents, gEnd: g };
}

function chunkedLevel({ id, name, seed, diffAt, finite, chunks, checkpointEvery, theme, traps = false }) {
  const cache = [];
  let lastG = 12;
  const ensure = (k) => {
    while (cache.length <= k) {
      const kk = cache.length;
      if (finite && kk >= chunks) {
        // bloco final com a chegada
        const rows = makeChunk();
        for (let x = 0; x < CW; x++) for (let y = lastG; y < GH; y++) rows[y][x] = '#';
        for (let y = 0; y < GH; y++) rows[y][CW - 1] = '#';
        rows[lastG - 1][10] = 'G';
        cache.push({ rows, ents: [] });
        lastG = lastG;
        continue;
      }
      const c = genChunk(seed, kk, lastG, diffAt(kk), { checkpointEvery, traps });
      lastG = c.gEnd;
      cache.push(c);
    }
    return cache[k];
  };
  const entCache = new Map();
  const first = ensure(0);
  let start = null;
  for (let y = 0; y < GH; y++) for (let x = 0; x < CW; x++) if (first.rows[y][x] === 'P') {
    start = { x: x * TILE + 3, y: (y + 1) * TILE - 12 };
    first.rows[y][x] = '.';
  }
  const maxK = finite ? chunks : Infinity;
  const level = {
    id, name, theme: theme ?? 0, endless: !finite, seed,
    w: finite ? (chunks + 1) * CW : Infinity, h: GH,
    heightPx: GH * TILE, widthPx: finite ? (chunks + 1) * CW * TILE : Infinity,
    start, goal: null, boss: null, gate: false,
    tileAt(tx, ty) {
      if (tx < 0) return '#';
      if (ty < 0 || ty >= GH) return '.';
      const k = Math.floor(tx / CW);
      if (k > maxK) return '#';
      return ensure(k).rows[ty][tx - k * CW];
    },
    entsNear(px) {
      const k = Math.floor(px / CHUNK_PX);
      if (!entCache.has(k)) {
        const list = [];
        for (let kk = Math.max(0, k - 1); kk <= Math.min(maxK, k + 1); kk++) list.push(...ensure(kk).ents);
        entCache.set(k, list);
      }
      return entCache.get(k);
    },
    // parede de energia do Modo Infinito: acelera com o tempo
    wallX(t) { return -400 + 0.9 * t + 0.000025 * t * t; },
  };
  if (finite) {
    const fin = ensure(chunks);
    for (let y = 0; y < GH; y++) if (fin.rows[y][10] === 'G') level.goal = { x: chunks * CW + 10, y };
  }
  return level;
}

export function endlessLevel(seed) {
  return chunkedLevel({
    id: 'endless', name: 'Modo Infinito', seed: seed >>> 0, finite: false,
    diffAt: (k) => Math.min(1, k / 22), checkpointEvery: 0, theme: 0,
  });
}

export function courseLevel(id, { chunks = 5, diff = 0.5, name = 'Percurso', theme } = {}) {
  const seed = hashString(id);
  return chunkedLevel({
    id, name, seed, finite: true, chunks,
    diffAt: (k) => Math.min(1, diff * (0.6 + (0.4 * k) / Math.max(1, chunks - 1))),
    checkpointEvery: 2, theme: theme ?? (seed % 4) + 1,
  });
}

// Fases 20 a 999 do jogo: geradas por semente fixa (iguais para todo mundo), com armadilhas
// e dificuldade que já começa alta e sobe até o máximo.
export function storyGenParams(n) {
  const chunks = Math.min(10, 4 + Math.floor((n - 20) / 120));
  const diff = Math.min(1, 0.6 + (n - 20) / 400);
  const par = Math.round((chunks * CW) / 9.75 * 1.5) + 3;
  return { chunks, diff, par, theme: 1 + (Math.floor(n / 25) % 4) };
}

export function storyGenLevel(n, salt = 0) {
  const { chunks, diff, theme } = storyGenParams(n);
  const id = 'f' + n;
  const seed = hashString(salt ? `${id}:${salt}` : id);
  return chunkedLevel({
    id, name: `Fase ${n}`, seed, finite: true, chunks, traps: true,
    diffAt: (k) => (k === 0 ? Math.min(diff, 0.6) : diff),
    checkpointEvery: 2, theme,
  });
}
