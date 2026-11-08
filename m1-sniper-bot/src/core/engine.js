// Motor de análise M1. Recebe APENAS candles fechados e decide se há sinal
// no fechamento do último candle. Não acessa o futuro: a entrada sugerida é
// na abertura do próximo candle, com expiração de 1 minuto.

import { ema, rsi, adx, bollinger } from './indicators.js';
import { detectPatterns, avgBody, candleHelpers as H } from './priceAction.js';
import { validateSeries } from './validate.js';

export const DEFAULT_ENGINE_CONFIG = Object.freeze({
  minScore: 80,
  rsiCallMin: 50, rsiCallMax: 70,   // faixa favorável para CALL
  rsiPutMin: 30, rsiPutMax: 50,     // faixa favorável para PUT
  rsiSoftMargin: 5,                  // zona "neutra aceitável" (pontos parciais)
  adxMin: 20,                        // abaixo disso: mercado sem direção → sem sinal
  adxStrong: 25,
  minBandWidth: 0.0004,              // bandas muito estreitas (0,04%) = mercado parado
});

// EMA200 precisa de 200 candles; usamos folga para estabilizar EMA/ADX.
export const REQUIRED_CANDLES = 260;
// Com velas montadas da tela da Quotex (sem histórico), começa com EMA 50
// como tendência longa e passa para a EMA 200 quando houver 260 velas.
export const WARMUP_LONG_EMA = 50;
export const WARMUP_REQUIRED = 60;
export const requiredFor = (longEma) => (longEma >= 200 ? REQUIRED_CANDLES : longEma + 10);

// Perfis de períodos. "rapido" usa versões curtas dos mesmos indicadores para
// começar a operar com poucas velas (fonte Quotex, sem histórico).
export const PROFILES = Object.freeze({
  completo: { name: 'completo', fast: 9, slow: 21, rsi: 14, adx: 14, bb: 20 },
  rapido: { name: 'rápido', fast: 3, slow: 6, long: 10, rsi: 6, adx: 5, bb: 10 },
});
export const QUICK_REQUIRED = 12;
export function requiredForProfile(p, longEma) {
  const L = p.long ?? longEma ?? 200;
  if (!p.long && L >= 200) return REQUIRED_CANDLES;
  return Math.max(L, 2 * p.adx, p.bb, p.rsi + 1, p.slow + 3) + 2;
}
/** Perfil conforme as velas disponíveis (fonte Quotex). null = ainda poucas velas. */
export function profileForCount(n) {
  if (n >= REQUIRED_CANDLES) return { ...PROFILES.completo, long: 200 };
  if (n >= WARMUP_REQUIRED) return { ...PROFILES.completo, long: WARMUP_LONG_EMA };
  if (n >= QUICK_REQUIRED) return { ...PROFILES.rapido };
  return null;
}

const fmt = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));

/** Calcula todos os indicadores para a série (uma vez). */
export function computeIndicators(candles, longEma = 200, profile = PROFILES.completo) {
  const closes = candles.map((c) => c.close);
  const p = { ...PROFILES.completo, ...profile };
  const L = profile.long ?? longEma;
  return {
    longEma: L, p,
    ema9: ema(closes, p.fast),     // EMA curta (9; 3 no modo rápido)
    ema21: ema(closes, p.slow),    // EMA média (21; 6 no modo rápido)
    ema200: ema(closes, L),        // EMA longa (200/50; 10 no modo rápido)
    rsi: rsi(closes, p.rsi),
    adx: adx(candles, p.adx),
    bb: bollinger(closes, p.bb, 2),
  };
}

/**
 * Pontua uma direção no índice i. Retorna { score, vetoes[], reasons[], breakdown }.
 * Vetos = condição contraditória/perigosa que impede o sinal independentemente da nota.
 */
export function scoreDirection(candles, ind, i, dir, cfg) {
  const x = candles[i];
  const call = dir === 'CALL';
  const P = ind.p || PROFILES.completo;
  const e9 = ind.ema9[i], e21 = ind.ema21[i], e200 = ind.ema200[i];
  const e9prev = ind.ema9[i - 3];
  const r = ind.rsi[i];
  const a = ind.adx.adx[i], pdi = ind.adx.plusDI[i], mdi = ind.adx.minusDI[i];
  const mid = ind.bb.middle[i], up = ind.bb.upper[i], lo = ind.bb.lower[i], bw = ind.bb.width[i];

  const vetoes = [], reasons = [], confirmed = [];
  const bd = { trend: 0, rsi: 0, adx: 0, bollinger: 0, priceAction: 0, candle: 0 };

  // --- Tendência (25)
  const emaAligned = call ? e9 > e21 : e9 < e21;
  const longTrend = call ? x.close > e200 && e21 > e200 : x.close < e200 && e21 < e200;
  const slope = call ? e9 > e9prev : e9 < e9prev;
  if (!emaAligned) vetoes.push(`EMA ${P.fast} ${call ? 'abaixo' : 'acima'} da EMA ${P.slow}`);
  const L = ind.longEma ?? 200;
  if (!longTrend) vetoes.push(`Preço/EMA 21 do lado errado da EMA ${L}`);
  if (emaAligned) { bd.trend += 10; confirmed.push(`EMA ${P.fast}/${P.slow}`); }
  if (longTrend) { bd.trend += 10; confirmed.push(`EMA ${L}`); }
  if (slope) bd.trend += 5;
  if (emaAligned && longTrend) reasons.push(`Tendência de ${call ? 'alta' : 'baixa'} confirmada (EMA${P.fast} ${fmt(e9, 5)} ${call ? '>' : '<'} EMA${P.slow} ${fmt(e21, 5)}, preço ${call ? 'acima' : 'abaixo'} da EMA${L})`);

  // --- RSI (15)
  const [rMin, rMax] = call ? [cfg.rsiCallMin, cfg.rsiCallMax] : [cfg.rsiPutMin, cfg.rsiPutMax];
  if (call ? r >= cfg.rsiCallMax : r <= cfg.rsiPutMin) {
    vetoes.push(`RSI ${fmt(r, 1)} em exaustão`);
  } else if (r > rMin && r < rMax) {
    bd.rsi = 15; confirmed.push('RSI');
    reasons.push(`RSI ${fmt(r, 1)} com força ${call ? 'compradora' : 'vendedora'} sem exaustão`);
  } else if (call ? r > rMin - cfg.rsiSoftMargin : r < rMax + cfg.rsiSoftMargin) {
    bd.rsi = 7;
  } else {
    vetoes.push(`RSI ${fmt(r, 1)} contra a direção`);
  }

  // --- ADX (15)
  const diOk = call ? pdi > mdi : mdi > pdi;
  if (a < cfg.adxMin) vetoes.push(`ADX ${fmt(a, 1)} < ${cfg.adxMin}: mercado sem direção`);
  if (!diOk) vetoes.push(`DI contraditório (+DI ${fmt(pdi, 1)} / -DI ${fmt(mdi, 1)})`);
  if (a >= cfg.adxMin && diOk) {
    bd.adx = a >= cfg.adxStrong ? 15 : 8;
    confirmed.push('ADX');
    reasons.push(`ADX ${fmt(a, 1)} indica tendência ${a >= cfg.adxStrong ? 'forte' : 'moderada'}`);
  }

  // --- Bollinger (15)
  if (bw < cfg.minBandWidth) {
    vetoes.push('Bandas de Bollinger comprimidas (volatilidade muito baixa)');
  } else if (call ? x.close > up : x.close < lo) {
    vetoes.push(`Fechamento fora da banda ${call ? 'superior' : 'inferior'} (esticado)`);
  } else {
    const sideOk = call ? x.close > mid : x.close < mid;
    const midReject = call ? x.low <= mid && x.close > mid : x.high >= mid && x.close < mid;
    const bandReject = call ? x.low <= lo && x.close > lo : x.high >= up && x.close < up;
    if (sideOk) bd.bollinger += 10;
    if (midReject || bandReject) bd.bollinger += 5;
    if (sideOk) {
      confirmed.push('Bollinger');
      reasons.push(midReject || bandReject
        ? `Rejeição na banda ${bandReject ? (call ? 'inferior' : 'superior') : 'central'} de Bollinger`
        : `Preço ${call ? 'acima' : 'abaixo'} da média de Bollinger com espaço até a banda`);
    }
  }

  // --- Price Action (20)
  const levels = call ? [e21, lo, mid] : [e21, up, mid];
  const patterns = detectPatterns(candles, i, dir, levels);
  if (patterns.length === 0) vetoes.push('Sem confirmação de Price Action');
  else {
    bd.priceAction = Math.min(20, Math.max(...patterns.map((p) => p.pts)) + (patterns.length > 1 ? 4 : 0));
    confirmed.push('Price Action');
    reasons.push(`Price Action: ${patterns.map((p) => p.label).join(', ')}`);
  }

  // --- Candle de confirmação (10). Sempre o último candle FECHADO.
  const dirCandle = call ? H.isBull(x) : H.isBear(x);
  if (!dirCandle) vetoes.push(`Candle de confirmação ${call ? 'não é de alta' : 'não é de baixa'}`);
  else {
    bd.candle += 5;
    if (H.range(x) > 0 && H.body(x) >= 0.5 * H.range(x)) bd.candle += 3;
    if (H.body(x) >= avgBody(candles, i)) bd.candle += 2;
    confirmed.push('Candle fechado');
  }

  const score = bd.trend + bd.rsi + bd.adx + bd.bollinger + bd.priceAction + bd.candle;
  // Checklist por indicador (para o painel): ok = confirma, partial = neutro, senão contra.
  const st = (pts, max, veto) => (veto ? 'no' : pts >= max ? 'ok' : pts > 0 ? 'partial' : 'no');
  const has = (txt) => vetoes.some((v) => v.includes(txt));
  const checks = [
    { id: 'trend', label: 'Tendência (EMAs)', status: emaAligned && longTrend ? 'ok' : emaAligned || longTrend ? 'partial' : 'no',
      detail: `EMA${P.fast} ${call ? (e9 > e21 ? '>' : '<') : (e9 < e21 ? '<' : '>')} EMA${P.slow} · preço ${x.close > e200 ? 'acima' : 'abaixo'} da EMA${L}` },
    { id: 'rsi', label: `RSI ${P.rsi}`, status: st(bd.rsi, 15, has('RSI')), detail: fmt(r, 1) },
    { id: 'adx', label: `ADX ${P.adx}`, status: st(bd.adx, 15, has('ADX') || has('DI')), detail: `${fmt(a, 1)} · +DI ${fmt(pdi, 0)} / −DI ${fmt(mdi, 0)}` },
    { id: 'bb', label: `Bollinger ${P.bb}/2`, status: st(bd.bollinger, 10, has('Bollinger') || has('banda')), detail: x.close > up ? 'acima da banda sup.' : x.close < lo ? 'abaixo da banda inf.' : x.close > mid ? 'acima da média' : 'abaixo da média' },
    { id: 'pa', label: 'Price Action', status: patterns.length ? 'ok' : 'no', detail: patterns.length ? patterns.map((p) => p.label).join(', ') : 'nenhum padrão' },
    { id: 'candle', label: 'Vela de confirmação', status: dirCandle ? 'ok' : 'no', detail: H.isBull(x) ? 'vela de alta' : H.isBear(x) ? 'vela de baixa' : 'doji' },
  ];
  return {
    dir, score, vetoes, reasons, confirmed, breakdown: bd, checks,
    patterns: patterns.map((p) => p.id),
    snapshot: { ema9: e9, ema21: e21, ema200: e200, rsi: r, adx: a, plusDI: pdi, minusDI: mdi, bbUpper: up, bbMiddle: mid, bbLower: lo },
  };
}

/**
 * Analisa a série de candles fechados.
 * @returns {{status:'invalid'|'no_signal'|'signal', reason?:string, signal?:object, best?:object}}
 */
export function analyze(candles, config = {}, meta = {}) {
  const cfg = { ...DEFAULT_ENGINE_CONFIG, ...config };
  const longEma = cfg.longEma ?? 200;
  const profile = cfg.profile || PROFILES.completo;
  const v = validateSeries(candles, cfg.profile ? requiredForProfile(profile, longEma) : requiredFor(longEma));
  if (!v.ok) return { status: 'invalid', reason: v.reason };

  const ind = computeIndicators(candles, longEma, profile);
  return analyzeAt(candles, ind, candles.length - 1, cfg, meta);
}

/** Versão usada pelo backtest: indicadores pré-calculados, índice explícito. */
export function analyzeAt(candles, ind, i, cfg, meta = {}) {
  const needed = [ind.ema200[i], ind.ema9[i - 3], ind.rsi[i], ind.adx.adx[i], ind.bb.width[i]];
  if (needed.some((v) => v == null || !Number.isFinite(v))) {
    return { status: 'invalid', reason: 'Indicadores ainda em aquecimento' };
  }
  const call = scoreDirection(candles, ind, i, 'CALL', cfg);
  const put = scoreDirection(candles, ind, i, 'PUT', cfg);
  const best = call.score >= put.score ? call : put;

  const qualifies = (s) => s.vetoes.length === 0 && s.score >= cfg.minScore;
  const qc = qualifies(call), qp = qualifies(put);
  if (qc && qp) return { status: 'no_signal', reason: 'Indicadores contraditórios', best };
  const chosen = qc ? call : qp ? put : null;
  if (!chosen) {
    const why = best.vetoes.length ? best.vetoes[0] : `Pontuação ${best.score} < ${cfg.minScore}`;
    return { status: 'no_signal', reason: why, best };
  }

  const c = candles[i];
  return {
    status: 'signal',
    best,
    signal: {
      id: `${meta.symbol ?? 'UNK'}-${c.time}`,
      symbol: meta.symbol ?? 'UNK',
      source: meta.source ?? 'unknown',
      direction: chosen.dir,
      score: chosen.score,
      breakdown: chosen.breakdown,
      reasons: chosen.reasons,
      confirmed: chosen.confirmed,
      checks: chosen.checks,
      patterns: chosen.patterns,
      snapshot: chosen.snapshot,
      confirmCandleTime: c.time,            // abertura do candle de confirmação (fechado)
      entryTime: c.time + 60_000,           // entrada na abertura do próximo candle
      expiryTime: c.time + 120_000,         // expiração de 1 minuto
      refPrice: c.close,
    },
  };
}

// ------------------------------------------------------------------ estratégias
import { analyzeSniperPro, sniperProRequired } from './strategies/sniperPro.js';
export const STRATEGIES = Object.freeze({
  sniperPro: { name: 'M1 SNIPER PRO (seu script)', required: () => sniperProRequired() },
  padrao: { name: 'Padrão (pontuação 0–100)', required: null },
});

/** Analisa com a estratégia escolhida. ctx.lastSignalTime = vela do último sinal (intervalo do script). */
export function analyzeStrategy(candles, cfg = {}, meta = {}, ctx = {}) {
  if (cfg.strategy === 'sniperPro') return analyzeSniperPro(candles, meta, ctx.lastSignalTime ?? null);
  return analyze(candles, cfg, meta);
}
