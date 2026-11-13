// Floating panel + reading the asset and payout the broker is showing.
(() => {
  if (window.__sinalHonesto) { window.__sinalHonesto.toggle(); return; }

  // ---------- panel ----------
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      .box{width:390px;height:640px;min-width:300px;min-height:260px;max-width:95vw;max-height:92vh;display:flex;flex-direction:column;
        background:#0b1120;border:1px solid #26324f;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.55);overflow:hidden;resize:both}
      .bar{display:flex;align-items:center;gap:6px;padding:6px 8px 6px 12px;background:#0e1628;color:#e6ebf5;
        font:600 13px system-ui,sans-serif;cursor:move;user-select:none;border-bottom:1px solid #26324f}
      .sp{flex:1}
      button{all:unset;cursor:pointer;color:#8a97b3;width:24px;height:24px;text-align:center;border-radius:6px;font:16px/24px system-ui}
      button:hover{background:#1a2540;color:#fff}
      iframe{flex:1;border:0;width:100%;background:#0b1120}
      .min .box{height:auto!important;min-height:0;resize:none}
      .min iframe{display:none}
    </style>
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
      const m = t.match(PAIR) || t.match(GLUED); if (!m) continue;
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
    let msg = { type: "sh-detect", raw: null, sym: null, otc: false, payout: null };
    try {
      const a = findAsset();
      if (a) {
        const otc = isOtc(a);
        msg = { type: "sh-detect", raw: `${a.base}/${a.quote}${otc ? " OTC" : ""}`, sym: toSym(a.base, a.quote), otc, payout: findPayout(a) };
      }
    } catch (e) { /* page changed under us; try again next tick */ }
    const key = JSON.stringify(msg);
    if (force === true || key !== lastKey) { lastKey = key; frame.contentWindow && frame.contentWindow.postMessage(msg, "*"); }
  }
  window.addEventListener("message", (e) => {
    if (e.source === frame.contentWindow && e.data && e.data.type === "sh-ready") scan(true);
  });
  toggle(true);
})();
