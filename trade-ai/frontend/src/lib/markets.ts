/** Ativos típicos de corretoras de opções binárias. `tv` é o símbolo do gráfico ao vivo no TradingView. */
export interface Asset {
  id: string;
  label: string;
  group: "Forex" | "Cripto" | "Commodities";
  tv: string;
}

export const ASSETS: Asset[] = [
  { id: "EURUSD", label: "EUR/USD", group: "Forex", tv: "FX:EURUSD" },
  { id: "GBPUSD", label: "GBP/USD", group: "Forex", tv: "FX:GBPUSD" },
  { id: "USDJPY", label: "USD/JPY", group: "Forex", tv: "FX:USDJPY" },
  { id: "AUDUSD", label: "AUD/USD", group: "Forex", tv: "FX:AUDUSD" },
  { id: "USDCAD", label: "USD/CAD", group: "Forex", tv: "FX:USDCAD" },
  { id: "USDCHF", label: "USD/CHF", group: "Forex", tv: "FX:USDCHF" },
  { id: "NZDUSD", label: "NZD/USD", group: "Forex", tv: "FX:NZDUSD" },
  { id: "EURJPY", label: "EUR/JPY", group: "Forex", tv: "FX:EURJPY" },
  { id: "EURGBP", label: "EUR/GBP", group: "Forex", tv: "FX:EURGBP" },
  { id: "GBPJPY", label: "GBP/JPY", group: "Forex", tv: "FX:GBPJPY" },
  { id: "AUDCAD", label: "AUD/CAD", group: "Forex", tv: "FX:AUDCAD" },
  { id: "AUDJPY", label: "AUD/JPY", group: "Forex", tv: "FX:AUDJPY" },
  { id: "BTCUSD", label: "BTC/USD", group: "Cripto", tv: "BINANCE:BTCUSDT" },
  { id: "ETHUSD", label: "ETH/USD", group: "Cripto", tv: "BINANCE:ETHUSDT" },
  { id: "LTCUSD", label: "LTC/USD", group: "Cripto", tv: "BINANCE:LTCUSDT" },
  { id: "XAUUSD", label: "Ouro (XAU/USD)", group: "Commodities", tv: "OANDA:XAUUSD" },
  { id: "XAGUSD", label: "Prata (XAG/USD)", group: "Commodities", tv: "OANDA:XAGUSD" },
  { id: "USOIL", label: "Petróleo (USOIL)", group: "Commodities", tv: "TVC:USOIL" },
];

export const GROUPS = ["Forex", "Cripto", "Commodities"] as const;

export function findAsset(id: string | null | undefined): Asset {
  return ASSETS.find((a) => a.id === id) ?? ASSETS[0];
}
