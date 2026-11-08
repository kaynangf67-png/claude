// Página da extensão que incorpora o widget público de gráfico da TradingView.
// Fica dentro de um iframe da própria extensão para não depender da CSP da Quotex.
// O símbolo é BINANCE:<par>: o MESMO feed que o motor do bot usa nos cálculos.
(() => {
  const q = new URLSearchParams(location.search);
  const sym = (q.get('symbol') || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const studies = ['MAExp@tv-basicstudies', 'BB@tv-basicstudies', 'RSI@tv-basicstudies'];
  const params = new URLSearchParams({
    symbol: `BINANCE:${sym}`,
    interval: '1',
    theme: 'dark',
    style: '1',
    timezone: !q.get('tz') || q.get('tz') === 'UTC' ? 'Etc/UTC' : q.get('tz'),
    locale: 'br',
    hidesidetoolbar: '1',
    hidetoptoolbar: '0',
    symboledit: '0',
    saveimage: '0',
    withdateranges: '0',
    toolbarbg: '0b1328',
    studies: JSON.stringify(studies),
  });
  const f = document.createElement('iframe');
  f.src = `https://s.tradingview.com/widgetembed/?${params}`;
  f.title = `TradingView BINANCE:${sym} M1`;
  f.allow = 'fullscreen';
  f.addEventListener('load', () => document.getElementById('msg')?.remove());
  document.body.appendChild(f);
})();
