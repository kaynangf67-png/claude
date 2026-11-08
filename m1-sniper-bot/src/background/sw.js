// Service worker: ÚNICA fonte de verdade do estado. Serializa todas as ações
// numa fila, aplica as regras de risco (reduce) e persiste em chrome.storage.
// Também busca candles na fonte independente (evita CORS/CSP da página).
import { hydrate, reduce } from '../core/state.js';
import { fetchKlines } from '../data/binance.js';

const KEY = 'm1state';
let cache = null;
let queue = Promise.resolve();

async function load() {
  if (cache) return cache;
  const got = await chrome.storage.local.get(KEY);
  cache = hydrate(got[KEY], Date.now());
  return cache;
}

async function save(s) {
  cache = s;
  await chrome.storage.local.set({ [KEY]: s });
}

function dispatch(action) {
  const run = queue.then(async () => {
    const s = await load();
    const { state, error } = reduce(s, action, Date.now());
    // Grava sempre que o estado mudou (inclui TICK de virada de dia).
    if (JSON.stringify(state) !== JSON.stringify(s)) await save(state);
    return { state, error };
  });
  queue = run.catch(() => {});
  return run;
}

// Qualquer alteração externa no storage (outra janela, edição manual) força
// releitura + hydrate, que reaplica as travas a partir dos contadores.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[KEY] && changes[KEY].newValue !== cache) cache = null;
});

chrome.runtime.onInstalled.addListener(async (details) => {
  // Instalação ou atualização: preserva contadores/histórico; apenas migra.
  const got = await chrome.storage.local.get(KEY);
  const s = hydrate(got[KEY], Date.now());
  s.events = [...s.events, { t: Date.now(), level: 'info', msg: `Extensão ${details.reason === 'install' ? 'instalada' : 'atualizada/recarregada'} (v${chrome.runtime.getManifest().version})` }].slice(-400);
  await save(s);
  chrome.alarms.create('tick', { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('tick', { periodInMinutes: 1 });
  dispatch({ type: 'TICK' });
});

chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'tick') dispatch({ type: 'TICK' }); });

// Clique no ícone: mostra/oculta o painel SOBRE o gráfico na aba atual.
// Em domínios não listados no manifesto, injeta o painel via activeTab.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || !/^https?:/.test(tab.url || 'https:')) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { window.__m1SniperWantToggle = true; },
    });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/loader.js'] });
  } catch (e) {
    console.warn('[M1 SNIPER BOT] não foi possível abrir o painel nesta aba:', e?.message || e);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'getState') return sendResponse({ state: (await dispatch({ type: 'TICK' })).state });
      if (msg?.type === 'dispatch') return sendResponse(await dispatch(msg.action));
      if (msg?.type === 'openOptions') { chrome.runtime.openOptionsPage(); return sendResponse({ ok: true }); }
      if (msg?.type === 'klines') {
        const candles = await fetchKlines(msg.symbol, { limit: msg.limit ?? 500 });
        return sendResponse({ candles, serverNow: Date.now() });
      }
      sendResponse({ error: 'Mensagem desconhecida' });
    } catch (e) {
      sendResponse({ error: String(e?.message || e) });
    }
  })();
  return true; // resposta assíncrona
});
