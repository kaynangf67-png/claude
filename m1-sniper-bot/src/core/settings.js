/* M1 SNIPER BOT — Configurações (padrões + saneamento). */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.M1 = root.M1 || {};
  root.M1.Settings = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCES = ['binance', 'manual'];
  const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'LTCUSDT', 'ADAUSDT', 'DOGEUSDT', 'EURUSDT'];

  const DEFAULTS = Object.freeze({
    stake: 10,
    currency: 'R$',
    accountMode: 'DEMO',
    source: 'binance',
    symbol: 'BTCUSDT',
    assetLabel: '',
    minScore: 70,
    adxMin: 20,
    payout: 0.85,
    autoRecord: false,
    sound: true,
  });

  const num = (v, d, lo, hi) => {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
  };

  function sanitize(raw) {
    const r = Object.assign({}, DEFAULTS, raw || {});
    return {
      stake: Math.round(num(r.stake, DEFAULTS.stake, 1, 100000) * 100) / 100,
      currency: String(r.currency || 'R$').slice(0, 4),
      accountMode: r.accountMode === 'REAL' ? 'REAL' : 'DEMO',
      source: SOURCES.includes(r.source) ? r.source : DEFAULTS.source,
      symbol: /^[A-Z0-9]{5,15}$/.test(String(r.symbol).toUpperCase()) ? String(r.symbol).toUpperCase() : DEFAULTS.symbol,
      assetLabel: String(r.assetLabel || '').slice(0, 24),
      minScore: Math.round(num(r.minScore, DEFAULTS.minScore, 50, 95)),
      adxMin: Math.round(num(r.adxMin, DEFAULTS.adxMin, 10, 40)),
      payout: num(r.payout, DEFAULTS.payout, 0.1, 1.0),
      autoRecord: !!r.autoRecord,
      sound: r.sound !== false,
    };
  }

  /** Converte CSV colado pelo usuário em candles. Aceita "time,open,high,low,close" ou "open,high,low,close". */
  function parseCandlesCSV(text) {
    const out = [];
    const errors = [];
    const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, n) => {
      const cells = line.split(/[;,\t]/).map((x) => x.trim());
      if (n === 0 && cells.some((x) => /[a-z]/i.test(x) && !/^\d{4}-/.test(x))) return; // cabeçalho
      const nums = cells.map((x) => Number(x));
      let time, o, h, l, c;
      if (cells.length >= 5) {
        time = Number.isFinite(nums[0]) ? (nums[0] < 1e12 ? nums[0] * 1000 : nums[0]) : Date.parse(cells[0]);
        [o, h, l, c] = nums.slice(1, 5);
      } else if (cells.length === 4) {
        [o, h, l, c] = nums;
        time = null;
      } else { errors.push(`linha ${n + 1}: colunas insuficientes`); return; }
      if (![o, h, l, c].every(Number.isFinite)) { errors.push(`linha ${n + 1}: número inválido`); return; }
      out.push({ time: Number.isFinite(time) ? time : null, open: o, high: h, low: l, close: c });
    });
    // Sem tempo: gera minutos sequenciais terminando no último minuto fechado.
    if (out.length && out.some((c) => c.time == null)) {
      const end = Math.floor(Date.now() / 60000) * 60000 - 60000;
      out.forEach((c, i) => { c.time = end - (out.length - 1 - i) * 60000; });
    }
    return { candles: out, errors };
  }

  return { DEFAULTS, SOURCES, SYMBOLS, sanitize, parseCandlesCSV };
});
