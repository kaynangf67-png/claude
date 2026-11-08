// Painel flutuante SOBRE o gráfico + laço de análise M1.
// Não executa ordens: mostra a confirmação para a PRÓXIMA vela (expiração 1 min).
import { analyze, REQUIRED_CANDLES } from '../core/engine.js';
import { closedOnly, mergeCandles, M1_MS } from '../core/validate.js';
import { outcomeOf } from '../core/backtest.js';
import { canSignal } from '../core/state.js';
import { DAILY_GREEN_TARGET, DAILY_LOSS_LIMIT, LOCK_MESSAGES } from '../core/risk.js';
import { computeStats, realReadiness, REAL_CONFIRM_PHRASE } from '../core/stats.js';
import { formatTime } from '../core/time.js';
import { SYMBOLS, SOURCE_ID } from '../data/binance.js';
import { detectPageMode, detectAsset, assetMatches } from './quotexPage.js';

const POLL_MS = 3000;
const FAST_POLL_MS = 1000;           // perto da virada do minuto
const STALE_MS = 2.5 * M1_MS;

let state = null;
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
    const sym = state.settings.symbol;
    if (sym !== candleSymbol) { candles = []; candleSymbol = sym; lastAnalyzedTime = null; confirmed = preview = null; }
    const res = await send({ type: 'klines', symbol: sym, limit: candles.length >= REQUIRED_CANDLES ? 5 : 500 });
    if (res.error) throw new Error(res.error);
    candles = mergeCandles(candles, res.candles, 600);
    conn = { status: 'ok', error: null };
    await onData();
  } catch (e) {
    conn = { status: 'offline', error: String(e.message || e) };
    preview = null;
  } finally {
    render();
    const sec = new Date().getSeconds();
    pollTimer = setTimeout(poll, sec >= 55 || sec < 6 ? FAST_POLL_MS : POLL_MS);
  }
}

async function onData() {
  const now = Date.now();
  const closed = closedOnly(candles, now);
  const last = closed.at(-1);
  if (!last || now - (last.time + M1_MS) > STALE_MS) { conn.status = 'stale'; preview = null; return; }
  await resolveOutcomes(closed);
  if (!state.active || state.day.locked) { preview = null; confirmed = null; lastAnalyzedTime = last.time; return; }

  const meta = { symbol: state.settings.symbol, source: SOURCE_ID };
  const cfg = { minScore: state.settings.minScore };

  // Prévia: a vela atual tratada como se fechasse agora (pode mudar até o fechamento).
  const forming = candles.find((c) => c.time === last.time + M1_MS);
  preview = forming ? { r: analyze([...closed, forming], cfg, meta), candleTime: forming.time } : null;

  if (last.time === lastAnalyzedTime) return; // confirmação: uma vez por vela fechada
  lastAnalyzedTime = last.time;
  const r = analyze(closed, cfg, meta);
  confirmed = { r, candleTime: last.time };
  if (r.status !== 'signal') return;
  if (canSignal(state)) return;
  const asset = detectAsset();
  if (assetMatches(asset, state.settings.symbol) === false) {
    confirmed = { r: { status: 'no_signal', reason: `Ativo da página (${asset.label}) ≠ ${state.settings.symbol}`, best: r.best }, candleTime: last.time };
    return;
  }
  const res = await dispatch({ type: 'PROPOSE_SIGNAL', signal: r.signal, pageMode: detectPageMode() });
  if (!res.error) beep(r.signal.direction);
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
      <span class="clock" data-k="clock">--:--:--</span>
    </div>
    <div class="small muted" data-k="assetInfo"></div>
    <div class="next" data-k="next"></div>
    <div class="checks" data-k="checks"></div>
    <div data-k="tradeBox" class="hidden"></div>
    <div class="lockbox hidden" data-k="lock"></div>
    <div class="ctl">
      <button class="toggle off" data-k="toggle">LIGAR</button>
      <input class="amount" data-k="amount" type="number" min="0.01" step="0.01" inputmode="decimal" title="Valor por operação">
    </div>
    <div class="stats small">
      <span>GREEN <span class="cnt g" data-k="greens">0</span>/${DAILY_GREEN_TARGET}</span>
      <span>LOSS <span class="cnt l" data-k="losses">0</span>/${DAILY_LOSS_LIMIT}</span>
      <div class="history" data-k="history"></div>
    </div>
    <div class="small"><span class="muted">Último sinal: </span><span data-k="lastSignal">—</span></div>
    <div class="err hidden" data-k="err"></div>
  </div>
  <div class="body hidden" data-k="settings"></div>
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
  wrap.innerHTML = TEMPLATE; // template estático
  panel = wrap.firstElementChild;
  root.appendChild(panel);

  const sel = $('symbol');
  for (const [k, label] of Object.entries(SYMBOLS)) {
    const o = document.createElement('option'); o.value = k; o.textContent = `${k} · ${label}`; sel.appendChild(o);
  }
  sel.addEventListener('change', () => dispatch({ type: 'SET_SETTINGS', value: { symbol: sel.value } }));
  $('toggle').addEventListener('click', () => dispatch({ type: 'SET_ACTIVE', value: !state.active }));
  const amt = $('amount');
  amt.addEventListener('change', () => dispatch({ type: 'SET_AMOUNT', value: Number(String(amt.value).replace(',', '.')) }));
  root.addEventListener('keydown', (e) => e.stopPropagation()); // não dispara atalhos da Quotex
  $('minBtn').addEventListener('click', () => dispatch({ type: 'SET_SETTINGS', value: { panel: { minimized: !state.settings.panel.minimized } } }));
  $('gear').addEventListener('click', () => { view = view === 'main' ? 'settings' : 'main'; renderSettings(true); render(); });
  $('close').addEventListener('click', () => setVisible(false));
  enableDrag();
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
  if (conn.status !== 'ok') return { kind: 'blocked', text: conn.status === 'stale' ? 'Dados atrasados — aguarde' : 'Sem conexão com a fonte de dados' };
  if (preview) return { kind: 'preview', ...preview };
  if (confirmed) return { kind: 'confirmed', ...confirmed };
  return { kind: 'blocked', text: 'Carregando candles…' };
}

function render() {
  if (!root || !state) return;
  const s = state, tz = s.settings.timeZone, now = Date.now();
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
  const amt = $('amount');
  if (root.activeElement !== amt) amt.value = s.settings.amount.toFixed(2);
  amt.disabled = !!s.openTrade;

  const asset = detectAsset();
  const match = assetMatches(asset, s.settings.symbol);
  const warn = [];
  if (match === false) warn.push(`⚠ página mostra ${asset.label}`);
  if (pageMode === 'REAL' && s.account.mode === 'DEMO') warn.push('⚠ página parece conta REAL');
  $('assetInfo').textContent = warn.length ? warn.join(' · ') : `Fonte Binance · ${conn.status === 'ok' ? 'online' : conn.status === 'stale' ? 'atrasado' : conn.status === 'offline' ? 'offline' : 'conectando'}`;
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
  const top = el('div', 'row'); top.append(el('b', t.direction === 'CALL' ? 'ok' : 'no', `${t.direction} em andamento`), el('span', 'small', `${t.amount.toFixed(2)} · ${t.mode}`));
  card.append(top);
  if (left > 0) card.append(el('div', 'small', `Expira em ${left}s`));
  else {
    const sg = t.suggested;
    card.append(el('div', 'small', sg ? `Binance indica ${sg.result}. Registre o resultado da Quotex:` : 'Registre o resultado da Quotex:'));
    const btns = el('div', 'btns');
    const mk = (r, cls, label) => button(cls + (sg?.result === r ? ' sugg' : ''), label, () => dispatch({ type: 'RECORD_RESULT', tradeId: t.id, result: r }));
    btns.append(mk('GREEN', 'green', 'GREEN'), mk('LOSS', 'red', 'LOSS'), mk('DRAW', '', 'EMPATE'));
    card.append(btns);
  }
  box.replaceChildren(card);
}

// ---------------------------------------------------------------- Ajustes (dentro do painel)
function renderSettings(rebuild) {
  const box = $('settings');
  if (!rebuild && box.dataset.built) { updateSettingsStats(); return; }
  box.dataset.built = '1';
  const s = state;
  const form = el('div', 'form');
  const tz = el('select');
  const tzs = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [];
  if (!tzs.includes('UTC')) tzs.unshift('UTC');
  for (const z of tzs) { const o = el('option', null, z); o.value = z; tz.appendChild(o); }
  tz.value = s.settings.timeZone;
  const num = (v, min, max, step) => { const i = el('input'); i.type = 'number'; i.min = min; i.max = max; i.step = step; i.value = v; return i; };
  const minScore = num(s.settings.minScore, 80, 100, 1);
  const payout = num(s.settings.payout, 0.1, 1.5, 0.01);
  const ttl = num(s.settings.signalTtlSec, 3, 30, 1);
  const lab = (t, inp) => { const l = el('label'); l.append(el('span', null, t), inp); return l; };
  form.append(lab('Fuso (virada do dia)', tz), lab('Nota mínima (80–100)', minScore), lab('Payout (ex.: 0.85)', payout), lab('Validade do sinal (s)', ttl));
  const msg = el('div', 'small');
  const save = button('blue', 'SALVAR', async () => {
    const v = { minScore: Number(minScore.value), payout: Number(payout.value), signalTtlSec: Number(ttl.value) };
    if (tz.value !== state.settings.timeZone) v.timeZone = tz.value;
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

  const exp = button('', 'EXPORTAR HISTÓRICO (JSON)', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.download = 'm1-sniper-historico.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const back = button('', '← VOLTAR AO PAINEL', () => { view = 'main'; render(); });
  box.replaceChildren(el('b', null, 'Ajustes'), form, el('b', null, 'Validação DEMO'), stats, real, exp, back);
  updateSettingsStats();
}

function updateSettingsStats() {
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
  $('clock').textContent = formatTime(Date.now(), state.settings.timeZone);
}

let lastSecond = -1;
function everySecond() {
  const sec = Math.floor(Date.now() / 1000);
  if (sec === lastSecond) return;
  lastSecond = sec;
  if (view === 'main' && visible) render(); else tick();
  if (state?.activeSignal && Date.now() > state.activeSignal.entryTime + state.settings.signalTtlSec * 1000) dispatch({ type: 'TICK' });
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
  poll();
}
