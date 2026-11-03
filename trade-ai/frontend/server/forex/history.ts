import { wilson } from "../../src/lib/math.js";
import type { Candle, Dir } from "./types.js";

/** Histórico e desempenho. O resultado usa a sequência real das velas: stop e alvo na mesma vela contam como STOP (conservador). */
export interface SavedSignal {
  id: string; symbol: string; label: string; at: number; tf: string; dir: Dir; strategy: string;
  entry: number; sl: number; tps: (number | null)[]; score: number; reasons: string[]; pip: number;
}
export type Outcome = "aberto" | "tp1" | "stop" | "ambiguo" | "expirado";
export interface Resolved extends SavedSignal { status: Outcome; r: number | null; closedAt: number | null }

const MAX_HOLD_S = 3600; // operação curta: expira em 1 hora

export function resolveSignal(sig: SavedSignal, candles: Candle[]): Resolved {
  const buy = sig.dir === "BUY", risk = Math.abs(sig.entry - sig.sl), tp1 = sig.tps[0];
  if (!tp1 || risk <= 0) return { ...sig, status: "aberto", r: null, closedAt: null };
  const rr = Math.abs(tp1 - sig.entry) / risk;
  let lastClose = sig.entry;
  for (const k of candles) {
    if (k.t < sig.at) continue;
    lastClose = k.c;
    const hitSl = buy ? k.l <= sig.sl : k.h >= sig.sl, hitTp = buy ? k.h >= tp1 : k.l <= tp1;
    if (hitSl && hitTp) return { ...sig, status: "ambiguo", r: -1, closedAt: k.t };
    if (hitSl) return { ...sig, status: "stop", r: -1, closedAt: k.t };
    if (hitTp) return { ...sig, status: "tp1", r: rr, closedAt: k.t };
    if (k.t - sig.at > MAX_HOLD_S) return { ...sig, status: "expirado", r: (buy ? k.c - sig.entry : sig.entry - k.c) / risk, closedAt: k.t };
  }
  return { ...sig, status: "aberto", r: null, closedAt: null, ...(lastClose ? {} : {}) };
}

export interface GroupStat { key: string; n: number; wins: number; winRate: number | null; sumR: number }
export interface Stats {
  n: number; open: number; wins: number; losses: number;
  winRate: number | null; ci: [number, number] | null; lossRate: number | null;
  sumR: number; expectancy: number | null; profitFactor: number | null; maxDrawdownR: number;
  byStrategy: GroupStat[]; bySymbol: GroupStat[]; byTf: GroupStat[]; byScore: GroupStat[];
  note: string;
}

const band = (s: number) => (s >= 85 ? "85–100" : s >= 75 ? "75–84" : s >= 65 ? "65–74" : "abaixo de 65");

function group(list: Resolved[], key: (r: Resolved) => string): GroupStat[] {
  const m = new Map<string, Resolved[]>();
  for (const r of list) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return [...m.entries()].map(([k, v]) => {
    const wins = v.filter((r) => (r.r ?? 0) > 0).length;
    return { key: k, n: v.length, wins, winRate: v.length ? wins / v.length : null, sumR: v.reduce((s, r) => s + (r.r ?? 0), 0) };
  }).sort((a, b) => b.n - a.n);
}

export function computeStats(all: Resolved[]): Stats {
  const done = all.filter((r) => r.r !== null && r.status !== "aberto").sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
  const wins = done.filter((r) => (r.r ?? 0) > 0), losses = done.filter((r) => (r.r ?? 0) <= 0);
  const sumR = done.reduce((s, r) => s + (r.r ?? 0), 0);
  const gain = wins.reduce((s, r) => s + (r.r ?? 0), 0), loss = Math.abs(losses.reduce((s, r) => s + (r.r ?? 0), 0));
  let peak = 0, cum = 0, dd = 0;
  for (const r of done) { cum += r.r ?? 0; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  const n = done.length;
  return {
    n, open: all.filter((r) => r.status === "aberto").length, wins: wins.length, losses: losses.length,
    winRate: n ? wins.length / n : null, ci: wilson(wins.length, n), lossRate: n ? losses.length / n : null,
    sumR, expectancy: n ? sumR / n : null, profitFactor: loss > 0 ? gain / loss : null, maxDrawdownR: dd,
    byStrategy: group(done, (r) => r.strategy), bySymbol: group(done, (r) => r.label), byTf: group(done, (r) => r.tf), byScore: group(done, (r) => band(r.score)),
    note: n < 30 ? "Amostra pequena (menos de 30 sinais resolvidos): não tire conclusões." : "Resultado passado não garante resultado futuro.",
  };
}

/** Item do histórico no navegador: toda análise é registrada, inclusive NO TRADE. `realR` só existe se o usuário informou um resultado real. */
export interface HistItem extends Partial<Omit<SavedSignal, "dir" | "score">> {
  id: string; symbol: string; label: string; at: number; tf: string; decision: string; state: string; dir: Dir | null; strategy: string;
  score: number | null; missing?: string[]; realR?: number | null;
}
export interface HistorySummary {
  analyses: { total: number; entries: number; waiting: number; noTrade: number };
  /** Resultados conferidos automaticamente com as velas reais (simulação: não houve ordem de verdade). */
  simulated: Stats;
  /** Só o que o usuário registrou como resultado real. Vazio se nunca registrou. */
  real: Stats | null;
  unresolved: number;
  noTradeBySymbol: { key: string; n: number }[];
  noTradeReasons: { key: string; n: number }[];
}

const countBy = (xs: string[]) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
};

/** Separa resultados simulados, reais e não resolvidos (grupos que não se sobrepõem) e conta as análises sem operação. */
export function summarizeHistory(items: HistItem[], resolved: Resolved[]): HistorySummary {
  const byId = new Map(resolved.map((r) => [r.id, r]));
  const entries = items.filter((i) => i.dir);
  const realItems = entries.filter((i) => typeof i.realR === "number" && Number.isFinite(i.realR));
  const realIds = new Set(realItems.map((i) => i.id));
  const real: Resolved[] = realItems.map((i) => {
    const base = byId.get(i.id);
    return { ...(base ?? (i as unknown as SavedSignal)), status: (i.realR as number) > 0 ? "tp1" : "stop", r: i.realR as number, closedAt: base?.closedAt ?? i.at } as Resolved;
  });
  const sim = resolved.filter((r) => !realIds.has(r.id) && r.status !== "aberto");
  const noTrade = items.filter((i) => !i.dir);
  return {
    analyses: { total: items.length, entries: entries.length, waiting: items.filter((i) => !i.dir && i.state === "aguardando_confirmacao").length, noTrade: noTrade.length },
    simulated: computeStats(sim),
    real: real.length ? computeStats(real) : null,
    unresolved: entries.filter((i) => !realIds.has(i.id) && (byId.get(i.id)?.status ?? "aberto") === "aberto").length,
    noTradeBySymbol: countBy(noTrade.map((i) => i.label)),
    noTradeReasons: countBy(noTrade.map((i) => (i.missing?.[0] ?? "sem setup válido").split(":")[0].slice(0, 60))).slice(0, 8),
  };
}
