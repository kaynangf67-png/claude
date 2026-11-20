import {
  MONTHS, MONTHS_SHORT, dateKey, parseKey, todayParts, daysInMonth, firstWeekday,
  netOf, normalizeEntry, entriesIn, summarize, cumulative, monthlyTotals, yearsWithData,
  money, moneyShort, cellValue, decimal, percent, longDate,
} from './calc.js';

// ================= armazenamento =================
const STORE_KEY = 'tradecal.entries.v1';
const SETTINGS_KEY = 'tradecal.settings';

function loadEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    return cleanEntries(raw && raw.entries);
  } catch { return {}; }
}
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
function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, savedAt: Date.now(), entries }));
    return true;
  } catch {
    toast('Não foi possível salvar no aparelho', true);
    return false;
  }
}
function loadSettings() {
  try { return { theme: 'auto', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { theme: 'auto' }; }
}
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } }

let entries = loadEntries();
const settings = loadSettings();
// Pede ao navegador para não apagar os dados automaticamente.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ================= estado =================
let today = todayParts();
const state = {
  view: 'month',
  year: today.y,
  month: today.m,
  statsScope: 'month',
  statsYear: today.y,
  statsMonth: today.m,
  statsFrom: 'month',
};

// ================= utilidades DOM =================
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const txtCls = (v) => (v > 0 ? 'pos-text' : v < 0 ? 'neg-text' : '');
const haptic = () => { try { navigator.vibrate && navigator.vibrate(8); } catch { /* */ } };
const CHEV = '<svg class="chev" viewBox="0 0 24 24"><use href="#i-chev"/></svg>';

let toastTimer;
function toast(msg, isError) {
  const t = $('toast');
  t.innerHTML = `<span>${isError ? '⚠️' : '✓'}</span>${esc(msg)}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
}

function setSegmented(el, activeIdx) {
  const btns = [...el.querySelectorAll('button')];
  btns.forEach((b, i) => { b.classList.toggle('on', i === activeIdx); b.setAttribute('aria-selected', i === activeIdx); });
  const thumb = el.querySelector('.segmented-thumb');
  thumb.style.width = `calc((100% - 4px) / ${btns.length})`;
  thumb.style.transform = `translateX(${activeIdx * 100}%)`;
}

// ================= navegação entre telas =================
const views = { year: $('yearView'), month: $('monthView'), stats: $('statsView') };
const HIDE = ['is-active', 'hide-zoom-in', 'hide-zoom-out', 'hide-right', 'hide-left'];

function setView(name, { animate = true } = {}) {
  const prev = state.view;
  state.view = name;
  const plan = {
    year: { year: 'is-active', month: 'hide-zoom-out', stats: 'hide-right' },
    month: { year: 'hide-zoom-in', month: 'is-active', stats: 'hide-right' },
    stats: state.statsFrom === 'year'
      ? { year: 'hide-left', month: 'hide-zoom-out', stats: 'is-active' }
      : { year: 'hide-zoom-in', month: 'hide-left', stats: 'is-active' },
  }[name];
  for (const [k, el] of Object.entries(views)) {
    if (!animate) el.classList.add('no-anim');
    el.classList.remove(...HIDE);
    el.classList.add(plan[k]);
    el.setAttribute('aria-hidden', plan[k] !== 'is-active');
    if (!animate) { void el.offsetWidth; el.classList.remove('no-anim'); }
  }
  if (prev !== name && name === 'stats') $('statsScroll').scrollTop = 0;
}

// ================= mês =================
let lastSavedKey = null;

function renderMonth(direction) {
  const y = state.year, m = state.month;
  $('monthTitle').textContent = MONTHS[m];
  $('monthTitle').classList.toggle('accent', y === today.y && m === today.m);
  $('monthNavTitle').textContent = `${MONTHS[m]} de ${y}`;
  $('backYear').textContent = y;

  const lead = firstWeekday(y, m);
  const total = daysInMonth(y, m);
  const cells = Math.ceil((lead + total) / 7) * 7;
  let html = '';
  for (let i = 0; i < cells; i++) {
    const d = i - lead + 1;
    if (d < 1 || d > total) { html += '<div class="day empty"></div>'; continue; }
    const key = dateKey(y, m, d);
    const e = entries[key];
    const wd = i % 7;
    const c = ['day'];
    if (wd === 0 || wd === 6) c.push('weekend');
    if (y === today.y && m === today.m && d === today.d) c.push('today');
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
    grid.classList.remove('anim-in-left', 'anim-in-right');
    void grid.offsetWidth;
    grid.classList.add(direction > 0 ? 'anim-in-right' : 'anim-in-left');
  }

  const list = entriesIn(entries, { year: y, month: m });
  renderSummary(summarize(list));
  $('monthHint').textContent = list.length
    ? 'Toque em um dia para registrar ou editar · deslize para trocar de mês'
    : 'Toque em um dia para registrar o resultado do Day Trade';
}

function renderSummary(s) {
  const C = 2 * Math.PI * 23.5;
  const rate = s.winRate ?? 0;
  $('summary').innerHTML = `
    <div class="sum-head">
      <div>
        <div class="sum-label">Resultado líquido do mês</div>
        <div class="sum-net ${txtCls(s.net)}">${money(s.net, { sign: true })}</div>
      </div>
      <div class="ring-wrap" aria-label="Taxa de acerto ${percent(s.winRate)}">
        <div class="ring">
          <svg viewBox="0 0 54 54"><circle class="track" cx="27" cy="27" r="23.5"/><circle class="val" cx="27" cy="27" r="23.5" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - rate)}"/></svg>
          <div class="ring-txt">${percent(s.winRate)}</div>
        </div>
        <div class="ring-cap">acerto</div>
      </div>
    </div>
    <div class="sum-grid">
      <div class="sum-cell"><div class="k"><i class="dot pos"></i>Lucro total</div><div class="v pos-text">${moneyShort(s.profit)}</div></div>
      <div class="sum-cell"><div class="k"><i class="dot neg"></i>Prejuízo total</div><div class="v ${s.loss ? 'neg-text' : ''}">${moneyShort(s.loss)}</div></div>
      <div class="sum-cell"><div class="k">Dias positivos</div><div class="v">${s.positiveDays}</div></div>
      <div class="sum-cell"><div class="k">Dias negativos</div><div class="v">${s.negativeDays}</div></div>
    </div>`;
}

function goMonth(delta) {
  let m = state.month + delta, y = state.year;
  if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
  state.month = m; state.year = y;
  haptic();
  renderMonth(delta);
  renderYear();
}

function goToday() {
  today = todayParts();
  if (state.view === 'month') {
    const dir = Math.sign((today.y - state.year) * 12 + (today.m - state.month));
    state.year = today.y; state.month = today.m;
    renderMonth(dir || null);
    renderYear();
    $('monthScroll').scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    state.year = today.y; state.month = today.m;
    renderMonth(); renderYear();
    setView('month');
  }
}

// ================= ano =================
function renderYear() {
  const y = state.year;
  $('yearTitle').textContent = y;
  $('yearNavTitle').textContent = y;
  const months = monthlyTotals(entries, y);
  const ys = summarize(entriesIn(entries, { year: y }));
  $('yearSummary').innerHTML = ys.tradedDays || ys.noTradeDays
    ? `Resultado do ano <strong class="${txtCls(ys.net)}">${money(ys.net, { sign: true })}</strong><span class="ys-sub">${ys.positiveDays} dias positivos · ${ys.negativeDays} dias negativos · acerto ${percent(ys.winRate)}</span>`
    : '<span>Nenhum registro neste ano</span>';

  let html = '';
  for (let m = 0; m < 12; m++) {
    const lead = firstWeekday(y, m), total = daysInMonth(y, m);
    let days = '';
    for (let i = 0; i < lead; i++) days += '<span></span>';
    for (let d = 1; d <= total; d++) {
      const e = entries[dateKey(y, m, d)];
      const c = [];
      if (e && !e.noTrade) { const n = netOf(e); if (n > 0) c.push('p'); else if (n < 0) c.push('n'); }
      if (y === today.y && m === today.m && d === today.d) c.push('t');
      days += `<span${c.length ? ` class="${c.join(' ')}"` : ''}>${d}</span>`;
    }
    const mt = months[m];
    const has = mt.tradedDays > 0;
    html += `<button class="mini${y === today.y && m === today.m ? ' current' : ''}" data-month="${m}" aria-label="${MONTHS[m]} ${y}${has ? ', ' + money(mt.net) : ''}">
      <div class="mini-name">${MONTHS_SHORT[m]}</div>
      <div class="mini-net ${txtCls(mt.net)}">${has ? moneyShort(mt.net, { sign: true }) : ''}</div>
      <div class="mini-days">${days}</div>
    </button>`;
  }
  $('yearGrid').innerHTML = html;
}

// ================= estatísticas =================
function renderStats() {
  const scope = state.statsScope;
  setSegmented($('statsScope'), ['month', 'year', 'all'].indexOf(scope));
  $('statsBackLabel').textContent = state.statsFrom === 'year' ? String(state.year) : MONTHS[state.month];
  const pn = $('periodNav');
  pn.classList.toggle('hidden', scope === 'all');
  const sy = state.statsYear, sm = state.statsMonth;

  let list, series, periodName, historyHTML = '', historyTitle = '', deltaName;
  if (scope === 'month') {
    $('periodLabel').textContent = `${MONTHS[sm]} ${sy}`;
    periodName = `${MONTHS[sm]} de ${sy}`;
    list = entriesIn(entries, { year: sy, month: sm });
    series = [{ label: 'Início do mês', short: '1', value: 0 },
      ...list.filter((i) => !i.entry.noTrade).map((i) => ({ label: `${i.d} de ${MONTHS_SHORT[i.m]}.`, short: String(i.d), value: i.net }))];
    deltaName = 'Resultado do dia';
    historyTitle = 'Histórico do mês';
    historyHTML = [...list].reverse().map((i) => dayRow(i)).join('');
  } else if (scope === 'year') {
    $('periodLabel').textContent = String(sy);
    periodName = String(sy);
    list = entriesIn(entries, { year: sy });
    const months = monthlyTotals(entries, sy);
    const lastWithData = months.reduce((acc, mt, i) => (mt.tradedDays || mt.noTradeDays ? i : acc), -1);
    const upto = sy < today.y ? 11 : sy === today.y ? Math.max(today.m, lastWithData) : lastWithData;
    series = [{ label: 'Início do ano', short: '', value: 0 },
      ...months.slice(0, upto + 1).map((mt) => ({ label: `${MONTHS[mt.month]}`, short: MONTHS_SHORT[mt.month], value: mt.net }))];
    deltaName = 'Resultado do mês';
    historyTitle = 'Histórico mensal';
    const maxAbs = Math.max(1, ...months.map((mt) => Math.abs(mt.net)));
    historyHTML = months.map((mt) => {
      const has = mt.tradedDays || mt.noTradeDays;
      const sub = has ? `${mt.tradedDays} dias operados · acerto ${percent(mt.winRate)}` : 'Sem registros';
      return `<button class="li" data-goto-month="${mt.month}">
        <div class="li-main"><div class="li-t">${MONTHS[mt.month]}</div><div class="li-s">${sub}</div>${barHTML(mt.net, maxAbs)}</div>
        <div class="li-v ${txtCls(mt.net)}">${has ? moneyShort(mt.net, { sign: true }) : '—'}</div>${CHEV}</button>`;
    }).join('');
  } else {
    periodName = 'Todo o período';
    list = entriesIn(entries);
    const years = yearsWithData(entries);
    series = [{ label: 'Início', short: '', value: 0 }];
    if (years.length) {
      const first = list[0], last = list[list.length - 1];
      let y = first.y, m = first.m;
      while (y < last.y || (y === last.y && m <= last.m)) {
        const s = summarize(entriesIn(entries, { year: y, month: m }));
        series.push({ label: `${MONTHS[m]} ${y}`, short: `${MONTHS_SHORT[m]}/${String(y).slice(2)}`, value: s.net });
        m++; if (m > 11) { m = 0; y++; }
      }
    }
    deltaName = 'Resultado do mês';
    historyTitle = 'Histórico anual';
    const totals = years.map((y) => ({ y, ...summarize(entriesIn(entries, { year: y })) }));
    const maxAbs = Math.max(1, ...totals.map((t) => Math.abs(t.net)));
    historyHTML = [...totals].reverse().map((t) => `<button class="li" data-goto-year="${t.y}">
        <div class="li-main"><div class="li-t">${t.y}</div><div class="li-s">${t.tradedDays} dias operados · ${t.ops} operações · acerto ${percent(t.winRate)}</div>${barHTML(t.net, maxAbs)}</div>
        <div class="li-v ${txtCls(t.net)}">${moneyShort(t.net, { sign: true })}</div>${CHEV}</button>`).join('');
  }

  const s = summarize(list);
  const body = $('statsBody');
  if (!list.length) {
    body.innerHTML = `<div class="s-card empty-state"><div class="ico">📅</div><strong>Sem registros</strong>${scope === 'all' ? 'Nenhum resultado lançado ainda.' : `Nenhum resultado lançado em ${esc(periodName)}.`}<br>Toque em um dia do calendário para registrar.</div>
      ${scope === 'year' ? `<p class="list-title">${historyTitle}</p><div class="list">${historyHTML}</div>` : ''}`;
    return;
  }

  const bestTxt = s.best ? `${s.best.d} de ${MONTHS_SHORT[s.best.m]}.${scope !== 'month' ? ' ' + s.best.y : ''}` : 'Nenhum dia positivo';
  const worstTxt = s.worst ? `${s.worst.d} de ${MONTHS_SHORT[s.worst.m]}.${scope !== 'month' ? ' ' + s.worst.y : ''}` : 'Nenhum dia negativo';
  const scopeWord = scope === 'month' ? 'do mês' : scope === 'year' ? 'do ano' : 'geral';

  body.innerHTML = `
    <div class="s-card s-hero">
      <h3>Resultado líquido ${scopeWord}</h3>
      <div class="big ${txtCls(s.net)}">${money(s.net, { sign: true })}</div>
      <div class="sub">${esc(periodName)} · ${s.tradedDays} ${s.tradedDays === 1 ? 'dia operado' : 'dias operados'}</div>
      <div class="chips">
        <span class="chip pos">Lucro ${moneyShort(s.profit)}</span>
        <span class="chip neg">Prejuízo ${moneyShort(s.loss)}</span>
        <span class="chip">Acerto ${percent(s.winRate)}</span>
      </div>
    </div>

    <div class="s-card">
      <h3>Evolução financeira</h3>
      <div class="chart-wrap" id="chart"></div>
      <div class="chart-legend"><span><i style="background:var(--${s.net >= 0 ? 'green' : 'red'})"></i>Saldo acumulado</span><span><i style="background:var(--fill-2)"></i>${deltaName}</span></div>
    </div>

    <div class="tiles">
      <div class="tile"><div class="k"><span class="tile-ico pos">↑</span>Melhor dia</div><div class="v ${s.best ? 'pos-text' : ''}">${s.best ? money(s.best.net, { sign: true }) : '—'}</div><div class="d">${bestTxt}</div></div>
      <div class="tile"><div class="k"><span class="tile-ico neg">↓</span>Pior dia</div><div class="v ${s.worst ? 'neg-text' : ''}">${s.worst ? money(s.worst.net) : '—'}</div><div class="d">${worstTxt}</div></div>
      <div class="tile"><div class="k"><span class="tile-ico pos">+</span>Média de lucro</div><div class="v ${s.avgProfit ? 'pos-text' : ''}">${s.avgProfit != null ? money(s.avgProfit) : '—'}</div><div class="d">por dia positivo</div></div>
      <div class="tile"><div class="k"><span class="tile-ico neg">−</span>Média de prejuízo</div><div class="v ${s.avgLoss ? 'neg-text' : ''}">${s.avgLoss != null ? money(s.avgLoss) : '—'}</div><div class="d">por dia negativo</div></div>
    </div>

    <p class="list-title">Detalhes</p>
    <div class="list">
      ${detailRow('Taxa de acerto (dias)', percent(s.winRate))}
      ${detailRow('Dias positivos', s.positiveDays, 'pos-text')}
      ${detailRow('Dias negativos', s.negativeDays, 'neg-text')}
      ${s.flatDays ? detailRow('Dias zerados', s.flatDays) : ''}
      ${detailRow('Dias sem operações', s.noTradeDays)}
      ${detailRow('Total de operações', s.ops)}
      ${detailRow('Média por dia operado', s.avgPerDay != null ? money(s.avgPerDay, { sign: true }) : '—', txtCls(s.avgPerDay))}
      ${detailRow('Ganhos brutos', money(s.grossGain), 'pos-text')}
      ${detailRow('Perdas brutas', s.grossLoss ? money(-s.grossLoss) : money(0), s.grossLoss ? 'neg-text' : '')}
    </div>

    <p class="list-title">${historyTitle}</p>
    <div class="list">${historyHTML}</div>
  `;
  drawChart($('chart'), cumulative(series), deltaName);
}

function detailRow(k, v, c = '') {
  return `<div class="li"><div class="li-main"><div class="li-t">${k}</div></div><div class="li-v ${c}" style="font-weight:500">${v}</div></div>`;
}
function barHTML(v, maxAbs) {
  if (!v) return '<div class="li-bar"></div>';
  const w = Math.max(3, (Math.abs(v) / maxAbs) * 50);
  const style = v > 0 ? `left:50%;width:${w}%;background:var(--green)` : `right:50%;width:${w}%;background:var(--red)`;
  return `<div class="li-bar"><i style="${style}"></i></div>`;
}
function dayRow(i) {
  const e = i.entry;
  const wd = new Date(i.y, i.m, i.d).toLocaleDateString('pt-BR', { weekday: 'long' });
  const sub = e.noTrade ? 'Sem operações' : `${e.ops} ${e.ops === 1 ? 'operação' : 'operações'}${e.notes ? ' · ' + esc(e.notes) : ''}`;
  return `<button class="li" data-key="${i.key}">
    <div class="li-main"><div class="li-t">${i.d} de ${MONTHS_SHORT[i.m]}. <span class="muted" style="font-size:15px">${wd}</span></div><div class="li-s">${sub}</div></div>
    <div class="li-v ${e.noTrade ? 'muted' : txtCls(i.net)}">${e.noTrade ? '—' : money(i.net, { sign: true })}</div>${CHEV}</button>`;
}

// ---------- gráfico (SVG próprio, sem bibliotecas) ----------
let chartState = null;
function drawChart(wrap, pts, deltaName) {
  const W = Math.max(260, wrap.clientWidth || 340), H = 210;
  const padL = 10, padR = 10, padT = 26, padB = 22;
  const vals = [0, ...pts.map((p) => p.total), ...pts.map((p) => p.value)];
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { max += 1; min -= 1; }
  const span = max - min;
  max += span * 0.06; if (min < 0) min -= span * 0.06;
  const n = pts.length;
  const iw = W - padL - padR;
  const x = (i) => padL + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v) => padT + ((max - v) * (H - padT - padB)) / (max - min);
  const y0 = y(0);
  const final = pts[n - 1].total;
  const color = final >= 0 ? 'var(--green)' : 'var(--red)';
  const gid = 'g' + Math.random().toString(36).slice(2, 8);

  const step = n > 1 ? iw / (n - 1) : iw;
  const bw = Math.max(2, Math.min(16, step * 0.55));
  let bars = '';
  pts.forEach((p, i) => {
    if (i === 0 || !p.value) return;
    const top = y(Math.max(0, p.value)), h = Math.max(1.5, Math.abs(y(p.value) - y0));
    bars += `<rect class="${p.value > 0 ? 'bar-pos' : 'bar-neg'}" x="${(x(i) - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3, bw / 2)}"/>`;
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join('');
  const area = `${line}L${x(n - 1).toFixed(1)},${y0.toFixed(1)}L${x(0).toFixed(1)},${y0.toFixed(1)}Z`;

  // rótulos do eixo X: início, meio, fim
  const idx = n <= 4 ? pts.map((_, i) => i) : [1, Math.round((n - 1) / 2), n - 1];
  const xl = [...new Set(idx)].filter((i) => pts[i] && pts[i].short).map((i) => {
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    return `<text class="axis-txt" x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="${anchor}">${esc(pts[i].short)}</text>`;
  }).join('');

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Gráfico de evolução: saldo final ${money(final)}">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="${final >= 0 ? 0.28 : 0.04}"/>
        <stop offset="1" stop-color="${color}" stop-opacity="${final >= 0 ? 0.02 : 0.28}"/>
      </linearGradient></defs>
      <text class="axis-txt" x="${padL}" y="12">${moneyShort(Math.max(...pts.map((p) => p.total), 0))}</text>
      <line class="zero-line" x1="0" x2="${W}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}"/>
      <text class="axis-txt" x="${W - padR}" y="${(y0 - 4).toFixed(1)}" text-anchor="end">R$ 0</text>
      ${bars}
      <path d="${area}" fill="url(#${gid})"/>
      <path class="line" d="${line}" stroke="${color}"/>
      ${xl}
      <line class="cursor" x1="0" x2="0" y1="${padT - 6}" y2="${H - padB}" visibility="hidden"/>
      <circle class="cursor-dot" r="5" fill="${color}" stroke="var(--bg-elevated)" stroke-width="2.5" visibility="hidden"/>
    </svg>
    <div class="chart-tip"></div>`;

  const path = wrap.querySelector('.line');
  try {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
    requestAnimationFrame(() => path.classList.add('draw'));
  } catch { /* sem animação */ }

  chartState = { wrap, pts, x, y, W, deltaName };
}

function chartScrub(ev) {
  if (!chartState || !chartState.wrap.isConnected) return;
  const { wrap, pts, x, y, W, deltaName } = chartState;
  const r = wrap.getBoundingClientRect();
  const px = ((ev.clientX - r.left) / r.width) * W;
  let best = 0, bd = Infinity;
  pts.forEach((_, i) => { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } });
  const p = pts[best];
  const cur = wrap.querySelector('.cursor'), dot = wrap.querySelector('.cursor-dot'), tip = wrap.querySelector('.chart-tip');
  cur.setAttribute('x1', x(best)); cur.setAttribute('x2', x(best)); cur.setAttribute('visibility', 'visible');
  dot.setAttribute('cx', x(best)); dot.setAttribute('cy', y(p.total)); dot.setAttribute('visibility', 'visible');
  tip.innerHTML = `${esc(p.label)}<b class="${txtCls(p.total)}">${money(p.total, { sign: true })}</b>${best ? `<span class="muted">${deltaName}: ${money(p.value, { sign: true })}</span>` : ''}`;
  const left = (x(best) / W) * r.width;
  tip.style.left = Math.min(r.width - 70, Math.max(70, left)) + 'px';
  tip.classList.add('show');
}
function chartHide() {
  if (!chartState || !chartState.wrap.isConnected) return;
  const w = chartState.wrap;
  w.querySelector('.chart-tip').classList.remove('show');
  w.querySelector('.cursor').setAttribute('visibility', 'hidden');
  w.querySelector('.cursor-dot').setAttribute('visibility', 'hidden');
}

function openStats(from) {
  state.statsFrom = from;
  state.statsYear = state.year;
  state.statsMonth = state.month;
  state.statsScope = from === 'year' ? 'year' : 'month';
  setView('stats');
  renderStats();
}

// ================= folha de registro =================
const sheet = $('entrySheet');
const gainInput = $('gainInput'), lossInput = $('lossInput'), opsInput = $('opsInput'), notesInput = $('notesInput');
let editingKey = null, entryMode = 'trade';

const getMoney = (input) => { const d = input.value.replace(/\D/g, ''); return d ? Number(d) / 100 : 0; };
const setMoney = (input, v) => { input.value = v ? decimal(v) : ''; };
function maskMoney(input) {
  const digits = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11);
  input.value = digits ? decimal(Number(digits) / 100) : '';
}

function updateNet() {
  const n = Math.round((getMoney(gainInput) - getMoney(lossInput)) * 100) / 100;
  const box = $('netDisplay');
  box.classList.remove('pos', 'neg');
  if (n) box.classList.add(cls(n));
  $('netValue').textContent = money(n, { sign: true });
  $('netSub').textContent = n > 0 ? 'Dia positivo' : n < 0 ? 'Dia negativo' : 'calculado automaticamente';
}

function setEntryMode(mode) {
  entryMode = mode;
  setSegmented($('entryMode'), mode === 'trade' ? 0 : 1);
  $('tradeFields').hidden = mode !== 'trade';
  $('noTradeInfo').hidden = mode === 'trade';
}

function openEntry(key) {
  editingKey = key;
  const { y, m, d } = parseKey(key);
  const e = entries[key];
  $('entryTitle').textContent = longDate(y, m, d).replace(/ de \d{4}$/, '');
  setMoney(gainInput, e?.gain || 0);
  setMoney(lossInput, e?.loss || 0);
  opsInput.value = e?.ops || 0;
  notesInput.value = e?.notes || '';
  setEntryMode(e?.noTrade ? 'none' : 'trade');
  updateNet();
  $('entryDelete').hidden = !e;
  $('entryMeta').textContent = e
    ? `Atualizado em ${new Date(e.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : 'Novo registro';
  sheet.querySelector('.sheet-body').scrollTop = 0;
  openSheet(sheet);
}

function saveEntry() {
  if (!editingKey) return;
  const raw = {
    gain: getMoney(gainInput),
    loss: getMoney(lossInput),
    ops: Number(opsInput.value) || 0,
    notes: notesInput.value.trim(),
    noTrade: entryMode === 'none',
    updatedAt: Date.now(),
  };
  if (!raw.noTrade && !raw.gain && !raw.loss && !raw.ops) {
    toast('Informe um valor ou marque “Sem operações”', true);
    gainInput.focus();
    return;
  }
  entries[editingKey] = normalizeEntry(raw);
  if (!persist()) return;
  lastSavedKey = editingKey;
  haptic();
  closeSheets();
  renderAll();
  toast('Registro salvo');
}

function confirmDelete() {
  const key = editingKey;
  ask('Este registro será apagado permanentemente.', 'Apagar registro', () => {
    delete entries[key];
    persist();
    closeSheets();
    renderAll();
    toast('Registro apagado');
  });
}

// ================= sheets genéricos =================
let openSheetEl = null;
function openSheet(el) {
  openSheetEl = el;
  el.style.transform = '';
  $('backdrop').classList.add('show');
  requestAnimationFrame(() => el.classList.add('show'));
}
function closeSheets() {
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  document.querySelectorAll('.sheet.show').forEach((s) => { s.classList.remove('show'); s.style.transform = ''; });
  closeAsk();
  $('backdrop').classList.remove('show');
  openSheetEl = null;
}

// arrastar para baixo para fechar
document.querySelectorAll('.sheet').forEach((el) => {
  let startY = null, dy = 0;
  const handle = (ev) => ev.target.closest('.grabber, .sheet-nav') && !ev.target.closest('button');
  el.addEventListener('touchstart', (ev) => {
    if (!handle(ev) || window.innerWidth >= 600) return;
    startY = ev.touches[0].clientY; dy = 0; el.classList.add('dragging');
  }, { passive: true });
  el.addEventListener('touchmove', (ev) => {
    if (startY == null) return;
    dy = Math.max(0, ev.touches[0].clientY - startY);
    el.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  el.addEventListener('touchend', () => {
    if (startY == null) return;
    el.classList.remove('dragging');
    startY = null;
    if (dy > 110) closeSheets(); else el.style.transform = '';
  });
});

// ---------- action sheet ----------
let askCb = null;
function ask(msg, confirmLabel, cb) {
  askCb = cb;
  $('actionMsg').textContent = msg;
  $('actionConfirm').textContent = confirmLabel;
  $('backdrop').classList.add('show', 'top');
  $('actionSheet').classList.add('show');
}
function closeAsk() {
  $('actionSheet').classList.remove('show');
  $('backdrop').classList.remove('top');
  if (!openSheetEl) $('backdrop').classList.remove('show');
  askCb = null;
}

// ================= ajustes =================
function applyTheme() {
  const t = settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  setSegmented($('themeSeg'), ['auto', 'light', 'dark'].indexOf(t) < 0 ? 0 : ['auto', 'light', 'dark'].indexOf(t));
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((mt) => { mt.setAttribute('content', dark ? '#000000' : '#ffffff'); });
}

function updateStorageInfo() {
  const n = Object.keys(entries).length;
  $('storageInfo').textContent = `${n} ${n === 1 ? 'registro salvo' : 'registros salvos'} automaticamente neste aparelho. Exporte um backup de vez em quando para não perder nada se trocar de celular.`;
}

async function exportBackup() {
  const data = JSON.stringify({ app: 'trade-calendar', version: 1, exportedAt: new Date().toISOString(), entries }, null, 2);
  const t = todayParts();
  const name = `trade-calendar-backup-${dateKey(t.y, t.m, t.d)}.json`;
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: 'Backup Trade Calendar' }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Backup exportado');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let incoming;
    try {
      const parsed = JSON.parse(reader.result);
      incoming = cleanEntries(parsed.entries || parsed);
    } catch { toast('Arquivo inválido', true); return; }
    const n = Object.keys(incoming).length;
    if (!n) { toast('Nenhum registro no arquivo', true); return; }
    ask(`Importar ${n} ${n === 1 ? 'registro' : 'registros'}? Datas que já existem serão substituídas pelas do backup.`, 'Importar', () => {
      entries = { ...entries, ...incoming };
      persist(); closeAsk(); renderAll(); updateStorageInfo();
      toast(`${n} registros importados`);
    });
  };
  reader.readAsText(file);
}

// ================= render geral =================
function renderAll() {
  renderMonth();
  renderYear();
  if (state.view === 'stats') renderStats();
}

// ================= eventos =================
$('monthPrev').onclick = () => goMonth(-1);
$('monthNext').onclick = () => goMonth(1);
$('yearPrev').onclick = () => { state.year--; haptic(); renderYear(); renderMonth(); };
$('yearNext').onclick = () => { state.year++; haptic(); renderYear(); renderMonth(); };
$('toYear').onclick = () => { renderYear(); setView('year'); };
$('statsBack').onclick = () => setView(state.statsFrom);

$('monthGrid').addEventListener('click', (ev) => {
  if (swipeConsumed) return;
  const b = ev.target.closest('.day[data-key]');
  if (b) openEntry(b.dataset.key);
});
$('yearGrid').addEventListener('click', (ev) => {
  const b = ev.target.closest('.mini');
  if (!b) return;
  state.month = Number(b.dataset.month);
  renderMonth();
  $('monthScroll').scrollTop = 0;
  views.month.classList.remove('scrolled');
  setView('month');
});

document.addEventListener('click', (ev) => {
  const a = ev.target.closest('[data-action]');
  if (!a) return;
  const act = a.dataset.action;
  if (act === 'today') goToday();
  else if (act === 'stats-month') openStats('month');
  else if (act === 'stats-year') openStats('year');
  else if (act === 'settings') { updateStorageInfo(); applyTheme(); openSheet($('settingsSheet')); }
  else if (act === 'add') {
    today = todayParts();
    if (state.year !== today.y || state.month !== today.m) { state.year = today.y; state.month = today.m; renderMonth(); renderYear(); }
    openEntry(dateKey(today.y, today.m, today.d));
  }
});

$('statsScope').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  state.statsScope = b.dataset.scope;
  renderStats();
});
$('periodPrev').onclick = () => {
  if (state.statsScope === 'month') { state.statsMonth--; if (state.statsMonth < 0) { state.statsMonth = 11; state.statsYear--; } }
  else state.statsYear--;
  renderStats();
};
$('periodNext').onclick = () => {
  if (state.statsScope === 'month') { state.statsMonth++; if (state.statsMonth > 11) { state.statsMonth = 0; state.statsYear++; } }
  else state.statsYear++;
  renderStats();
};
$('statsBody').addEventListener('click', (ev) => {
  const day = ev.target.closest('[data-key]');
  if (day) { openEntry(day.dataset.key); return; }
  const gm = ev.target.closest('[data-goto-month]');
  if (gm) { state.statsScope = 'month'; state.statsMonth = Number(gm.dataset.gotoMonth); renderStats(); $('statsScroll').scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const gy = ev.target.closest('[data-goto-year]');
  if (gy) { state.statsScope = 'year'; state.statsYear = Number(gy.dataset.gotoYear); renderStats(); $('statsScroll').scrollTo({ top: 0, behavior: 'smooth' }); }
});
$('statsBody').addEventListener('pointermove', (ev) => { if (ev.target.closest('.chart-wrap')) chartScrub(ev); else chartHide(); });
$('statsBody').addEventListener('pointerdown', (ev) => { if (ev.target.closest('.chart-wrap')) chartScrub(ev); });
$('statsBody').addEventListener('pointerleave', chartHide);
$('statsScroll').addEventListener('scroll', chartHide, { passive: true });

// folha de registro
$('entryForm').addEventListener('submit', (ev) => { ev.preventDefault(); saveEntry(); });
$('entrySaveTop').onclick = saveEntry;
$('entryCancel').onclick = closeSheets;
$('entryDelete').onclick = confirmDelete;
$('entryMode').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) setEntryMode(b.dataset.mode); });
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
$('themeSeg').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  settings.theme = b.dataset.theme; saveSettings(); applyTheme();
  if (state.view === 'stats') renderStats();
});
$('exportBtn').onclick = exportBackup;
$('importInput').addEventListener('change', (ev) => { const f = ev.target.files[0]; if (f) importBackup(f); ev.target.value = ''; });
$('wipeBtn').onclick = () => ask('Todos os registros deste aparelho serão apagados. Esta ação não pode ser desfeita.', 'Apagar tudo', () => {
  entries = {}; persist(); closeAsk(); renderAll(); updateStorageInfo(); toast('Registros apagados');
});

// confirmação
$('actionConfirm').onclick = () => { const cb = askCb; if (cb) cb(); else closeAsk(); };
$('actionCancel').onclick = closeAsk;
$('backdrop').onclick = () => { if ($('actionSheet').classList.contains('show')) closeAsk(); else closeSheets(); };
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { if ($('actionSheet').classList.contains('show')) closeAsk(); else closeSheets(); }
  if (openSheetEl || ev.target.matches('input, textarea')) return;
  if (state.view === 'month' && ev.key === 'ArrowLeft') goMonth(-1);
  if (state.view === 'month' && ev.key === 'ArrowRight') goMonth(1);
});

// barra de navegação com título compacto ao rolar
document.querySelectorAll('.view').forEach((v) => {
  const sc = v.querySelector('.scroll');
  sc.addEventListener('scroll', () => v.classList.toggle('scrolled', sc.scrollTop > 36), { passive: true });
});

// deslizar para trocar de mês
let swipeConsumed = false;
(() => {
  const stage = $('monthStage');
  let sx = 0, sy = 0, tracking = false;
  stage.addEventListener('touchstart', (ev) => { const t = ev.touches[0]; sx = t.clientX; sy = t.clientY; tracking = true; swipeConsumed = false; }, { passive: true });
  stage.addEventListener('touchend', (ev) => {
    if (!tracking) return;
    tracking = false;
    const t = ev.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipeConsumed = true;
      setTimeout(() => { swipeConsumed = false; }, 350);
      goMonth(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
})();

// sincroniza com outras abas e com a virada do dia
window.addEventListener('storage', (ev) => { if (ev.key === STORE_KEY) { entries = loadEntries(); renderAll(); } });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const t = todayParts();
  if (t.y !== today.y || t.m !== today.m || t.d !== today.d) { today = t; renderAll(); }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); if (state.view === 'stats') renderStats(); });
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (state.view === 'stats') renderStats(); }, 150); });

// ================= início =================
applyTheme();
renderAll();
setView('month', { animate: false });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
