// Gravação de entradas em RLE: [[máscara, repetições], ...]
import { MAX_RUN_TICKS } from './constants.js';

export class InputRecorder {
  constructor() { this.rle = []; this.ticks = 0; }
  push(mask) {
    const last = this.rle[this.rle.length - 1];
    if (last && last[0] === mask) last[1]++;
    else this.rle.push([mask, 1]);
    this.ticks++;
  }
  toJSON() { return this.rle; }
}

export function rleTicks(rle) {
  let n = 0;
  for (const r of rle) n += r[1];
  return n;
}

// Valida o formato antes de simular (proteção do servidor).
export function sanitizeRle(rle) {
  if (!Array.isArray(rle) || rle.length === 0 || rle.length > 200000) return null;
  let total = 0;
  const out = new Array(rle.length);
  for (let i = 0; i < rle.length; i++) {
    const r = rle[i];
    if (!Array.isArray(r) || r.length !== 2) return null;
    const m = r[0], c = r[1];
    if (!Number.isInteger(m) || m < 0 || m > 7) return null;
    if (!Number.isInteger(c) || c < 1 || c > MAX_RUN_TICKS) return null;
    total += c;
    if (total > MAX_RUN_TICKS) return null;
    out[i] = [m, c];
  }
  return out;
}

export function expandRle(rle) {
  const out = [];
  for (const [m, c] of rle) for (let i = 0; i < c; i++) out.push(m);
  return out;
}
