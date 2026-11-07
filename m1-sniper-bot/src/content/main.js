/*
 * M1 SNIPER BOT — Content script (entrada).
 * Conecta o controlador ao chrome.storage (persistência) e ao service worker (feed),
 * monta o painel e roda o relógio de 1s. Não lê nem altera o gráfico/ordens da corretora.
 */
(function () {
  'use strict';
  if (window.top !== window || window.__m1SniperLoaded) return;
  window.__m1SniperLoaded = true;
  const M = globalThis.M1;

  const storage = {
    get: (keys) => chrome.storage.local.get(keys),
    set: (obj) => chrome.storage.local.set(obj),
  };

  const feed = {
    fetchKlines: (symbol, limit) => new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'm1:klines', symbol, limit }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!res || !res.ok) return reject(new Error(res ? res.error : 'sem resposta do service worker'));
        resolve(res.data);
      });
    }),
  };

  let panel = null;
  const ctl = M.Controller.createController({
    storage,
    feed,
    onSignal: (sig) => { if (ctl.state.settings.sound) M.Panel.beep(sig.direction); },
  });

  // Outra aba alterou risco/histórico (ex.: duas abas da corretora): recarrega para não haver divergência.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const k = M.Controller.KEYS;
    if (changes[k.risk] && JSON.stringify(changes[k.risk].newValue) !== JSON.stringify(ctl.state.risk)) {
      ctl.state.risk = M.Risk.rollover(changes[k.risk].newValue, Date.now()).state;
    }
    if (changes[k.history] && changes[k.history].newValue && JSON.stringify(changes[k.history].newValue) !== JSON.stringify(ctl.state.history)) {
      ctl.state.history = changes[k.history].newValue;
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'm1:toggle-panel' && panel) panel.toggleVisible();
  });

  ctl.init().then(() => {
    panel = M.Panel.mount(ctl);
    setInterval(() => ctl.tick(), 1000);
    ctl.tick();
  });
})();
