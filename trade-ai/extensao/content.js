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

  let visible = true, timer = null;
  function toggle(force) {
    visible = typeof force === "boolean" ? force : !visible;
    host.style.display = visible ? "" : "none";
    clearInterval(timer);
    if (visible) { timer = setInterval(scan, 1500); scan(true); }
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

  let lastKey = "";
  function scan(force) {
    if (picking) return;
    let msg = { type: "sh-detect", raw: null, sym: null, otc: false, payout: null, amount: null, currency: null,
      taught: { asset: !!taught.asset, payout: !!taught.payout, amount: !!taught.amount } };
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
    } catch (e) { /* page changed under us; try again next tick */ }
    const key = JSON.stringify(msg);
    if (force === true || key !== lastKey) { lastKey = key; frame.contentWindow && frame.contentWindow.postMessage(msg, "*"); }
  }

  // ---------- "Apontar": click once on the broker to teach where each value is ----------
  const hl = root.querySelector(".hl"), tip = root.querySelector(".tip");
  const LABEL = { asset: "o NOME DO MERCADO", payout: "o PAYOUT (ex.: 92%)", amount: "o VALOR da entrada" };
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
