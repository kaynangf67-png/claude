import type { Candle } from "./types.js";

/** Só para testes: gera velas determinísticas e agrega para tempos maiores. */
export function series(n: number, price: (i: number) => number, opts: { start?: number; step?: number; wick?: number } = {}): Candle[] {
  const start = opts.start ?? 1_800_000_000, step = opts.step ?? 300, wick = opts.wick ?? 0.00004;
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const c = price(i), o = i === 0 ? c : price(i - 1);
    out.push({ t: start + i * step, o, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick, c });
  }
  return out;
}

export function aggregate(c: Candle[], k: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i + k <= c.length; i += k) {
    const g = c.slice(i, i + k);
    out.push({ t: g[0].t, o: g[0].o, h: Math.max(...g.map((x) => x.h)), l: Math.min(...g.map((x) => x.l)), c: g[g.length - 1].c });
  }
  return out;
}

/** Gerador pseudoaleatório com semente (mulberry32), para cenários repetíveis. */
export function rng(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Mercado ruidoso (tendência leve + ondas + ruído). `mirror` inverte os preços (compra vira venda). */
export function noisy(seed: number, n: number, mirror = false, drift = 0.0000008, amp = 0.004, period = 55, noise = 0.0006): Candle[] {
  const r = rng(seed), out: Candle[] = [];
  let prev = 1.1;
  for (let i = 0; i < n; i++) {
    const target = 1.1 + i * drift + amp * Math.sin(i / period);
    const c = target + (r() - 0.5) * noise, o = prev;
    out.push({ t: 1_800_000_000 + i * 300, o, c, h: Math.max(o, c) + r() * noise * 0.4, l: Math.min(o, c) - r() * noise * 0.4 });
    prev = c;
  }
  return mirror ? out.map((k) => ({ t: k.t, o: 2.2 - k.o, c: 2.2 - k.c, h: 2.2 - k.l, l: 2.2 - k.h })) : out;
}
