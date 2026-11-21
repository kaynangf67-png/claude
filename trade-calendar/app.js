import {
  MONTHS, MONTHS_SHORT, PERIODS, dateKey, parseKey, daysInMonth, firstWeekday, todayKey,
  netOf, normalizeEntry, entriesIn, entriesInRange, summarize, cumulative, monthlyTotals, yearsWithData,
  periodRange, comparisons, change, buckets, shortDate, rangeLabel, fromKey,
  money, moneyShort, cellValue, decimal, percent, longDate,
} from './calc.js';
import { initMarket } from './market.js';

// ================= armazenamento (uma única base para todas as telas) =================
const STORE_KEY = 'tradecal.entries.v1';
const SETTINGS_KEY = 'tradecal.settings';

function cleanEntries(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    const e = normalizeEntry(v);
    if (e) out[k] = e;
  }
  return out;
}
function loadEntries() {
  try { const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); return cleanEntries(raw && raw.entries); } catch { return {}; }
}
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, savedAt: Date.now(), entries })); return true; } catch {
    toast('Não foi possível salvar no aparelho', true); return false;
  }
}
const DEFAULT_SETTINGS = { theme: 'auto', period: 'month', chartMode: 'day', custom: null, tab: 'dash' };
function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* */ } }

let entries = loadEntries();
const settings = loadSettings();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ================= estado =================
let TODAY = todayKey();
const T = () => parseKey(TODAY);
const state = {
  tab: ['dash', 'cal', 'market', 'stats', 'hist'].includes(settings.tab) ? settings.tab : 'dash',
  calView: 'month',
  year: T().y,
  month: T().m,
  statsYear: T().y,
  histFilter: 'all',
};

// ================= utilidades =================
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sgn = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const txt = (v) => (v > 0 ? 'pos-text' : v < 0 ? 'neg-text' : '');
const haptic = () => { try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(8); } catch { /* */ } };
const CHEV = '<svg class="chev" viewBox="0 0 24 24"><use href="#i-chev"/></svg>';
const WD_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WD3 = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const signedPct = (p) => (p == null ? '—' : (p > 0 ? '+' : p < 0 ? '−' : '') + percent(Math.abs(p)));

let toastTimer;
function toast(msg, isError) {
  const t = $('toast');
  t.innerHTML = `<span>${isError ? '⚠️' : '✓'}</span>${esc(msg)}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
}
function setSegmented(el, idx) {
  const btns = [...el.querySelectorAll('button')];
  btns.forEach((b, i) => { b.classList.toggle('on', i === idx); b.setAttribute('aria-selected', i === idx); });
  const th = el.querySelector('.segmented-thumb');
  th.style.width = `calc((100% - 4px) / ${btns.length})`;
  th.style.transform = `translateX(${Math.max(0, idx) * 100}%)`;
}

// ================= abas =================
function switchTab(name, { fromTabbar = false } = {}) {
  if (fromTabbar && name === state.tab) {
    const sc = name === 'cal' ? document.querySelector('#tab-cal .view.is-active .scroll') : document.querySelector('.tab.active .scroll');
    sc && sc.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  state.tab = name;
  settings.tab = name; saveSettings();
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('#tabbar button').forEach((b) => { b.classList.toggle('on', b.dataset.tab === name); b.setAttribute('aria-current', b.dataset.tab === name ? 'page' : 'false'); });
  renderActive();
  haptic();
}
function renderActive() {
  if (state.tab === 'dash') renderDash();
  else if (state.tab === 'cal') { renderMonth(); renderYear(); }
  else if (state.tab === 'market') market?.render();
  else if (state.tab === 'stats') renderStats();
  else if (state.tab === 'hist') renderHist();
}

// ================= gráfico (SVG próprio) =================
/** pts: [{label, short, value, total}] já acumulados; o primeiro é o ponto de partida (0). */
function drawChart(wrap, pts, { deltaName = 'Resultado', height = 210 } = {}) {
  const W = Math.max(260, wrap.clientWidth || 340), H = height;
  const padL = 10, padR = 10, padT = 26, padB = 22;
  const vals = [0, ...pts.map((p) => p.total), ...pts.map((p) => p.value)];
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { max += 1; min -= 1; }
  const span = max - min;
  max += span * 0.06; if (min < 0) min -= span * 0.06;
  const n = pts.length, iw = W - padL - padR;
  const x = (i) => padL + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => padT + ((max - v) * (H - padT - padB)) / (max - min);
  const y0 = y(0);
  const final = pts[n - 1].total;
  const color = final >= 0 ? 'var(--green)' : 'var(--red)';
  const gid = 'g' + Math.random().toString(36).slice(2, 8);
  const step = n > 1 ? iw / (n - 1) : iw;
  const bw = Math.max(2, Math.min(18, step * 0.55));

  let bars = '', dots = '';
  pts.forEach((p, i) => {
    if (i === 0 || !p.value) return;
    const top = y(Math.max(0, p.value)), h = Math.max(1.5, Math.abs(y(p.value) - y0));
    bars += `<rect class="${p.value > 0 ? 'bar-pos' : 'bar-neg'}" x="${(x(i) - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3, bw / 2)}"/>`;
    if (n <= 45) dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.total).toFixed(1)}" r="${n > 25 ? 2.4 : 3.2}" fill="${p.value > 0 ? 'var(--green)' : 'var(--red)'}" stroke="var(--bg-elevated)" stroke-width="1.5"/>`;
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join('');
  const area = `${line}L${x(n - 1).toFixed(1)},${y0.toFixed(1)}L${x(0).toFixed(1)},${y0.toFixed(1)}Z`;
  const idx = n <= 5 ? pts.map((_, i) => i).slice(1) : [1, Math.round(n / 2), n - 1];
  const xl = [...new Set(idx)].filter((i) => pts[i] && pts[i].short).map((i) => {
    const anchor = i === n - 1 && n > 2 ? 'end' : i <= 1 && n > 3 ? 'start' : 'middle';
    return `<text class="axis-txt" x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="${anchor}">${esc(pts[i].short)}</text>`;
  }).join('');
  const peak = Math.max(...pts.map((p) => p.total), 0);

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolução: saldo final ${money(final)}">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="${final >= 0 ? 0.28 : 0.04}"/>
        <stop offset="1" stop-color="${color}" stop-opacity="${final >= 0 ? 0.02 : 0.28}"/>
      </linearGradient></defs>
      ${peak > 0 ? `<text class="axis-txt" x="${padL}" y="12">Máx. ${moneyShort(peak)}</text>` : ''}
      <line class="zero-line" x1="0" x2="${W}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}"/>
      <text class="axis-txt" x="${W - padR}" y="${(y0 - 4).toFixed(1)}" text-anchor="end">R$ 0</text>
      ${bars}
      <path d="${area}" fill="url(#${gid})"/>
      <path class="line" d="${line}" stroke="${color}"/>
      ${dots}
      ${xl}
      <line class="cursor" x1="0" x2="0" y1="${padT - 6}" y2="${H - padB}" visibility="hidden"/>
      <circle class="cursor-dot" r="5.5" fill="${color}" stroke="var(--bg-elevated)" stroke-width="2.5" visibility="hidden"/>
    </svg>
    <div class="chart-tip"></div>`;
  wrap.style.height = H + 'px';
  const path = wrap.querySelector('.line');
  try {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
    requestAnimationFrame(() => path.classList.add('draw'));
  } catch { /* */ }
  wrap._chart = { pts, x, y, W, deltaName };
}
function chartScrub(wrap, ev) {
  const c = wrap._chart;
  if (!c) return;
  const r = wrap.getBoundingClientRect();
  const px = ((ev.clientX - r.left) / r.width) * c.W;
  let best = 0, bd = Infinity;
  c.pts.forEach((_, i) => { const d = Math.abs(c.x(i) - px); if (d < bd) { bd = d; best = i; } });
  const p = c.pts[best];
  const cur = wrap.querySelector('.cursor'), dot = wrap.querySelector('.cursor-dot'), tip = wrap.querySelector('.chart-tip');
  cur.setAttribute('x1', c.x(best)); cur.setAttribute('x2', c.x(best)); cur.setAttribute('visibility', 'visible');
  dot.setAttribute('cx', c.x(best)); dot.setAttribute('cy', c.y(p.total)); dot.setAttribute('visibility', 'visible');
  tip.innerHTML = `${esc(p.label)}<b class="${txt(p.total)}">${money(p.total, { sign: true })}</b>${best ? `<span class="${txt(p.value)}">${c.deltaName}: ${money(p.value, { sign: true })}</span>` : '<span class="muted">ponto de partida</span>'}`;
  tip.style.left = Math.min(r.width - 80, Math.max(80, (c.x(best) / c.W) * r.width)) + 'px';
  tip.classList.add('show');
}
function chartHideAll() {
  document.querySelectorAll('.chart-wrap').forEach((w) => {
    w.querySelector('.chart-tip')?.classList.remove('show');
    w.querySelector('.cursor')?.setAttribute('visibility', 'hidden');
    w.querySelector('.cursor-dot')?.setAttribute('visibility', 'hidden');
  });
}
document.addEventListener('pointermove', (ev) => { const w = ev.target.closest?.('.chart-wrap'); if (w) chartScrub(w, ev); else chartHideAll(); });
document.addEventListener('pointerdown', (ev) => { const w = ev.target.closest?.('.chart-wrap'); if (w) chartScrub(w, ev); else chartHideAll(); });

const seriesFrom = (bks, startLabel) => cumulative([{ label: startLabel, short: '', value: 0 }, ...bks]);

// ================= DASHBOARD =================
let stripCentered = false;
function renderDash() {
  TODAY = todayKey();
  const t = T();
  $('dashDate').textContent = `${WD_LONG[fromKey(TODAY).getDay()]}, ${t.d} de ${MONTHS[t.m].toLowerCase()}`;
  const custom = settings.custom;

  // cards de período, cada um com o seu resultado líquido
  $('periodStrip').innerHTML = PERIODS.map((p) => {
    const r = periodRange(p.id, TODAY, custom);
    const net = summarize(entriesInRange(entries, r.start, r.end)).net;
    const showVal = p.id !== 'custom' || custom;
    const on = settings.period === p.id;
    return `<button class="pcard${on ? ' on' : ''}" data-period="${p.id}" role="tab" aria-selected="${on}">
      <div class="pl">${p.id === 'custom' ? '<svg viewBox="0 0 24 24"><use href="#i-cal-small"/></svg>' : ''}${p.label}</div>
      <div class="pv ${showVal ? txt(net) : 'muted'}">${showVal ? moneyShort(net, { sign: true }) : 'Escolher'}</div>
    </button>`;
  }).join('');
  const sel = $('periodStrip').querySelector('.pcard.on');
  if (sel && !stripCentered) { $('periodStrip').scrollLeft = Math.max(0, sel.offsetLeft - 16); stripCentered = true; }

  const range = periodRange(settings.period, TODAY, custom);
  const list = entriesInRange(entries, range.start, range.end);
  const s = summarize(list);
  const pLabel = PERIODS.find((p) => p.id === settings.period)?.label || '';
  const hasAny = Object.keys(entries).length > 0;
  const g = s.grossGain, l = s.grossLoss, tot = g + l;

  const hero = `
    <div class="hero ${sgn(s.net)}">
      <div class="hero-top"><span>Resultado líquido · ${pLabel}</span><span class="hero-badge">${rangeLabel(range.start, range.end, t.y)}</span></div>
      <div class="hero-net ${txt(s.net)}">${money(s.net, { sign: true })}</div>
      <div class="hero-formula"><span>Lucro bruto <b class="pos-text">${money(g)}</b></span><span>−</span><span>Prejuízo bruto <b class="${l ? 'neg-text' : ''}">${money(l)}</b></span></div>
      ${tot ? `<div class="hero-bar"><i class="g" style="width:${(g / tot) * 100}%"></i><i class="r" style="width:${(l / tot) * 100}%"></i></div>` : ''}
      ${!hasAny ? '<p class="hero-empty">Nenhum resultado registrado ainda. Registre seu primeiro dia para ver o desempenho.</p><button class="hero-cta" data-action="add">Registrar hoje</button>'
        : !list.length ? '<p class="hero-empty">Nenhum registro neste período.</p>' : ''}
    </div>`;

  const best = s.best, worst = s.worst;
  const metrics = `
    <div class="metrics">
      <div class="metric"><div class="k"><i class="dot pos"></i>Lucro bruto</div><div class="v pos-text">${moneyShort(g)}</div><div class="d">soma dos valores ganhos</div></div>
      <div class="metric"><div class="k"><i class="dot neg"></i>Prejuízo bruto</div><div class="v ${l ? 'neg-text' : ''}">${moneyShort(l)}</div><div class="d">soma dos valores perdidos</div></div>
      <div class="metric"><div class="k">Dias operados</div><div class="v">${s.tradedDays}</div><div class="d">${s.noTradeDays ? `+ ${s.noTradeDays} sem operações` : `${s.ops} ${s.ops === 1 ? 'operação' : 'operações'}`}</div></div>
      <div class="metric"><div class="k">Taxa de dias positivos</div><div class="v">${percent(s.positiveRate)}</div><div class="meter"><i style="width:${(s.positiveRate || 0) * 100}%"></i></div></div>
      <div class="metric"><div class="k">Dias positivos</div><div class="v ${s.positiveDays ? 'pos-text' : ''}">${s.positiveDays}</div><div class="d">fecharam no lucro</div></div>
      <div class="metric"><div class="k">Dias negativos</div><div class="v ${s.negativeDays ? 'neg-text' : ''}">${s.negativeDays}</div><div class="d">fecharam no prejuízo</div></div>
      <button class="metric" ${best ? `data-key="${best.key}"` : 'disabled'}><div class="k">Melhor dia</div><div class="v ${best ? 'pos-text' : ''}">${best ? moneyShort(best.net, { sign: true }) : '—'}</div><div class="d">${best ? shortDate(best.key, best.y !== t.y) : 'nenhum dia positivo'}</div></button>
      <button class="metric" ${worst ? `data-key="${worst.key}"` : 'disabled'}><div class="k">Pior dia</div><div class="v ${worst ? 'neg-text' : ''}">${worst ? moneyShort(worst.net) : '—'}</div><div class="d">${worst ? shortDate(worst.key, worst.y !== t.y) : 'nenhum dia negativo'}</div></button>
    </div>`;

  const mode = settings.chartMode;
  const bks = buckets(list, mode, range.start, range.end);
  const hasChart = bks.some((b) => b.value) || (mode === 'day' && bks.length > 0);
  const deltaName = mode === 'day' ? 'No dia' : mode === 'week' ? 'Na semana' : 'No mês';
  const chart = `
    <div class="section-title"><h2>Performance</h2><span>lucro acumulado</span></div>
    <div class="card-pad">
      <div class="segmented" id="chartMode">
        <button type="button" data-mode="day">Diário</button><button type="button" data-mode="week">Semanal</button><button type="button" data-mode="month">Mensal</button>
        <span class="segmented-thumb"></span>
      </div>
      ${hasChart ? `<div class="chart-wrap" id="dashChart"></div>
        <div class="chart-legend"><span><i style="background:var(--${s.net >= 0 ? 'green' : 'red'})"></i>Acumulado</span><span><i style="background:var(--green);opacity:.45"></i>Lucro</span><span><i style="background:var(--red);opacity:.45"></i>Prejuízo</span></div>`
        : '<div class="empty-state">Sem operações neste período para montar o gráfico.</div>'}
    </div>`;

  const cmpRows = comparisons(TODAY).map((c) => {
    const cur = summarize(entriesInRange(entries, c.cur.start, c.cur.end)).net;
    const prev = summarize(entriesInRange(entries, c.prev.start, c.prev.end)).net;
    const { diff, pct } = change(cur, prev);
    const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    const max = Math.max(Math.abs(cur), Math.abs(prev), 1);
    const bar = (v) => `<div class="trk"><i style="width:${(Math.abs(v) / max) * 100}%;background:var(--${v >= 0 ? 'green' : 'red'})"></i></div>`;
    return `<div class="cmp-row">
      <div class="cmp-title">${c.title}</div>
      <div class="cmp-vals">${c.curName} <b class="${txt(cur)}">${moneyShort(cur, { sign: true })}</b> · ${c.prevName} <b class="${txt(prev)}">${moneyShort(prev, { sign: true })}</b></div>
      <div class="cmp-badge">
        <span class="cmp-pill ${dir}">${dir !== 'same' ? `<svg viewBox="0 0 24 24"><use href="#i-${dir}"/></svg>` : ''}${dir === 'same' ? 'Igual' : moneyShort(diff, { sign: true })}</span>
        <span class="cmp-pct ${dir === 'up' ? 'pos-text' : dir === 'down' ? 'neg-text' : 'muted'}">${pct == null ? (diff ? 'sem base anterior' : '0%') : signedPct(pct)}</span>
      </div>
      <div class="cmp-bars"><span>${c.curName}</span>${bar(cur)}<span>${c.prevName}</span>${bar(prev)}</div>
    </div>`;
  }).join('');
  const cmp = `<div class="section-title"><h2>Comparação de desempenho</h2></div><div class="cmp">${cmpRows}</div>
    <p class="group-footer">Seta verde: o resultado líquido melhorou. Seta vermelha: piorou. A variação percentual é sobre o período anterior; os períodos atuais vão até hoje.</p>`;

  $('dashBody').innerHTML = hero + metrics + chart + cmp;
  setSegmented($('chartMode'), ['day', 'week', 'month'].indexOf(mode));
  if (hasChart) drawChart($('dashChart'), seriesFrom(bks, 'Início do período'), { deltaName });
}

// ================= CALENDÁRIO =================
const calViews = { year: $('yearView'), month: $('monthView') };
function setCalView(name, { animate = true } = {}) {
  state.calView = name;
  const plan = name === 'year' ? { year: 'is-active', month: 'hide-zoom-out' } : { year: 'hide-zoom-in', month: 'is-active' };
  for (const [k, el] of Object.entries(calViews)) {
    if (!animate) el.classList.add('no-anim');
    el.classList.remove('is-active', 'hide-zoom-in', 'hide-zoom-out');
    el.classList.add(plan[k]);
    el.setAttribute('aria-hidden', plan[k] !== 'is-active');
    if (!animate) { void el.offsetWidth; el.classList.remove('no-anim'); }
  }
}

let lastSavedKey = null;
function renderMonth(direction) {
  const y = state.year, m = state.month, t = T();
  $('monthTitle').textContent = MONTHS[m];
  $('monthTitle').classList.toggle('accent', y === t.y && m === t.m);
  $('monthNavTitle').textContent = `${MONTHS[m]} de ${y}`;
  $('backYear').textContent = y;
  const lead = firstWeekday(y, m), total = daysInMonth(y, m);
  const cells = Math.ceil((lead + total) / 7) * 7;
  let html = '';
  for (let i = 0; i < cells; i++) {
    const d = i - lead + 1;
    if (d < 1 || d > total) { html += '<div class="day empty"></div>'; continue; }
    const key = dateKey(y, m, d), e = entries[key], wd = i % 7;
    const c = ['day'];
    if (wd === 0 || wd === 6) c.push('weekend');
    if (key === TODAY) c.push('today');
    let val = '&nbsp;', label = `${d} de ${MONTHS[m].toLowerCase()}`;
    if (e) {
      if (e.noTrade) { c.push('notrade'); val = 'sem op.'; label += ', sem operações'; }
      else {
        const n = netOf(e);
        c.push(n > 0 ? 'pos' : n < 0 ? 'neg' : 'flat');
        val = cellValue(n);
        label += `, ${n > 0 ? 'lucro' : n < 0 ? 'prejuízo' : 'resultado'} ${money(n)}`;
      }
      if (e.notes) c.push('has-notes');
      if (key === lastSavedKey) c.push('just-saved');
    }
    html += `<button class="${c.join(' ')}" data-key="${key}" aria-label="${esc(label)}"><span class="num">${d}</span><span class="val">${val}</span></button>`;
  }
  const grid = $('monthGrid');
  grid.innerHTML = html;
  lastSavedKey = null;
  if (direction) {
    grid.classList.remove('anim-in-left', 'anim-in-right'); void grid.offsetWidth;
    grid.classList.add(direction > 0 ? 'anim-in-right' : 'anim-in-left');
  }
  const list = entriesIn(entries, { year: y, month: m });
  renderMonthSummary(summarize(list));
  $('monthHint').textContent = list.length ? 'Toque em um dia para registrar ou editar · deslize para trocar de mês' : 'Toque em um dia para registrar o resultado';
}
function renderMonthSummary(s) {
  const C = 2 * Math.PI * 23.5, rate = s.positiveRate ?? 0;
  $('summary').innerHTML = `
    <div class="sum-head">
      <div><div class="sum-label">Resultado líquido do mês</div><div class="sum-net ${txt(s.net)}">${money(s.net, { sign: true })}</div></div>
      <div class="ring-wrap" aria-label="Taxa de dias positivos ${percent(s.positiveRate)}">
        <div class="ring"><svg viewBox="0 0 54 54"><circle class="track" cx="27" cy="27" r="23.5"/><circle class="val" cx="27" cy="27" r="23.5" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - rate)}"/></svg><div class="ring-txt">${percent(s.positiveRate)}</div></div>
        <div class="ring-cap">dias +</div>
      </div>
    </div>
    <div class="sum-grid">
      <div class="sum-cell"><div class="k"><i class="dot pos"></i>Lucro bruto</div><div class="v pos-text">${moneyShort(s.grossGain)}</div></div>
      <div class="sum-cell"><div class="k"><i class="dot neg"></i>Prejuízo bruto</div><div class="v ${s.grossLoss ? 'neg-text' : ''}">${moneyShort(s.grossLoss)}</div></div>
      <div class="sum-cell"><div class="k">Dias positivos</div><div class="v">${s.positiveDays}</div></div>
      <div class="sum-cell"><div class="k">Dias negativos</div><div class="v">${s.negativeDays}</div></div>
    </div>`;
}
function goMonth(delta) {
  let m = state.month + delta, y = state.year;
  if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
  state.month = m; state.year = y;
  haptic(); renderMonth(delta); renderYear();
}
function goToday() {
  TODAY = todayKey();
  const t = T();
  const dir = Math.sign((t.y - state.year) * 12 + (t.m - state.month));
  state.year = t.y; state.month = t.m;
  renderMonth(state.calView === 'month' ? dir || null : null); renderYear();
  if (state.calView !== 'month') setCalView('month');
  $('monthScroll').scrollTo({ top: 0, behavior: 'smooth' });
}
function renderYear() {
  const y = state.year, t = T();
  $('yearTitle').textContent = y;
  $('yearNavTitle').textContent = y;
  const months = monthlyTotals(entries, y);
  const ys = summarize(entriesIn(entries, { year: y }));
  $('yearSummary').innerHTML = ys.tradedDays || ys.noTradeDays
    ? `Resultado do ano <strong class="${txt(ys.net)}">${money(ys.net, { sign: true })}</strong><span class="ys-sub">${ys.positiveDays} dias positivos · ${ys.negativeDays} dias negativos · ${percent(ys.positiveRate)} positivos</span>`
    : 'Nenhum registro neste ano';
  let html = '';
  for (let m = 0; m < 12; m++) {
    const lead = firstWeekday(y, m), total = daysInMonth(y, m);
    let days = '';
    for (let i = 0; i < lead; i++) days += '<span></span>';
    for (let d = 1; d <= total; d++) {
      const k = dateKey(y, m, d), e = entries[k], c = [];
      if (e && !e.noTrade) { const n = netOf(e); if (n > 0) c.push('p'); else if (n < 0) c.push('n'); }
      if (k === TODAY) c.push('t');
      days += `<span${c.length ? ` class="${c.join(' ')}"` : ''}>${d}</span>`;
    }
    const mt = months[m], has = mt.tradedDays > 0;
    html += `<button class="mini${y === t.y && m === t.m ? ' current' : ''}" data-month="${m}" aria-label="${MONTHS[m]} ${y}${has ? ', ' + money(mt.net) : ''}">
      <div class="mini-name">${MONTHS_SHORT[m]}</div>
      <div class="mini-net ${txt(mt.net)}">${has ? moneyShort(mt.net, { sign: true }) : ''}</div>
      <div class="mini-days">${days}</div></button>`;
  }
  $('yearGrid').innerHTML = html;
}

// ================= ESTATÍSTICAS =================
function renderStats() {
  const y = state.statsYear, t = T();
  const body = $('statsBody');
  if (!Object.keys(entries).length) {
    body.innerHTML = '<div class="card-pad empty-state"><div class="ico">📊</div><strong>Sem dados ainda</strong>As estatísticas aparecem assim que você registrar o primeiro dia.<br><br><button class="hero-cta" data-action="add">Registrar hoje</button></div>';
    return;
  }
  const list = entriesIn(entries, { year: y });
  const s = summarize(list);
  const months = monthlyTotals(entries, y);
  const traded = months.filter((mt) => mt.tradedDays);
  const pos = traded.filter((mt) => mt.net > 0), neg = traded.filter((mt) => mt.net < 0);
  const bestM = pos.length ? pos.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  const worstM = neg.length ? neg.reduce((a, b) => (b.net < a.net ? b : a)) : null;
  const lastData = months.reduce((acc, mt, i) => (mt.tradedDays || mt.noTradeDays ? i : acc), -1);
  const upto = y < t.y ? 11 : y === t.y ? Math.max(t.m, lastData) : Math.max(lastData, 0);
  const monthPts = months.slice(0, upto + 1).map((mt) => ({ label: `${MONTHS[mt.month]} ${y}`, short: MONTHS_SHORT[mt.month], value: mt.net }));
  const years = [...new Set([...yearsWithData(entries), t.y])].sort((a, b) => a - b);
  const yearTotals = years.map((yy) => ({ y: yy, ...summarize(entriesIn(entries, { year: yy })) }));
  const yearPts = yearTotals.map((yt) => ({ label: String(yt.y), short: String(yt.y), value: yt.net }));
  const maxM = Math.max(1, ...months.map((mt) => Math.abs(mt.net)));
  const maxY = Math.max(1, ...yearTotals.map((yt) => Math.abs(yt.net)));
  const lineColor = s.net >= 0 ? 'green' : 'red';

  body.innerHTML = `
    <div class="hero stats-hero ${sgn(s.net)}">
      <div class="hero-top"><span>Total acumulado em ${y}</span><span class="hero-badge">${s.tradedDays} dias operados</span></div>
      <div class="hero-net big ${txt(s.net)}">${money(s.net, { sign: true })}</div>
      <div class="hero-formula"><span>Lucro bruto <b class="pos-text">${money(s.grossGain)}</b></span><span>−</span><span>Prejuízo bruto <b class="${s.grossLoss ? 'neg-text' : ''}">${money(s.grossLoss)}</b></span></div>
    </div>

    <div class="section-title"><h2>Evolução mensal</h2><span>${y}</span></div>
    <div class="card-pad">${s.tradedDays
      ? `<div class="chart-wrap" id="monthChart"></div><div class="chart-legend"><span><i style="background:var(--${lineColor})"></i>Acumulado no ano</span><span><i style="background:var(--green);opacity:.45"></i>Mês positivo</span><span><i style="background:var(--red);opacity:.45"></i>Mês negativo</span></div>`
      : `<div class="empty-state">Nenhuma operação em ${y}.</div>`}</div>

    <div class="metrics">
      <div class="metric"><div class="k">Melhor mês</div><div class="v ${bestM ? 'pos-text' : ''}">${bestM ? moneyShort(bestM.net, { sign: true }) : '—'}</div><div class="d">${bestM ? MONTHS[bestM.month] : 'nenhum mês positivo'}</div></div>
      <div class="metric"><div class="k">Pior mês</div><div class="v ${worstM ? 'neg-text' : ''}">${worstM ? moneyShort(worstM.net) : '—'}</div><div class="d">${worstM ? MONTHS[worstM.month] : 'nenhum mês negativo'}</div></div>
      <div class="metric"><div class="k">Média de lucro diário</div><div class="v ${s.avgProfit ? 'pos-text' : ''}">${s.avgProfit != null ? moneyShort(s.avgProfit) : '—'}</div><div class="d">por dia positivo</div></div>
      <div class="metric"><div class="k">Média de prejuízo diário</div><div class="v ${s.avgLoss ? 'neg-text' : ''}">${s.avgLoss != null ? moneyShort(s.avgLoss) : '—'}</div><div class="d">por dia negativo</div></div>
      <div class="metric"><div class="k">Taxa de dias positivos</div><div class="v">${percent(s.positiveRate)}</div><div class="meter"><i style="width:${(s.positiveRate || 0) * 100}%"></i></div></div>
      <div class="metric"><div class="k">Média por dia operado</div><div class="v ${txt(s.avgPerDay)}">${s.avgPerDay != null ? moneyShort(s.avgPerDay, { sign: true }) : '—'}</div><div class="d">${s.ops} operações no ano</div></div>
    </div>

    <div class="section-title"><h2>Evolução anual</h2><span>todos os anos</span></div>
    <div class="card-pad"><div class="chart-wrap" id="yearChart"></div></div>

    <p class="list-title">Resultados por mês · ${y}</p>
    <div class="list">${months.map((mt) => {
      const has = mt.tradedDays || mt.noTradeDays;
      return `<button class="li" data-cal-month="${mt.month}"><div class="li-main"><div class="li-t">${MONTHS[mt.month]}</div><div class="li-s">${has ? `${mt.tradedDays} dias operados · ${percent(mt.positiveRate)} positivos` : 'Sem registros'}</div>${barHTML(mt.net, maxM)}</div><div class="li-v ${txt(mt.net)}">${has ? moneyShort(mt.net, { sign: true }) : '—'}</div>${CHEV}</button>`;
    }).join('')}</div>

    <p class="list-title">Resultados por ano</p>
    <div class="list">${[...yearTotals].reverse().map((yt) => `<button class="li" data-stats-year="${yt.y}"><div class="li-main"><div class="li-t">${yt.y}</div><div class="li-s">${yt.tradedDays} dias operados · ${percent(yt.positiveRate)} positivos</div>${barHTML(yt.net, maxY)}</div><div class="li-v ${txt(yt.net)}">${moneyShort(yt.net, { sign: true })}</div>${CHEV}</button>`).join('')}</div>

    <div class="list"><button class="li" data-goto-tab="hist"><div class="li-main"><div class="li-t accent">Ver histórico completo</div></div>${CHEV}</button></div>`;

  if (s.tradedDays) drawChart($('monthChart'), seriesFrom(monthPts, `Início de ${y}`), { deltaName: 'No mês' });
  drawChart($('yearChart'), seriesFrom(yearPts, 'Início'), { deltaName: 'No ano', height: 180 });
}
function barHTML(v, maxAbs) {
  if (!v) return '<div class="li-bar"></div>';
  const w = Math.max(3, (Math.abs(v) / maxAbs) * 50);
  return `<div class="li-bar"><i style="${v > 0 ? `left:50%;width:${w}%;background:var(--green)` : `right:50%;width:${w}%;background:var(--red)`}"></i></div>`;
}

// ================= HISTÓRICO =================
function renderHist() {
  setSegmented($('histFilter'), ['all', 'pos', 'neg', 'none'].indexOf(state.histFilter));
  const all = entriesInRange(entries, '0000-00-00', '9999-99-99').reverse();
  const traded = all.filter((i) => !i.entry.noTrade).length;
  $('histCount').textContent = `${all.length} ${all.length === 1 ? 'registro' : 'registros'} · ${traded} ${traded === 1 ? 'dia operado' : 'dias operados'}`;
  const f = state.histFilter;
  const items = all.filter((i) => f === 'all' || (f === 'none' ? i.entry.noTrade : !i.entry.noTrade && (f === 'pos' ? i.net > 0 : i.net < 0)));
  if (!items.length) {
    $('histBody').innerHTML = `<div class="card-pad empty-state" style="margin-top:4px"><div class="ico">🗓️</div><strong>${all.length ? 'Nada com esse filtro' : 'Nenhum registro'}</strong>${all.length ? 'Escolha outro filtro.' : 'Os dias que você registrar aparecem aqui.'}</div>`;
    return;
  }
  const groups = new Map();
  for (const i of items) { const k = `${i.y}-${i.m}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
  let html = '';
  for (const [k, rows] of groups) {
    const [y, m] = k.split('-').map(Number);
    const ms = summarize(entriesIn(entries, { year: y, month: m }));
    html += `<div class="hist-month"><div class="hist-head"><span>${MONTHS[m]} ${y}</span><b class="${txt(ms.net)}">${money(ms.net, { sign: true })}</b></div><div class="hist-list">${rows.map(histRow).join('')}</div></div>`;
  }
  $('histBody').innerHTML = html;
}
function histRow(i) {
  const e = i.entry;
  const cls = e.noTrade ? 'none' : sgn(i.net);
  const title = e.noTrade ? 'Sem operações' : `${e.ops} ${e.ops === 1 ? 'operação' : 'operações'}`;
  const sub = e.noTrade ? (e.notes ? esc(e.notes) : 'Dia sem operações') : `<span class="pos-text">+${decimal(e.gain)}</span> · <span class="neg-text">−${decimal(e.loss)}</span>${e.notes ? ' · ' + esc(e.notes) : ''}`;
  return `<button class="hrow ${cls}" data-key="${i.key}">
    <div class="hdate"><span class="wd">${WD3[fromKey(i.key).getDay()]}</span><span class="dd">${i.d}</span></div>
    <div class="hm"><div class="ht">${title}</div><div class="hs">${sub}</div></div>
    <div class="hv ${e.noTrade ? 'muted' : txt(i.net)}">${e.noTrade ? '—' : money(i.net, { sign: true })}</div>${CHEV}</button>`;
}

// ================= REGISTRO =================
const gainInput = $('gainInput'), lossInput = $('lossInput'), opsInput = $('opsInput'), notesInput = $('notesInput'), dateInput = $('dateInput');
let originalKey = null, targetKey = null, entryMode = 'trade';
const getMoney = (inp) => { const d = inp.value.replace(/\D/g, ''); return d ? Number(d) / 100 : 0; };
const setMoney = (inp, v) => { inp.value = v ? decimal(v) : ''; };
function maskMoney(inp) { const d = inp.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11); inp.value = d ? decimal(Number(d) / 100) : ''; }

function updateNet() {
  const g = getMoney(gainInput), l = getMoney(lossInput);
  const n = Math.round((g - l) * 100) / 100;
  const box = $('netDisplay');
  box.classList.remove('pos', 'neg');
  if (n) box.classList.add(sgn(n));
  $('netValue').textContent = money(n, { sign: true });
  $('netSub').textContent = g || l ? `${money(g)} − ${money(l)}` : 'valor ganho − valor perdido';
}
function setEntryMode(mode) {
  entryMode = mode;
  setSegmented($('entryMode'), mode === 'trade' ? 0 : 1);
  $('tradeFields').hidden = mode !== 'trade';
  $('noTradeInfo').hidden = mode === 'trade';
}
function updateEntryTitle() {
  const { y, m, d } = parseKey(targetKey);
  $('entryTitle').textContent = longDate(y, m, d).replace(/ de \d{4}$/, '');
}
function fillEntry(e) {
  setMoney(gainInput, e?.gain || 0);
  setMoney(lossInput, e?.loss || 0);
  opsInput.value = e?.ops || 0;
  notesInput.value = e?.notes || '';
  setEntryMode(e?.noTrade ? 'none' : 'trade');
  updateNet();
  $('entryDelete').hidden = !e;
  $('entryMeta').textContent = e ? `Editando registro · atualizado em ${new Date(e.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Novo registro';
}
function openEntry(key) {
  const e = entries[key];
  originalKey = e ? key : null;
  targetKey = key;
  dateInput.value = key;
  fillEntry(e);
  updateEntryTitle();
  $('entrySheet').querySelector('.sheet-body').scrollTop = 0;
  openSheet($('entrySheet'));
}
/** Trocar a data abre o registro daquele dia (ou um registro novo). Nunca move registros. */
function changeEntryDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key === targetKey) return;
  const e = entries[key];
  if (e) { originalKey = key; fillEntry(e); toast(`Registro de ${shortDate(key)} carregado`); }
  else if (originalKey) { originalKey = null; fillEntry(null); }
  targetKey = key;
  updateEntryTitle();
}
function saveEntry() {
  if (!targetKey || !/^\d{4}-\d{2}-\d{2}$/.test(targetKey)) { toast('Escolha uma data válida', true); return; }
  const raw = { gain: getMoney(gainInput), loss: getMoney(lossInput), ops: Number(opsInput.value) || 0, notes: notesInput.value.trim(), noTrade: entryMode === 'none', updatedAt: Date.now() };
  if (!raw.noTrade && !raw.gain && !raw.loss && !raw.ops) { toast('Informe um valor ou marque “Sem operações”', true); return; }
  const wasEdit = Boolean(originalKey);
  entries[targetKey] = normalizeEntry(raw);
  if (!persist()) return;
  lastSavedKey = targetKey;
  haptic(); closeSheets(); renderActive();
  toast(wasEdit ? 'Registro atualizado' : 'Registro salvo');
}
function confirmDelete() {
  const key = originalKey;
  if (!key) return;
  ask(`O registro de ${shortDate(key, true)} será excluído permanentemente.`, 'Excluir registro', () => {
    delete entries[key]; persist(); closeSheets(); renderActive(); toast('Registro excluído');
  });
}

// ================= período personalizado =================
function openCustom() {
  const r = periodRange('custom', TODAY, settings.custom);
  $('customStart').value = r.start; $('customEnd').value = r.end;
  updateCustomInfo();
  openSheet($('customSheet'));
}
function updateCustomInfo() {
  const a = $('customStart').value, b = $('customEnd').value;
  if (!a || !b) { $('customInfo').textContent = 'Escolha a data inicial e a final.'; return; }
  const r = periodRange('custom', TODAY, { start: a, end: b });
  const n = entriesInRange(entries, r.start, r.end).length;
  $('customInfo').textContent = `${rangeLabel(r.start, r.end, T().y)} · ${n} ${n === 1 ? 'registro' : 'registros'} no intervalo.`;
}
function applyCustom() {
  const a = $('customStart').value, b = $('customEnd').value;
  if (!a || !b) { toast('Escolha as duas datas', true); return; }
  settings.custom = periodRange('custom', TODAY, { start: a, end: b });
  settings.period = 'custom'; saveSettings();
  closeSheets(); renderDash();
}

// ================= sheets =================
let openSheetEl = null;
function openSheet(el) {
  if (openSheetEl && openSheetEl !== el) openSheetEl.classList.remove('show');
  openSheetEl = el; el.style.transform = '';
  $('backdrop').classList.add('show');
  requestAnimationFrame(() => el.classList.add('show'));
}
function closeSheets() {
  document.activeElement?.blur?.();
  document.querySelectorAll('.sheet.show').forEach((s) => { s.classList.remove('show'); s.style.transform = ''; });
  closeAsk(); $('backdrop').classList.remove('show'); openSheetEl = null;
}
document.querySelectorAll('.sheet').forEach((el) => {
  let startY = null, dy = 0;
  const handle = (ev) => ev.target.closest('.grabber, .sheet-nav') && !ev.target.closest('button');
  el.addEventListener('touchstart', (ev) => { if (!handle(ev) || innerWidth >= 600) return; startY = ev.touches[0].clientY; dy = 0; el.classList.add('dragging'); }, { passive: true });
  el.addEventListener('touchmove', (ev) => { if (startY == null) return; dy = Math.max(0, ev.touches[0].clientY - startY); el.style.transform = `translateY(${dy}px)`; }, { passive: true });
  el.addEventListener('touchend', () => { if (startY == null) return; el.classList.remove('dragging'); startY = null; if (dy > 110) closeSheets(); else el.style.transform = ''; });
});
let askCb = null;
function ask(msg, label, cb) {
  askCb = cb; $('actionMsg').textContent = msg; $('actionConfirm').textContent = label;
  $('backdrop').classList.add('show', 'top'); $('actionSheet').classList.add('show');
}
function closeAsk() {
  $('actionSheet').classList.remove('show'); $('backdrop').classList.remove('top');
  if (!openSheetEl) $('backdrop').classList.remove('show');
  askCb = null;
}

// ================= ajustes =================
function applyTheme() {
  const t = settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  setSegmented($('themeSeg'), Math.max(0, ['auto', 'light', 'dark'].indexOf(t)));
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((mt) => mt.setAttribute('content', dark ? '#000000' : '#ffffff'));
}
function updateStorageInfo() {
  const n = Object.keys(entries).length;
  $('storageInfo').textContent = `${n} ${n === 1 ? 'registro salvo' : 'registros salvos'} automaticamente neste aparelho. Exporte um backup de vez em quando para não perder nada se trocar de celular.`;
}
async function exportBackup() {
  const data = JSON.stringify({ app: 'trade-calendar', version: 1, exportedAt: new Date().toISOString(), entries }, null, 2);
  const name = `trade-calendar-backup-${todayKey()}.json`;
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: 'Backup Trade Calendar' }); return; } catch (err) { if (err?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Backup exportado');
}
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let incoming;
    try { const parsed = JSON.parse(reader.result); incoming = cleanEntries(parsed.entries || parsed); } catch { toast('Arquivo inválido', true); return; }
    const n = Object.keys(incoming).length;
    if (!n) { toast('Nenhum registro no arquivo', true); return; }
    ask(`Importar ${n} ${n === 1 ? 'registro' : 'registros'}? Datas que já existem serão substituídas pelas do backup.`, 'Importar', () => {
      entries = { ...entries, ...incoming }; persist(); closeAsk(); renderActive(); updateStorageInfo(); toast(`${n} registros importados`);
    });
  };
  reader.readAsText(file);
}

// ================= eventos =================
$('tabbar').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-tab]'); if (b) switchTab(b.dataset.tab, { fromTabbar: true }); });

document.addEventListener('click', (ev) => {
  const a = ev.target.closest('[data-action]');
  if (a) {
    const act = a.dataset.action;
    if (act === 'today') goToday();
    else if (act === 'add') { TODAY = todayKey(); openEntry(TODAY); }
    else if (act === 'settings') { updateStorageInfo(); applyTheme(); openSheet($('settingsSheet')); }
    return;
  }
  const keyEl = ev.target.closest('[data-key]');
  if (keyEl && !keyEl.closest('#monthGrid')) { openEntry(keyEl.dataset.key); return; }
  const goTab = ev.target.closest('[data-goto-tab]');
  if (goTab) { switchTab(goTab.dataset.gotoTab); return; }
  const calM = ev.target.closest('[data-cal-month]');
  if (calM) {
    state.year = state.statsYear; state.month = Number(calM.dataset.calMonth);
    setCalView('month', { animate: false }); switchTab('cal'); $('monthScroll').scrollTop = 0; return;
  }
  const sy = ev.target.closest('[data-stats-year]');
  if (sy) { state.statsYear = Number(sy.dataset.statsYear); renderStats(); $('statsScroll').scrollTo({ top: 0, behavior: 'smooth' }); }
});

// dashboard
$('periodStrip').addEventListener('click', (ev) => {
  const b = ev.target.closest('.pcard'); if (!b) return;
  haptic();
  if (b.dataset.period === 'custom') { openCustom(); return; }
  settings.period = b.dataset.period; saveSettings(); renderDash();
});
$('dashBody').addEventListener('click', (ev) => {
  const b = ev.target.closest('#chartMode button'); if (!b) return;
  settings.chartMode = b.dataset.mode; saveSettings(); renderDash();
});
$('customStart').addEventListener('change', updateCustomInfo);
$('customEnd').addEventListener('change', updateCustomInfo);
$('customApply').onclick = applyCustom;
$('customApply2').onclick = applyCustom;
$('customCancel').onclick = closeSheets;

// calendário
$('monthPrev').onclick = () => goMonth(-1);
$('monthNext').onclick = () => goMonth(1);
$('yearPrev').onclick = () => { state.year--; haptic(); renderYear(); renderMonth(); };
$('yearNext').onclick = () => { state.year++; haptic(); renderYear(); renderMonth(); };
$('toYear').onclick = () => { renderYear(); setCalView('year'); };
$('monthGrid').addEventListener('click', (ev) => { if (swipeConsumed) return; const b = ev.target.closest('.day[data-key]'); if (b) openEntry(b.dataset.key); });
$('yearGrid').addEventListener('click', (ev) => {
  const b = ev.target.closest('.mini'); if (!b) return;
  state.month = Number(b.dataset.month); renderMonth();
  $('monthScroll').scrollTop = 0; calViews.month.classList.remove('scrolled'); setCalView('month');
});
let swipeConsumed = false;
(() => {
  const stage = $('monthStage'); let sx = 0, sy = 0, on = false;
  stage.addEventListener('touchstart', (ev) => { const t = ev.touches[0]; sx = t.clientX; sy = t.clientY; on = true; swipeConsumed = false; }, { passive: true });
  stage.addEventListener('touchend', (ev) => {
    if (!on) return; on = false;
    const t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { swipeConsumed = true; setTimeout(() => { swipeConsumed = false; }, 350); goMonth(dx < 0 ? 1 : -1); }
  }, { passive: true });
})();

// estatísticas
$('statsPrev').onclick = () => { state.statsYear--; haptic(); renderStats(); };
$('statsNext').onclick = () => { state.statsYear++; haptic(); renderStats(); };

// histórico
$('histFilter').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; state.histFilter = b.dataset.filter; renderHist(); });

// registro
$('entryForm').addEventListener('submit', (ev) => { ev.preventDefault(); saveEntry(); });
$('entrySaveTop').onclick = saveEntry;
$('entryCancel').onclick = closeSheets;
$('entryDelete').onclick = confirmDelete;
$('entryMode').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) setEntryMode(b.dataset.mode); });
dateInput.addEventListener('change', () => changeEntryDate(dateInput.value));
[gainInput, lossInput].forEach((inp) => {
  inp.addEventListener('input', () => { maskMoney(inp); updateNet(); });
  inp.addEventListener('focus', () => setTimeout(() => { const l = inp.value.length; try { inp.setSelectionRange(l, l); } catch { /* */ } }, 0));
});
gainInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); lossInput.focus(); } });
lossInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); lossInput.blur(); } });
opsInput.addEventListener('input', () => { opsInput.value = opsInput.value.replace(/\D/g, '').slice(0, 4); });
opsInput.addEventListener('blur', () => { opsInput.value = Number(opsInput.value) || 0; });
opsInput.addEventListener('focus', () => opsInput.select());
$('opsMinus').onclick = () => { opsInput.value = Math.max(0, (Number(opsInput.value) || 0) - 1); haptic(); };
$('opsPlus').onclick = () => { opsInput.value = Math.min(9999, (Number(opsInput.value) || 0) + 1); haptic(); };

// ajustes
$('settingsDone').onclick = closeSheets;
$('themeSeg').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; settings.theme = b.dataset.theme; saveSettings(); applyTheme(); renderActive(); });
$('exportBtn').onclick = exportBackup;
$('importInput').addEventListener('change', (ev) => { const f = ev.target.files[0]; if (f) importBackup(f); ev.target.value = ''; });
$('wipeBtn').onclick = () => ask('Todos os registros deste aparelho serão apagados. Esta ação não pode ser desfeita.', 'Apagar tudo', () => {
  entries = {}; persist(); closeAsk(); renderActive(); updateStorageInfo(); toast('Registros apagados');
});
$('actionConfirm').onclick = () => { const cb = askCb; if (cb) cb(); else closeAsk(); };
$('actionCancel').onclick = closeAsk;
$('backdrop').onclick = () => { if ($('actionSheet').classList.contains('show')) closeAsk(); else closeSheets(); };
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { if ($('actionSheet').classList.contains('show')) closeAsk(); else closeSheets(); }
  if (openSheetEl || ev.target.matches('input, textarea')) return;
  if (state.tab === 'cal' && state.calView === 'month' && ev.key === 'ArrowLeft') goMonth(-1);
  if (state.tab === 'cal' && state.calView === 'month' && ev.key === 'ArrowRight') goMonth(1);
});

// título compacto ao rolar
document.querySelectorAll('.scroll').forEach((sc) => {
  const host = sc.closest('.view, .page');
  sc.addEventListener('scroll', () => { host.classList.toggle('scrolled', sc.scrollTop > 36); chartHideAll(); }, { passive: true });
});

// sincronização: outras abas do navegador, virada do dia, tema e tamanho da tela
window.addEventListener('storage', (ev) => { if (ev.key === STORE_KEY) { entries = loadEntries(); renderActive(); } });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayKey() !== TODAY) { TODAY = todayKey(); renderActive(); }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); renderActive(); });
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (state.tab === 'dash' || state.tab === 'stats') renderActive(); }, 150); });

// ================= início =================
window.__setSeg = setSegmented;
const market = initMarket({
  $, esc, toast, haptic, openSheet, closeSheets,
  isActive: () => state.tab === 'market',
  goToMarket: () => switchTab('market'),
});
navigator.serviceWorker?.addEventListener('message', (ev) => { if (ev.data?.type === 'open-market') switchTab('market'); });
if (location.hash === '#mercado') { state.tab = 'market'; history.replaceState(null, '', location.pathname); }
applyTheme();
setCalView('month', { animate: false });
renderMonth(); renderYear();
switchTab(state.tab);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
