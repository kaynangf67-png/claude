// Floating panel + reading the asset and payout the broker is showing.
(() => {
  if (window.__sinalHonesto) { window.__sinalHonesto.toggle(); return; }

  // ---------- panel ----------
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      .box{width:400px;height:660px;min-width:300px;min-height:260px;max-width:95vw;max-height:92vh;display:flex;flex-direction:column;
        background:#0b1120;border:1px solid #26324f;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.55);overflow:hidden;resize:both}
      .bar{display:flex;align-items:center;gap:6px;padding:6px 8px 6px 12px;background:#0e1628;color:#e6ebf5;
        font:600 13px system-ui,sans-serif;cursor:move;user-select:none;border-bottom:1px solid #26324f}
      .sp{flex:1}
      button{all:unset;cursor:pointer;color:#8a97b3;width:24px;height:24px;text-align:center;border-radius:6px;font:16px/24px system-ui}
      button:hover{background:#1a2540;color:#fff}
      iframe{flex:1;border:0;width:100%;background:#0b1120}
      .min .box{height:auto!important;min-height:0;resize:none}
      .min iframe{display:none}
      .hl{position:fixed;pointer-events:none;border:2px solid #38bdf8;background:rgba(56,189,248,.15);border-radius:4px;display:none;z-index:2}
      .tip{position:fixed;left:50%;top:12px;transform:translateX(-50%);background:#0e1628;color:#e6ebf5;border:1px solid #38bdf8;
        border-radius:10px;padding:8px 14px;font:600 13px system-ui,sans-serif;display:none;pointer-events:none}
    </style>
    <div class="hl"></div><div class="tip"></div>
    <div class="wrap"><div class="box">
      <div class="bar"><span>🤖 Sinal Honesto</span><span class="sp"></span>
        <button class="m" title="Minimizar">–</button><button class="x" title="Fechar (clique no ícone para abrir de novo)">×</button></div>
      <iframe allow="autoplay"></iframe>
    </div></div>`;
  const wrap = root.querySelector(".wrap"), bar = root.querySelector(".bar"), frame = root.querySelector("iframe");
  frame.src = chrome.runtime.getURL("sinais.html");
  document.documentElement.appendChild(host);

  root.querySelector(".m").onclick = () => wrap.classList.toggle("min");
  root.querySelector(".x").onclick = () => toggle(false);

  // drag by the title bar
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    const r = host.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      host.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)) + "px";
      host.style.top = Math.max(0, Math.min(innerHeight - 30, ev.clientY - dy)) + "px";
      host.style.right = host.style.bottom = "auto";
    };
    const up = () => { bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); };
    bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up);
  });

  let visible = true, timer = null, priceTimer = null, candTimer = null;
  function toggle(force) {
    visible = typeof force === "boolean" ? force : !visible;
    host.style.display = visible ? "" : "none";
    clearInterval(timer);
    clearInterval(priceTimer); clearInterval(candTimer);
    if (visible) {
      timer = setInterval(scan, 1500); scan(true);
      collectPriceCands(); candTimer = setInterval(collectPriceCands, 4000); priceTimer = setInterval(pollPrice, 500);
    }
  }
  window.__sinalHonesto = { toggle };

  // ---------- reading the broker page ----------
  const CRYPTO = ["BTC", "ETH", "SOL", "BNB", "XRP"];
  const CUR = "USDT|USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD|BRL|TRY|MXN|ZAR|SGD|HKD|NOK|SEK|INR|IDR|CNH|BTC|ETH|SOL|BNB|XRP|XAU|XAG|LTC|DOGE|ADA|DOT|TRX|LINK|AVAX|TON|MATIC";
  const PAIR = new RegExp(`(?:^|[^A-Z])(${CUR})\\s?\\/\\s?(${CUR})(?![A-Z])`);
  const GLUED = new RegExp(`(?:^|[^A-Z])(${CUR})(USDT|USD|EUR|JPY|CHF|CAD|GBP|AUD|NZD)(?![A-Z])`);
  const PCT = /^\+?\s*(\d{2,3})\s*%$/;
  const ALIASES = [
    [/\bbitcoin\b/i, "BTC", "USD"], [/\bethereum\b/i, "ETH", "USD"], [/\bsolana\b/i, "SOL", "USD"],
    [/\b(gold|ouro)\b/i, "XAU", "USD"], [/\b(ripple)\b/i, "XRP", "USD"],
  ];
  const AMOUNT_WORDS = /(valor|amount|investimento|investment|montante|quantia|aposta|stake|sum|trade size|entrada)/i;
  const host_ = location.hostname;
  let taught = {};            // field -> CSS selector, remembered per site
  chrome.storage.local.get("picks", (r) => { taught = (r.picks || {})[host_] || {}; scan(true); });
  const savePicks = () => chrome.storage.local.get("picks", (r) => { const all = r.picks || {}; all[host_] = taught; chrome.storage.local.set({ picks: all }); });

  function cssPath(el) {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) {
      if (e.id && !/\d{3,}|[:]/.test(e.id)) { parts.unshift("#" + CSS.escape(e.id)); break; }
      let i = 1; for (let s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === e.tagName) i++;
      parts.unshift(e.tagName.toLowerCase() + ":nth-of-type(" + i + ")");
    }
    return (parts[0] && parts[0].startsWith("#") ? "" : "body > ") + parts.join(" > ");
  }
  const readEl = (sel) => { try { const e = document.querySelector(sel); if (!e) return null; return { el: e, text: (/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) ? e.value : e.textContent || "").trim() }; } catch { return null; } };

  // "1.000,50" / "1,000.50" / "R$ 10" -> number
  function parseAmount(t) {
    const m = String(t).replace(/\s/g, "").match(/\d[\d.,]*/); if (!m) return null;
    let x = m[0]; const lc = x.lastIndexOf(","), ld = x.lastIndexOf(".");
    if (lc > -1 && ld > -1) x = lc > ld ? x.replace(/\./g, "").replace(",", ".") : x.replace(/,/g, "");
    else if (lc > -1) x = /,\d{1,2}$/.test(x) ? x.replace(",", ".") : x.replace(/,/g, "");
    else if (ld > -1 && /\.\d{3}$/.test(x) && x.split(".").length > 2) x = x.replace(/\./g, "");
    const v = parseFloat(x); return Number.isFinite(v) && v > 0 && v < 1e7 ? v : null;
  }
  function currencyOf(t) {
    if (/R\$|BRL/.test(t)) return "R$";
    if (/€|EUR/.test(t)) return "€";
    if (/£|GBP/.test(t)) return "£";
    if (/\$|USD/.test(t)) return "$";
    return null;
  }
  // the visible input whose surroundings say "Valor / Amount / Investimento…"
  // expiration: "00:01:00", "01:00", "1 min", "M1", "30s"… next to "Tempo / Time / Expiração"
  const EXP_WORDS = /(tempo|time|expira|expiration|expiry|duração|duracao|duration|prazo|período|periodo)/i;
  // "21:05" as the time the trade ends -> seconds from now (only if it is within the next hour)
  function clockToSec(h, mi) {
    if (h > 23 || mi > 59) return null;
    const d = new Date(), end = new Date(d); end.setHours(h, mi, 0, 0);
    let sec = Math.round((end - d) / 1000); if (sec < -60) sec += 86400;
    return sec > 0 && sec <= 3600 ? Math.ceil(sec / 60) * 60 : null;
  }
  function parseExpiry(t) {
    t = String(t).replace(/\s+/g, " ").trim().replace(/\s*:\s*/g, ":");
    let m = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
    m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      // "00:30"/"01:00" = duration (min:s); a time that falls within the next hour = when the trade ends
      if (+m[1] === 0) return +m[2];
      const c = clockToSec(+m[1], +m[2]);
      return c != null ? c : +m[1] < 6 ? +m[1] * 60 + +m[2] : null;
    }
    m = t.match(/^([MS])\s?(\d{1,2})$/i);
    if (m) return m[1].toUpperCase() === "M" ? +m[2] * 60 : +m[2];
    m = t.match(/^(\d{1,3})\s*(s|seg|sec|segundos?|seconds?|m|min|mins|minutos?|minutes?|h|hora)$/i);
    if (m) { const u = m[2].toLowerCase(); return u.startsWith("h") ? +m[1] * 3600 : u.startsWith("m") ? +m[1] * 60 : +m[1]; }
    return null;
  }
  function findExpiry() {
    let best = null;
    const consider = (el, text) => {
      const sec = parseExpiry(text); if (!sec || sec < 5 || sec > 4 * 3600) return;
      let ctx = "", node = el;
      for (let k = 0; k < 4 && node; k++, node = node.parentElement) { ctx = node.textContent || ""; if (ctx.length > 200) break; }
      const own = [el.getAttribute && el.getAttribute("aria-label"), el.name, el.id, el.placeholder].join(" ");
      if (!EXP_WORDS.test(own + " " + ctx)) return;
      const score = EXP_WORDS.test(own) ? 2 : 1;
      if (!best || score > best.score) best = { score, sec };
    };
    for (const inp of document.querySelectorAll("input")) {
      if (host.contains(inp) || !visibleEl(inp)) continue;
      consider(inp, inp.value || "");
    }
    if (best) return best.sec;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, k = 0;
    const seen = new Set();
    while ((n = w.nextNode()) && k++ < 20000) {
      const t = n.nodeValue.trim(); if (!t || t.length > 12) continue;
      let el = n.parentElement; if (!el || host.contains(el) || !visibleEl(el)) continue;
      if (t.length >= 2) consider(el, t);
      // the time may be split in pieces ("00" ":" "01" ":" "00"): try the parents' whole text too
      for (let up = 0; up < 3 && el && !seen.has(el); up++, el = el.parentElement) {
        seen.add(el);
        const whole = (el.textContent || "").trim();
        if (whole.length > 14) break;
        if (whole !== t) consider(el, whole);
      }
    }
    return best ? best.sec : null;
  }
  // chart timeframe: "M1", "M5", "H1", "5m", "15 min"… the visible one, or the one marked active in a list
  const TF_RX = /^(?:([SMH])\s?(\d{1,2})|(\d{1,2})\s?(s|m|min|h))$/i;
  function tfToSec(t) {
    const m = String(t).trim().match(TF_RX); if (!m) return null;
    const u = (m[1] || m[4]).toLowerCase(), v = +(m[2] || m[3]);
    return u === "h" ? v * 3600 : u === "s" ? v : v * 60;
  }
  function findTimeframe() {
    const groups = new Map(), all = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, k = 0;
    while ((n = w.nextNode()) && k++ < 20000) {
      const t = n.nodeValue.trim(); if (t.length < 2 || t.length > 7) continue;
      const sec = tfToSec(t); if (!sec) continue;
      const el = n.parentElement; if (!el || host.contains(el) || !visibleEl(el)) continue;
      let ctx = "", node = el; for (let i = 0; i < 3 && node; i++, node = node.parentElement) ctx = node.textContent || "";
      if (EXP_WORDS.test(ctx.slice(0, 120)) && !/time ?frame|tempo gr|gráfico|grafico|candle|vela|interval/i.test(ctx.slice(0, 120))) continue;
      const cls = [el, el.parentElement, el.parentElement && el.parentElement.parentElement].filter(Boolean)
        .map((e) => (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) + " " + (e.getAttribute("aria-selected") || "") + (e.getAttribute("aria-pressed") || "") + (e.getAttribute("aria-checked") || "")).join(" ");
      const item = { sec, active: /active|selected|current|checked|true/i.test(cls) };
      all.push(item);
      const g = el.parentElement && el.parentElement.parentElement; groups.set(g, (groups.get(g) || []).concat(item));
    }
    const act = all.find((x) => x.active); if (act) return act.sec;
    const single = [...groups.values()].filter((g) => g.length === 1);   // a lone "M5" button, not a whole menu
    return single.length === 1 ? single[0][0].sec : null;
  }

  // time zone shown by the broker ("UTC-3", "UTC −03:00", "GMT+1")
  function findTz() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, k = 0;
    while ((n = w.nextNode()) && k++ < 20000) {
      const t = n.nodeValue; if (t.length > 60) continue;
      const m = t.match(/(?:UTC|GMT)\s*([+\-−–])\s*(\d{1,2})(?::?(\d{2}))?/);
      if (!m || !n.parentElement || host.contains(n.parentElement) || !visibleEl(n.parentElement)) continue;
      const h = +m[2] + (m[3] ? +m[3] / 60 : 0); if (h > 14) continue;
      return (m[1] === "+" ? 1 : -1) * h;
    }
    return null;
  }

  function findAmount() {
    let best = null;
    for (const inp of document.querySelectorAll("input")) {
      if (host.contains(inp) || /^(hidden|checkbox|radio|password|email|search)$/i.test(inp.type)) continue;
      const v = (inp.value || "").trim(); if (!v || v.includes(":") || !visibleEl(inp)) continue;
      const amount = parseAmount(v); if (amount == null) continue;
      let ctx = "", node = inp;
      for (let k = 0; k < 4 && node; k++, node = node.parentElement) { ctx = (node.textContent || "") + " " + (node.getAttribute && (node.getAttribute("aria-label") || "")); if (ctx.length > 300) break; }
      const label = (inp.labels && [...inp.labels].map((l) => l.textContent).join(" ")) || "";
      const words = [inp.name, inp.id, inp.placeholder, inp.getAttribute("aria-label"), label, ctx].join(" ");
      if (!AMOUNT_WORDS.test(words)) continue;
      const score = (AMOUNT_WORDS.test([inp.name, inp.id, inp.placeholder, label].join(" ")) ? 2 : 1);
      if (!best || score > best.score) best = { score, amount, currency: currencyOf(v + " " + ctx.slice(0, 120)) };
    }
    return best;
  }
  function parseMarket(text) {
    const t = text.trim().slice(0, 60);
    const m = t.match(PAIR) || t.match(GLUED);
    if (m) return { base: m[1], quote: m[2], text: t };
    for (const [rx, b, q] of ALIASES) if (rx.test(t)) return { base: b, quote: q, text: t, alias: true };
    return null;
  }

  function toSym(b, q) {
    if (CRYPTO.includes(b) && (q === "USD" || q === "USDT")) return b + "USDT";
    if (b === "EUR" && (q === "USD" || q === "USDT")) return "EURUSDT";
    if (b === "XAU" && (q === "USD" || q === "USDT")) return "PAXGUSDT";
    return null;
  }
  const visibleEl = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || +cs.opacity === 0) return null;
    return { r, cs };
  };

  // the biggest, boldest visible "XXX/YYY" on the page is taken as the selected asset
  function findAsset() {
    let best = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n, count = 0;
    while ((n = walker.nextNode()) && count < 20000) {
      count++;
      const t = n.nodeValue.trim();
      if (t.length < 6 || t.length > 40) continue;
      const pm = parseMarket(t); if (!pm) continue; const m = [null, pm.base, pm.quote];
      const el = n.parentElement; if (!el || host.contains(el)) continue;
      const v = visibleEl(el); if (!v) continue;
      const fs = parseFloat(v.cs.fontSize) || 12, fw = parseInt(v.cs.fontWeight, 10) || 400;
      const score = fs * (fw >= 600 ? 1.35 : 1) + (v.r.top < innerHeight * 0.35 ? 3 : 0);
      if (!best || score > best.score) best = { score, el, base: m[1], quote: m[2], text: t };
    }
    return best;
  }
  function isOtc(a) {
    if (/otc/i.test(a.text)) return true;
    const p = a.el.parentElement;
    return !!p && p.textContent.length < 80 && /otc/i.test(p.textContent);
  }
  // payout: the closest "92%" / "+92%" around the asset name
  function findPayout(a) {
    let node = a.el;
    for (let lvl = 0; lvl < 6 && node && node !== document.body; lvl++, node = node.parentElement) {
      const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let t, k = 0;
      while ((t = w.nextNode()) && k++ < 400) {
        const m = t.nodeValue.trim().match(PCT);
        if (m && +m[1] >= 10 && +m[1] <= 100 && t.parentElement && visibleEl(t.parentElement)) return +m[1];
      }
    }
    return null;
  }

  // ---------- current price shown by the broker ----------
  // Candidates are numbers with decimals; the price is the one that keeps changing.
  const NUM = /^[+-]?\d{1,3}(?:[.,\s]?\d{3})*(?:[.,]\d{2,6})$|^\d+[.,]\d{2,6}$/;
  let cands = new Map();      // element -> { v, changes: [times] } (pages replace the text node on every tick)
  function collectPriceCands() {
    const next = new Map();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, k = 0;
    while ((n = w.nextNode()) && k++ < 30000 && next.size < 400) {
      const t = n.nodeValue.trim(); if (t.length < 4 || t.length > 14 || !NUM.test(t)) continue;
      const el = n.parentElement; if (!el || host.contains(el) || !visibleEl(el)) continue;
      if (/%|\$|R\$|€/.test((el.textContent || "").slice(0, 20))) continue;     // payout, balance, amount
      if ((el.textContent || "").trim() !== t) continue;
      next.set(el, cands.get(el) || { v: t, changes: [] });
    }
    cands = next;
  }
  let lastPriceSent = null;
  function pollPrice() {
    if (picking) return;
    let p = null;
    const tp = taught.price && readEl(taught.price);
    if (tp) p = parseAmount(tp.text);
    else {
      const t0 = Date.now(); let best = null;
      for (const [n, c] of cands) {
        const v = (n.textContent || "").trim();
        if (!NUM.test(v)) continue;
        if (v !== c.v) {
          const a = parseAmount(c.v), b = parseAmount(v);
          // a price moves a tiny bit per tick; counters, payouts and timers jump
          if (a && b && Math.abs(b / a - 1) > 0.005) c.jumps = (c.jumps || 0) + 1;
          c.v = v; c.changes.push(t0);
        }
        c.changes = c.changes.filter((x) => t0 - x < 20000);
        if (!n.isConnected || c.changes.length < 3 || t0 - c.changes[c.changes.length - 1] > 8000) continue;
        const decs = (v.split(/[.,]/).pop() || "");
        if (/^0+$/.test(decs)) continue;                       // "93.000" is not a live price
        if ((c.jumps || 0) * 3 > c.changes.length) continue;   // mostly jumps
        const score = c.changes.length + decs.length * 2;
        if (!best || score > best.score) best = { score, v };
      }
      if (best) p = parseAmount(best.v);
    }
    if (p !== lastPriceSent || p) { lastPriceSent = p; frame.contentWindow && frame.contentWindow.postMessage({ type: "sh-price", p }, "*"); }
  }
  let lastKey = "";
  function scan(force) {
    if (picking) return;
    let msg = { type: "sh-detect", raw: null, sym: null, otc: false, payout: null, amount: null, currency: null,
      expirySec: null, tfSec: null, tz: null,
      taught: { asset: !!taught.asset, payout: !!taught.payout, amount: !!taught.amount, expiry: !!taught.expiry, price: !!taught.price, tf: !!taught.tf } };
    try {
      // market
      let a = null;
      const ta = taught.asset && readEl(taught.asset);
      if (ta && ta.text) {
        ta.text = ta.text.replace(/[+-]?\s*\d{1,3}([.,]\d+)?\s*%/g, " ").replace(/\s+/g, " ").trim();
        const pm = parseMarket(ta.text);
        a = { el: ta.el, text: ta.text, base: pm && pm.base, quote: pm && pm.quote, raw: pm && !pm.alias ? null : ta.text.slice(0, 40) };
      } else a = findAsset();
      if (a) {
        const otc = isOtc(a);
        msg.raw = a.raw || (a.base ? `${a.base}/${a.quote}${otc && !/otc/i.test(a.base + a.quote) ? " OTC" : ""}` : a.text.slice(0, 40));
        if (a.raw && otc && !/otc/i.test(msg.raw)) msg.raw += " OTC";
        msg.sym = a.base ? toSym(a.base, a.quote) : null; msg.otc = otc;
      }
      // payout
      const tp = taught.payout && readEl(taught.payout);
      if (tp) { const m = tp.text.match(/(\d{2,3})\s*%/); msg.payout = m ? +m[1] : null; }
      else if (a) msg.payout = findPayout(a);
      // amount
      const tv = taught.amount && readEl(taught.amount);
      if (tv) { msg.amount = parseAmount(tv.text); msg.currency = currencyOf(tv.text + " " + (tv.el.parentElement ? tv.el.parentElement.textContent.slice(0, 120) : "")); }
      else { const f = findAmount(); if (f) { msg.amount = f.amount; msg.currency = f.currency; } }
      // expiration and time zone
      const te = taught.expiry && readEl(taught.expiry);
      if (te) {
        let sec = null;
        for (let e = te.el, up = 0; e && up < 4 && sec == null; e = e.parentElement, up++) {
          const txt = /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) ? e.value : (e.textContent || "");
          if (txt.length > 40) break;
          sec = parseExpiry(txt);
          if (sec == null) { const m = txt.match(/(\d{1,2}\s*:\s*\d{2}(?:\s*:\s*\d{2})?|[MS]\s?\d{1,2}\b|\d{1,3}\s*(?:s|seg|sec|min|m)\b)/i); if (m) sec = parseExpiry(m[1]); }
        }
        msg.expirySec = sec;
      } else msg.expirySec = findExpiry();
      msg.tz = findTz();
      const tt = taught.tf && readEl(taught.tf);
      msg.tfSec = tt ? (tfToSec(tt.text) || tfToSec((tt.text.match(/[SMH]\s?\d{1,2}|\d{1,2}\s?(?:min|m|h|s)\b/i) || [""])[0])) : findTimeframe();
    } catch (e) { /* page changed under us; try again next tick */ }
    const key = JSON.stringify(msg);
    if (force === true || key !== lastKey) { lastKey = key; frame.contentWindow && frame.contentWindow.postMessage(msg, "*"); }
  }

  // ---------- "Apontar": click once on the broker to teach where each value is ----------
  const hl = root.querySelector(".hl"), tip = root.querySelector(".tip");
  const LABEL = { asset: "o NOME DO MERCADO", payout: "o PAYOUT (ex.: 92%)", amount: "o VALOR da entrada", expiry: "a EXPIRAÇÃO / TEMPO (ex.: 00:01:00)", price: "o PREÇO atual (o número que muda junto com o gráfico)", tf: "o TEMPO GRÁFICO (ex.: M1, M5)" };
  let picking = null;
  const under = (e) => { const t = document.elementFromPoint(e.clientX, e.clientY); return t && !host.contains(t) && t !== host ? t : null; };
  function onMove(e) {
    const t = under(e); if (!t) { hl.style.display = "none"; return; }
    const r = t.getBoundingClientRect();
    Object.assign(hl.style, { display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  }
  function block(e) { if (picking && under(e)) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } }
  function onClick(e) {
    const t = under(e); if (!t) return;
    block(e);
    taught[picking] = cssPath(t); savePicks(); stopPick();
  }
  function onKey(e) { if (e.key === "Escape") { stopPick(); } }
  function startPick(field) {
    if (field === "clear") { taught = {}; savePicks(); scan(true); return; }
    if (!LABEL[field]) return;
    picking = field; tip.textContent = `Clique em ${LABEL[field]} na corretora · Esc cancela`; tip.style.display = "block";
    addEventListener("mousemove", onMove, true); addEventListener("click", onClick, true);
    for (const ev of ["pointerdown", "mousedown", "pointerup", "mouseup"]) addEventListener(ev, block, true);
    addEventListener("keydown", onKey, true);
  }
  function stopPick() {
    picking = null; hl.style.display = tip.style.display = "none";
    removeEventListener("mousemove", onMove, true); removeEventListener("click", onClick, true);
    for (const ev of ["pointerdown", "mousedown", "pointerup", "mouseup"]) removeEventListener(ev, block, true);
    removeEventListener("keydown", onKey, true);
    scan(true);
  }

  window.addEventListener("message", (e) => {
    if (e.source !== frame.contentWindow || !e.data) return;
    if (e.data.type === "sh-ready") scan(true);
    if (e.data.type === "sh-pick") startPick(String(e.data.field));
  });
  toggle(true);
})();
