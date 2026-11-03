/**
 * DAILY RISK MANAGER 2X0 — regra do dia, no backend, sem depender de interface.
 *
 * Configuração FIXA (não configurável): R$ 5,00 de risco por operação, no máximo 2 operações por dia,
 * meta de 2 vitórias, limite de 1 derrota. Qualquer derrota ou a segunda vitória travam o dia.
 *
 * O estado é DERIVADO da lista de operações do dia (nunca guardado à parte), então não existe combinação
 * inconsistente: reiniciar servidor, recarregar a página ou repetir um evento não muda o resultado.
 * Todas as funções são puras: recebem o dia e devolvem um dia novo (ou lançam RiskViolation).
 */
export const RISK_BRL = 5;
export const MAX_TRADES_PER_DAY = 2;
export const WIN_TARGET = 2;
export const LOSS_LIMIT = 1;
export const TZ = "America/Sao_Paulo";

export type MgrState = "READY" | "FIRST_TRADE_ACTIVE" | "FIRST_WIN" | "SECOND_TRADE_ACTIVE" | "TARGET_REACHED" | "DAILY_LOCKED" | "WAIT_NEXT_DAY";
/** OPEN = em andamento; UNKNOWN = resultado não confirmado (falha de dados): continua bloqueando. Só WIN/LOSS contam como resultado. */
export type TradeResult = "OPEN" | "WIN" | "LOSS" | "UNKNOWN";

export interface DayTrade {
  id: string; setupId: string; symbol: string; dir: "BUY" | "SELL"; openedAt: number;
  result: TradeResult; closedAt?: number;
  /** Resultado em R, já com custos, e o equivalente em reais simulados (R × R$ 5). Só existe depois do fechamento. */
  r?: number; brl?: number;
}
export interface DayState { date: string; trades: DayTrade[]; version: number }

export class RiskViolation extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "RiskViolation"; }
}

// ---------- calendário operacional (America/Sao_Paulo) ----------
const fmtDate = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtWd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const fmtHm = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
export const brtDate = (tsSec: number) => fmtDate.format(new Date(tsSec * 1000));            // "2026-11-03"
export const brtWeekday = (tsSec: number) => fmtWd.format(new Date(tsSec * 1000));            // "Tue"
export const brtMinutes = (tsSec: number) => { const [h, m] = fmtHm.format(new Date(tsSec * 1000)).split(":").map(Number); return (h % 24) * 60 + m; };
/** Dia operacional = segunda a sexta no fuso de São Paulo. */
export const isOperationalDay = (tsSec: number) => !["Sat", "Sun"].includes(brtWeekday(tsSec));

// ---------- estado derivado ----------
const count = (d: DayState, r: TradeResult) => d.trades.filter((t) => t.result === r).length;
export const wins = (d: DayState) => count(d, "WIN");
export const losses = (d: DayState) => count(d, "LOSS");
export const pending = (d: DayState) => d.trades.filter((t) => t.result === "OPEN" || t.result === "UNKNOWN");
export const hasPending = (d: DayState) => pending(d).length > 0;

export function newDay(date: string): DayState { return { date, trades: [], version: 0 }; }

/** Tabela oficial: (vitórias, derrotas) → estado, com as operações em andamento sobrepondo o resultado parcial. */
export function stateOf(d: DayState): MgrState {
  const p = pending(d);
  if (p.length) return d.trades.length >= 2 ? "SECOND_TRADE_ACTIVE" : "FIRST_TRADE_ACTIVE";
  if (losses(d) >= LOSS_LIMIT) return "DAILY_LOCKED";
  if (wins(d) >= WIN_TARGET) return "TARGET_REACHED";
  if (wins(d) === 1) return "FIRST_WIN";
  return "READY";
}
/** Estado mostrado ao usuário: fora de dia operacional (fim de semana) o agente aguarda o próximo dia. */
export function viewState(d: DayState, nowSec: number): MgrState {
  const s = stateOf(d);
  if (hasPending(d)) return s;
  return isOperationalDay(nowSec) && d.date === brtDate(nowSec) ? s : "WAIT_NEXT_DAY";
}

export interface Gate { ok: boolean; reason: string | null }
const no = (reason: string): Gate => ({ ok: false, reason });

/** Pode abrir uma nova operação AGORA? Verifica só a regra do dia; filtros técnicos, horário e notícias são de outros módulos. */
export function canOpen(d: DayState, nowSec: number): Gate {
  if (d.date !== brtDate(nowSec)) return no("O dia operacional guardado não é o de hoje: é preciso rolar o dia antes de operar.");
  if (!isOperationalDay(nowSec)) return no("Hoje não é dia operacional (sábado ou domingo).");
  if (hasPending(d)) return no(pending(d).some((t) => t.result === "UNKNOWN") ? "Há operação com resultado desconhecido: novas entradas bloqueadas até reconciliar." : "Há operação em andamento: só uma por vez.");
  if (losses(d) >= LOSS_LIMIT) return no("DIA ENCERRADO — LOSS IDENTIFICADO. Novas entradas só no próximo dia operacional.");
  if (wins(d) >= WIN_TARGET) return no("META ALCANÇADA — 2X0. Novas entradas só no próximo dia operacional.");
  if (d.trades.length >= MAX_TRADES_PER_DAY) return no("Limite de 2 operações por dia atingido.");
  return { ok: true, reason: null };
}

export function openTrade(d: DayState, t: Omit<DayTrade, "result">, nowSec: number): DayState {
  const g = canOpen(d, nowSec);
  if (!g.ok) throw new RiskViolation("BLOCKED", g.reason!);
  if (d.trades.some((x) => x.id === t.id || x.setupId === t.setupId)) throw new RiskViolation("DUPLICATE", "Entrada duplicada: este setup já foi registrado hoje.");
  return { ...d, version: d.version + 1, trades: [...d.trades, { ...t, result: "OPEN" }] };
}

/**
 * Fecha uma operação. WIN/LOSS só vêm de resultado CONFIRMADO. UNKNOWN mantém o bloqueio.
 * Repetir o mesmo fechamento é inofensivo; trocar um resultado já confirmado é proibido.
 */
export function closeTrade(d: DayState, id: string, result: Exclude<TradeResult, "OPEN">, nowSec: number, money?: { r: number }): DayState {
  const t = d.trades.find((x) => x.id === id);
  if (!t) throw new RiskViolation("NOT_FOUND", "Operação não encontrada neste dia.");
  if (t.result === "WIN" || t.result === "LOSS") {
    if (t.result === result) return d;
    throw new RiskViolation("IMMUTABLE", "Resultado já confirmado não pode ser alterado.");
  }
  const brl = result === "UNKNOWN" || !money ? undefined : Math.round(money.r * RISK_BRL * 100) / 100;
  const upd: DayTrade = { ...t, result, closedAt: result === "UNKNOWN" ? t.closedAt : nowSec, r: result === "UNKNOWN" ? undefined : money?.r, brl };
  return { ...d, version: d.version + 1, trades: d.trades.map((x) => (x.id === id ? upd : x)) };
}

/**
 * Virada do dia. Zera vitórias/derrotas SÓ se não houver operação pendente do dia anterior; o histórico dos dias
 * anteriores continua guardado pelo chamador (esta função devolve o dia novo e o dia que fica arquivado).
 */
export function rollover(prev: DayState | null, nowSec: number): { day: DayState; archived: DayState | null; rolled: boolean; blockedByPending: boolean } {
  const today = brtDate(nowSec);
  if (!prev) return { day: newDay(today), archived: null, rolled: true, blockedByPending: false };
  if (prev.date === today) return { day: prev, archived: null, rolled: false, blockedByPending: false };
  if (prev.date > today) return { day: prev, archived: null, rolled: false, blockedByPending: false }; // relógio voltou: nunca apaga
  if (hasPending(prev)) return { day: prev, archived: null, rolled: false, blockedByPending: true };
  return { day: newDay(today), archived: prev, rolled: true, blockedByPending: false };
}

// ---------- texto do painel ----------
export interface Panel {
  goal: string; risk: string; wins: string; losses: string; ops: string; state: MgrState; banner: string | null;
  canTrade: boolean; reason: string | null; resultBrl: number; resultR: number; perfect2x0: boolean;
}
export function panel(d: DayState, nowSec: number): Panel {
  const st = viewState(d, nowSec), gate = canOpen(d, nowSec);
  const closed = d.trades.filter((t) => t.result === "WIN" || t.result === "LOSS");
  const banner = st === "DAILY_LOCKED" && losses(d) >= 1 ? "DIA ENCERRADO — LOSS IDENTIFICADO. O agente voltará a procurar oportunidades somente no próximo dia operacional."
    : st === "TARGET_REACHED" ? "META ALCANÇADA — 2X0. O agente voltará a procurar oportunidades somente no próximo dia operacional."
    : st === "WAIT_NEXT_DAY" ? "Aguardando o próximo dia operacional." : null;
  return {
    goal: "META DIÁRIA: 2/2 VITÓRIAS.", risk: `RISCO POR ENTRADA: R$ ${RISK_BRL.toFixed(2).replace(".", ",")}.`,
    wins: `VITÓRIAS: ${wins(d)}/2.`, losses: `DERROTAS: ${losses(d)}/1.`, ops: `OPERAÇÕES REALIZADAS: ${d.trades.length}/2.`,
    state: st, banner, canTrade: gate.ok, reason: gate.reason,
    resultBrl: Math.round(closed.reduce((s, t) => s + (t.brl ?? 0), 0) * 100) / 100, resultR: Math.round(closed.reduce((s, t) => s + (t.r ?? 0), 0) * 100) / 100,
    perfect2x0: wins(d) === 2 && losses(d) === 0,
  };
}
