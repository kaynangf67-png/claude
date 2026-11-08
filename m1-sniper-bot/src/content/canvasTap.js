// Roda no "mundo" da página (MAIN), antes do gráfico ser criado.
// Observa os textos que a página DESENHA no canvas (fillText/strokeText) —
// como o rótulo do preço ao vivo e a legenda OHLC — e repassa para a extensão.
// Não altera o que é desenhado: só registra texto, posição e cor.
(() => {
  if (window.__m1CanvasTap) return;
  window.__m1CanvasTap = true;
  const protos = [window.CanvasRenderingContext2D?.prototype, window.OffscreenCanvasRenderingContext2D?.prototype].filter(Boolean);
  if (!protos.length) return;
  // Inclui caracteres soltos (alguns gráficos desenham o número letra por letra).
  const INTERESTING = /^[\d.,:%+\-\s]{1,3}$|\d[.,]\d{2,}|abert|fech|alt|baix|máx|mín|max|min|open|close|high|low/i;
  let batch = [];
  const ids = new WeakMap(); let nextId = 1;
  const canvasId = (c) => { if (!ids.has(c)) ids.set(c, nextId++); return ids.get(c); };

  let record = function (ctx, text, x, y) {
    try {
      const t = String(text);
      if (t.length > 40 || !INTERESTING.test(t)) return;
      const m = ctx.getTransform();
      const c = ctx.canvas;
      const r = c && c.getBoundingClientRect ? c.getBoundingClientRect() : null;
      // posição em pixels da tela (CSS), considerando a transformação e o tamanho do canvas
      const px = m.a * x + m.c * y + m.e, py = m.b * x + m.d * y + m.f;
      const sx = r && c.width ? r.width / c.width : 1, sy = r && c.height ? r.height / c.height : 1;
      batch.push({
        t, c: canvasId(c),
        x: Math.round((r ? r.left : 0) + px * sx), y: Math.round((r ? r.top : 0) + py * sy),
        f: typeof ctx.fillStyle === 'string' ? ctx.fillStyle : 'grad',
        w: Math.round((ctx.measureText ? ctx.measureText(t).width : 0) * sx * 10) / 10,
      });
      if (batch.length > 400) batch.splice(0, batch.length - 400);
    } catch { /* nunca atrapalha o desenho */ }
  };

  for (const proto of protos) {
    for (const name of ['fillText', 'strokeText']) {
      const orig = proto[name];
      if (typeof orig !== 'function') continue;
      proto[name] = function (text, x, y, ...rest) {
        record(this, text, x, y);
        return orig.call(this, text, x, y, ...rest);
      };
    }
  }
  window.postMessage({ __m1tap: 1, at: Date.now(), items: [], hello: true }, '*');

  // ---------------------------------------------------------------- WebSocket (somente leitura)
  // Observa as mensagens que a página RECEBE (histórico de velas, cotações).
  // Não envia nada e não altera as mensagens.
  const NativeWS = window.WebSocket;
  if (NativeWS && !NativeWS.__m1wrapped) {
    const dec = new TextDecoder('utf-8');
    const INTEREST = /candle|history|quote|stream|tick|price|chart/i;
    const relay = (text) => {
      if (typeof text !== 'string' || text.length < 8 || text.length > 3_000_000) return;
      if (!INTEREST.test(text.slice(0, 200)) && !/^\s*[\[{]/.test(text)) return;
      window.postMessage({ __m1ws: 1, at: Date.now(), data: text }, '*');
    };
    const onMsg = (ev) => {
      try {
        const d = ev.data;
        if (typeof d === 'string') relay(d);
        else if (d instanceof ArrayBuffer) relay(dec.decode(new Uint8Array(d)[0] === 4 ? new Uint8Array(d).subarray(1) : new Uint8Array(d)));
        else if (d && typeof d.arrayBuffer === 'function') d.arrayBuffer().then((b) => { const u = new Uint8Array(b); relay(dec.decode(u[0] === 4 ? u.subarray(1) : u)); }).catch(() => {});
      } catch { /* nunca atrapalha a página */ }
    };
    const Wrapped = function (...args) {
      const ws = new NativeWS(...args);
      try { ws.addEventListener('message', onMsg); } catch {}
      return ws;
    };
    Wrapped.prototype = NativeWS.prototype;
    for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) Wrapped[k] = NativeWS[k];
    Wrapped.__m1wrapped = true;
    window.WebSocket = Wrapped;
  }

  // envia um lote por quadro desenhado e, por segurança, a cada 250 ms
  let scheduled = false;
  function flush() {
    scheduled = false;
    if (!batch.length) return;
    const items = batch; batch = [];
    window.postMessage({ __m1tap: 1, at: Date.now(), items }, '*');
  }
  const origRecord = record;
  // envia logo após o trecho de código que desenhou (microtarefa) = um quadro por lote
  record = function (...a) { origRecord(...a); if (!scheduled) { scheduled = true; Promise.resolve().then(flush); } };
  setInterval(flush, 250);
})();
