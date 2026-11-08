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
