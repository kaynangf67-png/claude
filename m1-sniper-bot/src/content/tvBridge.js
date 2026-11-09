// TradingView, mundo da extensão: lê os ALERTAS do seu script (aviso na tela ou
// notificação) com "COMPRA"/"VENDA" e entrega ao painel da Quotex via storage.
(() => {
  if (window.__m1TvBridge) return;
  window.__m1TvBridge = true;
  const seen = new Map(); // texto -> horário (evita repetir o mesmo alerta)

  const CODES = new Set(('USD EUR GBP JPY AUD CAD CHF NZD BRL MXN ZAR TRY NGN INR IDR PKR EGP ARS COP CLP PHP THB SGD HKD CNY CNH SEK NOK DKK PLN HUF CZK RUB ' +
    'KRW TWD MYR VND SAR AED QAR KWD BHD OMR JOD ILS KES UAH DZD MAD TND BDT LKR XAU XAG ' +
    'BTC ETH BNB SOL XRP ADA DOGE LTC TRX AVAX LINK DOT MATIC SHIB TON BCH ETC XLM ATOM USDT USDC').split(/\s+/));
  function findTicker(t) {
    const up = t.toUpperCase();
    const slash = up.match(/\b([A-Z]{3,5})\s*\/\s*([A-Z]{3,5})\b/);
    if (slash && CODES.has(slash[1]) && CODES.has(slash[2])) return slash[1] + slash[2];
    for (const tok of up.match(/\b(?:[A-Z]+:)?[A-Z]{6,9}\b/g) || []) {
      const w = tok.includes(':') ? tok.split(':')[1] : tok;
      for (let k = 3; k <= w.length - 3; k++) if (CODES.has(w.slice(0, k)) && CODES.has(w.slice(k))) return w;
    }
    return null;
  }

  function parse(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!/\b(COMPRA|VENDA|BUY|SELL|CALL|PUT)\b/i.test(t)) return null;
    if (!/sniper|m1|alert|alerta/i.test(t)) return null; // só alertas (evita textos comuns da página)
    const dir = /\b(COMPRA|BUY|CALL)\b/i.test(t) ? 'CALL' : 'PUT';
    // ticker: "EURUSD", "FX:EURUSD", "BINANCE:BTCUSDT", "EUR/USD" — só códigos reais de moeda/cripto
    const ticker = findTicker(t);
    return { dir, ticker, text: t.slice(0, 160) };
  }

  function emit(text, how) {
    const s = parse(text);
    if (!s) return;
    const k = s.text;
    const now = Date.now();
    if (now - (seen.get(k) || 0) < 50_000) return; // mesmo alerta repetido na mesma vela
    seen.set(k, now);
    chrome.storage.local.set({ m1tv: { ...s, at: now, how, url: location.pathname } });
  }

  // 1) notificações do navegador (via tvTap.js)
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.__m1tv === 1) emit(e.data.text, 'notificação');
  });
  // 2) avisos (toasts/pop-ups) que aparecem na página
  const obs = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      const txt = n.textContent || '';
      if (txt.length > 0 && txt.length < 400) emit(txt, 'aviso na tela');
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
