import type { Candle, Swing } from './types';

/**
 * Detecção de candidatos a topos e fundos (Regra 3).
 *
 * Um pivô só é conhecido `lookback` candles depois de ocorrer. Por isso cada
 * Swing carrega `confirmedAtIndex`: o primeiro candle em que um operador, em
 * tempo real, poderia saber que aquele ponto era um topo/fundo. Nenhum candle
 * além de `lastIndex` é lido.
 *
 * Empates: a máxima do pivô precisa ser estritamente maior que as dos
 * vizinhos à esquerda e maior ou igual às dos vizinhos à direita. Assim, de
 * dois topos idênticos adjacentes, só o primeiro é marcado.
 */
export function detectSwings(
  candles: Candle[],
  lookback: number,
  fromIndex: number,
  lastIndex: number,
): Swing[] {
  const swings: Swing[] = [];
  const n = lookback;
  for (let i = Math.max(fromIndex, n); i <= lastIndex - n; i++) {
    const c = candles[i]!;
    let isTop = true;
    let isBottom = true;
    for (let k = 1; k <= n; k++) {
      const left = candles[i - k]!;
      const right = candles[i + k]!;
      if (!(c.h > left.h) || !(c.h >= right.h)) isTop = false;
      if (!(c.l < left.l) || !(c.l <= right.l)) isBottom = false;
    }
    const supporting = Array.from({ length: 2 * n + 1 }, (_, j) => i - n + j);
    const base = {
      index: i,
      t: c.t,
      confirmedAtIndex: i + n,
      confirmedAtT: candles[i + n]!.t,
      supportingIndexes: supporting,
      displacement: 0,
      validated: false,
      validatedAtIndex: null,
      validatedAtT: null,
    };
    if (isTop) swings.push({ ...base, kind: 'topo', price: c.h });
    if (isBottom) swings.push({ ...base, kind: 'fundo', price: c.l });
  }
  return swings.sort((a, b) => a.index - b.index);
}

/**
 * Mede o afastamento de cada pivô usando apenas candles até `lastIndex` e
 * marca como validados os que atingiram `minDisplacement`. Com
 * `minDisplacement === null` nenhum pivô é validado (critério não definido).
 *
 * `validatedAtIndex` registra quando a validação ficou disponível — nunca
 * antes da confirmação geométrica.
 */
export function validateSwings(
  candles: Candle[],
  swings: Swing[],
  minDisplacement: number | null,
  lastIndex: number,
): Swing[] {
  return swings.map((s) => {
    let displacement = 0;
    let validatedAtIndex: number | null = null;
    for (let j = s.index + 1; j <= lastIndex; j++) {
      const c = candles[j]!;
      const away = s.kind === 'topo' ? s.price - c.l : c.h - s.price;
      if (away > displacement) displacement = away;
      if (
        validatedAtIndex === null &&
        minDisplacement !== null &&
        j >= s.confirmedAtIndex &&
        displacement >= minDisplacement
      ) {
        validatedAtIndex = j;
      }
    }
    return {
      ...s,
      displacement,
      validated: validatedAtIndex !== null,
      validatedAtIndex,
      validatedAtT: validatedAtIndex !== null ? candles[validatedAtIndex]!.t : null,
    };
  });
}
