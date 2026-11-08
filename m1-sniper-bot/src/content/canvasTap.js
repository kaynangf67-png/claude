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
