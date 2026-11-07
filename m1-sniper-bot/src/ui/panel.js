/*
 * M1 SNIPER BOT — Interface do painel flutuante.
 * Vanilla JS em Shadow DOM (estilos isolados da página). Só lê o estado do controlador
 * e chama suas ações; não contém regra de negócio.
 */
(function (root) {
  'use strict';
  const M = (root.M1 = root.M1 || {});

  const pad = (n) => String(n).padStart(2, '0');
  const hhmm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const hhmmss = (t) => { const d = new Date(t); return `${hhmm(t)}:${pad(d.getSeconds())}`; };
  const fmtMoney = (cur, v) => `${cur} ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pctTxt = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);
  const RESULT_LABEL = { GREEN: 'GREEN', LOSS: 'LOSS', EMPATE: 'EMPATE' };
  const STATUS_LABEL = { NOVO: 'novo', OPERADO: 'operado', IGNORADO: 'ignorado', EXPIRADO: 'expirado', CANCELADO: 'cancelado', NAO_OPERADO: 'não operado' };

  const SKELETON = `
<div class="m1" part="panel">
  <div class="hd" data-drag>
    <span class="dot"></span>
    <span class="title">M1 <i>SNIPER</i> BOT</span>
    <span class="badge" data-k="mode">DEMO</span>
    <span class="mini" data-k="mini"></span>
    <span class="sp"></span>
    <button class="ib" data-a="settings" title="Configurações">⚙</button>
    <button class="ib" data-a="min" title="Minimizar / expandir">–</button>
  </div>
  <div class="body">
    <div class="meta"><span>Ativo: <b data-k="asset">—</b></span><span><b data-k="clock">--:--:--</b> · <span class="cd" data-k="cd">--s</span></span></div>
    <div class="row"><button class="power off" data-a="power">ATIVAR</button><span class="status" data-k="status">DESATIVADO</span></div>
    <div class="stake">
      <label>Valor</label><span data-k="cur">R$</span><input class="inp" data-k="stake" inputmode="decimal" />
      <button class="chip" data-stake="5">5</button><button class="chip" data-stake="10">10</button>
      <button class="chip" data-stake="20">20</button><button class="chip" data-stake="50">50</button>
    </div>
    <div class="cnt">
      <div class="box g"><div class="k">GREEN HOJE</div><div class="v"><span data-k="g">0</span><small>/10</small></div><div class="bar"><span data-k="gbar"></span></div></div>
      <div class="box l"><div class="k">LOSS HOJE</div><div class="v"><span data-k="l">0</span><small>/3</small></div><div class="bar"><span data-k="lbar"></span></div></div>
    </div>
    <div class="an">
      <div class="t"><span class="spin" data-k="spin"></span><span data-k="anT">Desativado</span></div>
      <div class="d" data-k="anD"></div>
      <div class="ind" data-k="ind"></div>
    </div>
    <div class="sig" data-k="sig">
      <div class="top"><span class="dir" data-k="sDir"></span><span class="as" data-k="sAsset"></span>
        <div class="score"><b data-k="sScore"></b><small>/100</small></div></div>
      <div class="when" data-k="sWhen"></div>
      <ul data-k="sWhy"></ul>
      <div class="sug" data-k="sSug"></div>
      <div class="acts" data-k="sActs"></div>
    </div>
    <div class="last"><span>Último sinal: <b data-k="last">—</b></span><span data-k="lastR"></span></div>
    <div class="tabs"><button class="tab sel" data-tab="hist">HISTÓRICO</button><button class="tab" data-tab="sigs">SINAIS</button><button class="tab" data-tab="stats">ESTATÍSTICAS</button></div>
    <div data-k="tabBody"></div>
    <div class="bal"><span title="A Quotex não oferece API pública autorizada para ler saldo">Saldo: <b data-k="bal">—</b></span><span data-k="src"></span></div>
    <div class="msg" data-k="msg"></div>
    <div class="ft">Sem garantia de acerto · execução 100% manual · sem martingale</div>
  </div>
  <div class="set" data-k="set">
    <div class="acts first"><button class="btn sm" data-a="settings">← Voltar ao painel</button></div>
    <h4>FONTE DE DADOS</h4>
    <div class="fld">Fonte<select data-f="source"><option value="binance">Binance (pública)</option><option value="manual">Manual (CSV)</option></select></div>
    <div class="fld" data-only="binance">Par na Binance<select data-f="symbol"></select></div>
    <div class="fld">Nome exibido<input type="text" data-f="assetLabel" placeholder="ex.: BTC/USD" /></div>
    <div class="note warn" data-only="binance">Preço da Binance ≠ preço da Quotex. Pares OTC não têm fonte independente.</div>
    <div data-only="manual">
      <div class="note">Cole candles M1 fechados (mín. 230), um por linha: <code>time,open,high,low,close</code> ou <code>open,high,low,close</code>.</div>
      <textarea data-k="csv" placeholder="time,open,high,low,close"></textarea>
      <div class="acts"><button class="btn sm" data-a="csv">Analisar CSV</button></div>
    </div>
    <h4>FILTROS</h4>
    <div class="fld">Pontuação mínima (50–95)<input type="number" data-f="minScore" min="50" max="95" /></div>
    <div class="fld">ADX mínimo (10–40)<input type="number" data-f="adxMin" min="10" max="40" /></div>
    <div class="fld">Payout da corretora (%)<input type="number" data-f="payoutPct" min="10" max="100" /></div>
    <h4>OPERAÇÃO</h4>
    <div class="fld">Registrar resultado pelo feed automaticamente<input type="checkbox" data-f="autoRecord" /></div>
    <div class="fld">Som ao surgir sinal<input type="checkbox" data-f="sound" /></div>
    <h4>CONTA</h4>
    <div class="val" data-k="val"></div>
    <div class="acts"><button class="btn sm" data-a="demo">Usar DEMO</button><button class="btn sm" data-a="real">Liberar REAL</button></div>
    <h4>INTEGRAÇÕES</h4>
    <div class="conn">
      <div><span class="y">●</span> Candles via Binance pública (fonte independente)</div>
      <div><span class="y">●</span> Entrada manual por CSV</div>
      <div><span class="n">●</span> Gráfico/saldo da Quotex: sem API pública autorizada</div>
      <div><span class="n">●</span> Envio de ordens: desativado por design (manual)</div>
    </div>
    <h4>DADOS</h4>
    <div class="acts"><button class="btn sm" data-a="exportT">Exportar operações</button><button class="btn sm" data-a="exportS">Exportar sinais</button><button class="btn sm ghost" data-a="reset">Limpar</button></div>
  </div>
</div>`;

  function mount(ctl, opts) {
    const o = Object.assign({ hostId: 'm1-sniper-bot-host' }, opts || {});
    let host = document.getElementById(o.hostId);
    if (host) host.remove();
    host = document.createElement('div');
    host.id = o.hostId;
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(M.PANEL_CSS);
      shadow.adoptedStyleSheets = [sheet];
    } catch (_) {
      const st = document.createElement('style');
      st.textContent = M.PANEL_CSS;
      shadow.appendChild(st);
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = SKELETON;
    shadow.appendChild(wrap.firstElementChild);
    const $ = (sel) => shadow.querySelector(sel);
    const K = (k) => shadow.querySelector(`[data-k="${k}"]`);
    const F = (f) => shadow.querySelector(`[data-f="${f}"]`);
    const panel = $('.m1');
    let tab = 'hist';
    let settingsOpen = false;
    let msgTimer = null;
    let lastMsg = '';

    // ---------------- símbolos
    const symSel = F('symbol');
    M.Settings.SYMBOLS.forEach((s) => { const op = document.createElement('option'); op.value = s; op.textContent = s; symSel.appendChild(op); });

    // ---------------- posição / arrastar
    function place() {
      const ui = ctl.state.ui;
      const w = panel.offsetWidth || 292;
      const x = ui.x == null ? 90 : ui.x; // padrão à esquerda: as velas recentes ficam à direita do gráfico
      const y = ui.y == null ? 110 : ui.y;
      panel.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, x))}px`;
      panel.style.top = `${Math.max(0, Math.min(window.innerHeight - 30, y))}px`;
    }
    const drag = $('[data-drag]');
    drag.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = panel.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      drag.setPointerCapture(e.pointerId);
      const move = (ev) => {
        panel.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - dx))}px`;
        panel.style.top = `${Math.max(0, Math.min(window.innerHeight - 30, ev.clientY - dy))}px`;
      };
      const up = () => {
        drag.removeEventListener('pointermove', move);
        drag.removeEventListener('pointerup', up);
        ctl.setUI({ x: parseInt(panel.style.left, 10), y: parseInt(panel.style.top, 10) });
      };
      drag.addEventListener('pointermove', move);
      drag.addEventListener('pointerup', up);
    });
    window.addEventListener('resize', place);

    // ---------------- ações
    function download(name, text) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    shadow.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const a = b.dataset.a;
      const s = ctl.state;
      if (b.dataset.stake) { ctl.setStake(Number(b.dataset.stake)); return; }
      if (b.dataset.tab) { tab = b.dataset.tab; render(s); return; }
      if (b.dataset.res) { ctl.recordResult(b.dataset.res); return; }
      switch (a) {
        case 'min': ctl.setUI({ minimized: !s.ui.minimized }); break;
        case 'settings': settingsOpen = !settingsOpen; if (s.ui.minimized) ctl.setUI({ minimized: false }); render(s); break;
        case 'power': ctl.setActive(!s.active); break;
        case 'enter': ctl.confirmEntry(); break;
        case 'ignore': ctl.ignoreSignal(); break;
        case 'undo': ctl.cancelEntry(); break;
        case 'csv': ctl.loadManualCSV(K('csv').value); break;
        case 'demo': ctl.updateSettings({ accountMode: 'DEMO' }); break;
        case 'real': {
          const v = ctl.realValidation();
          if (!v.ok) { ctl.updateSettings({ accountMode: 'REAL' }); break; }
          if (window.confirm('Liberar modo REAL? Os sinais não garantem acerto e você opera por sua conta e risco.')) ctl.updateSettings({ accountMode: 'REAL' });
          break;
        }
        case 'exportT': download('m1-operacoes.csv', ctl.exportCSV().trades); break;
        case 'exportS': download('m1-sinais.csv', ctl.exportCSV().signals); break;
        case 'reset': if (window.confirm('Apagar histórico de sinais e operações? (contadores do dia e bloqueio continuam)')) ctl.resetHistory(); break;
        default: break;
      }
    });
    const stakeInp = K('stake');
    const commitStake = () => { if (!ctl.setStake(stakeInp.value)) stakeInp.value = ctl.state.settings.stake; };
    stakeInp.addEventListener('change', commitStake);
    stakeInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') stakeInp.blur(); e.stopPropagation(); });
    shadow.addEventListener('keydown', (e) => e.stopPropagation()); // atalhos da página não disparam enquanto digita
    shadow.addEventListener('change', (e) => {
      const f = e.target.dataset.f;
      if (!f) return;
      const el = e.target;
      if (f === 'payoutPct') ctl.updateSettings({ payout: Number(el.value) / 100 });
      else if (el.type === 'checkbox') ctl.updateSettings({ [f]: el.checked });
      else ctl.updateSettings({ [f]: el.value });
    });

    // ---------------- render
    const setText = (k, v) => { const el = K(k); if (el && el.textContent !== v) el.textContent = v; };
    const setVal = (el, v) => { if (el && shadow.activeElement !== el && String(el.value) !== String(v)) el.value = v; };

    function analysisView(s) {
      const lock = M.Risk.lockReason(s.risk);
      const a = s.analysis;
      const n = s.candles.length;
      if (lock) return { t: 'Bloqueado até amanhã', d: lock.reason, run: false };
      if (!s.active) return { t: 'Desativado', d: 'Ative para analisar os candles M1.', run: false };
      if (s.settings.source === 'binance' && s.feed.ok === false) return { t: 'Sem dados do feed', d: s.feed.error, run: false };
      if (s.settings.source === 'manual' && !n) return { t: 'Aguardando dados manuais', d: 'Cole candles em ⚙ → Fonte manual.', run: false };
      if (n < M.Engine.MIN_CANDLES) return { t: 'Carregando histórico…', d: `${n}/${M.Engine.MIN_CANDLES} candles fechados`, run: true };
      if (!a) return { t: 'Analisando…', d: '', run: true };
      const at = a.time ? `candle ${hhmm(a.time)}` : '';
      if (a.signal) return { t: `Sinal ${a.signal} · ${a.score}/100`, d: a.blockedBy || `Confirmado no fechamento do ${at}`, run: true };
      return { t: `Analisando… ${at}`, d: a.rejections[0] ? `Sem entrada: ${a.rejections[0]}` : '', run: true };
    }

    function indicatorChips(s) {
      const el = K('ind');
      const v = s.analysis && s.analysis.snapshot;
      const items = [];
      if (v && Number.isFinite(v.ema9)) {
        items.push([v.ema9 > v.ema21 ? 'up' : 'dn', `EMA9${v.ema9 > v.ema21 ? '>' : '<'}21`]);
        items.push([v.close > v.ema200 ? 'up' : 'dn', `${v.close > v.ema200 ? '↑' : '↓'} EMA200`]);
        items.push([v.rsi > 50 ? 'up' : 'dn', `RSI ${v.rsi.toFixed(0)}`]);
        items.push([v.adx >= s.settings.adxMin ? (v.plusDI > v.minusDI ? 'up' : 'dn') : '', `ADX ${v.adx.toFixed(0)}`]);
        if (Number.isFinite(v.bwRatio)) items.push(['', `BB ${v.bwRatio.toFixed(2)}x`]);
        if (s.analysis.direction) items.push([s.analysis.direction === 'CALL' ? 'up' : 'dn', `Score ${s.analysis.score}`]);
      }
      const sig = items.map((x) => x.join('|')).join(';');
      if (el.dataset.sig === sig) return;
      el.dataset.sig = sig;
      el.textContent = '';
      items.forEach(([cls, txt]) => { const sp = document.createElement('span'); if (cls) sp.className = cls; sp.textContent = txt; el.appendChild(sp); });
    }

    function signalCard(s, t) {
      const card = K('sig');
      const c = s.current;
      if (!c) { card.className = 'sig'; card.dataset.sig = ''; return; }
      card.className = `sig show ${c.direction}`;
      setText('sDir', c.direction === 'CALL' ? '▲ CALL' : '▼ PUT');
      setText('sAsset', c.asset);
      setText('sScore', String(c.score));
      const acts = K('sActs');
      let phase, when;
      if (c.status === 'NOVO') {
        const toOpen = Math.ceil((c.entryTime - t) / 1000);
        const toClose = Math.ceil((c.entryTime + ctl.ENTRY_GRACE_MS - t) / 1000);
        when = toOpen > 0 ? `Entrada no candle ${hhmm(c.entryTime)} · abre em ${toOpen}s` : `Entre AGORA no candle ${hhmm(c.entryTime)} · janela fecha em ${Math.max(0, toClose)}s`;
        phase = 'novo';
      } else if (t < c.expiryTime) {
        when = `Operação em andamento · expira ${hhmm(c.expiryTime)} (${Math.ceil((c.expiryTime - t) / 1000)}s)`;
        phase = 'run';
      } else {
        when = `Expirou ${hhmm(c.expiryTime)} · registre o resultado`;
        phase = 'res';
      }
      setText('sWhen', when);
      const sug = c.status === 'OPERADO' && phase === 'res'
        ? (c.feedResult ? `Feed (${s.settings.source === 'binance' ? 'Binance' : 'manual'}): <b class="${c.feedResult}">${c.feedResult}</b> — confira com o resultado na corretora.` : 'Sem resultado do feed: registre conforme a corretora.')
        : (c.status === 'OPERADO' ? `Valor: ${fmtMoney(s.settings.currency, (s.history.trades.find((x) => x.id === c.id) || {}).stake || s.settings.stake)} · conta ${c.accountMode}` : '');
      const sugEl = K('sSug');
      if (sugEl.dataset.v !== sug) { sugEl.dataset.v = sug; sugEl.innerHTML = sug; } // conteúdo só com valores internos fixos
      const key = `${c.id}|${c.status}|${phase}`;
      if (card.dataset.sig === key) return;
      card.dataset.sig = key;
      const ul = K('sWhy');
      ul.textContent = '';
      c.reasons.slice(0, 5).forEach((r) => { const li = document.createElement('li'); li.textContent = r; ul.appendChild(li); });
      acts.textContent = '';
      const btn = (label, cls, attrs) => {
        const b = document.createElement('button');
        b.className = `btn ${cls || ''}`;
        b.textContent = label;
        Object.entries(attrs).forEach(([k, v]) => { b.dataset[k] = v; });
        acts.appendChild(b);
      };
      if (phase === 'novo') { btn('ENTREI', c.direction === 'CALL' ? 'call' : 'put', { a: 'enter' }); btn('IGNORAR', 'ghost', { a: 'ignore' }); }
      else if (phase === 'run') btn('Não entrei', 'ghost', { a: 'undo' });
      else { btn('GREEN', 'call', { res: 'GREEN' }); btn('LOSS', 'put', { res: 'LOSS' }); btn('EMPATE', 'ghost', { res: 'EMPATE' }); }
    }

    function listRows(rows, empty, cls) {
      const box = document.createElement('div');
      box.className = 'list';
      if (!rows.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = empty; box.appendChild(e); return box; }
      rows.forEach((r) => {
        const it = document.createElement('div');
        it.className = `it${cls ? ' ' + cls : ''}`;
        r.forEach(([txt, cls]) => { const sp = document.createElement('span'); sp.textContent = txt; if (cls) sp.className = cls; it.appendChild(sp); });
        box.appendChild(it);
      });
      return box;
    }

    function tabBody(s) {
      shadow.querySelectorAll('.tab').forEach((b) => b.classList.toggle('sel', b.dataset.tab === tab));
      const body = K('tabBody');
      const h = s.history;
      const sigKey = `${tab}|${h.trades.length}|${h.signals.length}|${JSON.stringify(h.trades.slice(-1))}|${JSON.stringify(h.signals.slice(-1))}|${s.settings.payout}`;
      if (body.dataset.sig === sigKey) return;
      body.dataset.sig = sigKey;
      body.textContent = '';
      if (tab === 'hist') {
        const rows = h.trades.slice(-40).reverse().map((t) => [
          [hhmm(t.entryTime)], [t.asset], [t.direction, t.direction], [String(t.score)],
          [t.result ? RESULT_LABEL[t.result] : 'aberta', `res ${t.result || 'mut'}`],
        ]);
        body.appendChild(listRows(rows, 'Nenhuma operação registrada.'));
      } else if (tab === 'sigs') {
        const rows = h.signals.slice(-40).reverse().map((x) => [
          [hhmm(x.entryTime)], [x.asset], [x.direction, x.direction], [String(x.score)],
          [x.feedResult ? `${x.feedResult === 'GREEN' ? '✓' : x.feedResult === 'LOSS' ? '✗' : '='} ${STATUS_LABEL[x.status] || ''}` : STATUS_LABEL[x.status] || '', `res ${x.feedResult || 'mut'}`],
        ]);
        body.appendChild(listRows(rows, 'Nenhum sinal emitido ainda.'));
      } else {
        const st = ctl.stats();
        const g = document.createElement('div');
        g.className = 'st';
        const cell = (label, val) => { const d = document.createElement('div'); const sp = document.createElement('span'); sp.textContent = label; const b = document.createElement('b'); b.textContent = val; d.append(sp, b); g.appendChild(d); };
        const T = st.trades, S = st.signals;
        cell('Operações', String(T.count)); cell('Acerto ops.', pctTxt(T.winRate)); cell('Drawdown', `${T.maxDrawdown.toFixed(2)} st`);
        cell('Sinais (feed)', String(S.count)); cell('Acerto sinais', pctTxt(S.winRate)); cell('Break-even', pctTxt(T.breakeven));
        body.appendChild(g);
        const rows = Object.entries(T.byAsset).map(([k, v]) => [[k], [`${v.wins}G/${v.losses}L`], [pctTxt(v.winRate)], [`${v.net >= 0 ? '+' : ''}${v.net.toFixed(2)} st`, `res ${v.net >= 0 ? 'GREEN' : 'LOSS'}`]]);
        body.appendChild(listRows(rows, 'Sem resultados por ativo ainda.', 'as'));
      }
    }

    function render(s) {
      if (!s.ready) return;
      const t = o.now ? o.now() : Date.now();
      const lock = M.Risk.lockReason(s.risk);
      panel.classList.toggle('min', !!s.ui.minimized);
      panel.classList.toggle('cfg', settingsOpen);
      place();
      const dot = $('.dot');
      dot.className = `dot${lock ? ' lock' : s.active ? ' on' : ''}`;
      const mode = K('mode');
      mode.textContent = s.settings.accountMode;
      mode.className = `badge${s.settings.accountMode === 'REAL' ? ' real' : ''}`;
      setText('mini', `${s.active ? 'ATIVO' : lock ? 'BLOQ.' : 'OFF'} · ${s.risk.greens}G/${s.risk.losses}L${s.current && s.current.status === 'NOVO' ? ` · ${s.current.direction}!` : ''}`);
      setText('asset', `${s.settings.source === 'manual' ? (s.settings.assetLabel || 'MANUAL') : (s.settings.assetLabel || s.settings.symbol)}`);
      setText('clock', hhmmss(t));
      const secs = 60 - new Date(t).getSeconds();
      setText('cd', `fecha em ${secs}s`);
      const p = $('.power');
      p.textContent = s.active ? 'DESATIVAR' : 'ATIVAR';
      p.className = `power ${s.active ? 'on' : 'off'}${lock && !s.active ? ' locked' : ''}`;
      const stEl = K('status');
      stEl.textContent = lock ? 'BLOQUEADO' : s.active ? 'ATIVO' : 'DESATIVADO';
      stEl.className = `status${lock ? ' lock' : s.active ? ' on' : ''}`;
      setText('cur', s.settings.currency);
      setVal(stakeInp, s.settings.stake);
      shadow.querySelectorAll('[data-stake]').forEach((b) => {
        const v = Number(b.dataset.stake);
        b.classList.toggle('sel', v === s.settings.stake);
        b.classList.toggle('dis', s.risk.stakeCap != null && v > s.risk.stakeCap);
      });
      setText('g', String(s.risk.greens));
      setText('l', String(s.risk.losses));
      K('gbar').style.width = `${Math.min(100, (s.risk.greens / M.Risk.LIMITS.dailyGreens) * 100)}%`;
      K('lbar').style.width = `${Math.min(100, (s.risk.losses / M.Risk.LIMITS.dailyLosses) * 100)}%`;
      const av = analysisView(s);
      setText('anT', av.t);
      setText('anD', av.d || '');
      K('spin').className = `spin${av.run ? ' run' : ''}`;
      indicatorChips(s);
      signalCard(s, t);
      const last = s.history.signals[s.history.signals.length - 1];
      setText('last', last ? `${last.direction} ${last.asset} ${hhmm(last.entryTime)} (${last.score})` : '—');
      setText('lastR', last ? (last.feedResult ? `feed: ${last.feedResult}` : STATUS_LABEL[last.status] || '') : '');
      tabBody(s);
      setText('bal', 'sem integração');
      setText('src', s.settings.source === 'binance'
        ? (s.feed.ok ? `Binance · ${s.feed.lastUpdate ? hhmmss(s.feed.lastUpdate) : ''}` : s.feed.ok === false ? 'Binance · erro' : 'Binance · conectando')
        : 'Fonte manual');
      // mensagem temporária
      const msg = K('msg');
      if (s.message && s.message !== lastMsg) {
        lastMsg = s.message;
        msg.textContent = s.message;
        msg.className = 'msg show';
        clearTimeout(msgTimer);
        msgTimer = setTimeout(() => { msg.className = 'msg'; s.message = ''; lastMsg = ''; }, 6000);
      }
      // configurações
      K('set').className = `set${settingsOpen ? ' show' : ''}`;
      setVal(F('source'), s.settings.source);
      setVal(F('symbol'), s.settings.symbol);
      setVal(F('assetLabel'), s.settings.assetLabel);
      setVal(F('minScore'), s.settings.minScore);
      setVal(F('adxMin'), s.settings.adxMin);
      setVal(F('payoutPct'), Math.round(s.settings.payout * 100));
      F('autoRecord').checked = s.settings.autoRecord;
      F('sound').checked = s.settings.sound;
      shadow.querySelectorAll('[data-only]').forEach((el) => { el.style.display = el.dataset.only === s.settings.source ? '' : 'none'; });
      if (settingsOpen) {
        const v = ctl.realValidation();
        const val = K('val');
        const key = `${v.ok}|${v.decided}|${v.stats.winRate}|${s.settings.accountMode}|${s.settings.payout}`;
        if (val.dataset.sig !== key) {
          val.dataset.sig = key;
          val.textContent = '';
          const l1 = document.createElement('div');
          l1.textContent = `Modo atual: ${s.settings.accountMode}. Exigência para REAL: ${M.Stats.REAL_REQUIREMENTS.minDemoTrades} operações DEMO com acerto ≥ ${pctTxt(v.required)}.`;
          const l2 = document.createElement('div');
          const sp = document.createElement('span');
          sp.className = v.ok ? 'ok' : 'no';
          sp.textContent = v.ok ? 'Validação DEMO concluída.' : v.reason;
          l2.append(`DEMO: ${v.decided} ops · acerto ${pctTxt(v.stats.winRate)} · drawdown ${v.stats.maxDrawdown.toFixed(2)} st. `, sp);
          val.append(l1, l2);
        }
      }
    }

    ctl.subscribe(render);
    render(ctl.state);
    return {
      host,
      shadow,
      toggleVisible() { host.style.display = host.style.display === 'none' ? '' : 'none'; },
    };
  }

  /** Bipe curto (WebAudio) para novo sinal. */
  function beep(direction) {
    try {
      const Ctx = root.AudioContext || root.webkitAudioContext;
      if (!Ctx) return;
      const ac = new Ctx();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.frequency.value = direction === 'CALL' ? 880 : 520;
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.35);
      osc.connect(g); g.connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + 0.4);
      osc.onended = () => ac.close();
    } catch (_) { /* sem áudio */ }
  }

  M.Panel = { mount, beep };
})(typeof globalThis !== 'undefined' ? globalThis : this);
