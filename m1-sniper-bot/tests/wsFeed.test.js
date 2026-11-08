import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestWsText, wsHistoryFor, wsQuoteFor, normAsset } from '../src/content/wsFeed.js';

test('lê histórico de velas e cotação das mensagens da página (formatos comuns)', () => {
  const T = Math.floor(Date.now() / 60000) * 60 - 60;
  const rows = []; let p = 1.0852;
  for (let i = 60; i > 0; i--) { const o = p; p += Math.sin(i) * 0.0003; rows.push([T - i * 60, o, Math.max(o, p) + 0.0001, Math.min(o, p) - 0.0001, p]); } // t,o,h,l,c
  ingestWsText(JSON.stringify({ asset: 'EURUSD_otc', period: 60, candles: rows }));
  const h = wsHistoryFor('EUR/USD (OTC)');
  assert.equal(h.length, 60);
  assert.ok(h.every((c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close)));
  ingestWsText(`42["quotes/stream",[["EURUSD_otc",${Date.now() / 1000},1.08611,0]]]`);
  assert.equal(wsQuoteFor('EUR/USD (OTC)'), 1.08611);
  assert.equal(normAsset('Bitcoin (OTC)'), normAsset('BTCUSD_otc'));
});

test('ticks densos viram velas de 1 minuto; dados que não são M1 são ignorados', () => {
  const t0 = Math.floor(Date.now() / 60000) * 60000 - 30 * 60000;
  const ticks = []; for (let k = 0; k < 30 * 12; k++) ticks.push([(t0 + k * 5000) / 1000, 50 + Math.sin(k / 9)]);
  ingestWsText(JSON.stringify({ asset: 'GBPJPY_otc', history: ticks }));
  assert.equal(wsHistoryFor('GBP/JPY (OTC)').length, 30);
  const h5 = []; for (let i = 0; i < 20; i++) h5.push([1.7e9 + i * 300, 1, 1.2, 0.9, 1.1]);
  ingestWsText(JSON.stringify({ asset: 'USDJPY_otc', candles: h5 })); // 5 min: não é M1
  assert.equal(wsHistoryFor('USD/JPY (OTC)'), null);
});
