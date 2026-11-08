// Estratégia SÓ de price action (sem indicadores):
// tendência por estrutura (topos/fundos), Fibonacci do último impulso, pullback
// até a zona 38,2%–78,6%, suporte/resistência (nível anterior) e vela de rejeição.
// Usa apenas velas FECHADAS até a vela analisada (sem olhar o futuro).

export const PA_DEFAULTS = Object.freeze({
  lookback: 60,      // velas analisadas para achar topos/fundos
  pivot: 2,          // topo/fundo = maior/menor que 2 velas de cada lado
  fibMin: 0.382, fibMax: 0.786,
  srTolAtr: 0.35,    // tolerância do suporte/resistência (em ATR)
  minImpulseAtr: 2,  // impulso mínimo (em ATR) para valer o Fibonacci
  roomAtr: 0.3,      // espaço mínimo até a resistência/suporte do impulso
  atrLen: 14,
});
export const PA_REQUIRED = 30;

function atrAt(c, i, len) {
  let s = 0, k = 0;
  for (let j = Math.max(1, i - len + 1); j <= i; j++) { s += Math.max(c[j].high - c[j].low, Math.abs(c[j].high - c[j - 1].close), Math.abs(c[j].low - c[j - 1].close)); k++; }
  return k ? s / k : 0;
}

/** Topos e fundos confirmados (precisam de `k` velas fechadas depois). */
export function swings(c, from, to, k) {
  const highs = [], lows = [];
  for (let j = Math.max(from, k); j <= to - k; j++) {
    let isH = true, isL = true;
    for (let d = 1; d <= k; d++) {
      if (!(c[j].high > c[j - d].high && c[j].high >= c[j + d].high)) isH = false;
      if (!(c[j].low < c[j - d].low && c[j].low <= c[j + d].low)) isL = false;
    }
    if (isH) highs.push({ i: j, p: c[j].high });
    if (isL) lows.push({ i: j, p: c[j].low });
  }
  return { highs, lows };
}

const f5 = (v) => (v == null || !Number.isFinite(v) ? '—' : Number(v).toFixed(5));

export function priceActionDirection(c, i, dir, p = PA_DEFAULTS) {
  const buy = dir === 'CALL';
  const x = c[i];
  const atr = atrAt(c, i, p.atrLen);
  const from = Math.max(0, i - p.lookback);
  const { highs, lows } = swings(c, from, i, p.pivot);
  const checks = [];
  const add = (id, label, ok, detail) => checks.push({ id, label, status: ok ? 'ok' : 'no', detail });

  // 1) Tendência por estrutura
  const [h1, h2] = highs.slice(-2), [l1, l2] = lows.slice(-2);
  const up = h1 && h2 && l1 && l2 && h2.p > h1.p && l2.p > l1.p;
  const down = h1 && h2 && l1 && l2 && h2.p < h1.p && l2.p < l1.p;
  const trendOk = buy ? up : down;
  add('trend', buy ? 'Tendência de alta (topos/fundos subindo)' : 'Tendência de baixa (topos/fundos caindo)', trendOk,
    h2 && l2 ? `topos ${f5(h1?.p)}→${f5(h2.p)} · fundos ${f5(l1?.p)}→${f5(l2.p)}` : 'poucos topos/fundos');

  // 2) Impulso + Fibonacci: alta = último fundo → último topo depois dele
  let imp = null;
  if (buy && highs.length) {
    const H = highs.at(-1); const L = [...lows].reverse().find((l) => l.i < H.i);
    if (L) imp = { start: L, end: H };
  } else if (!buy && lows.length) {
    const L = lows.at(-1); const H = [...highs].reverse().find((h) => h.i < L.i);
    if (H) imp = { start: H, end: L };
  }
  const size = imp ? Math.abs(imp.end.p - imp.start.p) : 0;
  const impOk = !!imp && size >= p.minImpulseAtr * atr;
  // extremo da correção desde o fim do impulso (inclui a vela atual)
  let ext = null, retr = null;
  if (imp) {
    ext = buy ? Infinity : -Infinity;
    for (let j = imp.end.i + 1; j <= i; j++) ext = buy ? Math.min(ext, c[j].low) : Math.max(ext, c[j].high);
    retr = size ? (buy ? (imp.end.p - ext) / size : (ext - imp.end.p) / size) : null;
  }
  const fibOk = impOk && retr != null && retr >= p.fibMin && retr <= p.fibMax;
  add('fib', `Fibonacci ${Math.round(p.fibMin * 1000) / 10}%–${Math.round(p.fibMax * 1000) / 10}%`, fibOk,
    imp ? `impulso ${f5(imp.start.p)}→${f5(imp.end.p)} · correção ${retr != null && Number.isFinite(retr) ? (retr * 100).toFixed(1) + '%' : '—'}${impOk ? '' : ' (impulso pequeno)'}` : 'sem impulso');

  // 3) Pullback: houve correção (2+ velas após o topo/fundo) sem romper o início do impulso
  const barsSince = imp ? i - imp.end.i : 0;
  const notBroken = imp && (buy ? ext > imp.start.p : ext < imp.start.p);
  const pullOk = !!imp && barsSince >= 2 && notBroken && retr > 0;
  add('pull', 'Pullback', pullOk, imp ? `${barsSince} vela(s) de correção${notBroken ? '' : ' · rompeu o início do impulso'}` : '—');

  // 4) Suporte (compra) / resistência (venda): nível anterior perto do fim da correção
  const tol = p.srTolAtr * atr;
  const levels = imp ? (buy ? [...highs.filter((h) => h.i < imp.end.i && h !== imp.end), ...lows.filter((l) => l.i < imp.end.i)]
    : [...lows.filter((l) => l.i < imp.end.i && l !== imp.end), ...highs.filter((h) => h.i < imp.end.i)]) : [];
  const sr = ext != null && Number.isFinite(ext) ? levels.find((lv) => Math.abs(lv.p - ext) <= tol) : null;
  add('sr', buy ? 'Suporte (nível anterior)' : 'Resistência (nível anterior)', !!sr, sr ? `nível ${f5(sr.p)} · correção parou em ${f5(ext)}` : 'nenhum nível anterior na zona');

  // 5) Vela de rejeição a favor da tendência
  const body = Math.abs(x.close - x.open), range = x.high - x.low || 1e-12;
  const rej = buy ? x.close > x.open && (x.close - x.low) / range >= 0.6 : x.close < x.open && (x.high - x.close) / range >= 0.6;
  add('candle', 'Vela de rejeição', rej, `${x.close > x.open ? 'alta' : x.close < x.open ? 'baixa' : 'doji'} · corpo ${(body / range * 100).toFixed(0)}% da vela`);

  // 6) Espaço até a resistência (topo do impulso) / suporte (fundo do impulso)
  const room = imp ? (buy ? imp.end.p - x.close : x.close - imp.end.p) : 0;
  const roomOk = !!imp && room >= p.roomAtr * atr;
  add('room', buy ? 'Espaço até a resistência' : 'Espaço até o suporte', roomOk, imp ? `${f5(room)} (mín. ${f5(p.roomAtr * atr)})` : '—');

  const ok = checks.filter((k) => k.status === 'ok').length;
  const first = checks.find((k) => k.status !== 'ok');
  return { dir, all: !first, checks, score: Math.round((ok / checks.length) * 100), why: first ? `${first.label}: ${first.detail}` : '' };
}

export function analyzePriceActionAt(c, i, meta = {}, p = PA_DEFAULTS) {
  if (i + 1 < PA_REQUIRED) return { status: 'invalid', reason: `Juntando velas para o price action (${i + 1}/${PA_REQUIRED})` };
  const b = priceActionDirection(c, i, 'CALL', p), s = priceActionDirection(c, i, 'PUT', p);
  const best = b.score >= s.score ? b : s;
  const chosen = b.all ? b : s.all ? s : null;
  if (!chosen) return { status: 'no_signal', reason: best.why, best: { dir: best.dir, score: best.score, checks: best.checks } };
  const x = c[i];
  return {
    status: 'signal',
    best: { dir: chosen.dir, score: 100, checks: chosen.checks },
    signal: {
      id: `${meta.symbol ?? 'UNK'}-${x.time}`, symbol: meta.symbol ?? 'UNK', source: meta.source ?? 'unknown', strategy: 'priceAction',
      direction: chosen.dir, score: 100, breakdown: {}, reasons: chosen.checks.map((k) => `${k.label}: ${k.detail}`),
      confirmed: chosen.checks.map((k) => k.label), checks: chosen.checks, patterns: [], snapshot: {},
      confirmCandleTime: x.time, entryTime: x.time + 60_000, expiryTime: x.time + 120_000, refPrice: x.close,
    },
  };
}

export const analyzePriceAction = (c, meta = {}) => analyzePriceActionAt(c, c.length - 1, meta);

export function backtestPriceAction(c, symbol = 'X', p = PA_DEFAULTS) {
  const trades = [];
  for (let i = PA_REQUIRED - 1; i < c.length - 1; i++) {
    if (c[i + 1].time - c[i].time !== 60_000) continue;
    const r = analyzePriceActionAt(c, i, { symbol }, p);
    if (r.status !== 'signal') continue;
    const n = c[i + 1];
    trades.push({ time: n.time, symbol, direction: r.signal.direction, result: n.close === n.open ? 'DRAW' : (r.signal.direction === 'CALL') === (n.close > n.open) ? 'GREEN' : 'LOSS' });
    i++; // uma operação por vez
  }
  return trades;
}
