export function series(n, { start = Date.UTC(2026, 0, 1, 12), drift = 0, base = 100, noise = 0.05, seed = 1 } = {}) {
  let x = seed; const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const out = []; let p = base;
  for (let i = 0; i < n; i++) {
    const o = p; const c = o + drift + (rnd() - 0.5) * noise;
    const h = Math.max(o, c) + rnd() * noise * 0.3; const l = Math.min(o, c) - rnd() * noise * 0.3;
    out.push({ time: start + i * 60000, open: o, high: h, low: l, close: c }); p = c;
  }
  return out;
}
