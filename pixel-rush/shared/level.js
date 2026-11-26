// Construção de fases a partir de mapas ASCII.
// Legenda: '#' bloco  'I' gelo  '-' plataforma atravessável  'X' bloco que desmorona
// '^' 'v' '<' '>' espinhos (direção da ponta)  'S' mola  'o' moeda  'F' chão falso (parece chão, mas cai)
// 'C' checkpoint  'G' chegada  'P' início
import { TILE } from './constants.js';

export const SOLID = { '#': 1, 'I': 1, 'X': 1, '=': 1 };
export const CHUNK_PX = 32 * TILE;

function bucketEnts(ents) {
  const buckets = new Map();
  ents.forEach((e, i) => {
    if (e.id == null) e.id = i;
    let minX = e.x, maxX = e.x;
    if (e.x2 != null) { minX = Math.min(e.x, e.x2); maxX = Math.max(e.x, e.x2) + (e.w || 1); }
    if (e.n) maxX = Math.max(maxX, e.x + e.n);
    if (e.tx0 != null) minX = Math.min(minX, e.tx0);
    if (e.tx1 != null) maxX = Math.max(maxX, e.tx1 + 1);
    if (e.t === 'laser' || e.t === 'cannon') { minX -= (e.len || e.range || 0); maxX += (e.len || e.range || 0); }
    if (e.t === 'boss') { minX -= 64; maxX += 64; }
    const c0 = Math.floor((minX * TILE - 48) / CHUNK_PX);
    const c1 = Math.floor((maxX * TILE + 48) / CHUNK_PX);
    for (let c = c0; c <= c1; c++) {
      if (!buckets.has(c)) buckets.set(c, []);
      buckets.get(c).push(e);
    }
  });
  return buckets;
}

export function gridLevel(def) {
  const rows = def.map;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const grid = new Array(w * h).fill('.');
  let start = null;
  let goal = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = rows[y][x] || '.';
      if (c === ' ') c = '.';
      if (c === 'P') { start = { x: x * TILE + 3, y: (y + 1) * TILE - 12 }; c = '.'; }
      if (c === 'G') goal = { x, y };
      grid[y * w + x] = c;
    }
  }
  if (!start) throw new Error(`Fase ${def.id} sem início (P)`);
  const ents = (def.ents || []).map((e) => ({ ...e }));
  const buckets = bucketEnts(ents);
  const boss = ents.find((e) => e.t === 'boss') || null;
  const empty = [];
  return {
    id: def.id, name: def.name, world: def.world, par: def.par, theme: def.theme ?? def.world,
    w, h, endless: false, start, goal, boss, gate: !!boss,
    heightPx: h * TILE, widthPx: w * TILE,
    grid, ents,
    tileAt(tx, ty) {
      if (tx < 0 || tx >= w) return '#';
      if (ty < 0 || ty >= h) return '.';
      return grid[ty * w + tx];
    },
    entsNear(px) {
      return buckets.get(Math.floor(px / CHUNK_PX)) || empty;
    },
  };
}
