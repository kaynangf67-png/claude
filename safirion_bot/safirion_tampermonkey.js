// ==UserScript==
// @name         Safirion Auto-Bot M1
// @namespace    https://safirion.com
// @version      2.0
// @description  Indicadores M1 + entrada automática ACIMA/ABAIXO R$1.000
// @author       Bot
// @match        https://*.safirion.com/*
// @match        https://safirion.com/*
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
    minAtrRatio : 0.0003,
    autoEntry   : true,   // false = só mostra sinal, não entra
    debugLog    : true,
  };

  // ─── INDICADORES ───────────────────────────────────────────────────────────

  function calcEma(arr, period) {
    const k = 2 / (period + 1);
    const out = [arr[0]];
    for (let i = 1; i < arr.length; i++)
      out.push(arr[i] * k + out[i - 1] * (1 - k));
    return out;
  }

  function calcRsi(closes, period) {
    const out = new Array(closes.length).fill(50);
    let ag = 0, al = 0;
    for (let i = 1; i <= period; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) ag += d; else al += Math.abs(d);
    }
    ag /= period; al /= period;
    out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    for (let i = period + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      ag = (ag * (period - 1) + Math.max(d, 0)) / period;
      al = (al * (period - 1) + Math.max(-d, 0)) / period;
      out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    }
    return out;
  }

  function calcStoch(highs, lows, closes, kp, dp) {
    const kLine = closes.map((_, i) => {
      if (i < kp - 1) return 50;
      const slice_h = highs.slice(i - kp + 1, i + 1);
      const slice_l = lows.slice(i - kp + 1, i + 1);
      const hi = Math.max(...slice_h), lo = Math.min(...slice_l);
      return hi === lo ? 50 : 100 * (closes[i] - lo) / (hi - lo);
    });
    const dLine = kLine.map((_, i) => {
      if (i < dp - 1) return kLine[i];
      return kLine.slice(i - dp + 1, i + 1).reduce((a, b) => a + b, 0) / dp;
    });
    return { k: kLine, d: dLine };
  }

  function calcBB(closes, period, mult) {
    const upper = [], mid = [], lower = [];
    closes.forEach((_, i) => {
      if (i < period - 1) { upper.push(closes[i]); mid.push(closes[i]); lower.push(closes[i]); return; }
      const sl = closes.slice(i - period + 1, i + 1);
      const m  = sl.reduce((a, b) => a + b, 0) / period;
      const sd = Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / period);
      upper.push(m + mult * sd); mid.push(m); lower.push(m - mult * sd);
    });
    return { upper, mid, lower };
  }

  function calcAtr(highs, lows, closes, period) {
    const tr = closes.map((c, i) => {
      if (i === 0) return highs[0] - lows[0];
      return Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
    });
    return calcEma(tr, period);
  }

  function analyze(opens, highs, lows, closes) {
    const n = closes.length;
    if (n < CFG.emaSlow + 10) return { signal: null, score: 0, reasons: ['dados insuficientes'] };

    const emaF = calcEma(closes, CFG.emaFast);
    const emaS = calcEma(closes, CFG.emaSlow);
    const rsiV = calcRsi(closes, CFG.rsiPeriod);
    const { k: kV, d: dV } = calcStoch(highs, lows, closes, CFG.stochK, CFG.stochD);
    const { upper: bbU, lower: bbL } = calcBB(closes, CFG.bbPeriod, CFG.bbStd);
    const atrV = calcAtr(highs, lows, closes, CFG.atrPeriod);

    const i = n - 2;  // vela fechada mais recente
    const price = closes[i];
    const atr   = atrV[i];

    if (atr / price < CFG.minAtrRatio)
      return { signal: null, score: 0, reasons: ['mercado lateral'] };

    let calls = 0, puts = 0;
    const rc = [], rp = [];

    // 1 · EMA crossover / alinhamento
    const diffPrev = emaF[i-3] - emaS[i-3];
    const diffCur  = emaF[i]   - emaS[i];
    if (diffPrev < 0 && diffCur > 0)       { calls++; rc.push('EMA cruzou pra cima'); }
    else if (diffPrev > 0 && diffCur < 0)  { puts++;  rp.push('EMA cruzou pra baixo'); }
    else if (emaF[i] > emaS[i] && emaF[i] > emaF[i-3]) { calls++; rc.push('EMA9 subindo acima EMA21'); }
    else if (emaF[i] < emaS[i] && emaF[i] < emaF[i-3]) { puts++;  rp.push('EMA9 caindo abaixo EMA21'); }

    // 2 · RSI zona (janela 3 velas)
    const rsiSlice = rsiV.slice(i-2, i+1);
    const rsiMin = Math.min(...rsiSlice), rsiMax = Math.max(...rsiSlice);
    if (rsiMin < CFG.rsiOS)  { calls++; rc.push(`RSI sobrevendido (${rsiMin.toFixed(1)})`); }
    else if (rsiMax > CFG.rsiOB) { puts++;  rp.push(`RSI sobrecomprado (${rsiMax.toFixed(1)})`); }

    // 3 · Estocástico cruzamento saindo de zona extrema
    let crossUp = false, crossDown = false;
    for (let j = Math.max(1, i-4); j <= i; j++) {
      if (kV[j-1] <= dV[j-1] && kV[j] > dV[j]) crossUp   = true;
      if (kV[j-1] >= dV[j-1] && kV[j] < dV[j]) crossDown = true;
    }
    const dSliceOld = dV.slice(Math.max(0, i-7), Math.max(0, i-2));
    const dWasOS = dSliceOld.some(v => v < CFG.stochOS + 20);
    const dWasOB = dSliceOld.some(v => v > CFG.stochOB - 20);
    if (crossUp && dWasOS)    { calls++; rc.push('Estoc cruzou pra cima (OS)'); }
    if (crossDown && dWasOB)  { puts++;  rp.push('Estoc cruzou pra baixo (OB)'); }

    // 4 · Bollinger Bands
    const nearLow  = price <= bbL[i] + atr * 0.3;
    const nearHigh = price >= bbU[i] - atr * 0.3;
    const touchLow  = closes.slice(Math.max(0, i-4), i+1).some((c, j) => c <= bbL[i-4+j]);
    const touchHigh = closes.slice(Math.max(0, i-4), i+1).some((c, j) => c >= bbU[i-4+j]);
    if (nearLow || touchLow)   { calls++; rc.push('Preço na BB inferior'); }
    else if (nearHigh || touchHigh) { puts++; rp.push('Preço na BB superior'); }

    // 5 · Momentum preço vs EMA9
    if (price > emaF[i] && closes[i-3] < emaF[i-3])      { calls++; rc.push('Preço cruzou acima da EMA9'); }
    else if (price < emaF[i] && closes[i-3] > emaF[i-3]) { puts++;  rp.push('Preço cruzou abaixo da EMA9'); }
    else if (price > emaF[i] && emaF[i] > emaS[i])       { calls++; rc.push('Preço acima das duas EMAs'); }
    else if (price < emaF[i] && emaF[i] < emaS[i])       { puts++;  rp.push('Preço abaixo das duas EMAs'); }

    if (calls >= CFG.minSignals && calls > puts) return { signal: 'ACIMA', score: calls, reasons: rc };
    if (puts  >= CFG.minSignals && puts > calls) return { signal: 'ABAIXO', score: puts,  reasons: rp };

    return { signal: null, score: Math.max(calls, puts), reasons: [...rc, ...rp] || ['confluência insuficiente'] };
  }

  // ─── PAINEL VISUAL ─────────────────────────────────────────────────────────

  function createPanel() {
    if (document.getElementById('sb-panel')) return document.getElementById('sb-panel');

    const panel = document.createElement('div');
    panel.id = 'sb-panel';
    panel.style.cssText = `
      position: fixed; bottom: 80px; right: 20px; width: 280px;
      background: #0f1117; border: 1px solid #2a2d3a; border-radius: 12px;
      padding: 14px 16px; font-family: 'Inter', monospace; font-size: 12px;
      color: #c8cdd8; z-index: 99999; box-shadow: 0 4px 24px rgba(0,0,0,.6);
      user-select: none;
    `;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:13px;font-weight:700;color:#fff;">⚡ Auto-Bot M1</span>
        <span id="sb-status" style="font-size:10px;color:#6b7280;">aguardando...</span>
      </div>
      <div id="sb-signal" style="
        text-align:center; padding:8px; border-radius:8px;
        background:#1a1d27; font-size:18px; font-weight:700;
        color:#6b7280; margin-bottom:10px; letter-spacing:1px;
      ">— AGUARDANDO —</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:10px;">
        <div style="text-align:center;">
          <div style="font-size:10px;color:#6b7280;">RSI</div>
          <div id="sb-rsi" style="font-weight:600;color:#fff;">—</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:#6b7280;">STOCH</div>
          <div id="sb-stoch" style="font-weight:600;color:#fff;">—</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:#6b7280;">SCORE</div>
          <div id="sb-score" style="font-weight:600;color:#fff;">0/5</div>
        </div>
      </div>
      <div id="sb-reasons" style="font-size:10px;color:#6b7280;line-height:1.6;min-height:36px;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid #2a2d3a;">
        <span style="font-size:10px;color:#6b7280;">Próx. vela</span>
        <span id="sb-timer" style="font-size:11px;color:#fff;font-weight:600;">--s</span>
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
          <input type="checkbox" id="sb-auto" ${CFG.autoEntry ? 'checked' : ''} style="cursor:pointer;">
          <span style="font-size:10px;">Auto R$${CFG.amount}</span>
        </label>
      </div>
      <div id="sb-log" style="margin-top:8px;font-size:9px;color:#4b5563;max-height:60px;overflow:hidden;"></div>
    `;

    document.body.appendChild(panel);

    document.getElementById('sb-auto').addEventListener('change', function () {
      CFG.autoEntry = this.checked;
    });

    // arrastar painel
    let dragging = false, ox = 0, oy = 0;
    panel.addEventListener('mousedown', e => {
      dragging = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      panel.style.left  = (e.clientX - ox) + 'px';
      panel.style.top   = (e.clientY - oy) + 'px';
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => dragging = false);

    return panel;
  }

  function updatePanel(result, rsiCur, stochCur) {
    const sig   = document.getElementById('sb-signal');
    const score = document.getElementById('sb-score');
    const rsiEl = document.getElementById('sb-rsi');
    const stEl  = document.getElementById('sb-stoch');
    const reas  = document.getElementById('sb-reasons');

    rsiEl.textContent  = rsiCur != null  ? rsiCur.toFixed(1)  : '—';
    stEl.textContent   = stochCur != null ? stochCur.toFixed(1) : '—';
    score.textContent  = `${result.score}/5`;

    if (result.signal === 'ACIMA') {
      sig.textContent = '⬆ ACIMA';
      sig.style.cssText = 'text-align:center;padding:8px;border-radius:8px;background:#052e16;color:#22c55e;font-size:18px;font-weight:700;margin-bottom:10px;letter-spacing:1px;border:1px solid #16a34a;';
    } else if (result.signal === 'ABAIXO') {
      sig.textContent = '⬇ ABAIXO';
      sig.style.cssText = 'text-align:center;padding:8px;border-radius:8px;background:#2d0a0a;color:#ef4444;font-size:18px;font-weight:700;margin-bottom:10px;letter-spacing:1px;border:1px solid #b91c1c;';
    } else {
      sig.textContent = '— AGUARDANDO —';
      sig.style.cssText = 'text-align:center;padding:8px;border-radius:8px;background:#1a1d27;color:#6b7280;font-size:18px;font-weight:700;margin-bottom:10px;letter-spacing:1px;';
    }

    reas.innerHTML = result.reasons.slice(0, 4).map(r => `· ${r}`).join('<br>');
  }

  function addLog(msg) {
    if (!CFG.debugLog) return;
    const el = document.getElementById('sb-log');
    if (!el) return;
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.innerHTML = `[${time}] ${msg}<br>` + el.innerHTML;
  }

  // ─── TIMER ─────────────────────────────────────────────────────────────────

  function secondsToNextCandle() {
    return 60 - new Date().getSeconds();
  }

  function startTimer() {
    setInterval(() => {
      const el = document.getElementById('sb-timer');
      if (el) el.textContent = secondsToNextCandle() + 's';
    }, 500);
  }

  // ─── ENTRADA AUTOMÁTICA ────────────────────────────────────────────────────

  function findButton(direction) {
    // procura pelo texto "ACIMA" ou "ABAIXO"
    const all = document.querySelectorAll('button, [role="button"], .btn, [class*="btn"]');
    for (const el of all) {
      const txt = el.textContent.trim().toUpperCase();
      if (direction === 'ACIMA'  && (txt.includes('ACIMA')  || txt.includes('CALL') || txt.includes('CIMA')))  return el;
      if (direction === 'ABAIXO' && (txt.includes('ABAIXO') || txt.includes('PUT')  || txt.includes('BAIXO'))) return el;
    }
    return null;
  }

  function setAmount(value) {
    const inputs = document.querySelectorAll('input[type="number"], input[type="text"]');
    for (const inp of inputs) {
      const label = (inp.placeholder || inp.name || inp.id || inp.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('invest') || label.includes('valor') || label.includes('amount') || label.includes('1000')) {
        inp.focus();
        inp.value = '';
        const nativeInput = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        nativeInput.set.call(inp, String(value));
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        addLog(`Valor: R$ ${value}`);
        return true;
      }
    }
    return false;
  }

  function enter(direction) {
    setAmount(CFG.amount);
    setTimeout(() => {
      const btn = findButton(direction);
      if (!btn) {
        addLog(`Botão ${direction} não encontrado`);
        document.getElementById('sb-status').textContent = '⚠ botão não encontrado';
        return;
      }
      btn.click();
      addLog(`✓ ENTRADA ${direction} R$ ${CFG.amount}`);
      document.getElementById('sb-status').textContent = `✓ ${direction} executado`;

      const sig = document.getElementById('sb-signal');
      sig.style.animation = 'none';
      setTimeout(() => {
        document.getElementById('sb-status').textContent = 'aguardando...';
      }, 4000);
    }, 300);
  }

  // ─── CAPTURA DE DADOS DO GRÁFICO ───────────────────────────────────────────
  // Intercepta WebSocket para capturar candles em tempo real

  const candles = { opens: [], highs: [], lows: [], closes: [] };
  let lastSignal = null;
  let waitingNextCandle = false;

  const OrigWS = window.WebSocket;
  window.WebSocket = function (...args) {
    const ws = new OrigWS(...args);
    ws.addEventListener('message', e => {
      try {
        const data = JSON.parse(e.data);
        processWsMessage(data);
      } catch (_) {}
    });
    return ws;
  };
  window.WebSocket.prototype = OrigWS.prototype;

  function processWsMessage(data) {
    // FintechFuel / Safirion usa formatos variados — tenta extrair OHLC
    const candle = extractCandle(data);
    if (!candle) return;

    const isClosed = candle.closed !== false;  // considera fechada se não diz o contrário

    if (isClosed) {
      candles.opens.push(candle.open);
      candles.highs.push(candle.high);
      candles.lows.push(candle.low);
      candles.closes.push(candle.close);

      // mantém janela de 120 velas
      if (candles.closes.length > 120) {
        candles.opens.shift(); candles.highs.shift();
        candles.lows.shift();  candles.closes.shift();
      }

      runAnalysis();

      // se havia sinal pendente para próxima vela → entra
      if (waitingNextCandle && lastSignal && CFG.autoEntry) {
        addLog(`>>> Entrando ${lastSignal} na nova vela`);
        enter(lastSignal);
        waitingNextCandle = false;
        lastSignal = null;
      }
    }
  }

  function extractCandle(data) {
    // tenta vários formatos comuns do FintechFuel
    if (data.t && data.o !== undefined) {
      return { open: +data.o, high: +data.h, low: +data.l, close: +data.c, closed: data.isClosed !== false };
    }
    if (data.type === 'candle' || data.type === 'ohlc') {
      const c = data.data || data.candle || data;
      return { open: +c.open, high: +c.high, low: +c.low, close: +c.close, closed: c.isClosed !== false };
    }
    if (data.candle) {
      const c = data.candle;
      return { open: +c.open, high: +c.high, low: +c.low, close: +c.close, closed: true };
    }
    if (Array.isArray(data) && data.length >= 5 && typeof data[1] === 'number') {
      return { open: data[1], high: data[2], low: data[3], close: data[4], closed: true };
    }
    return null;
  }

  function runAnalysis() {
    const n = candles.closes.length;
    if (n < 30) { addLog(`Acumulando velas: ${n}/30...`); return; }

    const result = analyze(candles.opens, candles.highs, candles.lows, candles.closes);
    const rsiArr = calcRsi(candles.closes, CFG.rsiPeriod);
    const { k: kArr } = calcStoch(candles.highs, candles.lows, candles.closes, CFG.stochK, CFG.stochD);

    updatePanel(result, rsiArr[n - 2], kArr[n - 2]);

    addLog(`Sinal: ${result.signal || '—'} (${result.score}/5) | ${result.reasons[0] || ''}`);

    if (result.signal && result.signal !== lastSignal) {
      lastSignal = result.signal;
      waitingNextCandle = true;
      document.getElementById('sb-status').textContent = `⏳ ${result.signal} na próxima vela`;
      addLog(`>>> AGUARDANDO PRÓXIMA VELA PARA ${result.signal}`);
    } else if (!result.signal) {
      waitingNextCandle = false;
      lastSignal = null;
    }
  }

  // ─── FALLBACK: polling se WebSocket não retornar candles ───────────────────
  // Tenta ler os dados do objeto global do gráfico (TradingView/FintechFuel)

  function tryReadChartData() {
    const sources = [
      () => window.tvWidget && window.tvWidget.activeChart && window.tvWidget.activeChart().getSeries(),
      () => window.chart && window.chart.data,
      () => window.__chartData,
      () => window._chartBars,
    ];
    for (const fn of sources) {
      try {
        const d = fn();
        if (d && d.length > 10) return d;
      } catch (_) {}
    }
    return null;
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────

  function init() {
    createPanel();
    startTimer();
    addLog('Bot iniciado. Aguardando dados do gráfico...');

    // polling de fallback a cada nova vela (caso WS não funcione)
    setInterval(() => {
      const sec = new Date().getSeconds();
      if (sec !== 0 && sec !== 1) return;  // só roda no fechamento de vela M1

      const data = tryReadChartData();
      if (data && candles.closes.length === 0) {
        addLog('Dados encontrados via objeto global do gráfico');
        // adapte conforme o formato retornado
      }
    }, 500);

    document.getElementById('sb-status').textContent = 'ativo';
  }

  // aguarda DOM completo
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

})();
