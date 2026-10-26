import { defaultConfig } from '../config';
import { sourceFor } from '../demo';
import type { AnalysisConfig, Candle, DataSourceInfo, ParamKey } from '../types';

/** Apoio aos testes: constrói candles e configurações determinísticas. */

export const T0 = Date.UTC(2026, 0, 5, 12, 0, 0) / 1000;
export const STEP = 300;
export const PIP = 0.0001;

export interface Spec { o: number; h: number; l: number; c: number }

/** Candles M5 consecutivos a partir de [open, high, low, close] em preço. */
export function candles(specs: Array<[number, number, number, number]>, start = T0): Candle[] {
  return specs.map(([o, h, l, c], i) => ({ t: start + i * STEP, o, h, l, c }));
}

/**
 * Constrói candles a partir de uma trajetória de fechamentos (em pips acima de 1.1000).
 * A abertura de cada candle é o fechamento do anterior. `wicks` permite pavios por índice.
 */
export function fromCloses(
  closesPips: number[], wicks: Record<number, { up?: number; down?: number }> = {}, defaultWick = 0.3, startPips = closesPips[0]!,
): Candle[] {
  const out: Candle[] = [];
  let prev = startPips;
  closesPips.forEach((cp, i) => {
    const w = wicks[i] ?? {};
    const o = prev;
    const up = w.up ?? defaultWick;
    const down = w.down ?? defaultWick;
    const hi = Math.max(o, cp) + up;
    const lo = Math.min(o, cp) - down;
    const r = (x: number) => Math.round((1.1 + x * PIP) * 1e5) / 1e5;
    out.push({ t: T0 + i * STEP, o: r(o), h: r(hi), l: r(lo), c: r(cp) });
    prev = cp;
  });
  return out;
}

/**
 * Mercado lateral: ondas triangulares entre ~0 e ~15 pips, com candles
 * alternando de cor e pavios longos nos extremos. Termina na perna de alta,
 * aproximando-se da resistência.
 */
export function rangeBound(cycles: number, tailUp = 5): Candle[] {
  const closes: number[] = [];
  const wicks: Record<number, { up?: number; down?: number }> = {};
  const leg = 6;
  for (let k = 0; k < cycles; k++) {
    for (let j = 0; j < leg; j++) closes.push(j * 3 + 2 + (closes.length % 2 === 0 ? -2.6 : 2.6));
    wicks[closes.length - 1] = { up: 5 };
    for (let j = 0; j < leg; j++) closes.push(17 - j * 3 - 2 + (closes.length % 2 === 0 ? -2.6 : 2.6));
    wicks[closes.length - 1] = { down: 5 };
  }
  for (let j = 0; j < tailUp; j++) closes.push(j * 3 + 2 + (closes.length % 2 === 0 ? -2.6 : 2.6));
  return fromCloses(closes, wicks, 0.8, 0);
}

/** Tendência contínua sem retrações: todos os candles de alta, corpos grandes e pavios mínimos. */
export function strongTrend(count = 60, up = true): Candle[] {
  const closes = Array.from({ length: count }, (_, i) => (up ? 1 : -1) * (i + 1) * 4);
  return fromCloses(closes, {}, 0.1, 0);
}

export const memoryStore = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
};

export function cfg(overrides: Partial<Record<ParamKey, number | null>> = {}, base: AnalysisConfig = defaultConfig()): AnalysisConfig {
  const params = { ...base.params };
  for (const [k, v] of Object.entries(overrides) as Array<[ParamKey, number | null]>) {
    params[k] = v === null ? { value: null, origin: 'nao_definido' } : { value: v, origin: 'usuario' };
  }
  return { ...base, params };
}

/** Configuração completa usada nos cenários "favoráveis" dos testes. */
export const FULL: Partial<Record<ParamKey, number>> = {
  wickRelevantRatio: 0.3,
  minRelevantWickCandles: 2,
  alternationFavorableMin: 0.6,
  directionalDominanceMin: 0.8,
  swingMinDisplacementMult: 1,
  minValidatedSwings: 3,
  zoneToleranceMult: 1,
  retractionMinMult: 1,
  retractionWindow: 4,
  bigBodyRatio: 0.95,
  bigBodyMinCount: 6,
  continuousMoveEfficiency: 0.85,
};

export const fullConfig = (extra: Partial<Record<ParamKey, number | null>> = {}) => cfg({ ...FULL, ...extra });

export const testSource = (cs: Candle[], over: Partial<DataSourceInfo> = {}): DataSourceInfo => ({
  ...sourceFor(cs, {
    kind: 'csv', name: 'teste.csv', origin: 'fixture de teste', synthetic: true, asset: 'TESTE', otc: false,
    timezone: 'UTC', displayTimezone: 'UTC',
  }, 0),
  ...over,
});
