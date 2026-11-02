// ==UserScript==
// @name         Safirion Auto-Bot M1
// @namespace    https://safirion.com
// @version      3.0
// @description  Indicadores M1 completos + entrada automática ACIMA/ABAIXO
// @author       Bot
// @match        https://*.safirion.com/*
// @match        https://safirion.com/*
// @match        https://*.fintechfuel.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  const CFG = {
    amount      : 1000,
    minSignals  : 3,
    emaFast     : 9,
    emaSlow     : 21,
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
    minAtrRatio : 0.0001,   // relaxado para crypto/OTC
    autoEntry   : true,
    maxBars     : 150,
    entryDelay  : 800,      // ms após vela fechar
  };

  // ─── INDICADORES ───────────────────────────────────────────────────────────

  function ema(arr, p) {
    const k = 2 / (p + 1), out = [arr[0]];
    for (let i = 1; i < arr.length; i++)
      out.push(arr[i] * k + out[i - 1] * (1 - k));
    return out;
  }

  function rsi(closes, p) {
    const n = closes.length, out = new Array(n).fill(50);
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
      const hs = highs.slice(i - kp + 1, i + 1), ls = lows.slice(i - kp + 1, i + 1);
      const hi = Math.max(...hs), lo = Math.min(...ls);
      return hi === lo ? 50 : 100 * (closes[i] - lo) / (hi - lo);
    });
    const d = k.map((_, i) =>
      i < dp - 1 ? k[i] : k.slice(i - dp + 1, i + 1).reduce((a, b) => a + b, 0) / dp
    );
    return { k, d };
  }

  function bollinger(closes, p, mult) {
    const upper = [], mid = [], lower = [];
    closes.forEach((_, i) => {
      const sl = closes.slice(Math.max(0, i - p + 1), i + 1);
      const m  = sl.reduce((a, b) => a + b, 0) / sl.length;
      const sd = sl.length < p ? 0 : Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / sl.length);
      upper.push(m + mult * sd); mid.push(m); lower.push(m - mult * sd);
    });
    return { upper, mid, lower };
  }

  function atr(highs, lows, closes, p) {
    const tr = closes.map((c, i) =>
      i === 0 ? highs[0] - lows[0]
              : Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]))
    );
    return ema(tr, p);
  }

  function analyze(highs, lows, closes) {
    const n = closes.length;
    if (n < CFG.emaSlow + 10) return { signal: null, score: 0, reasons: [`acumulando ${n}/${CFG.emaSlow + 10}`] };

    const ef = ema(closes, CFG.emaFast);
    const es = ema(closes, CFG.emaSlow);
    const rv = rsi(closes, CFG.rsiPeriod);
    const { k: kv, d: dv } = stoch(highs, lows, closes, CFG.stochK, CFG.stochD);
    const { upper: bbU, lower: bbL } = bollinger(closes, CFG.bbPeriod, CFG.bbStd);
    const av = atr(highs, lows, closes, CFG.atrPeriod);

    const i = n - 2;
    const price = closes[i];
    const a = av[i];

    if (price > 0 && a / price < CFG.minAtrRatio)
      return { signal: null, score: 0, reasons: ['mercado lateral (ATR baixo)'] };

    let calls = 0, puts = 0;
    const rc = [], rp = [];

    // 1. EMA crossover / alinhamento
    const dp = ef[i-3] - es[i-3], dc = ef[i] - es[i];
    if      (dp < 0 && dc > 0)                              { calls++; rc.push('EMA cruzou ↑'); }
    else if (dp > 0 && dc < 0)                              { puts++;  rp.push('EMA cruzou ↓'); }
    else if (ef[i] > es[i] && ef[i] > ef[i-3])             { calls++; rc.push('EMA9 subindo acima EMA21'); }
    else if (ef[i] < es[i] && ef[i] < ef[i-3])             { puts++;  rp.push('EMA9 caindo abaixo EMA21'); }

    // 2. RSI zona (janela 3 velas)
    const rSlice = rv.slice(Math.max(0, i-2), i+1);
    const rMin = Math.min(...rSlice), rMax = Math.max(...rSlice);
    if      (rMin < CFG.rsiOS) { calls++; rc.push(`RSI sobrevendido ${rMin.toFixed(0)}`); }
    else if (rMax > CFG.rsiOB) { puts++;  rp.push(`RSI sobrecomprado ${rMax.toFixed(0)}`); }

    // 3. Estocástico saindo de zona extrema
    let crossUp = false, crossDown = false;
    for (let j = Math.max(1, i-4); j <= i; j++) {
      if (kv[j-1] <= dv[j-1] && kv[j] > dv[j]) crossUp   = true;
      if (kv[j-1] >= dv[j-1] && kv[j] < dv[j]) crossDown = true;
    }
    const dOld = dv.slice(Math.max(0, i-7), Math.max(0, i-2));
    if (crossUp   && dOld.some(v => v < CFG.stochOS + 20)) { calls++; rc.push('Estoc cruzou ↑ de OS'); }
    if (crossDown && dOld.some(v => v > CFG.stochOB - 20)) { puts++;  rp.push('Estoc cruzou ↓ de OB'); }

    // 4. Bollinger Bands
    const nearL = price <= bbL[i] + a * 0.3, nearH = price >= bbU[i] - a * 0.3;
    const winSlice = closes.slice(Math.max(0, i-4), i+1);
    const touchL = winSlice.some((c, j) => { const idx = i-4+j; return idx >= 0 && c <= bbL[idx]; });
    const touchH = winSlice.some((c, j) => { const idx = i-4+j; return idx >= 0 && c >= bbU[idx]; });
    if      (nearL || touchL) { calls++; rc.push('Preço na BB inferior'); }
    else if (nearH || touchH) { puts++;  rp.push('Preço na BB superior'); }

    // 5. Momentum preço vs EMA9
    if      (price > ef[i] && closes[i-3] < ef[i-3]) { calls++; rc.push('Preço cruzou ↑ EMA9'); }
    else if (price < ef[i] && closes[i-3] > ef[i-3]) { puts++;  rp.push('Preço cruzou ↓ EMA9'); }
    else if (price > ef[i] && ef[i] > es[i])          { calls++; rc.push('Preço acima das EMAs'); }
    else if (price < ef[i] && ef[i] < es[i])          { puts++;  rp.push('Preço abaixo das EMAs'); }

    if (calls >= CFG.minSignals && calls > puts) return { signal: 'ACIMA',  score: calls, reasons: rc };
    if (puts  >= CFG.minSignals && puts > calls) return { signal: 'ABAIXO', score: puts,  reasons: rp };
    return { signal: null, score: Math.max(calls, puts), reasons: [...rc, ...rp] };
  }

  // ─── ESTADO ────────────────────────────────────────────────────────────────

  const bars   = { opens: [], highs: [], lows: [], closes: [] };
  let pending  = null;   // sinal aguardando próxima vela
  let lastMin  = -1;     // minuto da última vela registrada

  // vela M1 sendo construída tick a tick
  let curBar   = null;   // { open, high, low, close, min }

  function pushBar(o, h, l, c) {
    bars.opens.push(o);  bars.highs.push(h);
    bars.lows.push(l);   bars.closes.push(c);
    if (bars.closes.length > CFG.maxBars) {
      bars.opens.shift(); bars.highs.shift();
      bars.lows.shift();  bars.closes.shift();
    }
    onBarClose();
  }

  function onBarClose() {
    const n = bars.closes.length;
    const result = analyze(bars.highs, bars.lows, bars.closes);
    const rsiArr = rsi(bars.closes, CFG.rsiPeriod);
    const { k: kArr } = stoch(bars.highs, bars.lows, bars.closes, CFG.stochK, CFG.stochD);
    updatePanel(result, rsiArr[n-2], kArr[n-2]);
    log(`${n} velas | Sinal: ${result.signal || '—'} (${result.score}/5) | ${result.reasons[0] || ''}`);

    if (result.signal) {
      pending = result.signal;
      setStatus(`⏳ ${result.signal} na próxima vela`);
    } else {
      pending = null;
    }
  }

  // ─── COLETA DE PREÇO ───────────────────────────────────────────────────────
  // Estratégia 1: WebSocket interception
  // Estratégia 2: fetch() interception (histórico)
  // Estratégia 3: DOM polling tick-a-tick → velas M1 sintéticas

  // Estratégia 1 — WebSocket
  const _WS = window.WebSocket;
  window.WebSocket = function (...a) {
    const ws = new _WS(...a);
    ws.addEventListener('message', ev => {
      try { handleWsMsg(JSON.parse(ev.data)); } catch (_) {}
    });
    return ws;
  };
  Object.assign(window.WebSocket, _WS);

  function handleWsMsg(d) {
    const c = extractOhlc(d);
    if (!c) return;

    if (c.closed) {
      // vela fechada recebida diretamente
      pushBar(c.open, c.high, c.low, c.close);
      // executa entrada pendente
      if (pending && CFG.autoEntry) {
        setTimeout(() => enter(pending), CFG.entryDelay);
        log(`>>> ENTRADA ${pending}`);
        pending = null;
      }
    } else {
      // tick parcial — acumula em curBar
      tickPrice(c.close || c.price || c.last);
    }
  }

  function extractOhlc(d) {
    // formato { t, o, h, l, c } ou variantes
    if (d && d.o !== undefined && d.h !== undefined)
      return { open: +d.o, high: +d.h, low: +d.l, close: +d.c, closed: d.x === true || d.isClosed === true };
    if (d && d.type === 'candle') {
      const c = d.data || d.candle || d;
      return { open: +c.open, high: +c.high, low: +c.low, close: +c.close, closed: c.isClosed !== false };
    }
    if (d && d.candle)
      return { open: +d.candle.open, high: +d.candle.high, low: +d.candle.low, close: +d.candle.close, closed: true };
    if (d && d.price !== undefined)
      return { open: null, high: null, low: null, close: +d.price, closed: false };
    if (d && d.last !== undefined)
      return { open: null, high: null, low: null, close: +d.last, closed: false };
    // array [timestamp, open, high, low, close]
    if (Array.isArray(d) && d.length >= 5 && typeof d[1] === 'number')
      return { open: d[1], high: d[2], low: d[3], close: d[4], closed: true };
    return null;
  }

  // Estratégia 2 — fetch histórico
  const _fetch = window.fetch;
  window.fetch = async function (...a) {
    const res = await _fetch(...a);
    const url = typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || '';
    if (/candle|ohlc|history|bars|kline/i.test(url)) {
      res.clone().json().then(data => {
        const arr = Array.isArray(data) ? data : data.data || data.candles || data.bars || [];
        if (arr.length > 5) loadHistory(arr);
      }).catch(() => {});
    }
    return res;
  };

  function loadHistory(arr) {
    if (bars.closes.length > 10) return; // já tem dados
    arr.slice(-CFG.maxBars).forEach(item => {
      const c = extractOhlc(item) || extractOhlc(item.data);
      if (c && c.closed) pushBarSilent(c.open, c.high, c.low, c.close);
    });
    if (bars.closes.length > 0) {
      log(`Histórico carregado: ${bars.closes.length} velas`);
      onBarClose();
    }
  }

  function pushBarSilent(o, h, l, c) {
    bars.opens.push(o); bars.highs.push(h); bars.lows.push(l); bars.closes.push(c);
    if (bars.closes.length > CFG.maxBars) {
      bars.opens.shift(); bars.highs.shift(); bars.lows.shift(); bars.closes.shift();
    }
  }

  // Estratégia 3 — DOM polling: lê ask/bid do DOM e constrói velas M1 sintéticas
  function readPriceFromDom() {
    const selectors = [
      '.ask-price', '.bid-price', '[class*="ask"]', '[class*="bid"]',
      '[class*="price"]', '[class*="current"]', '[class*="last"]',
    ];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const txt = el.textContent.trim();
        const n = parseFloat(txt.replace(',', '.'));
        if (n > 0 && isFinite(n)) return n;
      }
    }
    // tenta texto "ask 1.23456" ou "bid 1.23456" em qualquer elemento
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.nodeValue || '';
      const m = t.match(/(?:ask|bid|price)[:\s]+([\d.]+)/i);
      if (m) {
        const n = parseFloat(m[1]);
        if (n > 0 && isFinite(n)) return n;
      }
    }
    return null;
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
      // fechou a vela M1
      pushBar(curBar.open, curBar.high, curBar.low, curBar.close);
      if (pending && CFG.autoEntry) {
        setTimeout(() => enter(pending), CFG.entryDelay);
        log(`>>> ENTRADA ${pending}`);
        pending = null;
      }
      curBar = { open: price, high: price, low: price, close: price, min };
    } else {
      curBar.high  = Math.max(curBar.high, price);
      curBar.low   = Math.min(curBar.low, price);
      curBar.close = price;
    }
  }

  // Polling DOM a 500ms
  setInterval(() => {
    const price = readPriceFromDom();
    if (price) tickPrice(price);
  }, 500);

  // ─── ENTRADA ───────────────────────────────────────────────────────────────

  function findButton(dir) {
    // texto exato dos botões Safirion confirmados
    const labels = dir === 'ACIMA'
      ? ['ACIMA', 'CIMA', 'CALL', 'UP', 'COMPRAR', 'COMPRA']
      : ['ABAIXO', 'BAIXO', 'PUT', 'DOWN', 'VENDER', 'VENDA'];

    for (const lbl of labels) {
      for (const btn of document.querySelectorAll('button, [role="button"]')) {
        if (btn.textContent.trim().toUpperCase().includes(lbl)) return btn;
      }
    }

    // fallback: busca por cor (verde = ACIMA, vermelho = ABAIXO)
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      const style = window.getComputedStyle(btn);
      const bg = style.backgroundColor;
      if (dir === 'ACIMA'  && /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.test(bg)) {
        const [, r, g, b] = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (+g > 150 && +r < 100) return btn; // verde
      }
      if (dir === 'ABAIXO' && /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.test(bg)) {
        const [, r, g, b] = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (+r > 150 && +g < 100) return btn; // vermelho
      }
    }
    return null;
  }

  function setAmount(val) {
    const inputs = document.querySelectorAll('input[type="number"], input[type="text"], input');
    for (const inp of inputs) {
      const hint = (inp.placeholder + inp.name + inp.id + (inp.getAttribute('aria-label') || '')).toLowerCase();
      if (/invest|valor|amount|stake/.test(hint) || inp.value === '1000' || inp.value === String(CFG.amount)) {
        try {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          setter.set.call(inp, String(val));
          inp.dispatchEvent(new Event('input',  { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
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
      if (!btn) { log(`⚠ botão ${dir} não encontrado`); return; }
      btn.click();
      log(`✓ ENTRADA ${dir} R$ ${CFG.amount}`);
      setStatus(`✓ ${dir} executado`);
      setTimeout(() => setStatus('ativo'), 5000);
    }, 300);
  }

  // ─── PAINEL ────────────────────────────────────────────────────────────────

  function createPanel() {
    if (document.getElementById('sb-panel')) return;
    const p = document.createElement('div');
    p.id = 'sb-panel';
    p.style.cssText = `
      position:fixed;bottom:80px;right:20px;width:270px;
      background:#0d0f1a;border:1px solid #1e2235;border-radius:12px;
      padding:14px 16px;font-family:monospace;font-size:12px;
      color:#c8cdd8;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,.8);
      user-select:none;cursor:move;
    `;
    p.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <b style="font-size:13px;color:#fff">⚡ Auto-Bot M1</b>
        <span id="sb-status" style="font-size:10px;color:#4ade80">iniciando...</span>
      </div>
      <div id="sb-signal" style="text-align:center;padding:8px;border-radius:8px;
        background:#1a1d27;font-size:17px;font-weight:700;color:#6b7280;
        margin-bottom:10px;letter-spacing:1px">— AGUARDANDO —</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:10px;text-align:center">
        <div><div style="font-size:9px;color:#6b7280">RSI</div><div id="sb-rsi" style="font-weight:700;color:#fff">—</div></div>
        <div><div style="font-size:9px;color:#6b7280">STOCH</div><div id="sb-stoch" style="font-weight:700;color:#fff">—</div></div>
        <div><div style="font-size:9px;color:#6b7280">SCORE</div><div id="sb-score" style="font-weight:700;color:#fff">0/5</div></div>
      </div>
      <div id="sb-reasons" style="font-size:10px;color:#6b7280;line-height:1.6;min-height:32px"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;
        margin-top:10px;padding-top:10px;border-top:1px solid #1e2235">
        <span style="font-size:10px;color:#6b7280">Velas: <b id="sb-bars">0</b></span>
        <span id="sb-timer" style="font-size:11px;color:#fff;font-weight:700">--s</span>
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none">
          <input type="checkbox" id="sb-auto" checked style="cursor:pointer">
          <span style="font-size:10px">Auto $${CFG.amount}</span>
        </label>
      </div>
      <div id="sb-log" style="margin-top:8px;font-size:9px;color:#4b5563;
        max-height:56px;overflow:hidden;line-height:1.5"></div>
    `;
    document.body.appendChild(p);

    document.getElementById('sb-auto').addEventListener('change', function () {
      CFG.autoEntry = this.checked;
    });

    // drag
    let dx = 0, dy = 0, drag = false;
    p.addEventListener('mousedown', e => { drag=true; dx=e.clientX-p.offsetLeft; dy=e.clientY-p.offsetTop; });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      p.style.left=e.clientX-dx+'px'; p.style.top=e.clientY-dy+'px';
      p.style.right='auto'; p.style.bottom='auto';
    });
    document.addEventListener('mouseup', () => drag=false);
  }

  function updatePanel(result, rsiCur, stochCur) {
    const sig   = document.getElementById('sb-signal');
    const score = document.getElementById('sb-score');
    const rsiEl = document.getElementById('sb-rsi');
    const stEl  = document.getElementById('sb-stoch');
    const reas  = document.getElementById('sb-reasons');
    const barsEl= document.getElementById('sb-bars');

    if (barsEl) barsEl.textContent = bars.closes.length;
    if (rsiEl)  rsiEl.textContent  = rsiCur  != null ? rsiCur.toFixed(1)  : '—';
    if (stEl)   stEl.textContent   = stochCur != null ? stochCur.toFixed(1) : '—';
    if (score)  score.textContent  = `${result.score}/5`;
    if (reas)   reas.innerHTML     = result.reasons.slice(0, 4).map(r => `· ${r}`).join('<br>');

    if (!sig) return;
    if (result.signal === 'ACIMA') {
      sig.textContent = '⬆ ACIMA';
      sig.style.cssText = 'text-align:center;padding:8px;border-radius:8px;background:#052e16;color:#22c55e;font-size:17px;font-weight:700;margin-bottom:10px;letter-spacing:1px;border:1px solid #16a34a';
    } else if (result.signal === 'ABAIXO') {
      sig.textContent = '⬇ ABAIXO';
      sig.style.cssText = 'text-align:center;padding:8px;border-radius:8px;background:#2d0a0a;color:#ef4444;font-size:17px;font-weight:700;margin-bottom:10px;letter-spacing:1px;border:1px solid #b91c1c';
    } else {
      sig.textContent = '— AGUARDANDO —';
      sig.style.cssText = 'text-align:center;padding:8px;border-radius:8px;background:#1a1d27;color:#6b7280;font-size:17px;font-weight:700;margin-bottom:10px;letter-spacing:1px';
    }
  }

  function setStatus(msg) {
    const el = document.getElementById('sb-status');
    if (el) el.textContent = msg;
  }

  function log(msg) {
    console.log('[AutoBot]', msg);
    const el = document.getElementById('sb-log');
    if (!el) return;
    const t = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    el.innerHTML = `[${t}] ${msg}<br>` + el.innerHTML;
    el.innerHTML = el.innerHTML.split('<br>').slice(0, 8).join('<br>');
  }

  // timer
  setInterval(() => {
    const el = document.getElementById('sb-timer');
    if (el) el.textContent = (60 - new Date().getSeconds()) + 's';
  }, 500);

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    createPanel();
    setStatus('ativo');
    log('Bot v3 iniciado — interceptando WS + DOM polling');
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

})();
