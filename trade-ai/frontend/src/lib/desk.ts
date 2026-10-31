/** Regras das mesas de operação simulada. Funções puras: o motor (useDesks) só as aplica. */

export const WIN_GOAL = 5;
export const LOSS_LIMIT = 2;
export const LOCK_S = 24 * 3600;
export const M5 = 300;

export interface Candle { time: number; open: number; high: number; low: number; close: number; closed: boolean }

export interface Trade {
  id: string;
  asset: string;
  direction: "CALL" | "PUT";
  entryPrice: number;
  entryAt: number; // epoch s
  expiry: number; // epoch s, fechamento de uma vela M5
  stake: number;
  payout: number; // 0.85 = 85%
  reasons: string[];
  result?: "win" | "loss" | "empate" | "anulada";
  exitPrice?: number;
  profit?: number;
}

export interface LastDecision {
  at: number;
  decision: "CALL" | "PUT" | "AGUARDAR" | "ERRO";
  reasons: string[];
  against: string[];
  blocks: string[];
  error?: string;
}

export interface DeskState {
  id: string;
  name: string;
  asset: string;
  payout: number;
  stake: number;
  on: boolean;
  balance: number;
  wins: number;
  losses: number;
  day: string; // dia (Brasília) dos contadores
  lockUntil: number | null;
  lockReason: string;
  open: Trade | null;
  history: Trade[];
  lastAnalyzed: number | null; // abertura da vela M5 já analisada
  last: LastDecision | null;
}

export function today(nowS: number): string {
  return new Date(nowS * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function newDesk(id: string, name: string, asset: string, nowS: number): DeskState {
  return {
    id, name, asset, payout: 0.85, stake: 10, on: false, balance: 1000, wins: 0, losses: 0, day: today(nowS),
    lockUntil: null, lockReason: "", open: null, history: [], lastAnalyzed: null, last: null,
  };
}

/** Fim de trava e virada de dia: zera os contadores quando a trava acaba ou, sem trava, quando muda o dia. */
export function refresh(s: DeskState, nowS: number): DeskState {
  if (s.lockUntil !== null) {
    if (nowS < s.lockUntil) return s;
    return { ...s, lockUntil: null, lockReason: "", wins: 0, losses: 0, day: today(nowS) };
  }
  const d = today(nowS);
  return d === s.day ? s : { ...s, wins: 0, losses: 0, day: d };
}

export function canTrade(s: DeskState, nowS: number): boolean {
  return s.on && s.open === null && (s.lockUntil === null || nowS >= s.lockUntil);
}

/** Abertura da última vela M5 fechada. */
export function lastClosedOpen(nowS: number): number {
  return Math.floor(nowS / M5) * M5 - M5;
}

/**
 * Expiração no fechamento de uma vela M5, como nas corretoras: se faltar menos de 2,5 min para
 * a vela atual fechar, a primeira vela de expiração é a seguinte.
 */
export function expiryFor(entryAt: number, candles: number): number {
  let end = Math.ceil(entryAt / M5) * M5;
  if (end - entryAt < 150) end += M5;
  return end + (Math.max(1, Math.min(3, candles)) - 1) * M5;
}

/** Resultado pela vela M5 que fecha na expiração. null = vela ainda não disponível. */
export function settle(t: Trade, candles: Candle[]): Pick<Trade, "result" | "exitPrice" | "profit"> | null {
  const c = candles.find((x) => x.time === t.expiry - M5 && x.closed);
  if (!c) return null;
  const up = c.close > t.entryPrice;
  const down = c.close < t.entryPrice;
  if (!up && !down) return { result: "empate", exitPrice: c.close, profit: 0 };
  const win = t.direction === "CALL" ? up : down;
  return { result: win ? "win" : "loss", exitPrice: c.close, profit: win ? t.stake * t.payout : -t.stake };
}

/** Aplica o resultado e as regras: 5 wins ou 2 losses no dia travam a mesa por 24 horas. */
export function applyResult(s: DeskState, t: Trade, nowS: number): DeskState {
  const done: Trade = t;
  let next: DeskState = {
    ...s,
    open: null,
    history: [done, ...s.history].slice(0, 200),
    balance: s.balance + (done.profit ?? 0),
    wins: s.wins + (done.result === "win" ? 1 : 0),
    losses: s.losses + (done.result === "loss" ? 1 : 0),
  };
  if (next.wins >= WIN_GOAL) next = { ...next, lockUntil: nowS + LOCK_S, lockReason: `Meta de ${WIN_GOAL} wins batida` };
  else if (next.losses >= LOSS_LIMIT) next = { ...next, lockUntil: nowS + LOCK_S, lockReason: `Limite de ${LOSS_LIMIT} losses atingido` };
  return next;
}

export function stats(history: Trade[]) {
  const done = history.filter((t) => t.result === "win" || t.result === "loss");
  const wins = done.filter((t) => t.result === "win").length;
  return { n: done.length, wins, rate: done.length ? wins / done.length : null };
}
