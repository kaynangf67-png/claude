// ==UserScript==
// @name         Safirion Premium Bot M1
// @namespace    https://safirion.com
// @version      4.0
// @description  7 sinais de confluência + padrões de candle + filtro de tendência M5
// @match        https://*.safirion.com/*
// @match        https://safirion.com/*
// @match        https://*.fintechfuel.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ─── CONFIGURAÇÃO ──────────────────────────────────────────────────────────
  const CFG = {
    amount      : 1000,
    minSignals  : 4,      // mínimo de 4/7 sinais
    emaFast     : 9,
    emaSlow     : 21,
    emaTrend    : 50,     // tendência maior
    rsiPeriod   : 14,
    rsiOB       : 70,
    rsiOS       : 30,
    stochK      : 5,
    stochD      : 3,
    stochOB     : 80,
    stochOS     : 20,
    bbPeriod    : 20,
    bbStd       : 2.0,
    atrPeriod   : 14,
    minAtrRatio : 0.00005,
    autoEntry   : true,
    maxBars     : 200,
    entryDelay  : 600,
  };

  // ─── INDICADORES ───────────────────────────────────────────────────────────

  function ema(arr, p) {
    if (!arr || arr.length === 0) return [];
    const k = 2 / (p + 1);
    const out = [arr[0]];
    for (let i = 1; i < arr.length; i++)
      out.push(arr[i] * k + out[i - 1] * (1 - k));
    return out;
  }

  function sma(arr, p) {
    return arr.map((_, i) => {
      if (i < p - 1) return arr[i];
      return arr.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p;
    });
  }

  function rsi(closes, p) {
    const n = closes.length;
    const out = new Array(n).fill(50);
    if (n <= p) return out;
    let ag = 0, al = 0;
    for (let i = 1; i <= p; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) ag += d; else al -= d;
    }
    ag /= p; al /= p;
    out[p] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    for (let i = p + 1; i < n; i++) {
      const d = closes[i] - closes[i - 1];
      ag = (ag * (p - 1) + Math.max(d, 0)) / p;
      al = (al * (p - 1) + Math.max(-d, 0)) / p;
      out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    }
    return out;
  }

  function stoch(highs, lows, closes, kp, dp) {
    const k = closes.map((_, i) => {
      if (i < kp - 1) return 50;
      const hi = Math.max(...highs.slice(i - kp + 1, i + 1));
      const lo = Math.min(...lows.slice(i - kp + 1, i + 1));
      return hi === lo ? 50 : 100 * (closes[i] - lo) / (hi - lo);
    });
    const d = k.map((_, i) =>
      i < dp - 1 ? k[i] : k.slice(i - dp + 1, i + 1).reduce((a, b) => a + b, 0) / dp
    );
    return { k, d };
  }

  function bollinger(closes, p, mult) {
    return closes.map((_, i) => {
      const sl = closes.slice(Math.max(0, i - p + 1), i + 1);
      const m  = sl.reduce((a, b) => a + b, 0) / sl.length;
      const sd = sl.length < 2 ? 0 : Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / sl.length);
      return { upper: m + mult * sd, mid: m, lower: m - mult * sd };
    });
  }

  function atr(highs, lows, closes, p) {
    const tr = closes.map((c, i) =>
      i === 0 ? highs[0] - lows[0]
              : Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1]))
    );
    return ema(tr, p);
  }

  // ─── PADRÕES DE CANDLE ─────────────────────────────────────────────────────

  function candlePatterns(opens, highs, lows, closes, i) {
    const o = opens[i], h = highs[i], l = lows[i], c = closes[i];
    const body  = Math.abs(c - o);
    const range = h - l;
    const upBar = c > o;

    const o1 = opens[i-1], h1 = highs[i-1], l1 = lows[i-1], c1 = closes[i-1];
    const body1 = Math.abs(c1 - o1);
    const up1   = c1 > o1;

    let bull = 0, bear = 0;

    // Martelo (hammer) — corpo pequeno no topo, shadow longa embaixo
    if (upBar && range > 0) {
      const lowerShadow = o - l;
      if (lowerShadow > body * 2 && body / range < 0.4) bull++;
    }

    // Martelo invertido
    if (!upBar && range > 0) {
      const upperShadow = h - o;
      if (upperShadow > body * 2 && body / range < 0.4) bear++;
    }

    // Engulfing bullish
    if (i > 0 && !up1 && upBar && c > o1 && o < c1 && body > body1) bull++;

    // Engulfing bearish
    if (i > 0 && up1 && !upBar && c < o1 && o > c1 && body > body1) bear++;

    // Doji após tendência (reversão)
    const isDoji = range > 0 && body / range < 0.15;
    if (isDoji && i >= 2) {
      const trend3 = closes[i-2] - closes[i-3 >= 0 ? i-3 : 0];
      if (trend3 < 0) bull++; // doji após queda = potencial reversão
      if (trend3 > 0) bear++; // doji após alta = potencial reversão
    }

    // Pin bar
    if (range > 0 && body / range < 0.3) {
      const lowerSh = Math.min(o, c) - l;
      const upperSh = h - Math.max(o, c);
      if (lowerSh > upperSh * 2 && lowerSh > range * 0.5) bull++;
      if (upperSh > lowerSh * 2 && upperSh > range * 0.5) bear++;
    }

    return { bull, bear };
  }

  // ─── ANÁLISE PRINCIPAL ─────────────────────────────────────────────────────

  function analyze(opens, highs, lows, closes) {
    const n = closes.length;
    const need = CFG.emaTrend + 5;
    if (n < need)
      return { signal: null, score: 0, reasons: [`acumulando ${n}/${need} velas`] };

    const ef  = ema(closes, CFG.emaFast);
    const es  = ema(closes, CFG.emaSlow);
    const et  = ema(closes, CFG.emaTrend);
    const rv  = rsi(closes, CFG.rsiPeriod);
    const { k: kv, d: dv } = stoch(highs, lows, closes, CFG.stochK, CFG.stochD);
    const bb  = bollinger(closes, CFG.bbPeriod, CFG.bbStd);
    const av  = atr(highs, lows, closes, CFG.atrPeriod);

    const i = n - 2;   // vela fechada mais recente
    const price = closes[i];
    const a = av[i];

    // Filtro de volatilidade
    if (price > 0 && a / price < CFG.minAtrRatio)
      return { signal: null, score: 0, reasons: ['mercado lateral — ATR abaixo do mínimo'] };

    let calls = 0, puts = 0;
    const rc = [], rp = [];

    // ── Sinal 1: EMA 9/21 crossover / alinhamento ──────────────────
    const dp = ef[i-3] - es[i-3], dc = ef[i] - es[i];
    if (dp < 0 && dc > 0)                              { calls++; rc.push('EMA 9/21 cruzou ↑'); }
    else if (dp > 0 && dc < 0)                        { puts++;  rp.push('EMA 9/21 cruzou ↓'); }
    else if (ef[i] > es[i] && ef[i] > ef[i-3])        { calls++; rc.push('EMA9 subindo acima EMA21'); }
    else if (ef[i] < es[i] && ef[i] < ef[i-3])        { puts++;  rp.push('EMA9 caindo abaixo EMA21'); }

    // ── Sinal 2: Filtro de tendência EMA50 ─────────────────────────
    if (ef[i] > et[i] && es[i] > et[i])   { calls++; rc.push('Tendência altista (EMA50)'); }
    else if (ef[i] < et[i] && es[i] < et[i]) { puts++; rp.push('Tendência baixista (EMA50)'); }

    // ── Sinal 3: RSI zona extrema (janela 3 velas) ─────────────────
    const rSlice = rv.slice(Math.max(0, i-2), i+1);
    const rMin = Math.min(...rSlice), rMax = Math.max(...rSlice);
    if (rMin < CFG.rsiOS)  { calls++; rc.push(`RSI sobrevendido (${rMin.toFixed(0)})`); }
    else if (rMax > CFG.rsiOB) { puts++; rp.push(`RSI sobrecomprado (${rMax.toFixed(0)})`); }

    // ── Sinal 4: Estocástico cruzamento saindo de zona ─────────────
    let crossUp = false, crossDown = false;
    for (let j = Math.max(1, i-4); j <= i; j++) {
      if (kv[j-1] <= dv[j-1] && kv[j] > dv[j]) crossUp   = true;
      if (kv[j-1] >= dv[j-1] && kv[j] < dv[j]) crossDown = true;
    }
    const dOld = dv.slice(Math.max(0, i-7), Math.max(0, i-2));
    if (crossUp   && dOld.some(v => v < CFG.stochOS + 20)) { calls++; rc.push(`Estoc cruzou ↑ OS (${dv[i].toFixed(0)})`); }
    if (crossDown && dOld.some(v => v > CFG.stochOB - 20)) { puts++;  rp.push(`Estoc cruzou ↓ OB (${dv[i].toFixed(0)})`); }

    // ── Sinal 5: Bollinger Bands ────────────────────────────────────
    const nearL = price <= bb[i].lower + a * 0.4;
    const nearH = price >= bb[i].upper - a * 0.4;
    const win = closes.slice(Math.max(0, i-4), i+1);
    const touchL = win.some((c, j) => { const idx=i-4+j; return idx>=0 && c<=bb[idx].lower; });
    const touchH = win.some((c, j) => { const idx=i-4+j; return idx>=0 && c>=bb[idx].upper; });
    if (nearL || touchL) { calls++; rc.push('Preço na BB inferior'); }
    else if (nearH || touchH) { puts++; rp.push('Preço na BB superior'); }

    // ── Sinal 6: Momentum preço vs EMA9 ────────────────────────────
    if      (price > ef[i] && closes[i-3] < ef[i-3]) { calls++; rc.push('Preço cruzou ↑ EMA9'); }
    else if (price < ef[i] && closes[i-3] > ef[i-3]) { puts++;  rp.push('Preço cruzou ↓ EMA9'); }
    else if (price > ef[i] && ef[i] > es[i])          { calls++; rc.push('Preço acima das EMAs'); }
    else if (price < ef[i] && ef[i] < es[i])          { puts++;  rp.push('Preço abaixo das EMAs'); }

    // ── Sinal 7: Padrão de candle ───────────────────────────────────
    if (i >= 1) {
      const { bull: pb, bear: pr } = candlePatterns(opens, highs, lows, closes, i);
      if (pb > 0) { calls++; rc.push(`Padrão bullish (${pb})`); }
      if (pr > 0) { puts++;  rp.push(`Padrão bearish (${pr})`); }
    }

    if (calls >= CFG.minSignals && calls > puts) return { signal: 'ACIMA',  score: calls, total: 7, reasons: rc };
    if (puts  >= CFG.minSignals && puts > calls) return { signal: 'ABAIXO', score: puts,  total: 7, reasons: rp };
    return { signal: null, score: Math.max(calls, puts), total: 7, reasons: [...rc, ...rp] };
  }

  // ─── ACUMULAÇÃO DE DADOS ───────────────────────────────────────────────────

  const bars = { opens: [], highs: [], lows: [], closes: [] };
  let pending = null;
  let curBar  = null;
  let lastSignalTime = 0;

  function pushBar(o, h, l, c) {
    if (!o || !h || !l || !c || isNaN(o+h+l+c)) return;
    bars.opens.push(o);  bars.highs.push(h);
    bars.lows.push(l);   bars.closes.push(c);
    if (bars.closes.length > CFG.maxBars) {
      bars.opens.shift(); bars.highs.shift();
      bars.lows.shift();  bars.closes.shift();
    }
    onBarClose();

    if (pending && CFG.autoEntry) {
      const now = Date.now();
      if (now - lastSignalTime > 60_000) { // anti-spam: 1 entrada por minuto no mínimo
        lastSignalTime = now;
        setTimeout(() => enter(pending), CFG.entryDelay);
        log(`>>> ENTRADA ${pending}`);
        pending = null;
      }
    }
  }

  function onBarClose() {
    const n = bars.closes.length;
    const result = analyze(bars.opens, bars.highs, bars.lows, bars.closes);
    const rsiArr = rsi(bars.closes, CFG.rsiPeriod);
    const { k: kArr } = stoch(bars.highs, bars.lows, bars.closes, CFG.stochK, CFG.stochD);
    updatePanel(result, n >= 2 ? rsiArr[n-2] : null, n >= 2 ? kArr[n-2] : null, n);

    log(`[${n}v] ${result.signal || '—'} ${result.score}/${result.total || 7} | ${result.reasons[0] || ''}`);

    if (result.signal) {
      pending = result.signal;
      setStatus(`⏳ ${result.signal} na próxima vela`);
    } else {
      pending = null;
    }
  }

  function tickPrice(price) {
    if (!price || !isFinite(price) || price <= 0) return;
    const now = new Date();
    const min = now.getHours() * 60 + now.getMinutes();

    if (!curBar) {
      curBar = { open: price, high: price, low: price, close: price, min };
      return;
    }
    if (min !== curBar.min) {
      pushBar(curBar.open, curBar.high, curBar.low, curBar.close);
      curBar = { open: price, high: price, low: price, close: price, min };
    } else {
      curBar.high  = Math.max(curBar.high, price);
      curBar.low   = Math.min(curBar.low, price);
      curBar.close = price;
    }
  }

  // ─── CAPTURA DE DADOS ──────────────────────────────────────────────────────

  // WebSocket
  const _WS = window.WebSocket;
  window.WebSocket = function (...a) {
    const ws = new _WS(...a);
    ws.addEventListener('message', ev => {
      try {
        const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        processMsg(d);
      } catch (_) {}
    });
    return ws;
  };
  Object.assign(window.WebSocket, _WS);

  function processMsg(d) {
    if (!d || typeof d !== 'object') return;

    // candle fechada
    const c = extractCandle(d);
    if (c && c.closed) { pushBar(c.o, c.h, c.l, c.c); return; }

    // tick de preço
    const p = extractPrice(d);
    if (p) tickPrice(p);
  }

  function extractCandle(d) {
    // { o, h, l, c, x? } — formato binance-like
    if (d.o !== undefined && d.h !== undefined && d.l !== undefined && d.c !== undefined)
      return { o:+d.o, h:+d.h, l:+d.l, c:+d.c, closed: d.x===true || d.isClosed===true };

    // { type:'candle', data:{open,high,low,close} }
    if (d.type === 'candle' || d.type === 'ohlc') {
      const x = d.data || d.candle || d;
      return { o:+(x.open||x.o), h:+(x.high||x.h), l:+(x.low||x.l), c:+(x.close||x.c), closed:x.isClosed!==false };
    }

    // { candle: {open,high,low,close} }
    if (d.candle && d.candle.close !== undefined)
      return { o:+d.candle.open, h:+d.candle.high, l:+d.candle.low, c:+d.candle.close, closed:true };

    // array [ts, o, h, l, c]
    if (Array.isArray(d) && d.length >= 5 && typeof d[1] === 'number')
      return { o:d[1], h:d[2], l:d[3], c:d[4], closed:true };

    // { k: { o,h,l,c,x } } — formato binance stream
    if (d.k && d.k.c !== undefined)
      return { o:+d.k.o, h:+d.k.h, l:+d.k.l, c:+d.k.c, closed:d.k.x===true };

    return null;
  }

  function extractPrice(d) {
    if (typeof d.price  === 'number') return d.price;
    if (typeof d.ask    === 'number') return d.ask;
    if (typeof d.bid    === 'number') return d.bid;
    if (typeof d.last   === 'number') return d.last;
    if (typeof d.close  === 'number') return d.close;
    if (typeof d.p      === 'number') return d.p;
    if (typeof d.rate   === 'number') return d.rate;
    // string num
    for (const key of ['price','ask','bid','last','close','rate','p']) {
      if (typeof d[key] === 'string') {
        const n = parseFloat(d[key]);
        if (n > 0 && isFinite(n)) return n;
      }
    }
    return null;
  }

  // fetch() — captura histórico
  const _fetch = window.fetch;
  window.fetch = async function (...a) {
    const res = await _fetch(...a);
    const url = (typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || '');
    if (bars.closes.length < 10 && /candle|ohlc|history|bars|kline|quote/i.test(url)) {
      try {
        const data = await res.clone().json();
        const arr = Array.isArray(data) ? data : (data.data || data.candles || data.bars || data.result || []);
        if (arr.length > 5) {
          arr.slice(-CFG.maxBars).forEach(item => {
            const c = extractCandle(item) || extractCandle(item.data || {});
            if (c && c.o && c.c) {
              bars.opens.push(c.o); bars.highs.push(c.h);
              bars.lows.push(c.l);  bars.closes.push(c.c);
            }
          });
          if (bars.closes.length > CFG.maxBars) {
            const cut = bars.closes.length - CFG.maxBars;
            ['opens','highs','lows','closes'].forEach(k => bars[k].splice(0, cut));
          }
          if (bars.closes.length > 5) {
            log(`Histórico: ${bars.closes.length} velas carregadas via fetch`);
            onBarClose();
          }
        }
      } catch (_) {}
    }
    return res;
  };

  // DOM polling — fallback garantido
  function readDomPrice() {
    // seletores específicos Safirion/FintechFuel
    const candidates = [
      '.ask-price span', '.bid-price span',
      '[class*="current-price"]', '[class*="currentPrice"]',
      '[class*="ask"] span', '[class*="bid"] span',
      '.price-value', '[class*="price-value"]',
      '[class*="last-price"]',
    ];
    for (const sel of candidates) {
      for (const el of document.querySelectorAll(sel)) {
        const n = parseFloat(el.textContent.replace(/[^0-9.]/g, ''));
        if (n > 0 && isFinite(n)) return n;
      }
    }
    // busca textual "ask X.XXXXX"
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.nodeValue || '';
      const m = t.match(/(?:^|\s)([\d]{1,5}[.,][\d]{2,8})(?:\s|$)/);
      if (m) {
        const n = parseFloat(m[1].replace(',', '.'));
        if (n > 0.00001 && n < 1000000 && isFinite(n)) return n;
      }
    }
    return null;
  }

  setInterval(() => {
    const p = readDomPrice();
    if (p) tickPrice(p);
  }, 400);

  // ─── ENTRADA ───────────────────────────────────────────────────────────────

  function findButton(dir) {
    const up   = ['ACIMA','CIMA','CALL','UP','COMPRAR'];
    const down = ['ABAIXO','BAIXO','PUT','DOWN','VENDER'];
    const labels = dir === 'ACIMA' ? up : down;

    for (const lbl of labels) {
      for (const el of document.querySelectorAll('button,[role="button"]')) {
        if (el.textContent.trim().toUpperCase().includes(lbl)) return el;
      }
    }
    // por cor
    for (const el of document.querySelectorAll('button,[role="button"]')) {
      const bg = window.getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!m) continue;
      const [, r, g, b] = m.map(Number);
      if (dir === 'ACIMA'  && g > 130 && r < 100) return el;
      if (dir === 'ABAIXO' && r > 130 && g < 100) return el;
    }
    return null;
  }

  function setAmount(val) {
    for (const inp of document.querySelectorAll('input')) {
      const hint = (inp.placeholder+inp.name+inp.id+(inp.getAttribute('aria-label')||'')).toLowerCase();
      if (/invest|valor|amount|stake|entry/.test(hint) || ['1000','500','100'].includes(inp.value)) {
        try {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, String(val));
          ['input','change','blur'].forEach(ev => inp.dispatchEvent(new Event(ev, {bubbles:true})));
          return true;
        } catch (_) {}
      }
    }
    return false;
  }

  function enter(dir) {
    setAmount(CFG.amount);
    setTimeout(() => {
      const btn = findButton(dir);
      if (!btn) { log(`⚠ botão ${dir} não encontrado`); setStatus('⚠ botão não encontrado'); return; }
      btn.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
      btn.dispatchEvent(new MouseEvent('mouseup',   {bubbles:true}));
      btn.click();
      log(`✓ ENTRADA ${dir} $${CFG.amount}`);
      setStatus(`✓ ${dir}`);
      setTimeout(() => setStatus('ativo'), 6000);
    }, 300);
  }

  // ─── PAINEL ────────────────────────────────────────────────────────────────

  function buildPanel() {
    if (document.getElementById('sp-panel')) return;
    const p = document.createElement('div');
    p.id = 'sp-panel';
    p.innerHTML = `
      <style>
        #sp-panel {
          position:fixed;bottom:80px;right:20px;width:280px;
          background:#0b0e1a;border:1px solid #1e2336;border-radius:14px;
          padding:14px 16px;font-family:'Segoe UI',monospace,sans-serif;
          font-size:12px;color:#c4c9d8;z-index:99999;
          box-shadow:0 8px 40px rgba(0,0,0,.85);user-select:none;cursor:move;
        }
        #sp-panel .hdr {display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
        #sp-panel .title {font-size:13px;font-weight:700;color:#fff}
        #sp-panel .status {font-size:10px;color:#4ade80}
        #sp-signal {
          text-align:center;padding:10px 8px;border-radius:10px;
          background:#141824;font-size:18px;font-weight:800;
          color:#6b7280;margin-bottom:10px;letter-spacing:2px;
          border:1px solid #1e2336;transition:all .3s;
        }
        #sp-panel .stats {display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:10px;text-align:center}
        #sp-panel .stat-lbl {font-size:9px;color:#6b7280;margin-bottom:2px}
        #sp-panel .stat-val {font-size:12px;font-weight:700;color:#fff}
        #sp-reasons {font-size:10px;color:#6b7280;line-height:1.6;min-height:30px}
        #sp-panel .footer {
          display:flex;justify-content:space-between;align-items:center;
          margin-top:10px;padding-top:10px;border-top:1px solid #1e2336;
        }
        #sp-log {margin-top:8px;font-size:9px;color:#4b5563;max-height:52px;overflow:hidden;line-height:1.5}
        #sp-panel label {display:flex;align-items:center;gap:5px;cursor:pointer}
        #sp-panel input[type=checkbox] {cursor:pointer;accent-color:#4ade80}
      </style>
      <div class="hdr">
        <span class="title">⚡ Premium Bot M1</span>
        <span id="sp-status" class="status">iniciando...</span>
      </div>
      <div id="sp-signal">— AGUARDANDO —</div>
      <div class="stats">
        <div><div class="stat-lbl">RSI</div><div id="sp-rsi" class="stat-val">—</div></div>
        <div><div class="stat-lbl">STOCH</div><div id="sp-stoch" class="stat-val">—</div></div>
        <div><div class="stat-lbl">SCORE</div><div id="sp-score" class="stat-val">0/7</div></div>
        <div><div class="stat-lbl">VELAS</div><div id="sp-bars" class="stat-val">0</div></div>
      </div>
      <div id="sp-reasons"></div>
      <div class="footer">
        <span id="sp-timer" style="font-size:11px;font-weight:700;color:#fff">--s</span>
        <label>
          <input type="checkbox" id="sp-auto" checked>
          <span style="font-size:10px">Auto $${CFG.amount}</span>
        </label>
        <span id="sp-price" style="font-size:10px;color:#9ca3af">—</span>
      </div>
      <div id="sp-log"></div>
    `;
    document.body.appendChild(p);

    document.getElementById('sp-auto').addEventListener('change', function () {
      CFG.autoEntry = this.checked;
    });

    // drag
    let drag=false, dx=0, dy=0;
    p.addEventListener('mousedown', e => { drag=true; dx=e.clientX-p.offsetLeft; dy=e.clientY-p.offsetTop; });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      Object.assign(p.style, {left:e.clientX-dx+'px', top:e.clientY-dy+'px', right:'auto', bottom:'auto'});
    });
    document.addEventListener('mouseup', () => drag=false);
  }

  function updatePanel(result, rsiCur, stochCur, barCount) {
    const $ = id => document.getElementById(id);
    const sig = $('sp-signal');
    if (!sig) return;

    if ($('sp-rsi'))   $('sp-rsi').textContent   = rsiCur   != null ? rsiCur.toFixed(1)   : '—';
    if ($('sp-stoch')) $('sp-stoch').textContent = stochCur != null ? stochCur.toFixed(1) : '—';
    if ($('sp-score')) $('sp-score').textContent = `${result.score}/${result.total||7}`;
    if ($('sp-bars'))  $('sp-bars').textContent  = barCount || bars.closes.length;
    if ($('sp-reasons')) $('sp-reasons').innerHTML = result.reasons.slice(0,4).map(r=>`· ${r}`).join('<br>');

    if (result.signal === 'ACIMA') {
      sig.textContent = '⬆  ACIMA';
      sig.style.cssText = 'text-align:center;padding:10px 8px;border-radius:10px;background:#071f10;color:#22c55e;font-size:18px;font-weight:800;margin-bottom:10px;letter-spacing:2px;border:2px solid #16a34a;box-shadow:0 0 20px rgba(34,197,94,.3)';
    } else if (result.signal === 'ABAIXO') {
      sig.textContent = '⬇  ABAIXO';
      sig.style.cssText = 'text-align:center;padding:10px 8px;border-radius:10px;background:#1f0707;color:#ef4444;font-size:18px;font-weight:800;margin-bottom:10px;letter-spacing:2px;border:2px solid #b91c1c;box-shadow:0 0 20px rgba(239,68,68,.3)';
    } else {
      sig.textContent = '— AGUARDANDO —';
      sig.style.cssText = 'text-align:center;padding:10px 8px;border-radius:10px;background:#141824;color:#6b7280;font-size:18px;font-weight:800;margin-bottom:10px;letter-spacing:2px;border:1px solid #1e2336';
    }
  }

  function setStatus(msg) {
    const el = document.getElementById('sp-status');
    if (el) el.textContent = msg;
  }

  function log(msg) {
    console.log('[PremiumBot]', msg);
    const el = document.getElementById('sp-log');
    if (!el) return;
    const t = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    el.innerHTML = `[${t}] ${msg}<br>` + el.innerHTML;
    el.innerHTML = el.innerHTML.split('<br>').slice(0,6).join('<br>');
  }

  // mostra preço atual
  setInterval(() => {
    const el = document.getElementById('sp-price');
    if (el && curBar) el.textContent = curBar.close.toFixed(5);
    const t = document.getElementById('sp-timer');
    if (t) t.textContent = (60 - new Date().getSeconds()) + 's';
  }, 500);

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    buildPanel();
    setStatus('ativo');
    log('Premium Bot v4 iniciado');
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

})();
