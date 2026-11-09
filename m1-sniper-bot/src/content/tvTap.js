// TradingView, mundo da página: captura as NOTIFICAÇÕES do navegador que o
// TradingView cria para alertas (title/body) e repassa à extensão. Não altera nada.
(() => {
  if (window.__m1TvTap) return;
  window.__m1TvTap = true;
  const N = window.Notification;
  if (!N) return;
  const Wrapped = function (title, opts = {}) {
    try { window.postMessage({ __m1tv: 1, at: Date.now(), text: `${title ?? ''} ${opts?.body ?? ''}` }, '*'); } catch {}
    return new N(title, opts);
  };
  Wrapped.prototype = N.prototype;
  Object.defineProperty(Wrapped, 'permission', { get: () => N.permission });
  Wrapped.requestPermission = (...a) => N.requestPermission(...a);
  window.Notification = Wrapped;
})();
