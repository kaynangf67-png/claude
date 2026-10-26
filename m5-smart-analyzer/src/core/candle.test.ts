import { describe, expect, it } from 'vitest';
import { candleDirection, candleIssue, candleMetrics, directionRuns, meanRange } from './candle';
import { candles } from './testing/fixtures';

const c = (o: number, h: number, l: number, cl: number) => ({ t: 0, o, h, l, c: cl });

describe('corpo e pavios (Regra 1)', () => {
  it('calcula corpo, pavios e amplitude de um candle de alta', () => {
    const m = candleMetrics(c(10, 14, 9, 12));
    expect(m.body).toBe(2);
    expect(m.upperWick).toBe(2); // 14 - 12
    expect(m.lowerWick).toBe(1); // 10 - 9
    expect(m.range).toBe(5);
    expect(m.bodyRatio).toBeCloseTo(0.4);
    expect(m.upperWickRatio).toBeCloseTo(0.4);
    expect(m.lowerWickRatio).toBeCloseTo(0.2);
    expect(m.direction).toBe('alta');
  });

  it('usa a abertura como topo do corpo em candles de baixa', () => {
    const m = candleMetrics(c(12, 14, 9, 10));
    expect(m.upperWick).toBe(2); // 14 - 12
    expect(m.lowerWick).toBe(1); // 10 - 9
    expect(m.direction).toBe('baixa');
  });

  it('não divide por zero quando a amplitude é nula', () => {
    const m = candleMetrics(c(10, 10, 10, 10));
    expect(m.range).toBe(0);
    expect(m.bodyRatio).toBeNull();
    expect(m.upperWickRatio).toBeNull();
    expect(m.direction).toBe('doji');
  });
});

describe('direção e sequências (Regra 2)', () => {
  it('identifica alta, baixa e doji', () => {
    expect(candleDirection(c(1, 2, 0, 1.5))).toBe('alta');
    expect(candleDirection(c(1.5, 2, 0, 1))).toBe('baixa');
    expect(candleDirection(c(1, 2, 0, 1))).toBe('doji');
  });

  it('agrupa sequências consecutivas da mesma direção', () => {
    const cs = candles([
      [1, 2, 1, 2], [2, 3, 2, 3], [3, 4, 3, 4], // 3 altas
      [4, 4, 2, 2], // baixa
      [2, 3, 2, 3], // alta
      [3, 3, 3, 3], // doji
    ]);
    const runs = directionRuns(cs);
    expect(runs.map((r) => [r.direction, r.length])).toEqual([
      ['alta', 3], ['baixa', 1], ['alta', 1], ['doji', 1],
    ]);
    expect(runs[0]).toMatchObject({ startIndex: 0, endIndex: 2 });
  });

  it('calcula a amplitude média ignorando fora do intervalo', () => {
    const cs = candles([[1, 2, 1, 2], [2, 4, 2, 3], [3, 4, 3, 4]]);
    expect(meanRange(cs, 0, 2)).toBeCloseTo((1 + 2 + 1) / 3);
    expect(meanRange(cs, 1, 99)).toBeCloseTo(1.5);
  });
});

describe('candles inválidos', () => {
  it('detecta high menor que open/close', () => {
    expect(candleIssue(c(10, 11, 9, 12))).toBe('HIGH_MENOR_QUE_CORPO');
  });
  it('detecta low maior que open/close', () => {
    expect(candleIssue(c(10, 12, 10.5, 11))).toBe('LOW_MAIOR_QUE_CORPO');
  });
  it('detecta high menor que low', () => {
    expect(candleIssue(c(10, 9, 11, 10))).toBe('HIGH_MENOR_QUE_LOW');
  });
  it('detecta preços não positivos e valores não finitos', () => {
    expect(candleIssue(c(0, 1, 0, 1))).toBe('PRECO_NAO_POSITIVO');
    expect(candleIssue(c(NaN, 1, 0.5, 1))).toBe('NAO_FINITO');
  });
  it('aceita candle válido e volume ausente', () => {
    expect(candleIssue(c(10, 12, 9, 11))).toBeNull();
    expect(candleIssue({ ...c(10, 12, 9, 11), v: -1 })).toBe('VOLUME_INVALIDO');
  });
});
