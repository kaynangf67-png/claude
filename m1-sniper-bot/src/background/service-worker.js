/*
 * M1 SNIPER BOT — Service worker (MV3).
 * Única responsabilidade: buscar candles na fonte de mercado independente (Binance pública),
 * fora do contexto da página da corretora. Não toca na Quotex, não envia ordens.
 */
importScripts('../data/binance.js');

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'm1:klines') return false;
  self.M1.Binance.fetchKlines(msg.symbol, { limit: msg.limit || 500 })
    .then((data) => sendResponse({ ok: true, data, now: Date.now() }))
    .catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
  return true; // resposta assíncrona
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'm1:toggle-panel' });
  } catch (_) {
    // A aba não é da Quotex (o content script não está injetado). Nada a fazer.
  }
});
