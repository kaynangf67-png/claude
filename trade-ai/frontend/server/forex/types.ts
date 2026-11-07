export interface Candle { t: number; o: number; h: number; l: number; c: number; v?: number }
export type TF = "D1" | "H4" | "H1" | "M15" | "M5" | "M1";
export const TF_SECONDS: Record<TF, number> = { D1: 86400, H4: 14400, H1: 3600, M15: 900, M5: 300, M1: 60 };

/** Horizonte da análise. curto = minutos a ~1 hora; swing = posição que pode durar dias. */
export type Horizon = "curto" | "swing";
/** Papéis dos tempos gráficos: contexto/regiões, estrutura, setup e gatilho. */
export interface Roles { ctx: TF; struct: TF; setup: TF; trigger: TF }
export const HORIZON_TFS: Record<Horizon, Roles> = {
  curto: { ctx: "H1", struct: "M15", setup: "M5", trigger: "M1" },
  swing: { ctx: "D1", struct: "H4", setup: "H1", trigger: "M15" },
};
export type Trend = "alta" | "baixa" | "lateral";
export type Dir = "BUY" | "SELL";
export const opposite = (d: Dir): Dir => (d === "BUY" ? "SELL" : "BUY");

export interface Pivot { i: number; t: number; price: number; type: "high" | "low" }

export interface Region {
  low: number; high: number;
  role: "suporte" | "resistencia";
  strength: "forte" | "secundaria";
  reactions: number;
  origin: TF;
  distance: number;      // distância do preço atual até a borda mais próxima
  distancePips: number;
  intensity: number;     // 0 a 100
}

export interface Line {
  kind: "LTA" | "LTB";
  slope: number;          // preço por candle
  valueNow: number;       // valor da linha na última vela
  touches: number;
  points: Pivot[];
  broken: boolean;
  retested: boolean;
}

export interface StructureInfo {
  trend: Trend;
  lastHigh: Pivot | null;
  lastLow: Pivot | null;
  higherHighs: boolean; higherLows: boolean; lowerHighs: boolean; lowerLows: boolean;
  bos: Dir | null;        // rompimento de estrutura a favor da tendência (ou de direção)
  choch: Dir | null;      // mudança de caráter
}

export interface Pattern { name: string; dir: Dir | "neutro"; index: number; confirmed: boolean; weight: number }
export interface Fvg { dir: Dir; low: number; high: number; index: number; status: "aberto" | "parcial" | "preenchido" }
export interface Sweep { dir: Dir; level: number; index: number }

/** Tamanho do pip por par. */
export const pipSize = (symbol: string) => (symbol.includes("JPY") ? 0.01 : 0.0001);
export const fmtPrice = (v: number, symbol: string) => v.toFixed(symbol.includes("JPY") ? 3 : 5);
