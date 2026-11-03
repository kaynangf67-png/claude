import { TF_SECONDS, type Candle, type TF } from "./types.js";

/** CandleAnalyzer: limpeza, vela fechada e qualidade dos dados. */

/** Ordena, remove duplicados (fica a última versão) e descarta candles inválidos. */
export function cleanCandles(raw: Candle[]): { candles: Candle[]; duplicates: number; invalid: number } {
  const byT = new Map<number, Candle>();
  let duplicates = 0, invalid = 0;
  for (const k of raw) {
    const ok = [k.t, k.o, k.h, k.l, k.c].every(Number.isFinite) && k.h >= k.l && k.h >= Math.max(k.o, k.c) - 1e-12 && k.l <= Math.min(k.o, k.c) + 1e-12;
    if (!ok) { invalid++; continue; }
    if (byT.has(k.t)) duplicates++;
    byT.set(k.t, k);
  }
  return { candles: [...byT.values()].sort((a, b) => a.t - b.t), duplicates, invalid };
}

/** Só velas fechadas: a vela em formação nunca entra na análise. */
export const closedOnly = (c: Candle[], tf: TF, now: number) => c.filter((k) => k.t + TF_SECONDS[tf] <= now);

export interface Quality { ok: boolean; issues: string[]; lastClosedAt: number | null; ageMin: number | null; missing: number }

const MAX_AGE_MIN: Record<TF, number> = { M1: 8, M5: 20, M15: 45, H1: 150 };
const MIN_COUNT: Record<TF, number> = { M1: 30, M5: 250, M15: 120, H1: 80 };

/** Qualidade: atualizado, completo e contínuo nas últimas velas. `strictAge` desliga a checagem de atraso (backtest). */
export function assessQuality(c: Candle[], tf: TF, now: number, strictAge = true): Quality {
  const issues: string[] = [];
  const last = c.at(-1);
  if (!last) return { ok: false, issues: [`${tf}: sem velas`], lastClosedAt: null, ageMin: null, missing: 0 };
  const step = TF_SECONDS[tf];
  const ageMin = (now - (last.t + step)) / 60;
  if (strictAge && ageMin > MAX_AGE_MIN[tf]) issues.push(`${tf}: última vela fechada há ${Math.round(ageMin)} min (mercado fechado ou dados atrasados)`);
  if (c.length < MIN_COUNT[tf]) issues.push(`${tf}: histórico curto (${c.length} velas, mínimo ${MIN_COUNT[tf]})`);
  // continuidade nas últimas 12 velas
  const tail = c.slice(-12);
  let missing = 0;
  for (let i = 1; i < tail.length; i++) missing += Math.max(0, Math.round((tail[i].t - tail[i - 1].t) / step) - 1);
  const tolerated = tf === "M1" ? 3 : 1;
  if (missing > tolerated) issues.push(`${tf}: ${missing} velas faltando nas últimas 12`);
  return { ok: issues.length === 0, issues, lastClosedAt: last.t + step, ageMin, missing };
}

export const avgBody = (c: Candle[], n = 20) => {
  const s = c.slice(-n);
  return s.length ? s.reduce((a, k) => a + Math.abs(k.c - k.o), 0) / s.length : 0;
};
