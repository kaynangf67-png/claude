/** Estatística do teste histórico e do diário. Descritiva: não otimiza nem promete nada. */

/** Intervalo de confiança de Wilson (95%) para uma proporção. */
export function wilson(wins: number, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const z = 1.96;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

/** Taxa de acerto mínima para não perder dinheiro com o payout informado (1 ÷ (1 + payout)). */
export function breakevenRate(payoutPercent: number): number {
  return 1 / (1 + payoutPercent / 100);
}

export interface Tally {
  /** Ganhos + perdas (empates ficam de fora). */
  n: number;
  wins: number;
  losses: number;
  ties: number;
  rate: number;
  lo: number;
  hi: number;
}

export function tally(rows: Array<{ win: boolean; tie: boolean }>): Tally {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const r of rows) {
    if (r.tie) ties++;
    else if (r.win) wins++;
    else losses++;
  }
  const n = wins + losses;
  const [lo, hi] = wilson(wins, n);
  return { n, wins, losses, ties, rate: n ? wins / n : 0, lo, hi };
}

export type Verdict = 'sem_casos' | 'acima' | 'abaixo' | 'inconclusivo';

/**
 * "acima" só quando o intervalo INTEIRO está acima do equilíbrio; "abaixo"
 * quando está inteiro abaixo; caso contrário a amostra não permite concluir.
 */
export function verdict(t: Tally, breakeven: number): Verdict {
  if (t.n === 0) return 'sem_casos';
  if (t.lo > breakeven) return 'acima';
  if (t.hi < breakeven) return 'abaixo';
  return 'inconclusivo';
}
