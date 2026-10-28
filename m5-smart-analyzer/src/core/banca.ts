import { breakevenRate, wilson } from './stats';

/**
 * Simulador de banca (Monte Carlo). Pergunta: dada uma taxa de acerto, um payout
 * e um tamanho de entrada, o que a banca costuma fazer?
 *
 * É MATEMÁTICA, não previsão: assume operações independentes e taxa constante,
 * o que o mercado não garante. Com taxa abaixo do equilíbrio o resultado é
 * perda; com a taxa estimada de uma amostra pequena, a incerteza é grande
 * (por isso `simularCenarios` usa o intervalo de Wilson).
 */

export interface BancaInput {
  /** Taxa de acerto, 0 a 1. */
  winRate: number;
  payoutPercent: number;
  /** 'percent': fração da banca ATUAL (juros compostos). 'fixo': valor fixo em unidades. */
  stakeMode: 'percent' | 'fixo';
  /** % da banca (0–100] ou valor fixo (> 0). */
  stake: number;
  initial: number;
  trades: number;
  /** Caminhos simulados (padrão 1000). */
  paths?: number;
  /** Semente: o mesmo resultado a cada execução (padrão 12345). */
  seed?: number;
}

export interface Percentis { p5: number; p25: number; p50: number; p75: number; p95: number }

export interface BancaResult {
  /** Valor esperado por unidade apostada: p·b − (1 − p). */
  ev: number;
  breakeven: number;
  /** Fração de Kelly (0 se o valor esperado não é positivo). */
  kelly: number;
  /** Banca final. */
  final: Percentis;
  /** Probabilidade de terminar acima da banca inicial. */
  pAcima: number;
  /** Probabilidade de a banca, em algum momento, cair 50% ou mais abaixo da inicial. */
  pQueda50: number;
  /** Probabilidade de quebra: banca abaixo de 10% da inicial em algum momento. */
  pQuebra: number;
  /** Maior queda (pico → vale) como fração do pico. */
  maxDrawdown: { mediana: number; p95: number };
  /** Faixas ao longo das operações para o gráfico. */
  faixas: Array<{ trade: number } & Pick<Percentis, 'p5' | 'p50' | 'p95'>>;
  paths: number;
}

export function validarBanca(i: BancaInput): string | null {
  if (!Number.isFinite(i.winRate) || i.winRate < 0 || i.winRate > 1) return 'A taxa de acerto precisa estar entre 0% e 100%.';
  if (!Number.isFinite(i.payoutPercent) || i.payoutPercent < 1 || i.payoutPercent > 1000) return 'O payout precisa estar entre 1% e 1000%.';
  if (!Number.isFinite(i.initial) || i.initial <= 0) return 'A banca inicial precisa ser maior que zero.';
  if (!Number.isFinite(i.stake) || i.stake <= 0) return 'O valor da entrada precisa ser maior que zero.';
  if (i.stakeMode === 'percent' && i.stake > 100) return 'A entrada em % da banca não pode passar de 100%.';
  if (!Number.isInteger(i.trades) || i.trades < 1 || i.trades > 20_000) return 'O número de operações precisa ser um inteiro entre 1 e 20000.';
  if (i.paths !== undefined && (!Number.isInteger(i.paths) || i.paths < 10 || i.paths > 20_000)) return 'O número de simulações precisa estar entre 10 e 20000.';
  return null;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Percentil por interpolação linear (q de 0 a 1) sobre valores já ordenados. */
export function percentil(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

const sortedCopy = (a: number[]) => [...a].sort((x, y) => x - y);

export function evPorEntrada(winRate: number, payoutPercent: number): number {
  const b = payoutPercent / 100;
  return winRate * b - (1 - winRate);
}

export function kellyFracao(winRate: number, payoutPercent: number): number {
  const b = payoutPercent / 100;
  return Math.max(0, (winRate * b - (1 - winRate)) / b);
}

export function simularBanca(input: BancaInput): BancaResult {
  const erro = validarBanca(input);
  if (erro) throw new Error(erro);
  const paths = input.paths ?? 1000;
  const rnd = mulberry32(input.seed ?? 12345);
  const b = input.payoutPercent / 100;
  const n = input.trades;
  const step = Math.max(1, Math.floor(n / 60));
  const marks: number[] = [];
  for (let t = 0; t <= n; t += step) marks.push(t);
  if (marks[marks.length - 1] !== n) marks.push(n);
  const atMark: number[][] = marks.map(() => []);

  const finals: number[] = [];
  const dds: number[] = [];
  let acima = 0;
  let queda50 = 0;
  let quebra = 0;

  for (let p = 0; p < paths; p++) {
    let bank = input.initial;
    let peak = bank;
    let maxDd = 0;
    let minBank = bank;
    let m = 0;
    atMark[m++]!.push(bank);
    for (let t = 1; t <= n; t++) {
      if (bank > 0) {
        const stake = input.stakeMode === 'percent' ? bank * (input.stake / 100) : Math.min(input.stake, bank);
        bank += rnd() < input.winRate ? stake * b : -stake;
        if (bank < 1e-9) bank = 0;
      }
      if (bank > peak) peak = bank;
      else if (peak > 0) maxDd = Math.max(maxDd, (peak - bank) / peak);
      if (bank < minBank) minBank = bank;
      if (t === marks[m]) atMark[m++]!.push(bank);
    }
    finals.push(bank);
    dds.push(maxDd);
    if (bank > input.initial) acima++;
    if (minBank <= input.initial * 0.5) queda50++;
    if (minBank < input.initial * 0.1) quebra++;
  }

  const sf = sortedCopy(finals);
  const sd = sortedCopy(dds);
  return {
    ev: evPorEntrada(input.winRate, input.payoutPercent),
    breakeven: breakevenRate(input.payoutPercent),
    kelly: kellyFracao(input.winRate, input.payoutPercent),
    final: { p5: percentil(sf, 0.05), p25: percentil(sf, 0.25), p50: percentil(sf, 0.5), p75: percentil(sf, 0.75), p95: percentil(sf, 0.95) },
    pAcima: acima / paths,
    pQueda50: queda50 / paths,
    pQuebra: quebra / paths,
    maxDrawdown: { mediana: percentil(sd, 0.5), p95: percentil(sd, 0.95) },
    faixas: marks.map((trade, i) => {
      const s = sortedCopy(atMark[i]!);
      return { trade, p5: percentil(s, 0.05), p50: percentil(s, 0.5), p95: percentil(s, 0.95) };
    }),
    paths,
  };
}

export interface Cenarios {
  /** Limite inferior do intervalo de confiança da taxa. */
  pessimista: { winRate: number; result: BancaResult };
  observado: { winRate: number; result: BancaResult };
  /** Limite superior do intervalo de confiança da taxa. */
  otimista: { winRate: number; result: BancaResult };
}

/**
 * Três cenários a partir de uma amostra (acertos de n): taxa pessimista, observada
 * e otimista (intervalo de Wilson 95%). Amostras pequenas dão cenários muito distantes.
 */
export function simularCenarios(wins: number, n: number, base: Omit<BancaInput, 'winRate'>): Cenarios {
  if (!Number.isInteger(n) || n < 1 || wins < 0 || wins > n) throw new Error('Acertos e amostra inválidos.');
  const [lo, hi] = wilson(wins, n);
  const run = (winRate: number) => ({ winRate, result: simularBanca({ ...base, winRate }) });
  return { pessimista: run(lo), observado: run(wins / n), otimista: run(hi) };
}
