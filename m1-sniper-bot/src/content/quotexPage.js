// Leitura PASSIVA e best-effort da página da Quotex. Não clica, não envia
// ordens e não usa APIs privadas. Os seletores/URLs da Quotex não são
// documentados e podem mudar: tudo aqui é marcado como "não verificado".

/** DEMO/REAL a partir da URL (ex.: /pt/demo-trade vs /pt/trade). */
export function detectPageMode(loc = location) {
  const p = loc.pathname.toLowerCase();
  if (p.includes('demo')) return 'DEMO';
  if (/\/trade(\/|$)/.test(p)) return 'REAL';
  return 'UNKNOWN';
}

/** Tenta achar um par tipo "BTC/USD" ou "EUR/USD (OTC)" no título da aba. */
export function detectAsset(doc = document) {
  const m = (doc.title || '').match(/\b([A-Z]{2,6})\s*\/\s*([A-Z]{2,6})(\s*\(?OTC\)?)?/i);
  if (!m) return null;
  return { base: m[1].toUpperCase(), quote: m[2].toUpperCase(), otc: !!m[3], label: m[0].trim() };
}

/** O ativo da Quotex corresponde ao símbolo analisado na fonte independente? */
export function assetMatches(asset, symbol) {
  if (!asset) return null; // desconhecido
  if (asset.otc) return false; // OTC é preço sintético da corretora: sem fonte externa
  return symbol.startsWith(asset.base);
}
