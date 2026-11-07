// Fonte INDEPENDENTE de candles: API pública de dados de mercado da Binance
// (documentada, sem chave, somente leitura). https://developers.binance.com/docs/binance-spot-api-docs
// Endpoint "data-api.binance.vision" é o espelho oficial só de market data.
//
// LIMITAÇÃO: os preços da Binance NÃO são os preços exibidos pela Quotex.
// Para criptomoedas o movimento costuma ser próximo, mas pode haver diferença
// de cotação e de horário de fechamento. Ativos OTC e Forex da Quotex não
// existem nesta fonte.

export const SOURCE_ID = 'binance-spot';
export const BASE_URLS = ['https://data-api.binance.vision', 'https://api.binance.com'];

/** Ativos disponíveis: símbolo Binance → nome aproximado na Quotex. */
export const SYMBOLS = {
  BTCUSDT: 'Bitcoin (BTC/USD)',
  ETHUSDT: 'Ethereum (ETH/USD)',
  BNBUSDT: 'BNB (BNB/USD)',
  SOLUSDT: 'Solana (SOL/USD)',
  XRPUSDT: 'Ripple (XRP/USD)',
  ADAUSDT: 'Cardano (ADA/USD)',
  DOGEUSDT: 'Dogecoin (DOGE/USD)',
  LTCUSDT: 'Litecoin (LTC/USD)',
  TRXUSDT: 'TRON (TRX/USD)',
  AVAXUSDT: 'Avalanche (AVAX/USD)',
  LINKUSDT: 'Chainlink (LINK/USD)',
  DOTUSDT: 'Polkadot (DOT/USD)',
  EURUSDT: 'Euro (EUR/USDT — aproximação, NÃO é o EUR/USD da Quotex)',
};

export function parseKlines(raw) {
  if (!Array.isArray(raw)) throw new Error('Resposta inesperada da fonte de dados');
  return raw.map((k) => ({
    time: Number(k[0]),
    open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]),
    volume: Number(k[5]),
    closeTime: Number(k[6]),
  }));
}

/**
 * Busca candles de 1 minuto. `endTime` opcional (ms) para histórico.
 * Tenta os endpoints em ordem; lança erro com mensagem clara se todos falharem.
 */
export async function fetchKlines(symbol, { limit = 500, endTime, startTime, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!SYMBOLS[symbol] && !/^[A-Z0-9]{5,20}$/.test(symbol)) throw new Error('Símbolo inválido');
  const q = new URLSearchParams({ symbol, interval: '1m', limit: String(Math.min(1000, Math.max(1, limit))) });
  if (endTime) q.set('endTime', String(endTime));
  if (startTime) q.set('startTime', String(startTime));
  let lastErr;
  for (const base of BASE_URLS) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${base}/api/v3/klines?${q}`, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(base).host}`);
      return parseKlines(await res.json());
    } catch (e) {
      lastErr = e.name === 'AbortError' ? new Error(`Tempo esgotado em ${new URL(base).host}`) : e;
    } finally {
      clearTimeout(to);
    }
  }
  throw lastErr ?? new Error('Falha ao obter candles');
}

/** Histórico longo paginado (para backtest). */
export async function fetchHistory(symbol, { minutes, endTime = Date.now(), fetchImpl = fetch } = {}) {
  const out = [];
  let end = endTime;
  while (out.length < minutes) {
    const batch = await fetchKlines(symbol, { limit: 1000, endTime: end, fetchImpl, timeoutMs: 15000 });
    if (!batch.length) break;
    out.unshift(...batch);
    end = batch[0].time - 1;
    if (batch.length < 1000) break;
  }
  const map = new Map(out.map((c) => [c.time, c]));
  return [...map.values()].sort((a, b) => a.time - b.time).slice(-minutes);
}
