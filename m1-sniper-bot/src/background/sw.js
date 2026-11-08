// Service worker: ÚNICA fonte de verdade do estado. Serializa todas as ações
// numa fila, aplica as regras de risco (reduce) e persiste em chrome.storage.
// Também busca candles na fonte independente (evita CORS/CSP da página).
import { hydrate, reduce } from '../core/state.js';
import { fetchKlinesTimed } from '../data/binance.js';

const KEY = 'm1state';
let cache = null;
let queue = Promise.resolve();
// Diferença entre o relógio do servidor de dados e o do PC (ms). Corrige PCs
// com relógio adiantado/atrasado, que faziam os candles parecerem "atrasados".
let clockOffset = 0;
const now = () => Date.now() + clockOffset;
function updateOffset(serverNow, localNow) {
  if (!Number.isFinite(serverNow)) return;
  const off = serverNow - localNow;
  // Só ajusta quando a diferença é relevante (resolução do cabeçalho Date = 1 s).
  if (Math.abs(off - clockOffset) > 1500) clockOffset = Math.round(off);
}

async function load() {
  if (cache) return cache;
  const got = await chrome.storage.local.get(KEY);
  cache = hydrate(got[KEY], now());
  return cache;
}

async function save(s) {
  cache = s;
  await chrome.storage.local.set({ [KEY]: s });
}

function dispatch(action) {
  const run = queue.then(async () => {
    const s = await load();
    const { state, error } = reduce(s, action, now());
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
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/canvasTap.js'], world: 'MAIN' }).catch(() => {});
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/loader.js'] });
  } catch (e) {
    console.warn('[M1 SNIPER BOT] não foi possível abrir o painel nesta aba:', e?.message || e);
  }
});

// Mouse "de verdade" (eventos confiáveis) via chrome.debugger, usado SÓ durante
// a leitura do histórico do gráfico. O Chrome mostra uma faixa de aviso enquanto
// estiver conectado; desconecta ao terminar ou em caso de erro.
const attachedTabs = new Set();
async function debuggerOp(tabId, msg) {
  if (!tabId) return { error: 'aba desconhecida' };
  const target = { tabId };
  try {
    if (msg.op === 'attach') {
      if (!attachedTabs.has(tabId)) { await chrome.debugger.attach(target, '1.3'); attachedTabs.add(tabId); }
      return { ok: true };
    }
    if (msg.op === 'move') {
      await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: msg.x, y: msg.y, button: 'none', buttons: 0, pointerType: 'mouse' });
      return { ok: true };
    }
    if (msg.op === 'detach') {
      if (attachedTabs.has(tabId)) { attachedTabs.delete(tabId); await chrome.debugger.detach(target); }
      return { ok: true };
    }
    return { error: 'operação inválida' };
  } catch (e) {
    if (msg.op !== 'detach' && attachedTabs.has(tabId)) { attachedTabs.delete(tabId); chrome.debugger.detach(target).catch(() => {}); }
    return { error: String(e?.message || e) };
  }
}
chrome.debugger.onDetach.addListener((src) => attachedTabs.delete(src.tabId));

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'getState') return sendResponse({ state: (await dispatch({ type: 'TICK' })).state });
      if (msg?.type === 'dispatch') return sendResponse(await dispatch(msg.action));
      if (msg?.type === 'dbg') return sendResponse(await debuggerOp(_sender.tab?.id, msg));
      if (msg?.type === 'openOptions') { chrome.runtime.openOptionsPage(); return sendResponse({ ok: true }); }
      if (msg?.type === 'klines') {
        const r = await fetchKlinesTimed(msg.symbol, { limit: msg.limit ?? 500 });
        updateOffset(r.serverNow, r.localNow);
        return sendResponse({ candles: r.candles, clockOffset });
      }
      sendResponse({ error: 'Mensagem desconhecida' });
    } catch (e) {
      sendResponse({ error: String(e?.message || e) });
    }
  })();
  return true; // resposta assíncrona
});
