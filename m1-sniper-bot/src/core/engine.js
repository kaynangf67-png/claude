/*
 * M1 SNIPER BOT — Motor de sinais M1.
 *
 * Regras:
 *  - Analisa SOMENTE candles fechados. O último candle do array é o candle de
 *    confirmação (gatilho). A entrada sugerida é no candle seguinte, expiração 1 min.
 *  - Filtros obrigatórios (qualquer falha = sem sinal):
 *      volatilidade adequada, tendência sem contradição (EMA 9/21 x EMA 200 x DI),
 *      ADX mínimo, RSI fora de exaustão, Price Action na direção, candle de
 *      confirmação fechado a favor e sem padrão contrário.
 *  - Pontuação 0–100: tendência 25, ADX 20, RSI 15, Price Action 25, volatilidade 15.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode
    ? { I: require('./indicators.js'), P: require('./patterns.js') }
    : { I: root.M1.Indicators, P: root.M1.Patterns };
  const mod = factory(deps.I, deps.P);
  if (isNode) module.exports = mod;
  root.M1 = root.M1 || {};
  root.M1.Engine = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (I, P) {
  'use strict';

  const DEFAULTS = {
    minScore: 70,
    adxMin: 20,
    rsiCall: [50, 70],
    rsiPut: [30, 50],
    bwRatio: [0.5, 3.0],     // largura das bandas / mediana das últimas 100
    maxSpikeAtr: 3.0,        // candle gatilho maior que 3x ATR = volatilidade anormal
    maxStretchAtr: 0.5,      // fechamento além da banda oposta (exaustão)
    lookback: 20,
  };
  const MIN_CANDLES = 230;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function median(arr) {
    const s = arr.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (!s.length) return null;
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function computeIndicators(candles) {
    const closes = candles.map((c) => c.close);
    const ad = I.adx(candles, 14);
    return {
      ema9: I.ema(closes, 9),
      ema21: I.ema(closes, 21),
      ema200: I.ema(closes, 200),
      rsi: I.rsi(closes, 14),
      atr: I.atr(candles, 14),
      adx: ad.adx,
      plusDI: ad.plusDI,
      minusDI: ad.minusDI,
      bb: I.bollinger(closes, 20, 2),
    };
  }

  function validateCandles(candles) {
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (![c.open, c.high, c.low, c.close].every(Number.isFinite)) return `candle ${i} com valor inválido`;
      if (c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close)) return `candle ${i} com máxima/mínima inconsistente`;
      if (i > 0 && Number.isFinite(c.time) && Number.isFinite(candles[i - 1].time) && c.time <= candles[i - 1].time)
        return `candle ${i} fora de ordem`;
    }
    return null;
  }

  /**
   * Avalia o candle de índice i usando indicadores pré-calculados (causais).
   * Retorna sempre um objeto de análise; `signal` é 'CALL', 'PUT' ou null.
   */
  function evaluateAt(candles, ind, i, options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const c = candles[i];
    const res = {
      index: i,
      time: c ? c.time : null,
      signal: null,
      direction: null,
      score: 0,
      parts: {},
      reasons: [],
      rejections: [],
      patterns: [],
      snapshot: null,
    };
    if (i < MIN_CANDLES - 1) {
      res.rejections.push(`Histórico insuficiente: ${i + 1}/${MIN_CANDLES} candles fechados`);
      return res;
    }
    const v = {
      close: c.close,
      ema9: ind.ema9[i], ema21: ind.ema21[i], ema200: ind.ema200[i],
      rsi: ind.rsi[i], atr: ind.atr[i], adx: ind.adx[i],
      plusDI: ind.plusDI[i], minusDI: ind.minusDI[i],
      bbUpper: ind.bb.upper[i], bbLower: ind.bb.lower[i], bbMiddle: ind.bb.middle[i], bbWidth: ind.bb.width[i],
    };
    res.snapshot = v;
    if (Object.values(v).some((x) => !Number.isFinite(x))) {
      res.rejections.push('Indicadores ainda não disponíveis');
      return res;
    }

    // ---------- Volatilidade ----------
    const bwMed = median(ind.bb.width.slice(Math.max(0, i - 99), i + 1));
    const bwRatio = bwMed ? v.bbWidth / bwMed : 0;
    v.bwRatio = bwRatio;
    const range = c.high - c.low;
    if (v.atr <= 0 || bwMed === 0) res.rejections.push('Mercado sem movimento (volatilidade zero)');
    if (bwRatio < o.bwRatio[0]) res.rejections.push(`Volatilidade baixa (bandas ${bwRatio.toFixed(2)}x a média)`);
    if (bwRatio > o.bwRatio[1]) res.rejections.push(`Volatilidade excessiva (bandas ${bwRatio.toFixed(2)}x a média)`);
    if (v.atr > 0 && range > o.maxSpikeAtr * v.atr) res.rejections.push(`Candle anormal (${(range / v.atr).toFixed(1)}x ATR)`);

    // ---------- Direção ----------
    const emaUp = v.ema9 > v.ema21, emaDown = v.ema9 < v.ema21;
    const above200 = v.close > v.ema200, below200 = v.close < v.ema200;
    const diUp = v.plusDI > v.minusDI, diDown = v.minusDI > v.plusDI;
    let dir = null;
    if (emaUp && above200 && diUp) dir = 'CALL';
    else if (emaDown && below200 && diDown) dir = 'PUT';
    else {
      const parts = [];
      parts.push(emaUp ? 'EMA9>EMA21' : emaDown ? 'EMA9<EMA21' : 'EMA9=EMA21');
      parts.push(above200 ? 'preço acima da EMA200' : below200 ? 'preço abaixo da EMA200' : 'preço na EMA200');
      parts.push(diUp ? '+DI>-DI' : diDown ? '-DI>+DI' : 'DI empatado');
      res.rejections.push(`Filtros de tendência contraditórios (${parts.join(', ')})`);
    }
    res.direction = dir;

    // ---------- ADX ----------
    if (v.adx < o.adxMin) res.rejections.push(`ADX fraco (${v.adx.toFixed(1)} < ${o.adxMin}): mercado sem direção`);

    // ---------- RSI ----------
    if (dir === 'CALL' && !(v.rsi > o.rsiCall[0] && v.rsi < o.rsiCall[1]))
      res.rejections.push(v.rsi >= o.rsiCall[1] ? `RSI em sobrecompra (${v.rsi.toFixed(1)})` : `RSI sem força compradora (${v.rsi.toFixed(1)})`);
    if (dir === 'PUT' && !(v.rsi > o.rsiPut[0] && v.rsi < o.rsiPut[1]))
      res.rejections.push(v.rsi <= o.rsiPut[0] ? `RSI em sobrevenda (${v.rsi.toFixed(1)})` : `RSI sem força vendedora (${v.rsi.toFixed(1)})`);

    // ---------- Price Action ----------
    const pats = P.detectAll(candles, i, v.atr, {
      bbUpper: v.bbUpper, bbLower: v.bbLower, ema21: v.ema21, lookback: o.lookback,
    });
    res.patterns = pats;
    const favor = dir ? pats.filter((p) => p.direction === dir) : [];
    const against = dir ? pats.filter((p) => p.direction !== dir) : [];
    if (dir && !favor.length) res.rejections.push('Sem confirmação de Price Action');
    if (dir && against.length) res.rejections.push(`Price Action contrário (${against.map((p) => p.label).join(', ')})`);

    // ---------- Candle de confirmação ----------
    if (dir === 'CALL' && !(c.close > c.open)) res.rejections.push('Candle de confirmação não fechou comprador');
    if (dir === 'PUT' && !(c.close < c.open)) res.rejections.push('Candle de confirmação não fechou vendedor');
    if (dir === 'CALL' && c.close > v.bbUpper + o.maxStretchAtr * v.atr) res.rejections.push('Preço esticado acima da banda superior (exaustão)');
    if (dir === 'PUT' && c.close < v.bbLower - o.maxStretchAtr * v.atr) res.rejections.push('Preço esticado abaixo da banda inferior (exaustão)');

    // ---------- Pontuação ----------
    if (dir) {
      const sgn = dir === 'CALL' ? 1 : -1;
      const sep = (sgn * (v.ema9 - v.ema21)) / v.atr;
      const ema21Prev = ind.ema21[i - 5];
      const slopeOk = Number.isFinite(ema21Prev) && sgn * (v.ema21 - ema21Prev) > 0;
      const stack = sgn * (v.ema21 - v.ema200) > 0;
      const trend = 10 + 10 * clamp(sep / 0.6, 0, 1) + (slopeOk ? 2.5 : 0) + (stack ? 2.5 : 0);

      const diGap = Math.abs(v.plusDI - v.minusDI);
      const adxPts = v.adx < o.adxMin ? 0 : 8 + 9 * clamp((v.adx - o.adxMin) / 20, 0, 1) + 3 * clamp(diGap / 20, 0, 1);

      const ideal = dir === 'CALL' ? 58 : 42;
      const rsiPts = clamp(15 * (1 - Math.abs(v.rsi - ideal) / 14), 0, 15);

      const best = favor.reduce((m, p) => Math.max(m, p.strength), 0);
      const paPts = favor.length ? clamp(10 + 12 * best + (favor.length > 1 ? 3 : 0), 0, 25) : 0;

      const volPts = bwRatio > 0 ? clamp(15 * (1 - Math.abs(Math.log(bwRatio)) / Math.log(3)), 0, 15) : 0;

      res.parts = {
        tendencia: Math.round(trend), adx: Math.round(adxPts), rsi: Math.round(rsiPts),
        priceAction: Math.round(paPts), volatilidade: Math.round(volPts),
      };
      res.score = Math.round(clamp(trend + adxPts + rsiPts + paPts + volPts, 0, 100));

      res.reasons.push(dir === 'CALL'
        ? `Tendência compradora: EMA9 > EMA21 e preço acima da EMA200`
        : `Tendência vendedora: EMA9 < EMA21 e preço abaixo da EMA200`);
      res.reasons.push(`ADX ${v.adx.toFixed(1)} (${dir === 'CALL' ? '+DI' : '-DI'} dominante)`);
      res.reasons.push(`RSI ${v.rsi.toFixed(1)} em zona ${dir === 'CALL' ? 'compradora' : 'vendedora'} sem exaustão`);
      favor.forEach((p) => res.reasons.push(p.label));
      res.reasons.push(`Volatilidade ${bwRatio.toFixed(2)}x a média das bandas`);
    }

    if (dir && !res.rejections.length) {
      if (res.score >= o.minScore) res.signal = dir;
      else res.rejections.push(`Pontuação ${res.score} abaixo do mínimo ${o.minScore}`);
    }
    return res;
  }

  /** Avalia o último candle (fechado) do array. */
  function evaluate(candles, options) {
    const err = validateCandles(candles);
    if (err) {
      return { index: candles.length - 1, time: null, signal: null, direction: null, score: 0, parts: {},
        reasons: [], rejections: [`Dados inválidos: ${err}`], patterns: [], snapshot: null };
    }
    return evaluateAt(candles, computeIndicators(candles), candles.length - 1, options);
  }

  return { DEFAULTS, MIN_CANDLES, computeIndicators, evaluateAt, evaluate, validateCandles };
});
