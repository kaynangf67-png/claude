// Monitor somente leitura: o mesmo motor da extensão, rodando no navegador.
import { analyze, computeIndicators } from './core/engine.js';
import { closedOnly, mergeCandles, M1_MS } from './core/validate.js';
import { outcomeOf } from './core/backtest.js';
import { fetchKlines, SYMBOLS } from './data/binance.js';

const $ = (id) => document.getElementById(id);
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const hhmm = (t, s = false) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...(s ? { second: '2-digit' } : {}) });
let symbol = 'BTCUSDT', candles = [], lastAnalyzed = null, timer;
const signals = [];

for (const [k, v] of Object.entries(SYMBOLS)) { const o = document.createElement('option'); o.value = k; o.textContent = `${k} · ${v}`; $('sym').appendChild(o); }
$('sym').onchange = () => { symbol = $('sym').value; candles = []; lastAnalyzed = null; $('result').innerHTML = '<div class="muted">Carregando candles…</div>'; poll(); };

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

async function poll() {
  clearTimeout(timer);
  const sym = symbol;
  try {
    const fresh = await fetchKlines(sym, { limit: candles.length ? 5 : 500 });
    if (sym !== symbol) return;
    candles = mergeCandles(candles, fresh, 600);
    $('conn').textContent = '● online (Binance)'; $('conn').className = 'pill ok';
    update();
  } catch (e) {
    $('conn').textContent = '● sem conexão: ' + e.message; $('conn').className = 'pill bad';
  } finally {
    timer = setTimeout(poll, new Date().getSeconds() < 6 ? 1000 : 4000);
  }
}

function update() {
  const now = Date.now();
  const closed = closedOnly(candles, now);
  const last = closed.at(-1);
  // Resultado dos sinais já expirados
  const byTime = new Map(closed.map((c) => [c.time, c]));
  let changed = false;
  for (const s of signals) if (!s.result && s.symbol === symbol && byTime.has(s.entryTime)) { s.result = outcomeOf(s.direction, byTime.get(s.entryTime)); changed = true; }
  if (changed) renderSignals();
  if (!last || last.time === lastAnalyzed) return;
  if (now - (last.time + M1_MS) > 2.5 * M1_MS) { $('result').replaceChildren(el('div', 'muted', 'Dados desatualizados — análise suspensa')); return; }
  lastAnalyzed = last.time;

  const r = analyze(closed, {}, { symbol });
  renderIndicators(closed);
  const box = $('result'); box.replaceChildren();
  box.append(el('h3', null, `Candle das ${hhmm(last.time)} (fechado)`));
  if (r.status === 'invalid') { box.append(el('div', 'muted', 'Dados inválidos: ' + r.reason)); return; }
  if (r.status === 'no_signal') {
    box.append(el('div', 'dir muted', 'SEM ENTRADA'), el('div', null, r.reason));
    if (r.best) box.append(el('div', 'muted small', `Melhor nota: ${r.best.score} (${r.best.dir}) · mínimo 80`));
    return;
  }
  const s = r.signal;
  box.append(el('div', 'dir ' + s.direction, `${s.direction === 'CALL' ? '▲' : '▼'} ${s.direction} · ${s.score}/100`),
    el('div', 'small muted', `${s.symbol} · entrada ${hhmm(s.entryTime)} · expiração 1 min`));
  const ul = el('ul', 'reasons'); for (const x of s.reasons) ul.append(el('li', null, x)); box.append(ul);
  if (!signals.some((x) => x.id === s.id)) { signals.unshift({ ...s, result: null }); renderSignals(); }
}

function renderIndicators(closed) {
  const ind = computeIndicators(closed); const i = closed.length - 1;
  const f = (v, d = 2) => (v == null ? '—' : v.toFixed(d));
  const p = closed[i].close < 10 ? 5 : 2;
  const rows = [
    ['Fechamento', f(closed[i].close, p)], ['EMA 9', f(ind.ema9[i], p)], ['EMA 21', f(ind.ema21[i], p)], ['EMA 200', f(ind.ema200[i], p)],
    ['RSI 14', f(ind.rsi[i], 1)], ['ADX 14', f(ind.adx.adx[i], 1)], ['+DI / −DI', `${f(ind.adx.plusDI[i], 1)} / ${f(ind.adx.minusDI[i], 1)}`],
    ['Bollinger (sup / méd / inf)', `${f(ind.bb.upper[i], p)} / ${f(ind.bb.middle[i], p)} / ${f(ind.bb.lower[i], p)}`],
  ];
  $('ind').replaceChildren(...rows.map(([a, b]) => { const tr = el('tr'); tr.append(el('td', 'muted', a), el('td', 'mono', b)); return tr; }));
}

function renderSignals() {
  const t = $('sigs'); const head = t.rows[0];
  t.replaceChildren(head, ...signals.slice(0, 30).map((s) => {
    const tr = el('tr');
    tr.append(el('td', null, hhmm(s.entryTime)), el('td', null, s.symbol), el('td', s.direction, s.direction), el('td', null, s.score), el('td', s.result || 'muted', s.result || 'aguardando'));
    return tr;
  }));
  if (!signals.length) t.append(Object.assign(el('tr'), { innerHTML: '<td colspan="5" class="muted">Nenhum sinal ainda — o motor é seletivo.</td>' }));
}

setInterval(() => { $('clock').textContent = `${hhmm(Date.now(), true)} (${tz}) · próximo candle em ${60 - new Date().getSeconds()}s`; }, 250);
renderSignals();
poll();
