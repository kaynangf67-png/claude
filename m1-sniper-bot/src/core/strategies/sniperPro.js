// "M1 SNIPER PRO" — tradução fiel do script Pine v6 do usuário.
// Regras (todas precisam ser verdadeiras, só com a vela FECHADA):
//   Tendência: close > EMA200, EMA9 > EMA21, EMA200 > EMA200[3]   (venda: o inverso)
//   Força:     ADX(14,14) >= 18 e +DI > −DI                        (venda: −DI > +DI)
//   RSI(14):   52..72                                              (venda: 28..48)
//   MACD(12,26,9): hist > 0 e hist > hist[1]                       (venda: hist < 0 e caindo)
//   Pullback:  low[1] <= EMA9[1] ou low[1] <= EMA21[1]             (venda: high[1] >= …)
//   Candle:    alta, close > EMA9, corpo >= 0,15 × ATR(14)          (venda: o inverso)
//   Intervalo: >= 3 velas desde o último sinal
// Indicadores no padrão do TradingView: EMA semeada com SMA; RSI/ATR/DMI com RMA (Wilder).

export const SNIPER_PRO_DEFAULTS = Object.freeze({
  emaFast: 9, emaSlow: 21, emaTrend: 200, rsiLen: 14, adxLen: 14, adxSmooth: 14,
  minADX: 18, cooldown: 3, atrLen: 14, atrBodyMult: 0.15,
  rsiBuyMin: 52, rsiBuyMax: 72, rsiSellMin: 28, rsiSellMax: 48,
});

/** EMA estilo Pine (ignora valores nulos iniciais; semente = SMA). */
function emaPine(src, len) {
  const out = new Array(src.length).fill(null);
  const a = 2 / (len + 1);
  let seed = [], prev = null;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) continue;
    if (prev == null) {
      seed.push(v);
      if (seed.length === len) { prev = seed.reduce((x, y) => x + y, 0) / len; out[i] = prev; }
      continue;
    }
    prev = a * v + (1 - a) * prev; out[i] = prev;
  }
  return out;
}

/** RMA (Wilder) estilo Pine: semente = SMA dos primeiros `len` valores. */
function rma(src, len) {
  const out = new Array(src.length).fill(null);
  let seed = [], prev = null;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) continue;
    if (prev == null) {
      seed.push(v);
      if (seed.length === len) { prev = seed.reduce((x, y) => x + y, 0) / len; out[i] = prev; }
      continue;
    }
    prev = (prev * (len - 1) + v) / len; out[i] = prev;
  }
  return out;
}

export function computeSniperPro(candles, p = SNIPER_PRO_DEFAULTS) {
  const n = candles.length;
  const close = candles.map((c) => c.close);
  const ema9 = emaPine(close, p.emaFast), ema21 = emaPine(close, p.emaSlow), ema200 = emaPine(close, p.emaTrend);
  // RSI
  const up = [null], dn = [null];
  for (let i = 1; i < n; i++) { const d = close[i] - close[i - 1]; up.push(Math.max(d, 0)); dn.push(Math.max(-d, 0)); }
  const ru = rma(up, p.rsiLen), rd = rma(dn, p.rsiLen);
  const rsi = ru.map((u, i) => (u == null || rd[i] == null ? null : rd[i] === 0 ? 100 : u === 0 ? 0 : 100 - 100 / (1 + u / rd[i])));
  // TR / ATR / DMI
  const tr = [null], pdm = [null], mdm = [null];
  for (let i = 1; i < n; i++) {
    const c = candles[i], pc = candles[i - 1];
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - pc.close), Math.abs(c.low - pc.close)));
    const upM = c.high - pc.high, dnM = pc.low - c.low;
    pdm.push(upM > dnM && upM > 0 ? upM : 0);
    mdm.push(dnM > upM && dnM > 0 ? dnM : 0);
  }
  const atr = rma(tr, p.atrLen);
  const trR = rma(tr, p.adxLen), pR = rma(pdm, p.adxLen), mR = rma(mdm, p.adxLen);
  const diPlus = trR.map((t, i) => (t == null || pR[i] == null ? null : t === 0 ? 0 : 100 * pR[i] / t));
  const diMinus = trR.map((t, i) => (t == null || mR[i] == null ? null : t === 0 ? 0 : 100 * mR[i] / t));
  const dx = diPlus.map((pl, i) => (pl == null || diMinus[i] == null ? null : (pl + diMinus[i] === 0 ? 0 : 100 * Math.abs(pl - diMinus[i]) / (pl + diMinus[i]))));
  const adx = rma(dx, p.adxSmooth);
  // MACD 12/26/9
  const e12 = emaPine(close, 12), e26 = emaPine(close, 26);
  const macd = e12.map((v, i) => (v == null || e26[i] == null ? null : v - e26[i]));
  const sig = emaPine(macd, 9);
  const hist = macd.map((m, i) => (m == null || sig[i] == null ? null : m - sig[i]));
  return { ema9, ema21, ema200, rsi, adx, diPlus, diMinus, hist, atr, p };
}

export const sniperProRequired = (p = SNIPER_PRO_DEFAULTS) => Math.max(p.emaTrend + 3, 26 + 9, 2 * p.adxLen + 1) + 1;

const f = (v, d = 5) => (v == null ? '—' : Number(v).toFixed(d));

/** Avalia as regras do script na vela i para uma direção. */
export function sniperProDirection(candles, ind, i, dir, lastSignalIndex = null) {
  const { ema9, ema21, ema200, rsi, adx, diPlus, diMinus, hist, atr, p } = ind;
  const x = candles[i], prev = candles[i - 1];
  const buy = dir === 'CALL';
  const tend = buy ? x.close > ema200[i] && ema9[i] > ema21[i] && ema200[i] > ema200[i - 3]
    : x.close < ema200[i] && ema9[i] < ema21[i] && ema200[i] < ema200[i - 3];
  const forca = adx[i] >= p.minADX && (buy ? diPlus[i] > diMinus[i] : diMinus[i] > diPlus[i]);
  const rsiOk = buy ? rsi[i] >= p.rsiBuyMin && rsi[i] <= p.rsiBuyMax : rsi[i] <= p.rsiSellMax && rsi[i] >= p.rsiSellMin;
  const macdOk = buy ? hist[i] > 0 && hist[i] > hist[i - 1] : hist[i] < 0 && hist[i] < hist[i - 1];
  const pull = buy ? prev.low <= ema9[i - 1] || prev.low <= ema21[i - 1] : prev.high >= ema9[i - 1] || prev.high >= ema21[i - 1];
  const candle = buy ? x.close > x.open && x.close > ema9[i] && x.close - x.open >= atr[i] * p.atrBodyMult
    : x.close < x.open && x.close < ema9[i] && x.open - x.close >= atr[i] * p.atrBodyMult;
  const pode = lastSignalIndex == null || i - lastSignalIndex >= p.cooldown;
  const checks = [
    { id: 'trend', label: 'Tendência (EMA 9/21/200)', status: tend ? 'ok' : 'no', detail: `EMA9 ${ema9[i] > ema21[i] ? '>' : '<'} EMA21 · preço ${x.close > ema200[i] ? 'acima' : 'abaixo'} EMA200 (${ema200[i] > ema200[i - 3] ? 'subindo' : 'caindo'})` },
    { id: 'adx', label: `Força ADX ≥ ${p.minADX}`, status: forca ? 'ok' : 'no', detail: `${f(adx[i], 1)} · +DI ${f(diPlus[i], 0)} / −DI ${f(diMinus[i], 0)}` },
    { id: 'rsi', label: `RSI ${p.rsiLen}`, status: rsiOk ? 'ok' : 'no', detail: `${f(rsi[i], 1)} (${buy ? `${p.rsiBuyMin}–${p.rsiBuyMax}` : `${p.rsiSellMin}–${p.rsiSellMax}`})` },
    { id: 'macd', label: 'MACD 12/26/9', status: macdOk ? 'ok' : 'no', detail: `hist ${f(hist[i], 6)} (${hist[i] > hist[i - 1] ? 'subindo' : 'caindo'})` },
    { id: 'pull', label: 'Pullback EMA 9/21', status: pull ? 'ok' : 'no', detail: pull ? 'vela anterior tocou a média' : 'sem pullback' },
    { id: 'candle', label: 'Vela de confirmação', status: candle ? 'ok' : 'no', detail: `corpo ${f(Math.abs(x.close - x.open), 5)} vs ${f(atr[i] * p.atrBodyMult, 5)} (0,15×ATR)` },
  ];
  if (!pode) checks.push({ id: 'cd', label: 'Intervalo entre sinais', status: 'no', detail: `aguarde ${p.cooldown - (i - lastSignalIndex)} vela(s)` });
  const okCount = checks.filter((c) => c.status === 'ok').length;
  const all = tend && forca && rsiOk && macdOk && pull && candle && pode;
  const firstFail = checks.find((c) => c.status !== 'ok');
  return { dir, all, checks, score: Math.round((okCount / checks.length) * 100), why: firstFail ? `${firstFail.label}: ${firstFail.detail}` : '' };
}

/**
 * Analisa a vela i (última fechada). Retorna o mesmo formato do motor padrão.
 * lastSignalIndex = índice (em candles) do último sinal emitido, para o intervalo.
 */
export function analyzeSniperProAt(candles, ind, i, meta = {}, lastSignalIndex = null) {
  const req = sniperProRequired(ind.p);
  if (i + 1 < req || [ind.ema200[i - 3], ind.hist[i - 1], ind.adx[i], ind.rsi[i], ind.atr[i]].some((v) => v == null)) {
    return { status: 'invalid', reason: `Histórico insuficiente para o script (${i + 1}/${req} velas)` };
  }
  const b = sniperProDirection(candles, ind, i, 'CALL', lastSignalIndex);
  const s = sniperProDirection(candles, ind, i, 'PUT', lastSignalIndex);
  const best = b.score >= s.score ? b : s;
  const chosen = b.all ? b : s.all ? s : null;
  if (!chosen) return { status: 'no_signal', reason: best.why, best: { dir: best.dir, score: best.score, checks: best.checks } };
  const c = candles[i];
  return {
    status: 'signal',
    best: { dir: chosen.dir, score: 100, checks: chosen.checks },
    signal: {
      id: `${meta.symbol ?? 'UNK'}-${c.time}`, symbol: meta.symbol ?? 'UNK', source: meta.source ?? 'unknown',
      strategy: 'sniperPro', direction: chosen.dir, score: 100, breakdown: {},
      reasons: chosen.checks.map((k) => `${k.label}: ${k.detail}`), confirmed: chosen.checks.map((k) => k.label),
      checks: chosen.checks, patterns: [], snapshot: {},
      confirmCandleTime: c.time, entryTime: c.time + 60_000, expiryTime: c.time + 120_000, refPrice: c.close,
    },
  };
}

export function analyzeSniperPro(candles, meta = {}, lastSignalTime = null) {
  const ind = computeSniperPro(candles);
  const i = candles.length - 1;
  let lastIdx = null;
  if (lastSignalTime != null) {
    const k = candles.findIndex((c) => c.time === lastSignalTime);
    lastIdx = k >= 0 ? k : (lastSignalTime > candles[0].time ? i - Math.round((candles[i].time - lastSignalTime) / 60_000) : null);
  }
  return analyzeSniperProAt(candles, ind, i, meta, lastIdx);
}

/** Backtest do script (sem olhar o futuro): entrada na abertura da vela seguinte, expiração 1 min. */
export function backtestSniperPro(candles, symbol = 'X') {
  const ind = computeSniperPro(candles);
  const trades = [];
  let last = null;
  for (let i = sniperProRequired() - 1; i < candles.length - 1; i++) {
    if (candles[i + 1].time - candles[i].time !== 60_000) continue;
    const r = analyzeSniperProAt(candles, ind, i, { symbol }, last);
    if (r.status !== 'signal') continue;
    last = i;
    const n = candles[i + 1];
    const res = n.close === n.open ? 'DRAW' : (r.signal.direction === 'CALL') === (n.close > n.open) ? 'GREEN' : 'LOSS';
    trades.push({ time: n.time, symbol, direction: r.signal.direction, result: res });
  }
  return trades;
}
