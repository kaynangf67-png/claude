/*
 * M1 SNIPER BOT — Histórico de sinais e operações (puro).
 * signals: todo sinal emitido (operado ou não), com o resultado medido pelo feed.
 * trades:  operações que o usuário confirmou ter feito manualmente, com o resultado registrado.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.M1 = root.M1 || {};
  root.M1.History = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_SIGNALS = 1000;
  const MAX_TRADES = 2000;

  const empty = () => ({ signals: [], trades: [] });

  function upsert(list, item, max) {
    const i = list.findIndex((x) => x.id === item.id);
    const next = list.slice();
    if (i >= 0) next[i] = Object.assign({}, next[i], item);
    else next.push(item);
    return next.slice(-max);
  }

  const putSignal = (h, s) => Object.assign({}, h, { signals: upsert(h.signals, s, MAX_SIGNALS) });
  const putTrade = (h, t) => Object.assign({}, h, { trades: upsert(h.trades, t, MAX_TRADES) });

  /** Resultado binário M1: entrada na abertura do candle, expiração no fechamento. */
  function binaryOutcome(direction, entryCandle) {
    if (!entryCandle) return null;
    const d = entryCandle.close - entryCandle.open;
    if (d === 0) return 'EMPATE';
    if (direction === 'CALL') return d > 0 ? 'GREEN' : 'LOSS';
    return d < 0 ? 'GREEN' : 'LOSS';
  }

  function toCSV(rows, cols) {
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  }

  return { empty, putSignal, putTrade, binaryOutcome, toCSV, MAX_SIGNALS, MAX_TRADES };
});
