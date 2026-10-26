export function fmtPct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtNum(x: number, digits = 2): string {
  return x.toFixed(digits).replace(/\.?0+$/, '') || '0';
}

/** Preço com casas suficientes para distinguir pequenos movimentos. */
export function fmtPrice(x: number): string {
  const abs = Math.abs(x);
  const digits = abs >= 1000 ? 2 : abs >= 100 ? 3 : abs >= 10 ? 4 : 5;
  return x.toFixed(digits);
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
