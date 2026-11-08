import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, parseAsset, assetToSymbol, parsePercent } from '../src/content/quotexPage.js';

test('valores no formato da Quotex', () => {
  assert.equal(parseMoney('5,000 R$'), 5000);
  assert.equal(parseMoney('7,700 R$'), 7700);
  assert.equal(parseMoney('5.000,50'), 5000.5);
  assert.equal(parseMoney('1,234.56'), 1234.56);
  assert.equal(parseMoney('2,50 R$'), 2.5);
  assert.equal(parseMoney('R$ 10'), 10);
  assert.equal(parseMoney('$1.5'), 1.5);
  assert.equal(parseMoney('sem número'), null);
});

test('ativo por par ou por nome; OTC nunca corresponde', () => {
  assert.equal(assetToSymbol(parseAsset('BTC/USD')), 'BTCUSDT');
  assert.equal(assetToSymbol(parseAsset('Bitcoin')), 'BTCUSDT');
  assert.equal(assetToSymbol(parseAsset('Ethereum')), 'ETHUSDT');
  assert.equal(parseAsset('Bitcoin (OTC)').otc, true);
  assert.equal(assetToSymbol(parseAsset('Bitcoin (OTC)')), null);
  assert.equal(assetToSymbol(parseAsset('EUR/USD')), null);
  assert.equal(parseAsset('Bitcoin Cash'), null);
  assert.equal(parseAsset(''), null);
});

test('percentual de payout e valor nunca confundidos', () => {
  assert.equal(parsePercent('Bitcoin (OTC)71%'), 71);
  assert.equal(parsePercent('Ethereum +85 %'), 85);
  assert.equal(parsePercent('Ethereum'), null);
  assert.equal(parseMoney('71%'), null);
  assert.equal(parseMoney('Ethereum 85% 5,000 R$'), 5000);
});

test('número desenhado letra por letra no gráfico é remontado', async () => {
  const { assembleRuns } = await import('../src/content/canvasText.js');
  const glyphs = '0.78274'.split('').map((ch, i) => ({ t: ch, c: 1, f: '#fff', x: 1030 + i * 7, y: 200, w: 7 }));
  const out = assembleRuns([...glyphs, { t: '0.79000', c: 1, f: '#888', x: 1030, y: 100, w: 40 }]).map((i) => i.t).sort();
  assert.deepEqual(out, ['0.78274', '0.79000']);
});

test('preço automático: grupo de números que concordam (lista real da Quotex)', async () => {
  const { autoPick } = await import('../src/content/canvasText.js');
  const mk = (v, c, r) => ({ key: v + c, color: c, value: v, text: String(v), rate: r, seenS: 20, ageMs: 500 });
  const cands = [mk(0.56282, '#474c5d', 12.4), mk(0.56360, '#ffffff', 3.1), mk(0.56363, '#ffffff', 3.1), mk(0.56365, '#ffffff', 3.1),
    mk(0.56357, '#ffffff', 3.1), mk(0.56357, '#ffffff', 2.1), mk(0.56041, '#ffffff', 0.7), mk(0.55950, '#ffffff', 0)];
  const v = autoPick(cands);
  assert.ok(v >= 0.56357 && v <= 0.56365, String(v));
  assert.equal(autoPick([mk(1.1, '#ffffff', 2), mk(2.2, '#ffffff', 2)]), null); // dois brancos diferentes: não chuta
  // caso real USD/NGN (OTC): branco (preço) x cinza (animação) -> escolhe o branco
  assert.equal(autoPick([mk(1348.17, '#ffffff', 3.3), mk(1348.68, '#474c5d', 5.8)]), 1348.17);
});
