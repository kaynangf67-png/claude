(function(){ const module = { exports: {} };
/*
 * Gerador de candles sintéticos M1 (passeio aleatório com regimes de tendência e lateralidade).
 * Usado APENAS para testar a mecânica do motor e do backtest. Não representa mercado real.
 */


function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function gauss(r) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generate(n, opts) {
  const o = Object.assign({ seed: 42, start: 100, vol: 0.0006, startTime: Date.UTC(2026, 0, 5, 0, 0) }, opts || {});
  const r = rng(o.seed);
  const out = [];
  let price = o.start;
  let drift = 0;
  let regimeLeft = 0;
  for (let i = 0; i < n; i++) {
    if (regimeLeft <= 0) {
      const k = r();
      drift = k < 0.35 ? o.vol * 0.25 : k < 0.7 ? -o.vol * 0.25 : 0;
      regimeLeft = 30 + Math.floor(r() * 150);
    }
    regimeLeft--;
    const open = price;
    const ret = drift + o.vol * gauss(r);
    const close = open * (1 + ret);
    const wick = o.vol * open * Math.abs(gauss(r)) * 0.6;
    const high = Math.max(open, close) + wick * r();
    const low = Math.min(open, close) - wick * r();
    out.push({ time: o.startTime + i * 60000, open, high, low, close });
    price = close;
  }
  return out;
}

module.exports = { generate, rng };
window.M1Synthetic = module.exports; })();
