/** Taxa de acerto mínima para empatar com um payout (ex.: 0,85 -> 54,05%). */
export function breakEven(payout: number): number {
  return 1 / (1 + payout);
}

/** Intervalo de confiança de Wilson (95%) para a taxa de acerto real. */
export function wilson(wins: number, n: number, z = 1.96): [number, number] | null {
  if (n === 0) return null;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

/** Resultado em unidades de entrada: ganho = +payout, perda = -1. */
export function units(wins: number, losses: number, payout: number): number {
  return wins * payout - losses;
}

/**
 * Entrada na abertura da próxima vela e expiração após N velas, pelo relógio do aparelho.
 * Se faltar menos de `minLeadS` segundos para a próxima vela, pula para a seguinte.
 */
export function entryTimes(now: Date, tfMinutes: number, expCandles: number, minLeadS = 10) {
  const step = tfMinutes * 60_000;
  let open = Math.ceil(now.getTime() / step) * step;
  if (open - now.getTime() < minLeadS * 1000) open += step;
  return { entry: new Date(open), expiry: new Date(open + expCandles * step) };
}

export function hhmm(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
