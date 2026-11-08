import { computeStats, realReadiness, REAL_CONFIRM_PHRASE } from '../core/stats.js';
import { formatDateTime } from '../core/time.js';
import { LOCK_MESSAGES } from '../core/risk.js';

const $ = (id) => document.getElementById(id);
let state = null;
let src = 'DEMO';

const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (res) => r(res || { error: chrome.runtime.lastError?.message })));
async function dispatch(action, msgEl) {
  const res = await send({ type: 'dispatch', action });
  if (res.state) state = res.state;
  if (msgEl) { msgEl.textContent = res.error || 'Salvo.'; msgEl.className = 'msg ' + (res.error ? 'err' : 'good'); }
  render();
  return res;
}

const pct = (x) => (x * 100).toFixed(1) + '%';
function row(cells, tag = 'td') { const tr = document.createElement('tr'); for (const c of cells) { const td = document.createElement(tag); td.textContent = c; tr.appendChild(td); } return tr; }
function fillTable(t, head, rows) { t.replaceChildren(row(head, 'th'), ...rows.map((r) => row(r))); }

function render() {
  if (!state) return;
  const s = state, tz = s.settings.timeZone;
  $('modeBadge').textContent = s.account.mode;
  $('modeBadge').className = 'badge ' + (s.account.mode === 'REAL' ? 'real' : '');
  $('dayInfo').textContent = `Dia ${s.day.key} (horário de Brasília) · GREEN ${s.day.greens}/10 · LOSS ${s.day.losses}/3` + (s.day.locked ? ` · ${LOCK_MESSAGES[s.day.locked]}` : '');

  if (document.activeElement !== $('minScore')) $('minScore').value = s.settings.minScore;
  if (document.activeElement !== $('payout')) $('payout').value = s.settings.payout;
  if (document.activeElement !== $('ttl')) $('ttl').value = s.settings.signalTtlSec;

  const rows = src === 'SIGNALS'
    ? s.signalLog.filter((x) => x.outcome).map((x) => ({ result: x.outcome, time: x.confirmCandleTime, symbol: x.symbol }))
    : s.trades.filter((t) => t.mode === src);
  const st = computeStats(rows, s.settings.payout, tz);
  const k = [
    ['Registros', st.total], ['GREEN', st.wins], ['LOSS', st.losses], ['Empates', st.draws],
    ['Taxa de acerto', pct(st.winRate)], ['Break-even', pct(st.breakEven)],
    ['Resultado (entradas)', st.netStakes.toFixed(2)], ['Drawdown máx. (entradas)', st.maxDrawdownStakes.toFixed(2)],
    ...(src !== 'SIGNALS' ? [['Resultado (valor)', st.netMoney.toFixed(2)], ['Drawdown máx. (valor)', st.maxDrawdownMoney.toFixed(2)]] : []),
    ['Maior sequência de LOSS', st.maxLossStreak], ['Dias distintos', st.distinctDays],
  ];
  $('summary').replaceChildren(...k.map(([l, v]) => { const d = document.createElement('div'); d.className = 'kpi'; d.innerHTML = '<span class="muted"></span><b></b>'; d.firstChild.textContent = l; d.lastChild.textContent = v; return d; }));
  const toRows = (g) => Object.entries(g).map(([key, v]) => [key, v.total, pct(v.winRate), v.netStakes.toFixed(2)]);
  fillTable($('byAsset'), ['Ativo', 'Qtd', 'Acerto', 'Result.'], toRows(st.byAsset));
  fillTable($('byHour'), ['Hora', 'Qtd', 'Acerto', 'Result.'], toRows(st.byHour));

  const rd = realReadiness(s);
  $('checks').replaceChildren(...rd.checks.map((c) => { const li = document.createElement('li'); li.className = c.ok ? 'ok' : 'no'; li.textContent = `${c.ok ? '✔' : '✖'} ${c.label} — atual: ${c.value}`; return li; }));
  $('phrase').textContent = REAL_CONFIRM_PHRASE;
  $('goReal').disabled = !rd.ready || s.account.mode === 'REAL';
  $('goDemo').disabled = s.account.mode === 'DEMO';

  fillTable($('trades'), ['Data', 'Ativo', 'Direção', 'Nota', 'Valor', 'Conta', 'Resultado'],
    s.trades.slice(-50).reverse().map((t) => [formatDateTime(t.entryTime, tz), t.symbol, t.direction, t.score, t.amount.toFixed(2), t.mode, t.result]));
  $('events').replaceChildren(...s.events.slice(-200).reverse().map((e) => { const d = document.createElement('div'); d.textContent = `${formatDateTime(e.t, tz)} [${e.level}] ${e.msg}`; return d; }));
}

function csv(rows, cols) {
  const esc = (v) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
function download(name, text, type = 'text/csv') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function init() {
  const res = await send({ type: 'getState' });
  state = res.state; render();
  chrome.storage.onChanged.addListener((c, a) => { if (a === 'local' && c.m1state?.newValue) { state = c.m1state.newValue; render(); } });

  $('saveSettings').onclick = () => {
    const v = { minScore: Number($('minScore').value), payout: Number($('payout').value), signalTtlSec: Number($('ttl').value) };
    dispatch({ type: 'SET_SETTINGS', value: v }, $('settingsMsg'));
  };
  document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => {
    src = b.dataset.src; document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); render();
  });
  $('goReal').onclick = () => {
    if (!confirm('Você confirma que entende os riscos de operar com dinheiro real e que o bot NÃO garante resultados?')) return;
    dispatch({ type: 'SET_MODE', mode: 'REAL', confirmation: $('confirm').value.trim() }, $('modeMsg'));
  };
  $('goDemo').onclick = () => dispatch({ type: 'SET_MODE', mode: 'DEMO' }, $('modeMsg'));
  $('expTrades').onclick = () => download('m1-operacoes.csv', csv(state.trades.map((t) => ({ ...t, entryTimeISO: new Date(t.entryTime).toISOString() })),
    ['entryTimeISO', 'symbol', 'direction', 'score', 'amount', 'mode', 'result', 'dayKey', 'suggested']));
  $('expSignals').onclick = () => download('m1-sinais.csv', csv(state.signalLog.map((x) => ({ ...x, timeISO: new Date(x.entryTime).toISOString(), reasons: x.reasons?.join(' | ') })),
    ['timeISO', 'symbol', 'direction', 'score', 'mode', 'userAction', 'outcome', 'entryPrice', 'exitPrice', 'patterns', 'reasons', 'breakdown']));
  $('expAll').onclick = () => download('m1-backup.json', JSON.stringify(state, null, 2), 'application/json');
}
init();
