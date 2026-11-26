// Bot de busca em feixe (beam search) usado para PROVAR que cada fase é
// completável com a física real. Gera também replays de teste para o servidor.
import { createSim, step } from '../shared/sim.js';
import { IN_LEFT as L, IN_RIGHT as R, IN_JUMP as J, TILE } from '../shared/constants.js';
import { SOLID } from '../shared/level.js';

const N = 6;
const rep = (m, n = N) => new Array(n).fill(m);
const ACTIONS = [
  rep(R), rep(R | J), rep(L), rep(L | J), rep(0), rep(J),
  [R | J, R | J, R, R, R, R], [L | J, L | J, L, L, L, L],
  [R | J, R, R, R, R, R], [L | J, L, L, L, L, L],
];

function fastClone(s) {
  return {
    ...s,
    p: { ...s.p }, cp: s.cp, coins: { ...s.coins }, cr: { ...s.cr }, tr: { ...s.tr },
    boss: s.boss ? { ...s.boss } : null,
    proj: s.proj.map((q) => ({ ...q })), ev: [],
  };
}

function distField(level) {
  if (!level.goal || level.endless) return null;
  const { w, h } = level;
  const d = new Int32Array(w * h).fill(-1);
  const q = [];
  const gi = level.goal.y * w + level.goal.x;
  d[gi] = 0; q.push(gi);
  const blocked = (c) => SOLID[c] && c !== 'X' || c === '^' || c === 'v' || c === '<' || c === '>';
  for (let i = 0; i < q.length; i++) {
    const cur = q[i], x = cur % w, y = (cur / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (d[ni] >= 0 || blocked(level.tileAt(nx, ny))) continue;
      d[ni] = d[cur] + 1; q.push(ni);
    }
  }
  return d;
}

export function solve(level, { width = 500, maxTicks = 60 * 300, log = false } = {}) {
  const field = distField(level);
  const H = (s) => {
    const p = s.p;
    if (level.endless || !field) return -p.x;
    let hv;
    const tx = Math.floor((p.x + 5) / TILE), ty = Math.floor((p.y + 6) / TILE);
    const v = tx >= 0 && ty >= 0 && tx < level.w && ty < level.h ? field[ty * level.w + tx] : -1;
    hv = v < 0 ? 9999 : v * TILE;
    if (level.gate && s.boss && !s.boss.defeated) {
      const b = s.boss;
      hv = 20000 * b.hp + Math.abs(p.x - b.x) + Math.max(0, p.y - (b.y - 30)) * 2;
    }
    return hv;
  };
  const root = { s: createSim(level).s, parent: null, a: -1 };
  let beam = [root];
  const seen = new Set();
  const visits = new Map(); // novidade: penaliza células muito visitadas (evita mínimos locais)
  const cellOf = (s) => `${Math.floor(s.p.x / TILE)},${Math.floor(s.p.y / TILE)}`;
  for (let it = 0; it * N < maxTicks; it++) {
    const next = [];
    for (const node of beam) {
      for (let ai = 0; ai < ACTIONS.length; ai++) {
        const s = fastClone(node.s);
        const sim = { level, s };
        let bad = false;
        for (const m of ACTIONS[ai]) {
          step(sim, m);
          if (s.finished) break;
          if (s.p.dead > 0 || s.over) { bad = true; break; }
        }
        if (bad) continue;
        const child = { s, parent: node, a: ai };
        if (s.finished) return { ok: true, inputs: rebuild(child), ticks: s.finishT, iters: it };
        const p = s.p;
        const key = `${Math.round(p.x / 3)},${Math.round(p.y / 3)},${Math.round(p.vx)},${Math.round(p.vy / 2)},${p.onGround ? 1 : 0},${Math.floor(s.t / 24)},${s.boss ? s.boss.hp : 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        child.h = H(s) + (visits.get(cellOf(s)) || 0) * 0.05;
        next.push(child);
      }
    }
    if (!next.length) return { ok: false, reason: 'sem estados', iters: it, best: bestOf(beam, H) };
    next.sort((a, b) => a.h - b.h || a.s.t - b.s.t);
    // diversidade: mantém os melhores e uma amostra espalhada do restante
    const keep = next.slice(0, width * 0.8 | 0);
    const rest = next.slice(width * 0.8 | 0);
    const stepN = Math.max(1, Math.floor(rest.length / (width * 0.2)));
    for (let i = 0; i < rest.length && keep.length < width; i += stepN) keep.push(rest[i]);
    beam = keep;
    for (const n of beam) { const c = cellOf(n.s); visits.set(c, (visits.get(c) || 0) + 1); }
    if (log && it % 50 === 0) console.log('it', it, 'h', beam[0].h, 'x', beam[0].s.p.x.toFixed(0), 'y', beam[0].s.p.y.toFixed(0));
  }
  return { ok: false, reason: 'tempo', best: bestOf(beam, H) };
}

function bestOf(beam, H) {
  const b = beam[0];
  return b ? { x: Math.round(b.s.p.x / TILE), y: Math.round(b.s.p.y / TILE), h: b.h } : null;
}

function rebuild(node) {
  const acts = [];
  let n = node;
  while (n && n.a >= 0) { acts.push(n.a); n = n.parent; }
  acts.reverse();
  const rle = [];
  let total = 0;
  const lastT = node.s.finishT;
  for (const a of acts) for (const m of ACTIONS[a]) {
    if (total >= lastT) break;
    const r = rle[rle.length - 1];
    if (r && r[0] === m) r[1]++; else rle.push([m, 1]);
    total++;
  }
  return rle;
}
