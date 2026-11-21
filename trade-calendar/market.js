// Aba "Mercado": calendário econômico ao vivo + alertas 10 e 5 minutos antes de cada notícia.
const API = 'api/calendar';
const CACHE_KEY = 'tradecal.market.cache';
const PREFS_KEY = 'tradecal.market.prefs';
const FIRED_KEY = 'tradecal.market.fired';
const REFRESH_MS = 5 * 60 * 1000;

const IMPACT_RANK = { holiday: 0, low: 1, medium: 2, high: 3 };
const IMPACT_LABEL = { high: 'Alto impacto', medium: 'Médio impacto', low: 'Baixo impacto', holiday: 'Feriado' };
const FLAGS = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CAD: '🇨🇦', AUD: '🇦🇺', NZD: '🇳🇿', CHF: '🇨🇭', CNY: '🇨🇳', ALL: '🌐' };
const PAIRS = {
  USD: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'AUD/USD', 'XAU/USD'],
  EUR: ['EUR/USD', 'EUR/GBP', 'EUR/JPY', 'EUR/CAD', 'EUR/AUD'],
  GBP: ['GBP/USD', 'EUR/GBP', 'GBP/JPY', 'GBP/CAD'],
  JPY: ['USD/JPY', 'EUR/JPY', 'GBP/JPY', 'CAD/JPY'],
  CAD: ['USD/CAD', 'EUR/CAD', 'CAD/JPY', 'GBP/CAD'],
  AUD: ['AUD/USD', 'AUD/JPY', 'EUR/AUD', 'AUD/NZD'],
  NZD: ['NZD/USD', 'AUD/NZD', 'NZD/JPY'],
  CHF: ['USD/CHF', 'EUR/CHF', 'CHF/JPY'],
  CNY: ['USD/CNH', 'AUD/USD'],
};
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF', 'CNY'];
const DEFAULT_PREFS = { listImpact: 'medium', currencies: [], alert10: true, alert5: true, alertImpact: 'high', sound: true };

const hhmm = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function initMarket({ $, esc, toast, haptic, openSheet, closeSheets, isActive, goToMarket }) {
  let prefs = load(PREFS_KEY, DEFAULT_PREFS);
  prefs = { ...DEFAULT_PREFS, ...prefs };
  let fired = load(FIRED_KEY, {});
  let cache = load(CACHE_KEY, null); // { updatedAt, fetchedAt, events }
  let events = cache?.events || [];
  let status = cache ? 'ok' : 'loading';
  let lastError = '';
  let showPast = false;
  let audio = null;

  function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } }

  // ---------- dados ----------
  async function refresh(manual = false) {
    try {
      if (manual) { status = 'loading'; render(); }
      const r = await fetch(API, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !Array.isArray(j.events)) throw new Error(j.error || `HTTP ${r.status}`);
      events = j.events;
      cache = { updatedAt: j.updatedAt, fetchedAt: Date.now(), events };
      save(CACHE_KEY, cache);
      status = 'ok'; lastError = '';
      if (manual) toast('Calendário atualizado');
    } catch (err) {
      lastError = String(err.message || err);
      status = events.length ? 'stale' : 'error';
      if (manual) toast('Sem conexão com o calendário', true);
    }
    if (isActive()) render();
    checkAlerts();
  }

  // ---------- filtros ----------
  const passList = (e) => (IMPACT_RANK[e.impact] >= IMPACT_RANK[prefs.listImpact] || (prefs.listImpact === 'low'))
    && (!prefs.currencies.length || prefs.currencies.includes(e.currency));
  const passAlert = (e) => e.impact !== 'holiday' && IMPACT_RANK[e.impact] >= IMPACT_RANK[prefs.alertImpact]
    && (!prefs.currencies.length || prefs.currencies.includes(e.currency));

  // ---------- alertas ----------
  function offsets() { return [prefs.alert10 && 10, prefs.alert5 && 5].filter(Boolean); }

  function checkAlerts() {
    const now = Date.now();
    const offs = offsets();
    if (!offs.length) return;
    const due = new Map(); // agrupa notícias do mesmo horário
    for (const e of events) {
      if (!passAlert(e)) continue;
      const t = Date.parse(e.time);
      if (now >= t || t - now > 10.5 * 60e3) continue;
      const applicable = offs.filter((o) => now >= t - o * 60e3);
      if (!applicable.length) continue;
      const o = Math.min(...applicable);
      if (fired[`${e.id}|${o}`]) continue;
      applicable.forEach((a) => { fired[`${e.id}|${a}`] = now; });
      const k = `${e.time}|${o}`;
      if (!due.has(k)) due.set(k, []);
      due.get(k).push(e);
    }
    if (!due.size) return;
    // limpa marcações antigas (mais de 2 dias)
    for (const [k, v] of Object.entries(fired)) if (now - v > 2 * 864e5) delete fired[k];
    save(FIRED_KEY, fired);
    for (const list of due.values()) notify(list, now);
  }

  function describe(list, now) {
    const t = Date.parse(list[0].time);
    const mins = Math.max(1, Math.ceil((t - now) / 60e3));
    const curr = [...new Set(list.map((e) => e.currency))];
    const top = list.slice().sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact]);
    const title = `${curr.map((c) => (FLAGS[c] || '') + ' ' + c).join(' · ')} — notícia em ${mins} min (${hhmm.format(t)})`;
    const lines = top.slice(0, 3).map((e) => `${e.title} · ${IMPACT_LABEL[e.impact].toLowerCase()}${e.forecast ? ` · prev. ${e.forecast}` : ''}`);
    if (top.length > 3) lines.push(`+ ${top.length - 3} no mesmo horário`);
    const pairs = [...new Set(curr.flatMap((c) => PAIRS[c] || []))].slice(0, 5);
    if (pairs.length) lines.push(`Pares afetados: ${pairs.join(', ')}`);
    return { title, body: lines.join('\n'), tag: `tc-${list[0].time}-${mins}`, high: top[0].impact === 'high' };
  }

  async function notify(list, now) {
    const n = describe(list, now);
    banner(n);
    if (prefs.sound) chime(n.high);
    try { navigator.vibrate?.([120, 60, 120]); } catch { /* */ }
    markTab(true);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        const opts = { body: n.body, tag: n.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './#mercado' }, requireInteraction: n.high };
        if (reg) await reg.showNotification(n.title, opts); else new Notification(n.title, opts);
      } catch { /* banner já mostrado */ }
    }
  }

  let bannerTimer;
  function banner(n) {
    const el = $('mkBanner');
    el.innerHTML = `<div class="mkb-app"><img src="icons/icon-192.png" alt=""><span>TRADE CALENDAR</span><span class="mkb-now">agora</span></div><div class="mkb-title">${esc(n.title)}</div><div class="mkb-body">${esc(n.body).replace(/\n/g, '<br>')}</div>`;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), n.high ? 12000 : 8000);
  }

  function chime(strong) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const notes = strong ? [880, 1174.7, 880] : [880, 1174.7];
      notes.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        const t0 = audio.currentTime + i * 0.16;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
        o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + 0.32);
      });
    } catch { /* sem som */ }
  }
  // O iOS só libera áudio depois de um toque do usuário.
  document.addEventListener('touchend', () => { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* */ } }, { once: true, passive: true });

  function markTab(on) { document.querySelector('#tabbar [data-tab="market"]')?.classList.toggle('badge', on && !isActive()); }

  // ---------- render ----------
  const fmtCountdown = (ms) => {
    if (ms <= 0) return 'agora';
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h >= 24) return `em ${Math.floor(h / 24)}d ${h % 24}h`;
    if (h) return `em ${h}h ${String(m).padStart(2, '0')}min`;
    return `em ${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  const pill = (impact) => `<span class="imp imp-${impact}">${IMPACT_LABEL[impact]}</span>`;

  function render() {
    const now = Date.now();
    const todayK = localKey(new Date(now));
    const tomorrowK = localKey(new Date(now + 864e5));
    const list = events.filter(passList);
    const upcoming = list.filter((e) => Date.parse(e.time) > now - 60e3);
    const nextT = upcoming.find((e) => Date.parse(e.time) > now && e.impact !== 'holiday');
    const sameTime = nextT ? upcoming.filter((e) => e.time === nextT.time) : [];

    // status ao vivo
    const upd = cache?.fetchedAt ? hhmm.format(cache.fetchedAt) : '—';
    $('mkLive').innerHTML = status === 'loading' && !events.length ? '<span class="live-dot off"></span>Carregando…'
      : status === 'error' ? '<span class="live-dot off"></span>Sem conexão'
      : `<span class="live-dot${status === 'stale' ? ' off' : ''}"></span>Ao vivo · atualizado às ${upd}`;

    // próxima notícia
    let hero;
    if (nextT) {
      const t = Date.parse(nextT.time);
      const pairs = PAIRS[nextT.currency] || [];
      hero = `<div class="mk-hero imp-border-${nextT.impact}">
        <div class="mk-hero-top"><span>Próxima notícia</span>${pill(nextT.impact)}</div>
        <div class="mk-count" data-t="${t}">${fmtCountdown(t - now)}</div>
        <div class="mk-hero-title"><span class="flag">${FLAGS[nextT.currency] || '🏳️'}</span><b>${esc(nextT.currency)}</b> ${esc(nextT.title)}</div>
        <div class="mk-hero-sub">${dayLabel(localKey(new Date(t)), todayK, tomorrowK, t)} às ${hhmm.format(t)}${nextT.forecast ? ` · Previsão ${esc(nextT.forecast)}` : ''}${nextT.previous ? ` · Anterior ${esc(nextT.previous)}` : ''}</div>
        ${sameTime.length > 1 ? `<div class="mk-hero-more">+ ${sameTime.length - 1} ${sameTime.length - 1 === 1 ? 'notícia' : 'notícias'} no mesmo horário</div>` : ''}
        ${pairs.length ? `<div class="mk-pairs">${pairs.map((p) => `<span>${p}</span>`).join('')}</div>` : ''}
      </div>`;
    } else if (status === 'error') {
      hero = `<div class="mk-hero"><div class="mk-hero-top"><span>Calendário indisponível</span></div><p class="mk-empty">Não foi possível carregar as notícias agora. Verifique a internet e toque em atualizar.</p><button class="hero-cta" id="mkRetry">Tentar de novo</button></div>`;
    } else if (status === 'loading' && !events.length) {
      hero = '<div class="mk-hero"><p class="mk-empty">Carregando o calendário econômico…</p></div>';
    } else {
      hero = '<div class="mk-hero"><div class="mk-hero-top"><span>Próxima notícia</span></div><p class="mk-empty">Nenhuma notícia com esses filtros até o fim da semana. O calendário da semana seguinte é publicado no domingo.</p></div>';
    }

    // resumo dos alertas
    const offs = offsets();
    const perm = !('Notification' in window) ? 'unsupported' : Notification.permission;
    const alertTxt = offs.length ? `${offs.join(' e ')} min antes · ${prefs.alertImpact === 'high' ? 'alto impacto' : prefs.alertImpact === 'medium' ? 'médio e alto impacto' : 'todas as notícias'}` : 'Alertas desligados';
    const alerts = `<button class="mk-alerts" id="mkAlertsBtn">
      <span class="mk-bell ${offs.length ? 'on' : ''}"><svg viewBox="0 0 24 24"><use href="#i-bell"/></svg></span>
      <span class="mk-alerts-main"><b>Alertas de notícias</b><small>${alertTxt}${offs.length && perm !== 'granted' ? ' · só dentro do app' : ''}</small></span>
      <svg class="chev" viewBox="0 0 24 24"><use href="#i-chev"/></svg></button>`;

    // filtros
    const filt = `<div class="segmented" id="mkImpact">
        <button type="button" data-imp="high">Alto</button><button type="button" data-imp="medium">Médio e alto</button><button type="button" data-imp="low">Todos</button>
        <span class="segmented-thumb"></span></div>
      <div class="chips" id="mkCurr"><button class="chip-btn ${prefs.currencies.length ? '' : 'on'}" data-cur="">Todas</button>${CURRENCIES.map((c) => `<button class="chip-btn ${prefs.currencies.includes(c) ? 'on' : ''}" data-cur="${c}">${FLAGS[c]} ${c}</button>`).join('')}</div>`;

    // lista por dia
    const shown = showPast ? list : upcoming.filter((e) => localKey(new Date(Date.parse(e.time))) >= todayK || Date.parse(e.time) > now);
    const groups = new Map();
    for (const e of shown) {
      const k = localKey(new Date(Date.parse(e.time)));
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }
    let listHTML = '';
    for (const [k, evs] of groups) {
      const t0 = Date.parse(evs[0].time);
      listHTML += `<p class="list-title">${dayLabel(k, todayK, tomorrowK, t0)}</p><div class="list mk-list">${evs.map((e) => row(e, now)).join('')}</div>`;
    }
    if (!listHTML && events.length) listHTML = '<div class="card-pad empty-state">Nenhuma notícia com esses filtros.</div>';
    const pastCount = list.length - shown.length;
    const pastBtn = events.length ? `<button class="mk-past" id="mkPast">${showPast ? 'Ocultar notícias que já passaram' : `Ver notícias que já passaram nesta semana${pastCount ? ` (${pastCount})` : ''}`}</button>` : '';

    $('mkBody').innerHTML = hero + alerts + '<div class="section-title"><h2>Calendário econômico</h2><span>horário local</span></div>' + filt + listHTML + pastBtn
      + `<p class="group-footer center">Fonte: Forex Factory · atualiza a cada 5 minutos · horários no fuso do seu aparelho.</p>`;
    window.__setSeg?.($('mkImpact'), ['high', 'medium', 'low'].indexOf(prefs.listImpact));
    markTab(false);
  }

  function dayLabel(k, todayK, tomorrowK, t) {
    const d = dayFmt.format(t);
    if (k === todayK) return `Hoje · ${d}`;
    if (k === tomorrowK) return `Amanhã · ${d}`;
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

  function row(e, now) {
    const t = Date.parse(e.time);
    const past = t <= now - 60e3, live = !past && t <= now + 60e3 && t - now <= 0;
    const soon = !past && t - now <= 60 * 60e3;
    const right = past ? '<span class="mk-done">✓</span>' : live ? '<span class="mk-soon live">agora</span>' : soon ? `<span class="mk-soon" data-t="${t}">${fmtCountdown(t - now)}</span>` : '';
    const vals = [e.actual && `Atual <b>${esc(e.actual)}</b>`, e.forecast && `Prev. ${esc(e.forecast)}`, e.previous && `Ant. ${esc(e.previous)}`].filter(Boolean).join(' · ');
    return `<div class="mk-row ${past ? 'past' : ''}">
      <div class="mk-time">${hhmm.format(t)}</div>
      <i class="mk-bar imp-bg-${e.impact}"></i>
      <div class="mk-main"><div class="mk-t"><span class="mk-cur">${FLAGS[e.currency] || ''} ${esc(e.currency)}</span>${esc(e.title)}</div>${vals ? `<div class="mk-s">${vals}</div>` : ''}</div>
      ${right}</div>`;
  }

  // ---------- folha de alertas ----------
  function renderAlertSheet() {
    const perm = !('Notification' in window) ? 'unsupported' : Notification.permission;
    $('al10').checked = prefs.alert10; $('al5').checked = prefs.alert5; $('alSound').checked = prefs.sound;
    window.__setSeg?.($('alImpact'), ['high', 'medium', 'low'].indexOf(prefs.alertImpact));
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    let txt, btn = '';
    if (perm === 'granted') txt = 'Notificações do sistema ativadas.';
    else if (perm === 'denied') txt = 'As notificações foram bloqueadas. Libere em Ajustes do iPhone › Notificações › Trade Calendar.';
    else if (perm === 'unsupported' && isIOS && !standalone) txt = 'No iPhone, adicione o app à Tela de Início (Compartilhar › Adicionar à Tela de Início) e abra por lá para ativar as notificações.';
    else if (perm === 'unsupported') txt = 'Este navegador não mostra notificações do sistema. Os alertas aparecem dentro do app.';
    else { txt = 'Permita que o app mostre notificações do sistema.'; btn = '<button type="button" class="primary-btn" id="alPerm">Ativar notificações</button>'; }
    $('alPermBox').innerHTML = `<p class="group-footer">${txt}</p>${btn}`;
  }
  function openAlerts() { renderAlertSheet(); openSheet($('alertSheet')); }

  // ---------- eventos ----------
  $('mkBody').addEventListener('click', (ev) => {
    const imp = ev.target.closest('#mkImpact button');
    if (imp) { prefs.listImpact = imp.dataset.imp; save(PREFS_KEY, prefs); haptic(); render(); return; }
    const cur = ev.target.closest('#mkCurr .chip-btn');
    if (cur) {
      const c = cur.dataset.cur;
      if (!c) prefs.currencies = [];
      else prefs.currencies = prefs.currencies.includes(c) ? prefs.currencies.filter((x) => x !== c) : [...prefs.currencies, c];
      save(PREFS_KEY, prefs); haptic(); render(); return;
    }
    if (ev.target.closest('#mkAlertsBtn')) { openAlerts(); return; }
    if (ev.target.closest('#mkPast')) { showPast = !showPast; render(); return; }
    if (ev.target.closest('#mkRetry')) refresh(true);
  });
  $('mkRefresh').onclick = () => refresh(true);
  $('mkBanner').onclick = () => { $('mkBanner').classList.remove('show'); goToMarket(); };
  $('alDone').onclick = () => { closeSheets(); if (isActive()) render(); };
  $('al10').onchange = (e) => { prefs.alert10 = e.target.checked; save(PREFS_KEY, prefs); };
  $('al5').onchange = (e) => { prefs.alert5 = e.target.checked; save(PREFS_KEY, prefs); };
  $('alSound').onchange = (e) => { prefs.sound = e.target.checked; save(PREFS_KEY, prefs); };
  $('alImpact').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    prefs.alertImpact = b.dataset.imp; save(PREFS_KEY, prefs); renderAlertSheet();
  });
  $('alertSheet').addEventListener('click', async (ev) => {
    if (ev.target.closest('#alPerm')) {
      try { await Notification.requestPermission(); } catch { /* */ }
      renderAlertSheet();
    }
    if (ev.target.closest('#alTest')) {
      const fake = { id: 'teste', title: 'Notificação de teste', currency: 'CAD', impact: 'high', time: new Date(Date.now() + 5 * 60e3).toISOString(), forecast: '' };
      closeSheets();
      setTimeout(() => notify([fake], Date.now()), 400);
    }
  });

  // ---------- relógio ao vivo ----------
  let lastMinute = -1;
  setInterval(() => {
    const now = Date.now();
    if (isActive()) {
      document.querySelectorAll('#mkBody [data-t]').forEach((el) => { el.textContent = fmtCountdown(Number(el.dataset.t) - now); });
      const m = Math.floor(now / 60e3);
      if (m !== lastMinute) { if (lastMinute !== -1) render(); lastMinute = m; }
    }
    checkAlerts();
  }, 1000);
  setInterval(() => refresh(false), REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!cache || Date.now() - (cache.fetchedAt || 0) > 60e3)) refresh(false);
  });
  refresh(false);

  return { render };
}
