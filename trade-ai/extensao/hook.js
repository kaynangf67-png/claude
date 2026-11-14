// Runs in the broker page itself (not isolated) so it can see the live quotes the page already receives
// (WebSocket, or a worker that holds the WebSocket). It only reads "symbol, time, price" ticks and hands
// them to content.js in the same tab with window.postMessage. Nothing is sent anywhere else.
(() => {
  if ((window.__sinalHonestoHookV || 0) >= 2) return;   // v2 also reads workers; an older v1 hook may already be here
  window.__sinalHonestoHookV = 2;
  const desc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data");
  if (!desc || !desc.get) return;
  const seen = new WeakSet(), dec = new TextDecoder();
  const NUM = `"?(\\d{1,7}(?:\\.\\d+)?)"?`;
  // ["EURUSD_otc", 1731600000.123, 1.08523, ...]   (time in seconds or milliseconds, numbers may be quoted)
  const TICK = new RegExp(`\\["([A-Za-z0-9#._\\/ ()-]{3,30})",\\s*"?(1\\d{9,12}(?:\\.\\d+)?)"?,\\s*${NUM}`, "g");
  // {"asset":"EURUSD_otc", ... "price":1.08523}
  const OBJ = new RegExp(`"(?:asset|symbol|pair|instrument|active|ticker|s)"\\s*:\\s*"([A-Za-z0-9#._\\/ ()-]{3,30})"[^{}]{0,300}?"(?:price|value|close|rate|quote|bid|p|c)"\\s*:\\s*${NUM}`, "g");
  let pending = new Map(), timer = null;
  const stats = { msgs: 0, from: {}, names: new Map() };
  const flush = () => { timer = null; if (!pending.size) return; window.postMessage({ __sinalHonesto: "ticks", ticks: [...pending] }, "*"); pending = new Map(); };
  // chart history the broker sends when an asset is opened: ticks [time, price] or candles [time, a, b, c, d]
  const N = "(-?\\d{1,7}(?:\\.\\d+)?)";
  const H_TICK = new RegExp(`\\[\\s*(1\\d{9}(?:\\.\\d+)?)\\s*,\\s*${N}\\s*(?:,\\s*-?[\\d.]+\\s*)?\\]`, "g");
  const H_CANDLE = new RegExp(`\\[\\s*(1\\d{9})\\s*,\\s*${N}\\s*,\\s*${N}\\s*,\\s*${N}\\s*,\\s*${N}[^\\[\\]]*\\]`, "g");
  const H_OBJ = /\{[^{}]*?"time"\s*:\s*(1\d{9})[^{}]*?\}/g;
  const H_ASSET = /"(?:asset|symbol|pair|instrument|active)"\s*:\s*"([A-Za-z0-9#._\/ ()-]{3,30})"/;
  function scanHistory(text) {
    if (text.length < 400) return;
    const am = text.match(H_ASSET);
    const ticks = [], candles = [];
    let m;
    H_CANDLE.lastIndex = 0; while ((m = H_CANDLE.exec(text)) && candles.length < 5000) candles.push([+m[1], +m[2], +m[3], +m[4], +m[5]]);
    H_OBJ.lastIndex = 0;
    while ((m = H_OBJ.exec(text)) && candles.length < 5000) {
      const o = m[0], g = (k) => { const x = o.match(new RegExp(`"${k}"\\s*:\\s*"?(-?[\\d.]+)`)); return x ? +x[1] : null; };
      const op = g("open"), cl = g("close"), hi = g("high"), lo = g("low");
      if ([op, cl, hi, lo].every((x) => x != null)) candles.push([+m[1], op, cl, hi, lo, "named"]);
    }
    if (!candles.length) { H_TICK.lastIndex = 0; while ((m = H_TICK.exec(text)) && ticks.length < 20000) ticks.push([+m[1], +m[2]]); }
    if (candles.length >= 20 || ticks.length >= 50)
      window.postMessage({ __sinalHonesto: "history", asset: am ? am[1] : null, ticks, candles }, "*");
  }
  // closed trades the broker sends (profit, open/close price…): the real result of your operations
  const seenDeals = new Set();
  const DEAL = /\{[^{}]*"(?:profit|win|isWin|result)"[^{}]*\}/g;
  function scanDeals(text) {
    if (!/"(?:profit|isWin|win)"/.test(text) || !/"(?:closePrice|close_price|closeTimestamp|closeTime|close_time|closed|closeMs)"/.test(text)) return;
    const out = []; let m; DEAL.lastIndex = 0;
    while ((m = DEAL.exec(text)) && out.length < 50) {
      let o = null; try { o = JSON.parse(m[0]); } catch { continue; }
      const num = (...ks) => { for (const k of ks) if (o[k] != null && o[k] !== "" && isFinite(+o[k])) return +o[k]; return null; };
      const str = (...ks) => { for (const k of ks) if (typeof o[k] === "string") return o[k]; return null; };
      const d = {
        id: String(o.id ?? o.ticket ?? o.uid ?? o.dealId ?? ""), asset: str("asset", "symbol", "pair", "active"),
        profit: num("profit", "income", "win_amount", "winAmount"), amount: num("amount", "investment", "sum", "stake", "openAmount"),
        open: num("openPrice", "open_price", "openRate", "open_rate"), close: num("closePrice", "close_price", "closeRate", "close_rate"),
        openT: num("openTimestamp", "openTime", "open_time", "openMs", "created_at", "createdAt", "timestamp"),
        closeT: num("closeTimestamp", "closeTime", "close_time", "closeMs", "expiration", "expirationTime"),
        win: typeof o.isWin === "boolean" ? o.isWin : typeof o.win === "boolean" ? o.win : null,
        cmd: o.command ?? o.action ?? o.direction ?? o.type ?? null,
      };
      if (d.close == null && d.win == null) continue;           // still open
      const key = d.id || `${d.asset}|${d.openT}|${d.amount}`;
      if (seenDeals.has(key + "|" + d.close + "|" + d.profit)) continue; seenDeals.add(key + "|" + d.close + "|" + d.profit);
      out.push(d);
    }
    if (out.length) window.postMessage({ __sinalHonesto: "deals", deals: out }, "*");
  }
  function scan(text) {
    if (!text || text.length > 2000000) return;
    try { scanDeals(text); } catch {}
    try { scanHistory(text); } catch {}
    if (text.length > 400000) return;
    let m;
    TICK.lastIndex = 0; while ((m = TICK.exec(text))) { pending.set(m[1], +m[3]); stats.names.set(m[1], Date.now()); }
    OBJ.lastIndex = 0; while ((m = OBJ.exec(text))) { pending.set(m[1], +m[2]); stats.names.set(m[1], Date.now()); }
    if (pending.size && !timer) timer = setTimeout(flush, 200);
  }
  function read(v) {
    try {
      if (typeof v === "string") scan(v);
      else if (v instanceof ArrayBuffer) scan(dec.decode(new Uint8Array(v)));
      else if (ArrayBuffer.isView(v)) scan(dec.decode(v));
      else if (v instanceof Blob) { if (v.size < 400000) v.text().then(scan, () => {}); }
      else if (v && typeof v === "object") { const s = JSON.stringify(v); if (s && s.length < 400000) scan(s); }
    } catch {}
  }
  const sourceOf = (t) => (typeof WebSocket !== "undefined" && t instanceof WebSocket) ? "websocket"
    : (typeof Worker !== "undefined" && t instanceof Worker) ? "worker"
    : (typeof SharedWorker !== "undefined" && t instanceof MessagePort) ? "porta"
    : (typeof BroadcastChannel !== "undefined" && t instanceof BroadcastChannel) ? "canal" : null;
  Object.defineProperty(MessageEvent.prototype, "data", {
    configurable: true, enumerable: desc.enumerable,
    get() {
      const v = desc.get.call(this);
      try {
        if (!seen.has(this)) {
          seen.add(this);
          const src = sourceOf(this.target);
          if (src) { stats.msgs++; stats.from[src] = (stats.from[src] || 0) + 1; read(v); }
        }
      } catch {}
      return v;
    },
  });
  // what the extension is getting, for the diagnostic in Ajustes
  setInterval(() => {
    const names = [...stats.names].sort((a, b) => b[1] - a[1]).slice(0, 8).map((x) => x[0]);
    window.postMessage({ __sinalHonesto: "stats", msgs: stats.msgs, from: stats.from, names }, "*");
  }, 2000);
})();
