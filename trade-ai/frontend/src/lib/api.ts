import type {
  Account, AssetRow, ChartPayload, DemoSettings, EngineSettings, MarketStatus, ProviderStatus, Signal, Stats,
  Status, Trade, VisionResult,
} from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Servidor do Trade AI fora do ar ou inacessível");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* corpo não-JSON */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

const post = <T,>(path: string, body?: unknown) =>
  req<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T,>(path: string, body: unknown) => req<T>(path, { method: "PUT", body: JSON.stringify(body) });

export const api = {
  status: () => req<Status>("/api/status"),
  start: () => post<Status>("/api/scanner/start"),
  stop: () => post<Status>("/api/scanner/stop"),
  markets: () => req<{ markets: MarketStatus[]; providers: ProviderStatus[] }>("/api/markets"),
  assets: (params: Record<string, string | number | boolean | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)));
    return req<{ assets: AssetRow[]; total: number }>(`/api/assets?${q}`);
  },
  chart: (key: string) => req<ChartPayload>(`/api/assets/${encodeURIComponent(key)}/chart`),
  signals: (status?: string) => req<{ signals: Signal[] }>(`/api/signals${status ? `?status=${status}` : ""}`),
  settings: () =>
    req<{ engine: EngineSettings; demo: DemoSettings; integrations: Record<string, boolean | string> }>("/api/settings"),
  putEngine: (body: Partial<EngineSettings>) => put<EngineSettings>("/api/settings/engine", body),
  putDemo: (body: Partial<DemoSettings>) => put<DemoSettings>("/api/settings/demo", body),
  account: () => req<Account>("/api/demo/account"),
  openTrade: (signal_id: string) => post<Trade>("/api/demo/trades", { signal_id }),
  closeTrade: (id: number) => post<Trade>(`/api/demo/trades/${id}/close`),
  emergency: () => post<{ closed: number; account: Account }>("/api/demo/emergency"),
  unlock: () => post<Account>("/api/demo/unlock"),
  reset: (initial_balance: number) => post<Account>("/api/demo/reset", { initial_balance }),
  trades: (mode: "demo" | "backtest") => req<{ trades: Trade[] }>(`/api/trades?mode=${mode}`),
  stats: () => req<Stats>("/api/stats"),
  backtest: (asset_key: string) => post<Stats["backtest_runs"][number]>("/api/backtest", { asset_key }),
  events: () => req<{ events: { at: number; kind: string; message: string }[] }>("/api/events"),
  vision: (file: Blob, asset_key?: string) => {
    const fd = new FormData();
    fd.append("file", file, "captura.png");
    if (asset_key) fd.append("asset_key", asset_key);
    return req<VisionResult>("/api/vision/analyze", { method: "POST", body: fd });
  },
  importCsv: (file: File, symbol: string, market: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("symbol", symbol);
    fd.append("market", market);
    return req<{ asset: string; candles: number }>("/api/import/csv", { method: "POST", body: fd });
  },
};

export function wsUrl(): string {
  if (BASE) return BASE.replace(/^http/, "ws") + "/ws";
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}

export function webhookUrl(): string {
  return (BASE || location.origin) + "/api/webhooks/tradingview";
}
