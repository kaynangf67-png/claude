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

/** Tempo gráfico escolhido pelo usuário (o do SETUP) → os quatro papéis e o horizonte. */
export type SetupTf = "M1" | "M5" | "M15" | "H1" | "H4";
export const SETUP_TFS: Record<SetupTf, Roles & { horizon: Horizon }> = {
  M1: { ctx: "M15", struct: "M5", setup: "M1", trigger: "M1", horizon: "curto" },
  M5: { ...HORIZON_TFS.curto, horizon: "curto" },
  M15: { ctx: "H4", struct: "H1", setup: "M15", trigger: "M5", horizon: "curto" },
  H1: { ...HORIZON_TFS.swing, horizon: "swing" },
  H4: { ctx: "D1", struct: "D1", setup: "H4", trigger: "H1", horizon: "swing" },
};
export const isSetupTf = (v: unknown): v is SetupTf => typeof v === "string" && v in SETUP_TFS;
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
