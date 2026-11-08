// Painel flutuante SOBRE o gráfico + laço de análise M1.
// Não executa ordens: mostra a confirmação para a PRÓXIMA vela (expiração 1 min).
import { analyze, REQUIRED_CANDLES, WARMUP_LONG_EMA, WARMUP_REQUIRED } from '../core/engine.js';
import { closedOnly, mergeCandles, M1_MS } from '../core/validate.js';
import { outcomeOf } from '../core/backtest.js';
import { canSignal, autoArmed, calibComplete, AUTO_ENTRY_WINDOW_MS } from '../core/state.js';
import { DAILY_GREEN_TARGET, DAILY_LOSS_LIMIT, LOCK_MESSAGES } from '../core/risk.js';
import { computeStats, realReadiness, REAL_CONFIRM_PHRASE } from '../core/stats.js';
import { formatTime } from '../core/time.js';
import { SYMBOLS, SOURCE_ID } from '../data/binance.js';
import { QuotexFeed, feedKey } from './quotexFeed.js';
import { readChartHistory, syntheticMover, trustedMover } from './chartHistory.js';
import { canvasStatus, canvasCandidates, selectCanvasKey } from './canvasText.js';
import { detectPageMode, detectAsset, assetMatches, assetToSymbol, readAmount, readPayout, panelReadings, readPrice, readPriceInfo, parseCanvasPref, diagnostics, clearCaches, assetTargetFromClick, makeCalib, calibReading, captureNextClick, clickDirection } from './quotexPage.js';

const POLL_MS = 3000;
const FAST_POLL_MS = 1000;           // perto da virada do minuto
const STALE_MS = 2.5 * M1_MS;

// Relógio corrigido pelo horário do servidor de dados (PC adiantado/atrasado).
let clockOffset = 0;
const nowMs = () => Date.now() + clockOffset;
let state = null;
// ---- Fonte "Quotex": velas montadas com o preço ao vivo lido da tela
const feed = new QuotexFeed({ onClose: (k) => feed.persist(k) });
let qxKey = null;
const qxLoading = new Set();
// Fonte Quotex: padrão. Usa o rótulo calibrado ou, se não houver/for ilegível, a legenda do gráfico.
const quotexMode = (s = state) => !!s && s.settings.feed !== 'binance';
const qxSymbol = (key) => (key ? 'QX:' + key : null);
// Mouse sobre o gráfico: a legenda passa a mostrar a vela apontada (não a atual).
let pointerOverChartAt = 0;
window.addEventListener('pointermove', (e) => {
  if (e.composedPath().includes(hostEl)) return;
  if (e.target instanceof HTMLCanvasElement || e.target?.closest?.('canvas')) pointerOverChartAt = Date.now();
}, true);
let lastPriceFrom = null;
let lastSeenKey = null, keyChangedAt = 0;
// ---- Histórico pelo gráfico (mouse virtual sobre a legenda OHLC)
let historyBusy = false;
const historyTried = new Set();
let historyStatus = null; // texto exibido durante/depois da leitura
let lastHistory = null;
let syntheticFailed = false; // gráfico ignora mouse simulado: vai direto ao mouse do Chrome
let historyUnavailable = false; // as duas formas falharam: não tenta mais sozinho nesta página    // resultado da última tentativa (exibido no ⚙ e no diagnóstico)

async function loadChartHistory(key, manual = false) {
  if (historyBusy || !key) return;
  historyBusy = true; historyTried.add(key);
  historyStatus = 'Lendo o histórico do gráfico… (não mexa o mouse no gráfico)'; render();
  try {
    const live = readPrice(state.settings.calib);
    const progress = (n) => { historyStatus = `Lendo o histórico do gráfico… ${n} velas`; };
    let r = syntheticFailed ? { ok: false, error: 'legenda (mouse simulado já falhou nesta página)' }
      : await readChartHistory({ livePrice: live, now: nowMs(), onProgress: progress, mover: syntheticMover });
    if (!r.ok && /legenda|poucas velas|não bate/.test(r.error || '')) {
      syntheticFailed = true;
      // O gráfico ignora mouse simulado: tenta com o mouse do Chrome (faixa amarela de aviso por ~15 s).
      historyStatus = 'Lendo o histórico com o mouse do Chrome… (o Chrome mostra uma faixa amarela de aviso; ela some ao terminar)'; render();
      try {
        r = await readChartHistory({ livePrice: readPrice(state.settings.calib) ?? live, now: nowMs(), onProgress: progress, mover: trustedMover(send) });
      } catch (e) { r = { ok: false, error: String(e.message || e), info: 'mouse Chrome' }; }
      if (!r.ok) historyUnavailable = true;
    }
    lastHistory = { at: nowMs(), key, ok: r.ok, text: r.ok ? `ok: ${r.used} velas` : r.error, info: r.info || '' };
    if (r.ok) {
      const n = feed.setHistory(key, r.candles);
      if (Number.isFinite(live)) feed.lastTick.set(key, { t: nowMs(), price: live }); // evita "sem leitura" logo após
      feed.persist(key);
      historyStatus = null;
      showToast(`Histórico lido do gráfico: ${r.used} velas (${n} contínuas).${n < WARMUP_REQUIRED ? ' Afaste o zoom do gráfico para ver mais velas.' : ''}`, 'ok');
      lastAnalyzedTime = null;
    } else {
      historyStatus = null;
      showToast(`Não deu para ler o histórico: ${r.error}. Seguindo com o aquecimento normal.${historyUnavailable ? ' (O bot não vai tentar de novo sozinho nesta página.)' : ''}`, manual ? 'err' : 'warn');
    }
  } catch (e) {
    historyStatus = null;
    showToast('Erro ao ler o histórico: ' + (e.message || e), 'err');
  } finally {
    historyBusy = false; render();
  }
}

function qxTick() {
  if (!quotexMode() || historyBusy) return;
  const key = feedKey(detectAsset(state.settings.calib));
  const info = readPriceInfo(state.settings.calib);
  if (!key || !info) return;
  if (info.from === 'legenda' && Date.now() - pointerOverChartAt < 1500) return; // pausa durante o hover
  // Logo após trocar de ativo, o preço na tela ainda pode ser o do ativo anterior.
  if (key !== lastSeenKey) { lastSeenKey = key; keyChangedAt = Date.now(); }
  if (Date.now() - keyChangedAt < 1500) { qxKey = key; return; }
  lastPriceFrom = info.from;
  const price = info.price;
  if (!feed.loaded.has(key)) {
    // carrega o histórico salvo deste ativo ANTES de registrar leituras novas
    if (!qxLoading.has(key)) { qxLoading.add(key); feed.ensureLoaded(key, nowMs()).finally(() => qxLoading.delete(key)); }
    qxKey = key;
    return;
  }
  feed.tick(key, price, nowMs());
  qxKey = key;
}
let candles = [];
let candleSymbol = null;
let conn = { status: 'connecting', error: null };
let confirmed = null;   // leitura da última vela FECHADA
let preview = null;     // leitura da vela EM FORMAÇÃO (prévia)
let lastAnalyzedTime = null;
let uiError = null;
let pollTimer = null;
let view = 'main';
let visible = true;
let hostEl = null;
let toast = null;             // { text, kind, until }
const AUTO_RECORD_AFTER_MS = 45_000; // sem resposta do usuário, o AUTO registra o resultado da fonte
// Varredura de mercados (para indicar qual abrir na Quotex)
const SCAN_SYMBOLS = Object.keys(SYMBOLS).filter((k) => k !== 'EURUSDT');
const scanCandles = new Map();
const scan = new Map();       // symbol -> { dir, score, signal, at }
let scanBusy = false, lastScanAt = 0;
const SCAN_EVERY_MS = 15_000;

const send = (msg) => new Promise((resolve) => {
  try {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
      else resolve(res || { error: 'Sem resposta' });
    });
  } catch { resolve({ error: 'Extensão recarregada — atualize a página (F5)' }); }
});

async function dispatch(action) {
  const res = await send({ type: 'dispatch', action });
  if (res.state) state = res.state;
  uiError = res.error || null;
  render();
  return res;
}

// ---------------------------------------------------------------- dados
async function poll() {
  clearTimeout(pollTimer);
  try {
    if (!state) return;
    await syncPayout();
    if (quotexMode()) {
      // Fonte = preço da tela da Quotex (o mesmo gráfico do usuário, inclusive OTC).
      const want = qxSymbol(qxKey);
      if (want && want !== state.settings.symbol && !state.openTrade && !state.activeSignal) {
        await dispatch({ type: 'SET_SETTINGS', value: { symbol: want } });
      }
      if (state.settings.symbol !== candleSymbol) { candleSymbol = state.settings.symbol; lastAnalyzedTime = null; confirmed = preview = null; }
      candles = qxKey && qxSymbol(qxKey) === state.settings.symbol ? feed.candles(qxKey) : [];
      // Aquecendo? Tenta uma vez por ativo ler o histórico do próprio gráfico.
      if (qxKey && !historyUnavailable && !historyTried.has(qxKey) && !historyBusy && feed.lastTickAt(qxKey) > 0
          && closedOnly(candles, nowMs()).length < WARMUP_REQUIRED && nowMs() - keyChangedAt > 3000) {
        loadChartHistory(qxKey);
      }
      if (!qxKey || (feed.loaded.has(qxKey) && nowMs() - feed.lastTickAt(qxKey) > 5000 && feed.lastTickAt(qxKey) > 0) || (!readPrice(state.settings.calib) && Date.now() - pointerOverChartAt > 1500)) throw new Error(`Preço ao vivo não identificado: ${canvasStatus()}. Se continuar, envie ⚙ → COPIAR DIAGNÓSTICO.`);
      // relógio: sincroniza pelo servidor de dados de vez em quando
      if (nowMs() - lastClockSync > 60_000) { lastClockSync = nowMs(); send({ type: 'klines', symbol: 'BTCUSDT', limit: 1 }).then((r) => { if (Number.isFinite(r.clockOffset)) clockOffset = r.clockOffset; }); }
    } else {
      await followOpenedMarket();
      const sym = state.settings.symbol;
      if (sym !== candleSymbol || sym.startsWith('QX:')) { candles = []; candleSymbol = sym; lastAnalyzedTime = null; confirmed = preview = null; }
      if (sym.startsWith('QX:')) { await dispatch({ type: 'SET_SETTINGS', value: { symbol: 'BTCUSDT' } }); return; }
      const res = await send({ type: 'klines', symbol: sym, limit: candles.length >= REQUIRED_CANDLES ? 5 : 500 });
      if (res.error) throw new Error(res.error);
      if (Number.isFinite(res.clockOffset)) clockOffset = res.clockOffset;
      candles = mergeCandles(candles, res.candles, 600);
    }
    conn = { status: 'ok', error: null };
    await onData();
    await autoRecordResult();
    if (nowMs() - lastScanAt > SCAN_EVERY_MS || isMinuteTurn()) runScan();
  } catch (e) {
    conn = { status: 'offline', error: String(e.message || e) };
    preview = null;
  } finally {
    render();
    const sec = new Date(nowMs()).getSeconds();
    pollTimer = setTimeout(poll, sec >= 55 || sec < 6 ? FAST_POLL_MS : POLL_MS);
  }
}

let lastClockSync = 0;
const isMinuteTurn = () => { const sec = new Date(nowMs()).getSeconds(); return sec >= 1 && sec <= 3 && nowMs() - lastScanAt > 4000; };

/** Se o usuário abriu na Quotex um mercado coberto, o bot passa a analisar esse mercado. */
async function followOpenedMarket() {
  // Segue a cripto aberta na Quotex, inclusive OTC (como referência de análise).
  const sym = assetToSymbol(detectAsset(state.settings.calib), { allowOtc: true });
  if (sym && sym !== state.settings.symbol && !state.openTrade && !state.activeSignal) {
    await dispatch({ type: 'SET_SETTINGS', value: { symbol: sym } });
  }
}

/** Ajusta o payout automaticamente com a % do mercado aberto na Quotex. */
let pagePayout = null;
let amountSyncError = null;
async function syncPayout() {
  // Valor: segue o campo da Quotex (as regras de risco, como "sem Martingale", continuam valendo).
  const pageAmt = readAmount(state.settings.calib);
  if (pageAmt != null && !state.openTrade && Math.abs(pageAmt - state.settings.amount) >= 0.005) {
    const r = await dispatch({ type: 'SET_AMOUNT', value: pageAmt });
    amountSyncError = r.error || null;
    if (r.error) uiError = null; // mostra no item "Valor" do AUTO, não como erro geral
  } else if (pageAmt != null && Math.abs(pageAmt - state.settings.amount) < 0.005) amountSyncError = null;
  pagePayout = readPayout(state.settings.calib);
  if (pagePayout == null || state.openTrade) return;
  if (Math.abs(pagePayout - state.settings.payout) >= 0.005) {
    await dispatch({ type: 'SET_SETTINGS', value: { payout: pagePayout } });
  }
}

function targetSymbol(asset) {
  return quotexMode() ? qxSymbol(feedKey(asset)) : assetToSymbol(asset, { allowOtc: true });
}

async function switchTo(asset, target) {
  if (quotexMode()) { const key = feedKey(asset); qxKey = key; lastSeenKey = key; keyChangedAt = Date.now(); }
  if (target !== state.settings.symbol) await dispatch({ type: 'SET_SETTINGS', value: { symbol: target } });
  candleSymbol = null; lastAnalyzedTime = null; confirmed = preview = null;
  syncPayout();
  poll();
}

/** Varre os outros mercados e calcula a leitura de cada um (prévia da vela atual). */
async function runScan() {
  if (scanBusy || !state?.active) return;
  scanBusy = true; lastScanAt = nowMs();
  try {
    const cfg = { minScore: state.settings.minScore };
    for (const sym of SCAN_SYMBOLS) {
      const have = scanCandles.get(sym) || [];
      const res = await send({ type: 'klines', symbol: sym, limit: have.length >= REQUIRED_CANDLES ? 3 : 400 });
      if (res.error) continue;
      if (Number.isFinite(res.clockOffset)) clockOffset = res.clockOffset;
      const cs = mergeCandles(have, res.candles, 450);
      scanCandles.set(sym, cs);
      const now = nowMs();
      const closed = closedOnly(cs, now);
      const last = closed.at(-1);
      if (!last) continue;
      const forming = cs.find((c) => c.time === last.time + M1_MS);
      const rc = analyze(closed, cfg, { symbol: sym });
      const rp = forming ? analyze([...closed, forming], cfg, { symbol: sym }) : rc;
      const pick = (r) => (r.status === 'signal' ? { dir: r.signal.direction, score: r.signal.score, signal: true } : r.best ? { dir: r.best.dir, score: r.best.score, signal: false } : null);
      const c = pick(rc), p = pick(rp);
      const best = c?.signal && now - (last.time + M1_MS) < 15_000 ? c : p;
      if (best) scan.set(sym, { ...best, at: now, fresh: c?.signal && best === c });
    }
  } finally { scanBusy = false; render(); }
}

function indicatedMarkets() {
  const now = nowMs();
  return [...scan.entries()].filter(([, v]) => now - v.at < 90_000)
    .sort((a, b) => (b[1].signal - a[1].signal) || b[1].score - a[1].score).slice(0, 3);
}

/** Execução automática do sinal (só se armado e com todas as verificações). */
async function tryAutoEntry(sig) {
  if (!autoArmed(state)) return;
  const calib = state.settings.calib;
  const asset = detectAsset(calib);
  const res = await dispatch({
    type: 'AUTO_ENTRY', signalId: sig.id, pageMode: detectPageMode(),
    pageAsset: quotexMode() ? qxSymbol(feedKey(asset)) : assetToSymbol(asset), pageAmount: readAmount(calib),
    pageExpirySec: panelReadings(calib)?.expirySec ?? null,
  });
  if (res.error) { showToast(`AUTO não entrou: ${res.error}`, 'warn'); return; }
  const t = state.openTrade;
  const click = clickDirection(calib, sig.direction);
  if (!click.ok) {
    await dispatch({ type: 'ABORT_AUTO_TRADE', tradeId: t.id, reason: click.error });
    showToast(`AUTO falhou: ${click.error}. Automático desarmado.`, 'err');
    return;
  }
  showToast(`AUTO: ${sig.direction} ${sig.symbol} clicado (${t.amount.toFixed(2)})`, 'ok');
}

/** Em operações automáticas, registra o resultado da fonte se o usuário não registrar. */
async function autoRecordResult() {
  const t = state.openTrade;
  if (!t?.auto || !t.suggested) return;
  if (nowMs() < t.expiryTime + AUTO_RECORD_AFTER_MS) return;
  await dispatch({ type: 'RECORD_RESULT', tradeId: t.id, result: t.suggested.result, by: 'auto' });
}

function showToast(text, kind = 'ok') { toast = { text, kind, until: nowMs() + 8000 }; render(); }

async function onData() {
  const now = nowMs();
  const closed = closedOnly(candles, now);
  const last = closed.at(-1);
  if (!last && quotexMode()) {
    preview = { r: { status: 'invalid', reason: historyStatus || `Aquecendo com o preço da Quotex: 0/${WARMUP_REQUIRED} velas (~${WARMUP_REQUIRED} min). Deixe a página aberta neste ativo.` }, candleTime: now };
    return;
  }
  if (!last || now - (last.time + M1_MS) > STALE_MS) { conn.status = 'stale'; preview = null; return; }
  await resolveOutcomes(closed);
  if (!state.active || state.day.locked) { preview = null; confirmed = null; lastAnalyzedTime = last.time; return; }

  const qm = quotexMode();
  const meta = { symbol: state.settings.symbol, source: qm ? 'quotex-tela' : SOURCE_ID };
  // Fonte Quotex: EMA 50 como tendência longa até juntar velas para a EMA 200.
  const longEma = !qm || closed.length >= REQUIRED_CANDLES ? 200 : WARMUP_LONG_EMA;
  const cfg = { minScore: state.settings.minScore, longEma };
  if (qm && closed.length < WARMUP_REQUIRED) {
    const n = closed.length;
    preview = { r: { status: 'invalid', reason: historyStatus || `Aquecendo com o preço da Quotex: ${n}/${WARMUP_REQUIRED} velas (~${WARMUP_REQUIRED - n} min). Deixe a página aberta neste ativo, ou use ⚙ → LER HISTÓRICO DO GRÁFICO.` }, candleTime: last.time };
    lastAnalyzedTime = last.time;
    return;
  }

  // Prévia: a vela atual tratada como se fechasse agora (pode mudar até o fechamento).
  const forming = candles.find((c) => c.time === last.time + M1_MS);
  preview = forming ? { r: analyze([...closed, forming], cfg, meta), candleTime: forming.time } : null;

  if (last.time === lastAnalyzedTime) return; // confirmação: uma vez por vela fechada
  lastAnalyzedTime = last.time;
  const r = analyze(closed, cfg, meta);
  confirmed = { r, candleTime: last.time };
  if (r.status !== 'signal') return;
  if (canSignal(state)) return;
  const asset = detectAsset(state.settings.calib);
  if (!qm && assetMatches(asset, state.settings.symbol) === false) {
    confirmed = { r: { status: 'no_signal', reason: `Ativo da página (${asset.label}) ≠ ${state.settings.symbol}`, best: r.best }, candleTime: last.time };
    return;
  }
  const res = await dispatch({ type: 'PROPOSE_SIGNAL', signal: r.signal, pageMode: detectPageMode() });
  if (res.error) return;
  beep(r.signal.direction);
  if (state.activeSignal && nowMs() <= r.signal.entryTime + AUTO_ENTRY_WINDOW_MS) await tryAutoEntry(state.activeSignal);
}

async function resolveOutcomes(closed) {
  const byTime = new Map(closed.map((c) => [c.time, c]));
  const sym = state.settings.symbol;
  const outcomes = [];
  for (const s of state.signalLog.slice(-200)) {
    if (s.outcome || s.symbol !== sym) continue;
    const c = byTime.get(s.entryTime);
    if (c) outcomes.push({ id: s.id, outcome: outcomeOf(s.direction, c), entryPrice: c.open, exitPrice: c.close });
  }
  if (outcomes.length) await dispatch({ type: 'SIGNAL_OUTCOMES', outcomes });
  const t = state.openTrade;
  if (t && !t.suggested && t.symbol === sym) {
    const c = byTime.get(t.entryTime);
    if (c) await dispatch({ type: 'SUGGEST_RESULT', tradeId: t.id, suggested: { result: outcomeOf(t.direction, c), entryPrice: c.open, exitPrice: c.close } });
  }
}

function beep(dir) {
  try {
    const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = dir === 'CALL' ? 880 : 440; g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.18);
  } catch { /* sem áudio */ }
}

// ---------------------------------------------------------------- UI
let root, panel;
const $ = (k) => root.querySelector(`[data-k="${k}"]`);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function button(cls, text, onClick) { const b = el('button', 'btn ' + cls, text); b.addEventListener('click', onClick); return b; }

const TEMPLATE = `
<div class="panel">
  <div class="head" data-drag>
    <span class="dot" data-k="dot"></span>
    <span class="title">M1 <b>SNIPER</b> BOT</span>
    <span class="badge demo" data-k="mode">DEMO</span>
    <button class="iconbtn" data-k="gear" title="Ajustes e estatísticas">⚙</button>
    <button class="iconbtn" data-k="minBtn" title="Minimizar">–</button>
    <button class="iconbtn" data-k="close" title="Ocultar (clique no ícone da extensão para mostrar)">×</button>
  </div>
  <div class="body" data-k="main">
    <div class="row small">
      <select data-k="symbol" title="Ativo analisado (fonte: Binance)"></select>
      <b class="hidden" data-k="qxName" title="Ativo aberto na Quotex"></b>
      <span class="clock" data-k="clock">--:--:--</span>
    </div>
    <div class="small muted" data-k="assetInfo"></div>
    <div class="next" data-k="next"></div>
    <div class="checks" data-k="checks"></div>
    <div class="auto" data-k="autoBox"></div>
    <div class="toast hidden" data-k="toast"></div>
    <div data-k="tradeBox" class="hidden"></div>
    <div class="lockbox hidden" data-k="lock"></div>
    <div class="ctl">
      <button class="toggle off" data-k="toggle">LIGAR</button>
      <div class="amount ro" data-k="amount" title="Valor lido do Investimento da Quotex (automático)">—</div>
    </div>
    <div class="small" data-k="payoutInfo"></div>
    <div class="stats small">
      <span>GREEN <span class="cnt g" data-k="greens">0</span>/${DAILY_GREEN_TARGET}</span>
      <span>LOSS <span class="cnt l" data-k="losses">0</span>/${DAILY_LOSS_LIMIT}</span>
      <div class="history" data-k="history"></div>
    </div>
    <div class="markets" data-k="markets"></div>
    <div class="small"><span class="muted">Último sinal: </span><span data-k="lastSignal">—</span></div>
    <div class="err hidden" data-k="err"></div>
  </div>
  <div class="body hidden" data-k="settings"></div>
</div>`;

async function mountPanel() {
  const host = document.createElement('div');
  host.id = 'm1-sniper-bot-host';
  document.documentElement.appendChild(host);
  hostEl = host;
  root = host.attachShadow({ mode: 'open' });
  const css = await (await fetch(chrome.runtime.getURL('src/content/panel.css'))).text();
  const sheet = new CSSStyleSheet(); sheet.replaceSync(css);
  root.adoptedStyleSheets = [sheet];
  const wrap = document.createElement('div');
  wrap.innerHTML = TEMPLATE; // template estático
  panel = wrap.firstElementChild;
  root.appendChild(panel);

  const sel = $('symbol');
  for (const [k, label] of Object.entries(SYMBOLS)) {
    const o = document.createElement('option'); o.value = k; o.textContent = `${k} · ${label}`; sel.appendChild(o);
  }
  sel.addEventListener('change', () => dispatch({ type: 'SET_SETTINGS', value: { symbol: sel.value } }));
  $('toggle').addEventListener('click', () => dispatch({ type: 'SET_ACTIVE', value: !state.active }));
  root.addEventListener('keydown', (e) => e.stopPropagation()); // não dispara atalhos da Quotex
  $('minBtn').addEventListener('click', () => dispatch({ type: 'SET_SETTINGS', value: { panel: { minimized: !state.settings.panel.minimized } } }));
  $('gear').addEventListener('click', () => { view = view === 'main' ? 'settings' : 'main'; renderSettings(true); render(); });
  $('close').addEventListener('click', () => setVisible(false));
  enableDrag();
  root.addEventListener('pointerdown', () => { pressing = true; });
  window.addEventListener('pointerup', () => { if (pressing) { pressing = false; setTimeout(render, 0); } }, true);
  window.addEventListener('pointercancel', () => { pressing = false; }, true);
}

function setVisible(v) { visible = v; panel.classList.toggle('hidden', !v); }

function enableDrag() {
  const head = panel.querySelector('[data-drag]');
  let sx, sy, ox, oy, dragging = false;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true; head.setPointerCapture(e.pointerId);
    const r = panel.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
  });
  head.addEventListener('pointermove', (e) => { if (dragging) place(ox + e.clientX - sx, oy + e.clientY - sy); });
  head.addEventListener('pointerup', () => {
    if (!dragging) return; dragging = false;
    const r = panel.getBoundingClientRect();
    dispatch({ type: 'SET_SETTINGS', value: { panel: { x: Math.round(r.left), y: Math.round(r.top) } } });
  });
}

function place(x, y) {
  const w = panel.offsetWidth || 280;
  x = Math.min(Math.max(0, x), window.innerWidth - w);
  y = Math.min(Math.max(0, y), window.innerHeight - 40);
  panel.style.left = x + 'px'; panel.style.top = y + 'px';
}

/** Escolhe o que mostrar na caixa "PRÓXIMA VELA". */
function nextReading(s, now) {
  if (s.activeSignal) return { kind: 'signal', sig: s.activeSignal };
  if (!s.active) return { kind: 'off' };
  if (s.day.locked || s.openTrade) return { kind: 'blocked', text: canSignal(s) };
  if (conn.status !== 'ok') {
    const lastC = closedOnly(candles, now).at(-1);
    return { kind: 'blocked', text: conn.status === 'stale'
      ? `Dados atrasados (última vela ${lastC ? formatTime(lastC.time, s.settings.timeZone, false) : '—'}) — aguarde`
      : (quotexMode(s) ? `Preço ao vivo não identificado: ${canvasStatus()}` : 'Sem conexão com a fonte de dados') };
  }
  if (preview) return { kind: 'preview', ...preview };
  if (confirmed) return { kind: 'confirmed', ...confirmed };
  return { kind: 'blocked', text: 'Carregando candles…' };
}

// Não recria botões enquanto o usuário está com o mouse pressionado
// (senão o clique se perde entre mousedown e mouseup).
let pressing = false;

function render() {
  if (!root || !state) return;
  if (pressing) { tick(); return; }
  const s = state, tz = s.settings.timeZone, now = nowMs();
  panel.classList.toggle('min', !!s.settings.panel.minimized);
  $('minBtn').textContent = s.settings.panel.minimized ? '+' : '–';
  if (!panel.dataset.placed) {
    panel.dataset.placed = '1';
    place(s.settings.panel.x ?? window.innerWidth - 280 - 16, s.settings.panel.y ?? 70);
  }
  $('main').classList.toggle('hidden', view !== 'main' || !!s.settings.panel.minimized);
  $('settings').classList.toggle('hidden', view !== 'settings' || !!s.settings.panel.minimized);
  $('gear').classList.toggle('on', view === 'settings');

  const locked = s.day.locked;
  $('dot').className = 'dot ' + (locked ? 'lock' : s.active ? 'on' : '');
  $('dot').title = locked ? 'BLOQUEADO' : s.active ? 'ATIVO' : 'DESATIVADO';
  const pageMode = detectPageMode();
  const mode = $('mode');
  mode.textContent = s.account.mode;
  mode.className = 'badge ' + (s.account.mode === 'REAL' ? 'real' : 'demo');
  mode.title = `Modo do bot: ${s.account.mode}. Página (pela URL, não verificado): ${pageMode}`;

  if (view === 'settings') { renderSettings(false); tick(); return; }

  const sel = $('symbol');
  if (root.activeElement !== sel) sel.value = s.settings.symbol;
  sel.disabled = !!(s.openTrade || s.activeSignal);
  const pageAmt = readAmount(s.settings.calib);
  $('amount').textContent = pageAmt != null ? `${s.settings.amount.toFixed(2)}` : '— valor ?';
  $('amount').title = pageAmt != null ? 'Valor lido do Investimento da Quotex (automático)' : 'Calibre Comprar/Vender em ⚙ para o bot ler o Investimento da Quotex';

  const asset = detectAsset(s.settings.calib);
  const match = assetMatches(asset, s.settings.symbol);
  const warn = [];
  const qm = quotexMode(s);
  if (!qm && match === false) {
    warn.push(asset.otc
      ? `${asset.label}: indicadores do ${s.settings.symbol.replace('USDT', '/USD')} (Binance) só como referência. O preço OTC é da Quotex e pode ser diferente; sinais e AUTO ficam desligados no OTC.`
      : `Quotex em ${asset.label}, bot em ${s.settings.symbol.replace('USDT', '/USD')}: abra o mesmo ativo.`);
  }
  if (pageMode === 'REAL' && s.account.mode === 'DEMO') warn.push('⚠ página parece conta REAL');
  const nC = qm && qxKey ? closedOnly(feed.candles(qxKey), nowMs()).length : 0;
  const live = conn.status === 'ok' ? 'ao vivo' : conn.status === 'stale' ? '(atrasado)' : conn.status === 'offline' ? '(sem leitura)' : '(conectando)';
  $('assetInfo').textContent = warn.length ? warn.join(' · ')
    : qm ? `Fonte: Quotex (preço da tela) · ${qxKey ?? 'ativo ?'} · ${nC} velas · EMA ${nC >= REQUIRED_CANDLES ? 200 : WARMUP_LONG_EMA} · ${live}`
    : `Fonte: Binance · ${s.settings.symbol} · ${live}`;
  $('symbol').classList.toggle('hidden', qm);
  $('qxName').classList.toggle('hidden', !qm);
  $('qxName').textContent = qm ? (qxKey ?? '—') : '';
  $('assetInfo').style.color = warn.length || conn.status === 'offline' || conn.status === 'stale' ? '#f59e0b' : '';

  renderNext(s, now, tz);

  const tg = $('toggle');
  tg.textContent = s.active ? 'DESLIGAR' : 'LIGAR';
  tg.className = 'toggle ' + (s.active ? '' : 'off');
  tg.disabled = !!locked;
  const lock = $('lock');
  lock.classList.toggle('hidden', !locked);
  if (locked) { lock.className = 'lockbox ' + locked; lock.textContent = `${LOCK_MESSAGES[locked]} · volta amanhã`; }

  $('greens').textContent = s.day.greens;
  $('losses').textContent = s.day.losses;
  const hist = $('history'); hist.replaceChildren();
  for (const t of s.trades.filter((t) => t.dayKey === s.day.key).slice(-13)) {
    const h = el('span', 'h ' + t.result); h.title = `${t.result} · ${t.direction} ${t.symbol} ${formatTime(t.entryTime, tz, false)}`; hist.appendChild(h);
  }
  renderTrade(s, now);
  renderAuto(s);
  const be = 1 / (1 + s.settings.payout);
  $('payoutInfo').textContent = `Payout ${Math.round(s.settings.payout * 100)}% ${pagePayout != null ? '(lido da Quotex, automático)' : '(manual em ⚙)'} · empata com ${(be * 100).toFixed(1)}% de acerto`;
  $('payoutInfo').className = 'small ' + (s.settings.payout < 0.75 ? 'no' : 'muted');
  renderMarkets(s);
  const tEl = $('toast');
  const showT = toast && toast.until > now;
  tEl.classList.toggle('hidden', !showT);
  if (showT) { tEl.textContent = toast.text; tEl.className = 'toast ' + toast.kind; }
  const last = s.signalLog.at(-1);
  $('lastSignal').textContent = last ? `${last.direction} ${last.symbol} ${last.score} pts · ${formatTime(last.entryTime, tz, false)}${last.outcome ? ' · ' + last.outcome : ''}` : '—';

  const err = $('err');
  const msg = uiError || (conn.status === 'offline' ? conn.error : '');
  err.classList.toggle('hidden', !msg);
  err.textContent = msg || '';
  tick();
}

function renderNext(s, now, tz) {
  const box = $('next');
  const n = nextReading(s, now);
  const nextOpen = Math.floor(now / M1_MS) * M1_MS + M1_MS;
  const secsToClose = Math.ceil((nextOpen - now) / 1000);
  let cls = 'next', items = [], checks = null;

  if (n.kind === 'signal') {
    const sig = n.sig;
    const ttl = Math.max(0, Math.ceil((sig.entryTime + s.settings.signalTtlSec * 1000 - now) / 1000));
    cls += ` ${sig.direction} signal`;
    items.push(el('div', 'lbl', `✔ CONFIRMADO · ENTRADA ${formatTime(sig.entryTime, tz, false)} · EXP. 1 MIN`));
    const top = el('div', 'row'); top.append(el('span', 'dir', sig.direction === 'CALL' ? '▲ CALL' : '▼ PUT'), el('span', 'score', `${sig.score}/100`));
    items.push(top, bar(sig.score));
    const btns = el('div', 'btns');
    btns.append(
      button(sig.direction === 'CALL' ? 'green' : 'red', `ENTREI (${ttl}s)`, () => dispatch({ type: 'CONFIRM_ENTRY', signalId: sig.id })),
      button('', 'IGNORAR', () => dispatch({ type: 'DISMISS_SIGNAL', signalId: sig.id })));
    items.push(btns, el('div', 'small muted', 'Abra você mesmo na Quotex agora. Nota ≠ probabilidade de acerto.'));
    checks = sig.checks;
  } else if (n.kind === 'off') {
    items.push(el('div', 'lbl', 'PRÓXIMA VELA'), el('div', 'dir', 'DESLIGADO'), el('div', 'small muted', 'Clique em LIGAR para ver os indicadores M1.'));
  } else if (n.kind === 'blocked') {
    items.push(el('div', 'lbl', 'PRÓXIMA VELA'), el('div', 'dir', '⏸ AGUARDAR'), el('div', 'small', n.text || ''));
  } else {
    const r = n.r;
    const isPrev = n.kind === 'preview';
    if (r.status === 'invalid') {
      items.push(el('div', 'lbl', 'PRÓXIMA VELA'), el('div', 'dir', '⏸ AGUARDAR'), el('div', 'small', r.reason));
    } else {
      const b = r.status === 'signal' ? { dir: r.signal.direction, score: r.signal.score, checks: r.signal.checks } : r.best;
      const strong = r.status === 'signal';
      if (strong) cls += ' ' + b.dir;
      items.push(el('div', 'lbl', isPrev
        ? `PRÓXIMA VELA ${formatTime(nextOpen, tz, false)} · confirma em ${secsToClose}s`
        : `VELA ${formatTime(n.candleTime, tz, false)} FECHADA`));
      const top = el('div', 'row');
      const dirTxt = strong ? (b.dir === 'CALL' ? '▲ CALL' : '▼ PUT') : '⏸ AGUARDAR';
      top.append(el('span', 'dir', dirTxt), el('span', 'score', `${b.dir} ${b.score}/100`));
      items.push(top, bar(b.score));
      items.push(el('div', 'small muted', strong
        ? (isPrev ? 'Prévia: se a vela fechar assim, sai sinal. Ainda pode mudar.' : 'Sinal na vela fechada.')
        : `Falta: ${r.reason}`));
      checks = b.checks;
    }
  }
  box.className = cls;
  box.replaceChildren(...items);

  const list = $('checks');
  list.classList.toggle('hidden', !checks);
  if (checks) {
    list.replaceChildren(...checks.map((c) => {
      const row = el('div', 'chk ' + c.status);
      row.title = c.detail;
      row.append(el('span', 'ic', c.status === 'ok' ? '✓' : c.status === 'partial' ? '•' : '✗'), el('span', null, c.label), el('span', 'v', c.detail));
      return row;
    }));
  }
}

function bar(score) {
  const b = el('div', 'bar'); const i = el('i'); i.style.width = Math.max(0, Math.min(100, score)) + '%';
  b.append(i, el('b')); b.title = 'Linha amarela = mínimo de 80'; return b;
}

function renderTrade(s, now) {
  const box = $('tradeBox');
  const t = s.openTrade;
  box.classList.toggle('hidden', !t);
  if (!t) { box.replaceChildren(); return; }
  const card = el('div', 'card');
  const left = Math.ceil((t.expiryTime - now) / 1000);
  const top = el('div', 'row'); top.append(el('b', t.direction === 'CALL' ? 'ok' : 'no', `${t.auto ? 'AUTO ' : ''}${t.direction} em andamento`), el('span', 'small', `${t.amount.toFixed(2)} · ${t.mode}`));
  card.append(top);
  if (left > 0) card.append(el('div', 'small', `Expira em ${left}s`));
  else {
    const sg = t.suggested;
    const autoLeft = t.auto && sg ? Math.max(0, Math.ceil((t.expiryTime + AUTO_RECORD_AFTER_MS - now) / 1000)) : null;
    card.append(el('div', 'small', (sg ? `Binance indica ${sg.result}. Confira na Quotex e registre:` : 'Registre o resultado da Quotex:')
      + (autoLeft != null ? ` (sem resposta, o AUTO registra ${sg.result} em ${autoLeft}s)` : '')));
    const btns = el('div', 'btns');
    const mk = (r, cls, label) => button(cls + (sg?.result === r ? ' sugg' : ''), label, () => dispatch({ type: 'RECORD_RESULT', tradeId: t.id, result: r }));
    btns.append(mk('GREEN', 'green', 'GREEN'), mk('LOSS', 'red', 'LOSS'), mk('DRAW', '', 'EMPATE'));
    card.append(btns);
  }
  box.replaceChildren(card);
}

function autoChecks(s) {
  const calib = s.settings.calib;
  const pageMode = detectPageMode();
  const asset = detectAsset(calib);
  const pageSym = assetToSymbol(asset);
  const amt = readAmount(calib);
  const pr = calib.call ? panelReadings(calib) : null;
  return [
    { label: 'Calibrado', ok: calibComplete(s), v: calibComplete(s) ? (pr ? 'painel de operação encontrado' : 'botões ok') : 'calibre Comprar/Vender em ⚙' },
    { label: 'Tempo', ok: pr?.expirySec == null || pr.expirySec === 60, v: pr?.expiryText ? `${pr.expiryText}${pr.expirySec === 60 ? '' : ' — use 00:01:00'}` : 'não lido (confirme 1 min)' },
    { label: 'Conta', ok: pageMode === s.account.mode,
      v: pageMode === s.account.mode ? `página ${pageMode} · bot ${s.account.mode}`
        : pageMode === 'REAL' ? `página em conta REAL (${location.pathname}) — bot só opera DEMO; troque para a conta demo`
        : `conta da página não identificada (${location.pathname})` },
    quotexMode(s) ? { label: 'Mercado aberto', ok: !!asset && qxSymbol(feedKey(asset)) === s.settings.symbol,
      v: asset ? `${asset.label} (preço da Quotex)` : 'ativo não encontrado no painel de operação' } :
    { label: 'Mercado aberto', ok: !!pageSym && pageSym === s.settings.symbol,
      v: !asset ? (calib.call ? 'ativo não encontrado no painel de operação' : 'calibre Comprar/Vender em ⚙')
        : asset.otc ? `${asset.label}: calibre o "Preço ao vivo" em ⚙ para operar OTC`
        : !pageSym ? `${asset.label}: sem dados de cripto`
        : pageSym !== s.settings.symbol ? `${asset.label} ≠ ${s.settings.symbol}` : asset.label },
    { label: 'Valor', ok: amt != null && Math.abs(amt - s.settings.amount) < 0.001,
      v: amt == null ? (calib.call ? 'Investimento não encontrado no painel' : 'calibre Comprar/Vender em ⚙')
        : amountSyncError ? `Quotex ${amt}: ${amountSyncError}` : `Quotex ${amt} · bot ${s.settings.amount.toFixed(2)} (automático)` },
  ];
}

function renderAuto(s) {
  const box = $('autoBox');
  const armed = autoArmed(s);
  const row = el('div', 'row');
  const btn = el('button', 'toggle ' + (armed ? 'auto-on' : 'off'), armed ? '🤖 AUTO ARMADO' : '🤖 AUTO DESLIGADO');
  btn.disabled = !!s.day.locked || !s.active;
  btn.title = 'Quando armado, o bot clica CALL/PUT sozinho no mercado aberto, se tudo conferir.';
  btn.addEventListener('click', async () => {
    if (armed) return dispatch({ type: 'SET_AUTO', armed: false });
    if (!calibComplete(state)) { view = 'settings'; renderSettings(true); render(); showToast('Calibre os 4 itens antes de armar o AUTO', 'warn'); return; }
    const ok = window.confirm('ARMAR AUTOMÁTICO\n\n• O bot vai CLICAR em CALL/PUT sozinho na Quotex quando sair sinal no mercado aberto.\n• Confirme que a EXPIRAÇÃO na Quotex está em 1 MINUTO.\n• Resultados passados não garantem resultados futuros.\n\nArmar agora?');
    if (ok) dispatch({ type: 'SET_AUTO', armed: true, expiryConfirmed: true });
  });
  row.append(btn);
  const list = el('div', 'autochk');
  if (s.active) {
    for (const c of autoChecks(s)) {
      const r = el('div', 'chk ' + (c.ok ? 'ok' : 'no'));
      r.append(el('span', 'ic', c.ok ? '✓' : '✗'), el('span', null, c.label), el('span', 'v', c.v));
      list.append(r);
    }
  }
  box.replaceChildren(row, list);
}

function renderMarkets(s) {
  const box = $('markets');
  const top = indicatedMarkets();
  if (!s.active || !top.length) { box.replaceChildren(); return; }
  const head = el('div', 'small muted', 'Mercados indicados (abra na Quotex):');
  const rows = top.map(([sym, v]) => {
    const r = el('div', 'mkt' + (v.signal ? ' ' + v.dir : '') + (sym === s.settings.symbol ? ' cur' : ''));
    r.append(el('span', null, SYMBOLS[sym].replace(/^.*\((.*)\).*$/, '$1')),
      el('span', 'v', `${v.signal ? '✔ ' : ''}${v.dir === 'CALL' ? '▲' : '▼'} ${v.dir} ${v.score}`));
    r.title = sym === s.settings.symbol ? 'Mercado em análise' : 'Abra este ativo na Quotex (M1, expiração 1 min)';
    return r;
  });
  box.replaceChildren(head, ...rows);
}

// ---------------------------------------------------------------- Ajustes (dentro do painel)
function renderSettings(rebuild) {
  const box = $('settings');
  if (!rebuild && box.dataset.built) { updateSettingsStats(); return; }
  box.dataset.built = '1';
  const s = state;
  const form = el('div', 'form');
  const num = (v, min, max, step) => { const i = el('input'); i.type = 'number'; i.min = min; i.max = max; i.step = step; i.value = v; return i; };
  const feedSel = el('select');
  for (const [v, t] of [['quotex', 'Quotex (preço da tela, inclui OTC)'], ['binance', 'Binance (só cripto, sem OTC)']]) { const o = el('option', null, t); o.value = v; feedSel.appendChild(o); }
  feedSel.value = s.settings.feed || 'quotex';
  feedSel.addEventListener('change', () => dispatch({ type: 'SET_SETTINGS', value: { feed: feedSel.value } }));
  const minScore = num(s.settings.minScore, 80, 100, 1);
  const payout = num(s.settings.payout, 0.1, 1.5, 0.01);
  const ttl = num(s.settings.signalTtlSec, 3, 30, 1);
  const lab = (t, inp) => { const l = el('label'); l.append(el('span', null, t), inp); return l; };
  const clk = Math.abs(clockOffset) > 3000 ? ` · relógio do PC ${Math.round(Math.abs(clockOffset) / 1000)} s ${clockOffset < 0 ? 'adiantado' : 'atrasado'} (o bot já corrige sozinho)` : '';
  form.append(el('div', 'small muted', `Horário: Brasília (automático) · o dia vira à meia-noite${clk}`), lab('Fonte das velas', feedSel), lab('Nota mínima (80–100)', minScore), lab('Payout (ex.: 0.85)', payout), lab('Validade do sinal (s)', ttl));
  const msg = el('div', 'small');
  const save = button('blue', 'SALVAR', async () => {
    const v = { minScore: Number(minScore.value), payout: Number(payout.value), signalTtlSec: Number(ttl.value) };
    const r = await dispatch({ type: 'SET_SETTINGS', value: v });
    msg.textContent = r.error || 'Salvo.'; msg.className = 'small ' + (r.error ? 'no' : 'ok');
  });
  form.append(save, msg, el('div', 'small muted', 'Fixos: 10 GREEN / 3 LOSS por dia, sem Martingale, 1 operação por vez.'));

  const stats = el('div'); stats.dataset.k = 'statsBox';
  const real = el('div', 'form');
  const phrase = el('input'); phrase.placeholder = REAL_CONFIRM_PHRASE;
  const rmsg = el('div', 'small');
  const goReal = button('red', 'HABILITAR REAL', async () => {
    const r = await dispatch({ type: 'SET_MODE', mode: 'REAL', confirmation: phrase.value.trim() });
    rmsg.textContent = r.error || 'Modo REAL habilitado.'; rmsg.className = 'small ' + (r.error ? 'no' : 'ok');
  });
  const goDemo = button('', 'VOLTAR P/ DEMO', () => dispatch({ type: 'SET_MODE', mode: 'DEMO' }));
  const rb = el('div', 'btns'); rb.append(goReal, goDemo);
  real.append(el('div', 'small muted', `Para liberar o REAL, cumpra todos os critérios e digite: ${REAL_CONFIRM_PHRASE}`), phrase, rb, rmsg);

  const cal = el('div', 'form');
  cal.dataset.k = 'calibBox';

  const exp = button('', 'EXPORTAR HISTÓRICO (JSON)', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.download = 'm1-sniper-historico.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const diag = button('blue', 'COPIAR DIAGNÓSTICO', async () => {
    const txt = diagnostics(state.settings.calib) + '\n--- histórico do gráfico ---\n'
      + (lastHistory ? `${lastHistory.key}: ${lastHistory.ok ? 'OK' : 'FALHOU'} — ${lastHistory.text}\n${lastHistory.info}` : 'ainda não tentado');
    try { await navigator.clipboard.writeText(txt); showToast('Diagnóstico copiado: cole na conversa com o suporte', 'ok'); }
    catch { window.prompt('Copie o diagnóstico (Ctrl+C):', txt); }
  });
  const hist = button('', 'LER HISTÓRICO DO GRÁFICO', () => {
    if (!qxKey) { showToast('Ativo/preço da Quotex ainda não lido.', 'warn'); return; }
    view = 'main'; render(); loadChartHistory(qxKey, true);
  });
  const back = button('', '← VOLTAR AO PAINEL', () => { view = 'main'; render(); });
  const histInfo = el('div', 'small ' + (lastHistory ? (lastHistory.ok ? 'ok' : 'no') : 'muted'),
    lastHistory ? `Última leitura do histórico (${lastHistory.key}): ${lastHistory.ok ? '' : 'falhou — '}${lastHistory.text}` : 'Histórico do gráfico: ainda não tentado');
  box.replaceChildren(el('b', null, 'Calibração do automático'), cal, diag, hist, histInfo, el('b', null, 'Ajustes'), form, el('b', null, 'Validação DEMO'), stats, real, exp, back);
  updateSettingsStats();
  renderCalib();
}

const CALIB_ITEMS = [
  { key: 'price', label: 'Preço ao vivo (automático)', hint: 'opcional: clique num PREÇO em texto, se houver' },
  { key: 'call', label: 'Botão Comprar (CALL)', hint: 'clique no botão COMPRAR (verde)' },
  { key: 'put', label: 'Botão Vender (PUT)', hint: 'clique no botão VENDER (vermelho)' },
  { key: 'asset', label: 'Ativo', hint: 'clique no NOME do ativo aberto (topo do painel da direita)' },
  { key: 'amount', label: 'Valor (opcional)', hint: 'clique no número do Investimento' },
];
let calibrating = null;

function renderCalib() {
  const box = root.querySelector('[data-k="calibBox"]');
  if (!box) return;
  const c = state.settings.calib;
  const rows = CALIB_ITEMS.map((it) => {
    if (it.key === 'price') return priceRow(c);
    const r = el('div', 'row small');
    let test = '';
    let okItem = !!c[it.key];
    if (it.key === 'price' && !c[it.key]) {
      const pi = readPriceInfo(c);
      okItem = !!pi;
      test = pi ? `automático (${pi.from}): ${pi.price}` : 'procurando o preço sozinho…';
    }
    if (c[it.key]) {
      const rd = calibReading(c[it.key], it.key);
      if (it.key === 'price' && (!rd.found || !readPrice({ price: c.price }))) {
        const pi = readPriceInfo(c);
        okItem = !!pi;
        test = pi ? `automático (${pi.from}): ${pi.price}` : 'procurando o preço sozinho…';
      }
      else if (!rd.found && /opcional/.test(it.label)) test = 'não usado (lido do painel)';
      else if (!rd.found) test = 'NÃO ENCONTRADO — refaça';
      else if (it.key === 'asset') { const a = detectAsset(c); test = a ? `lido "${a.label}"` : `lido "${rd.text}" (não reconhecido)`; }
      else if (it.key === 'amount') test = `lido "${rd.text}" = ${readAmount(c) ?? '?'}`;
      else if (it.key === 'price') test = `lido ${readPrice(c) ?? '?'}`;
      else test = 'encontrado';
    }
    r.append(el('span', okItem ? 'ok' : 'no', `${okItem ? '✓' : '✗'} ${it.label}${test ? ' · ' + test : ''}`),
      button(calibrating === it.key ? 'blue' : '', calibrating === it.key ? 'CLIQUE NA QUOTEX…' : (c[it.key] ? 'REFAZER' : 'CALIBRAR'), () => startCalib(it)));
    return r;
  });
  const pr = c.call ? panelReadings(c) : null;
  const auto = el('div', 'small ' + (pr ? 'ok' : 'muted'), pr
    ? `Painel de operação lido automaticamente: ${pr.asset?.label ?? 'ativo ?'} · ${pr.payout != null ? Math.round(pr.payout * 100) + '%' : '% ?'} · Tempo ${pr.expiryText ?? '?'} · Investimento ${pr.amountText ?? '?'}`
    : 'Calibre Comprar e Vender: ativo, %, tempo e valor são lidos sozinhos do painel ao lado deles.');
  box.replaceChildren(el('div', 'small muted', 'Clique em CALIBRAR e depois no item da Quotex. O clique é bloqueado: nada é operado. Esc cancela.'), ...rows, auto);
}

let pickingPrice = false;
function colorName(f) {
  const m = { '#ffffff': 'branco', '#fff': 'branco', '#000000': 'preto' };
  return m[String(f).toLowerCase()] || f;
}
/** Linha "Preço ao vivo": mostra o preço lido e permite ESCOLHER entre os números do gráfico. */
function priceRow(c) {
  const wrap = el('div');
  const pi = readPriceInfo(c);
  const chosen = parseCanvasPref(c.price);
  const r = el('div', 'row small');
  r.append(el('span', pi ? 'ok' : 'no', `${pi ? '✓' : '✗'} Preço ao vivo · ${pi ? `${pi.price} (${pi.from})` : 'não identificado'}`),
    button(pickingPrice ? 'blue' : '', pickingPrice ? 'FECHAR' : 'ESCOLHER', () => { pickingPrice = !pickingPrice; renderCalib(); }));
  wrap.append(r);
  if (pickingPrice) {
    const cands = canvasCandidates(10_000).slice(0, 8);
    wrap.append(el('div', 'small muted', cands.length ? 'Toque no número IGUAL ao rótulo azul do preço no gráfico:' : 'Nenhum número mudando no gráfico agora. Recarregue a Quotex (F5) e aguarde.'));
    for (const k of cands) {
      const sel = chosen && chosen.color === k.color && (chosen.key === k.key);
      wrap.append(button(sel ? 'green' : '', `${k.text} · ${colorName(k.color)} · ${Math.round(k.rate * 10) / 10}/s`, async () => {
        selectCanvasKey(k.key);
        await dispatch({ type: 'SET_CALIB', key: 'price', selector: JSON.stringify({ v: 3, kind: 'canvas', key: k.key, color: k.color, rate: k.rate }) });
        pickingPrice = false; renderCalib();
        showToast(`Preço ao vivo: ${k.text} (${colorName(k.color)}). Confira se acompanha o rótulo azul.`, 'ok');
      }));
    }
  }
  return wrap;
}

async function startCalib(it) {
  if (calibrating) return;
  calibrating = it.key; renderCalib();
  showToast(`Calibrando: ${it.hint}`, 'warn');
  const target = await captureNextClick((e) => e.composedPath().includes(hostEl));
  calibrating = null;
  if (target) {
    const el = it.key === 'asset' ? (assetTargetFromClick(target) || target) : target;
    const r = await dispatch({ type: 'SET_CALIB', key: it.key, selector: makeCalib(el, it.key) });
    if (it.key === 'asset' && !r.error) {
      clearCaches();
      const a = detectAsset(state.settings.calib);
      if (a && !state.openTrade && !state.activeSignal) await switchTo(a, targetSymbol(a));
    }
    showToast(r.error ? `Erro: ${r.error}` : `${it.label} calibrado`, r.error ? 'err' : 'ok');
  } else showToast('Calibração cancelada', 'warn');
  renderCalib();
}

function updateSettingsStats() {
  renderCalib();
  const box = root.querySelector('[data-k="statsBox"]');
  if (!box) return;
  const s = state;
  const st = computeStats(s.trades.filter((t) => t.mode === 'DEMO'), s.settings.payout, s.settings.timeZone);
  const kv = el('div', 'kv');
  const add = (k, v) => kv.append(el('span', 'muted', k), el('b', null, String(v)));
  add('Operações DEMO', st.total); add('Taxa de acerto', (st.winRate * 100).toFixed(1) + '%');
  add('Break-even', (st.breakEven * 100).toFixed(1) + '%'); add('Resultado (entradas)', st.netStakes.toFixed(2));
  add('Drawdown máx.', st.maxDrawdownStakes.toFixed(2)); add('Dias testados', st.distinctDays);
  const rd = realReadiness(s);
  const ul = el('ul', 'crit');
  for (const c of rd.checks) ul.append(el('li', c.ok ? 'ok' : 'no', `${c.ok ? '✓' : '✗'} ${c.label} (${c.value})`));
  box.replaceChildren(kv, ul);
}

function tick() {
  if (!root || !state) return;
  $('clock').textContent = formatTime(nowMs(), state.settings.timeZone);
}

let lastSecond = -1;
function everySecond() {
  const sec = Math.floor(nowMs() / 1000);
  if (sec === lastSecond) return;
  lastSecond = sec;
  if (view === 'main' && visible) render(); else tick();
  if (state?.activeSignal && nowMs() > state.activeSignal.entryTime + state.settings.signalTtlSec * 1000) dispatch({ type: 'TICK' });
}

export async function start() {
  await mountPanel();
  window.__m1SniperToggle = () => setVisible(!visible);
  const res = await send({ type: 'getState' });
  if (res.state) state = res.state; else uiError = res.error;
  render();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.m1state?.newValue) { state = changes.m1state.newValue; render(); }
  });
  window.addEventListener('online', () => poll());
  window.addEventListener('resize', () => { const r = panel.getBoundingClientRect(); place(r.left, r.top); });
  setInterval(everySecond, 250);
  setInterval(qxTick, 250);
  poll();
}
