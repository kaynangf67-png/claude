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

/** Dia da semana (0 = domingo) e hora decimal em Nova York, onde os mercados abrem e fecham. */
function newYork(now: Date): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, hour: Number(get("hour")) + Number(get("minute")) / 60 };
}

export interface MarketState {
  open: boolean;
  note: string;
}

/**
 * Horário de negociação:
 * - Cripto: 24h, todos os dias.
 * - Forex: de domingo 17h a sexta 17h (Nova York).
 * - Ouro, prata, petróleo: de domingo 18h a sexta 17h, com pausa diária das 17h às 18h (Nova York).
 * Feriados não estão incluídos.
 */
export function marketState(asset: Asset, now = new Date()): MarketState {
  if (asset.group === "Cripto") return { open: true, note: "Aberto 24 horas, todos os dias" };
  const { day, hour } = newYork(now);
  const reopen = "Reabre domingo no fim da tarde (horário de Brasília)";
  if (day === 6) return { open: false, note: `Fechado no fim de semana. ${reopen}` };
  if (asset.group === "Forex") {
    if (day === 0 && hour < 17) return { open: false, note: `Fechado no fim de semana. ${reopen}` };
    if (day === 5 && hour >= 17) return { open: false, note: `Fechado no fim de semana. ${reopen}` };
    return { open: true, note: "Aberto agora" };
  }
  if (day === 0 && hour < 18) return { open: false, note: `Fechado no fim de semana. ${reopen}` };
  if (day === 5 && hour >= 17) return { open: false, note: `Fechado no fim de semana. ${reopen}` };
  if (hour >= 17 && hour < 18) return { open: false, note: "Pausa diária de 1 hora; reabre em instantes" };
  return { open: true, note: "Aberto agora" };
}
