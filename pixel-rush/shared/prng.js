// PRNG determinístico (mulberry32) — só operações inteiras de 32 bits.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function hash2(a, b) {
  let h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (b >>> 0) ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function randInt(rng, lo, hi) { // inclusivo
  return lo + Math.floor(rng() * (hi - lo + 1));
}
