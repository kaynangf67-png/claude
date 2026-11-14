// Runs in the broker page itself (not isolated) so it can see the live quotes the page already receives
// over its own WebSocket. It only reads "symbol, time, price" ticks and hands them to content.js in the
// same tab with window.postMessage. Nothing is sent anywhere else.
(() => {
  if (window.__sinalHonestoHook) return;
  window.__sinalHonestoHook = true;
  const desc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data");
  if (!desc || !desc.get) return;
  const seen = new WeakSet(), dec = new TextDecoder();
  // ["EURUSD_otc", 1731600000.123, 1.08523, ...]  or  {"asset":"EURUSD_otc","price":1.08523}
  const TICK = /\["([A-Za-z0-9#._\/-]{3,24})",\s*(1\d{9}(?:\.\d+)?),\s*(\d{1,7}(?:\.\d+)?)/g;
  const OBJ = /"(?:asset|symbol|pair|instrument|active)"\s*:\s*"([A-Za-z0-9#._\/-]{3,24})"[^{}]{0,200}?"(?:price|value|close|rate|quote|bid)"\s*:\s*(\d{1,7}(?:\.\d+)?)/g;
  let pending = new Map(), timer = null;
  const flush = () => { timer = null; if (!pending.size) return; window.postMessage({ __sinalHonesto: "ticks", ticks: [...pending] }, "*"); pending = new Map(); };
  function scan(text) {
    if (!text || text.length > 300000) return;
    let m;
    TICK.lastIndex = 0; while ((m = TICK.exec(text))) pending.set(m[1], +m[3]);
    OBJ.lastIndex = 0; while ((m = OBJ.exec(text))) pending.set(m[1], +m[2]);
    if (pending.size && !timer) timer = setTimeout(flush, 200);
  }
  function read(v) {
    try {
      if (typeof v === "string") scan(v);
      else if (v instanceof ArrayBuffer) scan(dec.decode(new Uint8Array(v)));
      else if (v instanceof Blob && v.size < 300000) v.text().then(scan, () => {});
    } catch {}
  }
  Object.defineProperty(MessageEvent.prototype, "data", {
    configurable: true, enumerable: desc.enumerable,
    get() {
      const v = desc.get.call(this);
      try { if (!seen.has(this) && this.target instanceof WebSocket) { seen.add(this); read(v); } } catch {}
      return v;
    },
  });
})();
