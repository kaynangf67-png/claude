/*
 * M1 SNIPER BOT — Fonte de mercado independente: Binance Spot (API pública documentada).
 * Docs: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints#klinecandlestick-data
 * GET /api/v3/klines — não exige chave. data-api.binance.vision é o espelho oficial só de dados de mercado.
 *
 * IMPORTANTE: estes preços NÃO são os preços da Quotex. Para pares OTC da Quotex não existe fonte
 * independente; nesses casos o sinal não corresponde ao gráfico da corretora.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.M1 = root.M1 || {};
  root.M1.Binance = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

  function parseKlines(rows) {
    return rows.map((r) => ({
      time: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
      closeTime: Number(r[6]),
    }));
  }

  async function fetchKlines(symbol, opts) {
    const o = Object.assign({ limit: 500, interval: '1m' }, opts || {});
    const q = new URLSearchParams({ symbol, interval: o.interval, limit: String(Math.min(1000, o.limit)) });
    if (o.startTime) q.set('startTime', String(o.startTime));
    if (o.endTime) q.set('endTime', String(o.endTime));
    let lastErr;
    for (const host of HOSTS) {
      try {
        const res = await fetch(`${host}/api/v3/klines?${q}`, { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`);
        }
        return parseKlines(await res.json());
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('Falha ao buscar candles');
  }

  /** Mescla candles por horário de abertura (o mais recente substitui). */
  function merge(existing, incoming, max) {
    const map = new Map(existing.map((c) => [c.time, c]));
    for (const c of incoming) map.set(c.time, c);
    const all = Array.from(map.values()).sort((a, b) => a.time - b.time);
    return all.slice(-(max || 600));
  }

  /** Separa candles fechados do candle em formação (anti-repintura). */
  function splitClosed(candles, now) {
    const closed = [];
    let forming = null;
    for (const c of candles) {
      const end = Number.isFinite(c.closeTime) ? c.closeTime : c.time + 59999;
      if (end < now) closed.push(c);
      else forming = c;
    }
    return { closed, forming };
  }

  return { HOSTS, parseKlines, fetchKlines, merge, splitClosed };
});
