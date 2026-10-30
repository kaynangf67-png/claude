export type Decision = "COMPRA" | "VENDA" | "AGUARDAR";
export type MarketId = "forex" | "crypto" | "b3" | "us_stocks" | "indices" | "futures" | "commodities";

export interface ProviderStatus {
  name: string;
  label: string;
  markets: MarketId[];
  is_live: boolean;
  configured: boolean;
  state: "parado" | "conectando" | "conectado" | "erro" | "sem_credencial" | "aguardando" | "sem_dados";
  message: string;
  last_ok: number | null;
  last_error: string | null;
  symbols: number;
  requires: string[];
}

export interface EngineSettings {
  min_score: number;
  min_adx: number;
  rsi_long_min: number;
  rsi_long_max: number;
  rsi_short_min: number;
  rsi_short_max: number;
  rsi_extreme: number;
  atr_pct_min: number;
  atr_pct_max: number;
  volume_factor: number;
  stop_atr_mult: number;
  max_stop_atr: number;
  tp1_rr: number;
  tp2_rr: number;
  entry_zone_atr: number;
  validity_bars: number;
  max_signal_delay_s: number;
  require_trend: boolean;
}

export interface Status {
  running: boolean;
  started_at: number | null;
  last_cycle: number | null;
  cycles: number;
  timeframe: "M5";
  server_time: number;
  assets_total: number;
  assets_live: number;
  assets_stale: number;
  simulated_present: boolean;
  active_signals: number;
  providers: ProviderStatus[];
  stale_after_s: number;
  engine: EngineSettings;
}

export interface AssetRow {
  key: string;
  symbol: string;
  display: string;
  market: MarketId;
  market_label: string;
  source: string;
  is_live: boolean;
  last_price: number | null;
  change_pct: number | null;
  last_update: number | null;
  data_time: number | null;
  stale: boolean;
  candles: number;
  has_volume: boolean;
  decision: Decision | null;
  direction: "long" | "short" | null;
  score: number | null;
  trend: string | null;
  blocker: string | null;
}

export interface FactorView {
  label: string;
  ok: boolean;
  available: boolean;
  weight: number;
  detail: string;
}

export interface Signal {
  id: string;
  asset_key: string;
  symbol: string;
  market: MarketId;
  market_label: string;
  source: string;
  is_live: boolean;
  timeframe: "M5";
  decision: Decision;
  direction: "long" | "short";
  score: number;
  entry: number;
  zone_low: number;
  zone_high: number;
  stop: number;
  tp1: number;
  tp2: number;
  rr1: number;
  rr2: number;
  bar_time: number;
  created_at: number;
  valid_until: number;
  reasons: string[];
  confirmation: string;
  status: "ativo" | "cancelado" | "expirado" | "executado";
  status_reason: string;
  closed_at: number | null;
  trend: string;
  factors: FactorView[];
}

export interface Trade {
  id: number;
  mode: "demo" | "backtest";
  run_id: number | null;
  signal_id: string | null;
  asset_key: string;
  symbol: string;
  market: MarketId;
  source: string;
  data_is_live: boolean;
  direction: "long" | "short";
  qty: number;
  entry: number;
  stop: number;
  target: number;
  opened_at: number;
  closed_at: number | null;
  exit: number | null;
  exit_reason: string | null;
  pnl: number | null;
  r_multiple: number | null;
  status: "aberta" | "fechada";
  score: number | null;
  last_price?: number | null;
  data_ok?: boolean;
  unrealized?: number;
}

export interface DemoSettings {
  initial_balance: number;
  risk_pct: number;
  daily_loss_limit_pct: number;
  target: "tp1" | "tp2";
  max_open: number;
}

export interface Account {
  mode: "demo";
  balance: number;
  initial_balance: number;
  today_pnl: number;
  daily_loss_limit: number;
  daily_loss_used: number;
  locked: boolean;
  lock_reason: string;
  settings: DemoSettings;
  open_trades: Trade[];
}

export interface Level {
  price: number;
  kind: "suporte" | "resistencia";
  touches: number;
}

export interface Analysis {
  decision: Decision;
  direction: "long" | "short" | null;
  score: number;
  score_long: number;
  score_short: number;
  trend: string;
  bar_time: number | null;
  price: number | null;
  factors: (FactorView & { key: string })[];
  blockers: string[];
  reasons: string[];
  indicators: Record<string, number | boolean | null>;
  levels: { supports: Level[]; resistances: Level[]; range_high: number | null; range_low: number | null };
  plan: {
    entry: number; zone_low: number; zone_high: number; stop: number;
    tp1: number; tp2: number; rr1: number; rr2: number; valid_until: number;
  } | null;
}

export interface CandlePoint { time: number; open: number; high: number; low: number; close: number; volume: number }
export interface LinePoint { time: number; value: number }

export interface ChartPayload {
  asset: AssetRow;
  candles: CandlePoint[];
  forming: CandlePoint | null;
  series: { ema50: LinePoint[]; ema200: LinePoint[]; vwap: LinePoint[]; rsi: LinePoint[]; macd_hist: LinePoint[] };
  analysis: Analysis;
  signal: Signal | null;
}

export interface MarketStatus {
  market: MarketId;
  label: string;
  coverage: "ao_vivo" | "simulado" | "sem_provedor";
  note: string;
  providers: string[];
  assets: number;
  stale: number;
}

export interface Summary {
  trades: number;
  wins: number;
  losses: number;
  hit_rate: number | null;
  total_r: number;
  avg_r: number | null;
  profit_factor: number | null;
  max_drawdown_r: number;
  skipped_late_entries: number;
}

export interface Stats {
  demo: Summary & { pnl: number; simulated_feed_trades: number };
  equity: LinePoint[];
  initial_balance: number;
  backtest: Summary;
  backtest_runs: (Summary & { id: number; asset_key: string; created_at: number; bars: number; from: number; to: number; data_is_live: boolean; source: string })[];
  live: { available: boolean; note: string };
}

export interface VisionResult {
  is_chart: boolean;
  platform: string | null;
  symbol: string | null;
  exchange: string | null;
  timeframe: string | null;
  last_price: number | null;
  visible_datetime_text: string | null;
  visible_datetime_utc: string | null;
  indicators_visible: string[];
  levels_visible: { label: string; price: number | null }[];
  trend_read: string;
  observations: string[];
  missing: string[];
  request_new_capture: boolean;
  new_capture_reason: string | null;
  server_checks: string[];
}
