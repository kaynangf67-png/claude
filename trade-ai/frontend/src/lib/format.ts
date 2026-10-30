export function price(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 10 ? 3 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 8;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits });
}

export function money(v: number | null | undefined, sign = false): string {
  if (v === null || v === undefined) return "—";
  const s = v.toLocaleString("pt-BR", { style: "currency", currency: (import.meta.env.VITE_ACCOUNT_CURRENCY as string | undefined) ?? "BRL", maximumFractionDigits: 2 });
  return sign && v > 0 ? `+${s}` : s;
}

export function pct(v: number | null | undefined, digits = 2, sign = true): string {
  if (v === null || v === undefined) return "—";
  const s = `${v.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
  return sign && v > 0 ? `+${s}` : s;
}

export function ratio(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
}

export function time(ts: number | null | undefined, seconds = false): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}),
  });
}

export function dateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function ago(ts: number | null | undefined, now = Date.now() / 1000): string {
  if (!ts) return "nunca";
  const d = Math.max(0, Math.round(now - ts));
  if (d < 60) return `há ${d}s`;
  if (d < 3600) return `há ${Math.floor(d / 60)} min`;
  if (d < 86400) return `há ${Math.floor(d / 3600)} h`;
  return `há ${Math.floor(d / 86400)} d`;
}

export function countdown(until: number, now = Date.now() / 1000): string {
  const d = Math.round(until - now);
  if (d <= 0) return "vencido";
  const m = Math.floor(d / 60);
  return `${m}:${String(d % 60).padStart(2, "0")}`;
}

export const SOURCE_LABEL: Record<string, string> = {
  binance: "Binance",
  twelvedata: "Twelve Data",
  tradingview: "TradingView",
  simulado: "Simulado",
};
