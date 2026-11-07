// Painel flutuante + laço de análise. Roda dentro da página da Quotex.
import { analyze, REQUIRED_CANDLES } from '../core/engine.js';
import { closedOnly, mergeCandles, M1_MS } from '../core/validate.js';
import { outcomeOf } from '../core/backtest.js';
import { canSignal } from '../core/state.js';
import { DAILY_GREEN_TARGET, DAILY_LOSS_LIMIT, LOCK_MESSAGES } from '../core/risk.js';
import { formatTime } from '../core/time.js';
import { SYMBOLS, SOURCE_ID } from '../data/binance.js';
import { detectPageMode, detectAsset, assetMatches } from './quotexPage.js';

const POLL_MS = 4000;
const FAST_POLL_MS = 1000;           // nos primeiros segundos de cada minuto
const STALE_MS = 2.5 * M1_MS;        // sem candle fechado novo há 2,5 min = dados desatualizados

let state = null;
let candles = [];
let candleSymbol = null;
let conn = { status: 'connecting', error: null, lastOk: 0 };
let analysis = { text: 'Aguardando dados…', score: null };
let lastAnalyzedTime = null;
let uiError = null;
let pollTimer = null;

const send = (msg) => new Promise((resolve) => {
  try {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
      else resolve(res || { error: 'Sem resposta' });
    });
  } catch (e) { resolve({ error: 'Extensão recarregada — atualize a página (F5)' }); }
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
    const sym = state.settings.symbol;
    if (sym !== candleSymbol) { candles = []; candleSymbol = sym; lastAnalyzedTime = null; }
    const limit = candles.length >= REQUIRED_CANDLES ? 5 : 500;
    const res = await send({ type: 'klines', symbol: sym, limit });
    if (res.error) throw new Error(res.error);
    candles = mergeCandles(candles, res.candles, 600);
    conn = { status: 'ok', error: null, lastOk: Date.now() };
    await onData();
  } catch (e) {
    conn = { ...conn, status: 'offline', error: String(e.message || e) };
    analysis = { text: 'Sem conexão com a fonte de dados — sinais suspensos', score: null };
  } finally {
    render();
    const sec = new Date().getSeconds();
    pollTimer = setTimeout(poll, sec < 6 ? FAST_POLL_MS : POLL_MS);
  }
}

async function onData() {
  const now = Date.now();
  const closed = closedOnly(candles, now);
  const last = closed.at(-1);
  if (!last || now - (last.time + M1_MS) > STALE_MS) {
    conn.status = 'stale';
    analysis = { text: 'Dados desatualizados — sinais suspensos', score: null };
    return;
  }
  await resolveOutcomes(closed);

  if (last.time === lastAnalyzedTime) return; // analisa uma vez por candle fechado
  lastAnalyzedTime = last.time;

  if (!state.active) { analysis = { text: 'Painel desativado — sem análise operacional', score: null }; return; }
  const block = canSignal(state);
  if (block) { analysis = { text: block, score: null }; return; }

  const asset = detectAsset();
  if (assetMatches(asset, state.settings.symbol) === false) {
    analysis = { text: `Ativo da Quotex (${asset.label}) ≠ ativo analisado (${state.settings.symbol}). Sinais suspensos.`, score: null };
    return;
  }

  const r = analyze(closed, { minScore: state.settings.minScore }, { symbol: state.settings.symbol, source: SOURCE_ID });
  if (r.status === 'invalid') { analysis = { text: `Dados inválidos: ${r.reason}`, score: null }; return; }
  if (r.status === 'no_signal') {
    analysis = { text: `Sem entrada: ${r.reason}`, score: r.best?.score ?? null, dir: r.best?.dir };
    return;
  }
  analysis = { text: `Sinal ${r.signal.direction} encontrado`, score: r.signal.score, dir: r.signal.direction };
  const res = await dispatch({ type: 'PROPOSE_SIGNAL', signal: r.signal, pageMode: detectPageMode() });
  if (!res.error) beep(r.signal.direction);
}

/** Mede na fonte de dados o resultado de sinais e da operação aberta (sugestão). */
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
let root, $;

const TEMPLATE = `
<div class="panel" part="panel">
  <div class="head" data-drag>
    <span class="dot" data-k="dot"></span>
    <span class="title">M1 <b>SNIPER</b> BOT</span>
    <span class="badge demo" data-k="mode">DEMO</span>
    <button class="iconbtn" data-k="minBtn" title="Minimizar">–</button>
  </div>
  <div class="body">
    <div class="row"><span class="status off" data-k="status">DESATIVADO</span><span class="clock" data-k="clock">--:--:--</span></div>
    <div class="row small"><span class="muted">Próximo candle em</span><span class="clock" data-k="countdown">--</span></div>
    <div class="row small">
      <span class="muted">Ativo</span>
      <select data-k="symbol"></select>
    </div>
    <div class="small muted" data-k="assetInfo"></div>
    <div class="row">
      <span class="muted">Valor por operação</span>
      <input class="amount" data-k="amount" type="number" min="0.01" step="0.01" inputmode="decimal">
    </div>
    <button class="toggle off" data-k="toggle">LIGAR</button>
    <div class="lockbox hidden" data-k="lock"></div>
    <div class="counters">
      <div class="counter g"><div class="n" data-k="greens">0</div><div class="small muted">GREEN / ${DAILY_GREEN_TARGET}</div></div>
      <div class="counter l"><div class="n" data-k="losses">0</div><div class="small muted">LOSS / ${DAILY_LOSS_LIMIT}</div></div>
    </div>
    <div class="analysis small"><div class="row"><span class="muted">Análise</span><span data-k="conn"></span></div><div data-k="analysis"></div></div>
    <div data-k="signalBox" class="hidden"></div>
    <div data-k="tradeBox" class="hidden"></div>
    <div class="small"><span class="muted">Último sinal: </span><span data-k="lastSignal">—</span></div>
    <div><div class="small muted" style="margin-bottom:3px">Histórico de hoje</div><div class="history" data-k="history"></div></div>
    <div class="err hidden" data-k="err"></div>
    <div class="row small"><a data-k="report">Relatórios e configurações</a><span class="muted">Execução manual</span></div>
  </div>
</div>`;

async function mountPanel() {
  const host = document.createElement('div');
  host.id = 'm1-sniper-bot-host';
  document.documentElement.appendChild(host);
  root = host.attachShadow({ mode: 'closed' });
  const css = await (await fetch(chrome.runtime.getURL('src/content/panel.css'))).text();
  const sheet = new CSSStyleSheet(); sheet.replaceSync(css);
  root.adoptedStyleSheets = [sheet];
  const wrap = document.createElement('div');
  wrap.innerHTML = TEMPLATE; // template estático, sem dados externos
  root.appendChild(wrap.firstElementChild);
  $ = (k) => root.querySelector(`[data-k="${k}"]`);

  const sel = $('symbol');
  for (const [k, label] of Object.entries(SYMBOLS)) {
    const o = document.createElement('option'); o.value = k; o.textContent = `${k} · ${label}`; sel.appendChild(o);
  }
  sel.addEventListener('change', () => dispatch({ type: 'SET_SETTINGS', value: { symbol: sel.value } }));
  $('toggle').addEventListener('click', () => dispatch({ type: 'SET_ACTIVE', value: !state.active }));
  const amt = $('amount');
  amt.addEventListener('change', () => dispatch({ type: 'SET_AMOUNT', value: Number(String(amt.value).replace(',', '.')) }));
  amt.addEventListener('keydown', (e) => e.stopPropagation()); // não dispara atalhos da página
  $('minBtn').addEventListener('click', () => {
    const minimized = !state.settings.panel.minimized;
    dispatch({ type: 'SET_SETTINGS', value: { panel: { minimized } } });
  });
  $('report').addEventListener('click', () => send({ type: 'openOptions' }));
  enableDrag(root.querySelector('.panel'));
}

function enableDrag(panel) {
  const head = panel.querySelector('[data-drag]');
  let sx, sy, ox, oy, dragging = false;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true; head.setPointerCapture(e.pointerId);
    const r = panel.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
  });
  head.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    place(panel, ox + e.clientX - sx, oy + e.clientY - sy);
  });
  head.addEventListener('pointerup', () => {
    if (!dragging) return; dragging = false;
    const r = panel.getBoundingClientRect();
    dispatch({ type: 'SET_SETTINGS', value: { panel: { x: Math.round(r.left), y: Math.round(r.top) } } });
  });
}

function place(panel, x, y) {
  const w = panel.offsetWidth || 268, h = panel.offsetHeight || 40;
  x = Math.min(Math.max(0, x), window.innerWidth - w);
  y = Math.min(Math.max(0, y), window.innerHeight - Math.min(h, 40));
  panel.style.left = x + 'px'; panel.style.top = y + 'px';
}

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function button(cls, text, onClick) { const b = el('button', 'btn ' + cls, text); b.addEventListener('click', onClick); return b; }

function render() {
  if (!root || !state) return;
  const s = state, tz = s.settings.timeZone, now = Date.now();
  const panel = root.querySelector('.panel');
  panel.classList.toggle('min', !!s.settings.panel.minimized);
  $('minBtn').textContent = s.settings.panel.minimized ? '+' : '–';
  if (!panel.dataset.placed) {
    panel.dataset.placed = '1';
    const x = s.settings.panel.x ?? window.innerWidth - 268 - 16;
    place(panel, x, s.settings.panel.y ?? 16);
  }

  const locked = s.day.locked;
  $('dot').className = 'dot ' + (locked ? 'lock' : s.active ? 'on' : '');
  const st = $('status');
  st.textContent = locked ? 'BLOQUEADO' : s.active ? 'ATIVO' : 'DESATIVADO';
  st.className = 'status ' + (locked ? 'lock' : s.active ? 'on' : 'off');

  const pageMode = detectPageMode();
  const mode = $('mode');
  mode.textContent = s.account.mode;
  mode.className = 'badge ' + (s.account.mode === 'REAL' ? 'real' : 'demo');
  mode.title = `Modo do bot: ${s.account.mode}. Página (pela URL, não verificado): ${pageMode}`;

  const sel = $('symbol');
  if (root.activeElement !== sel) sel.value = s.settings.symbol;
  sel.disabled = !!(s.openTrade || s.activeSignal);
  const amt = $('amount');
  if (root.activeElement !== amt) amt.value = s.settings.amount.toFixed(2);
  amt.disabled = !!s.openTrade;

  const asset = detectAsset();
  const match = assetMatches(asset, s.settings.symbol);
  $('assetInfo').textContent = `Fonte: Binance (${s.settings.symbol}) · Quotex: ${asset ? asset.label : 'não detectado'}`
    + (match === false ? ' ⚠ não corresponde' : '') + (pageMode === 'REAL' && s.account.mode === 'DEMO' ? ' · ⚠ página parece REAL' : '');

  const tg = $('toggle');
  tg.textContent = s.active ? 'DESLIGAR' : 'LIGAR';
  tg.className = 'toggle ' + (s.active ? '' : 'off');
  tg.disabled = !!locked;

  const lock = $('lock');
  lock.classList.toggle('hidden', !locked);
  if (locked) { lock.className = 'lockbox ' + locked; lock.textContent = `${LOCK_MESSAGES[locked]} · volta amanhã`; }

  $('greens').textContent = s.day.greens;
  $('losses').textContent = s.day.losses;

  const connEl = $('conn');
  connEl.textContent = conn.status === 'ok' ? '● online' : conn.status === 'stale' ? '● atrasado' : conn.status === 'offline' ? '● offline' : '● conectando';
  connEl.style.color = conn.status === 'ok' ? '#22c55e' : conn.status === 'connecting' ? '#94a3b8' : '#f59e0b';
  // Estado de bloqueio/desativação vale imediatamente, sem esperar o próximo candle.
  const block = canSignal(s);
  const shown = block && block !== 'Já existe um sinal em aberto' ? { text: block } : analysis;
  const extra = shown === analysis && analysis.score != null ? ` (melhor nota ${analysis.score}${analysis.dir ? ' ' + analysis.dir : ''})` : '';
  $('analysis').textContent = shown.text + extra;

  renderSignal(s, now, tz);
  renderTrade(s, now);

  const last = s.signalLog.at(-1);
  $('lastSignal').textContent = last ? `${last.direction} ${last.symbol} ${last.score} pts às ${formatTime(last.entryTime, tz, false)}` : '—';

  const hist = $('history'); hist.replaceChildren();
  const today = s.trades.filter((t) => t.dayKey === s.day.key).slice(-20);
  if (!today.length) hist.appendChild(el('span', 'small muted', 'sem operações'));
  for (const t of today) {
    const h = el('span', 'h ' + t.result, t.result === 'GREEN' ? 'G' : t.result === 'LOSS' ? 'L' : '=');
    h.title = `${t.direction} ${t.symbol} ${formatTime(t.entryTime, tz, false)} · ${t.amount.toFixed(2)}`;
    hist.appendChild(h);
  }

  const err = $('err');
  err.classList.toggle('hidden', !uiError && !conn.error);
  err.textContent = uiError || (conn.status !== 'ok' ? conn.error : '') || '';
  tick();
}

function renderSignal(s, now, tz) {
  const box = $('signalBox');
  const sig = s.activeSignal;
  box.classList.toggle('hidden', !sig);
  if (!sig) { box.replaceChildren(); return; }
  const ttl = Math.max(0, Math.ceil((sig.entryTime + s.settings.signalTtlSec * 1000 - now) / 1000));
  const card = el('div', 'signal ' + sig.direction);
  const top = el('div', 'row');
  top.append(el('span', 'dir', sig.direction === 'CALL' ? '▲ CALL' : '▼ PUT'), el('span', 'score', `${sig.score}/100`));
  const info = el('div', 'small muted', `${sig.symbol} · entrada ${formatTime(sig.entryTime, tz)} · exp. 1 min`);
  const conf = el('div', 'small', 'Confirmados: ' + sig.confirmed.join(', '));
  const ul = el('ul', 'reasons'); for (const r of sig.reasons) ul.appendChild(el('li', null, r));
  const btns = el('div', 'btns');
  btns.append(
    button(sig.direction === 'CALL' ? 'green' : 'red', `CONFIRMEI A ENTRADA (${ttl}s)`, () => dispatch({ type: 'CONFIRM_ENTRY', signalId: sig.id })),
    button('', 'IGNORAR', () => dispatch({ type: 'DISMISS_SIGNAL', signalId: sig.id })),
  );
  const note = el('div', 'small muted', 'Abra a operação você mesmo na Quotex e depois confirme aqui. Nota não é probabilidade de acerto.');
  card.append(top, info, conf, ul, btns, note);
  box.replaceChildren(card);
}

function renderTrade(s, now) {
  const box = $('tradeBox');
  const t = s.openTrade;
  box.classList.toggle('hidden', !t);
  if (!t) { box.replaceChildren(); return; }
  const card = el('div', 'signal ' + t.direction);
  const left = Math.ceil((t.expiryTime - now) / 1000);
  card.append(el('div', 'row', null));
  card.firstChild.append(el('span', 'dir', `${t.direction} aberto`), el('span', 'small', `${t.amount.toFixed(2)} · ${t.mode}`));
  if (left > 0) {
    card.append(el('div', 'small', `Expira em ${left}s — aguarde para registrar o resultado.`));
  } else {
    const sg = t.suggested;
    card.append(el('div', 'small', sg
      ? `Fonte Binance indica ${sg.result} (${sg.entryPrice} → ${sg.exitPrice}). Confira o resultado REAL na Quotex:`
      : 'Registre o resultado conforme a Quotex:'));
    const btns = el('div', 'btns');
    const mk = (r, cls, label) => { const b = button(cls + (sg?.result === r ? ' sugg' : ''), label, () => dispatch({ type: 'RECORD_RESULT', tradeId: t.id, result: r })); return b; };
    btns.append(mk('GREEN', 'green', 'GREEN'), mk('LOSS', 'red', 'LOSS'), mk('DRAW', '', 'EMPATE'));
    card.append(btns);
  }
  box.replaceChildren(card);
}

function tick() {
  if (!root || !state) return;
  const now = Date.now();
  $('clock').textContent = formatTime(now, state.settings.timeZone);
  const left = 60 - new Date(now).getUTCSeconds();
  $('countdown').textContent = `${left}s`;
}

let lastSecond = -1;
function everySecond() {
  const sec = Math.floor(Date.now() / 1000);
  if (sec !== lastSecond) {
    lastSecond = sec;
    // Re-render para contadores regressivos de sinal/operação e expiração local.
    if (state?.activeSignal || state?.openTrade) render(); else tick();
    if (state?.activeSignal && Date.now() > state.activeSignal.entryTime + state.settings.signalTtlSec * 1000) dispatch({ type: 'TICK' });
  }
}

export async function start() {
  await mountPanel();
  const res = await send({ type: 'getState' });
  if (res.state) state = res.state; else { uiError = res.error; }
  render();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.m1state?.newValue) { state = changes.m1state.newValue; render(); }
  });
  window.addEventListener('online', () => poll());
  window.addEventListener('resize', () => { const p = root.querySelector('.panel'); const r = p.getBoundingClientRect(); place(p, r.left, r.top); });
  setInterval(everySecond, 250);
  poll();
}
