import { describe, expect, it } from 'vitest';
import { breakevenRate, tally, verdict, wilson } from './stats';

describe('estatística do teste e do diário', () => {
  it('ponto de equilíbrio = 1 ÷ (1 + payout)', () => {
    expect(breakevenRate(80)).toBeCloseTo(0.5556, 4);
    expect(breakevenRate(100)).toBeCloseTo(0.5, 6);
    expect(breakevenRate(90)).toBeCloseTo(0.5263, 4);
  });

  it('intervalo de Wilson: valores conhecidos e limites', () => {
    const [lo, hi] = wilson(60, 100);
    expect(lo).toBeCloseTo(0.502, 3);
    expect(hi).toBeCloseTo(0.691, 3);
    expect(wilson(0, 0)).toEqual([0, 0]);
    expect(wilson(0, 10)[0]).toBe(0);
    expect(wilson(10, 10)[1]).toBe(1);
  });

  it('o intervalo estreita com mais casos', () => {
    const a = wilson(6, 10);
    const b = wilson(600, 1000);
    expect(b[1] - b[0]).toBeLessThan(a[1] - a[0]);
  });

  it('empates ficam fora da taxa', () => {
    const t = tally([{ win: true, tie: false }, { win: false, tie: false }, { win: false, tie: true }, { win: true, tie: false }]);
    expect(t).toMatchObject({ n: 3, wins: 2, losses: 1, ties: 1 });
    expect(t.rate).toBeCloseTo(2 / 3);
  });

  it('veredito: só "acima" com o intervalo inteiro acima do equilíbrio; amostra pequena é inconclusiva', () => {
    const be = breakevenRate(80);
    expect(verdict(tally([]), be)).toBe('sem_casos');
    expect(verdict(tally([...Array(6).fill({ win: true, tie: false }), ...Array(2).fill({ win: false, tie: false })]), be)).toBe('inconclusivo'); // 75% em 8 casos
    expect(verdict(tally(Array(8).fill({ win: true, tie: false })), be)).toBe('acima'); // 8 de 8: Wilson inferior ≈ 68%
    expect(verdict(tally([...Array(900).fill({ win: true, tie: false }), ...Array(100).fill({ win: false, tie: false })]), be)).toBe('acima');
    expect(verdict(tally([...Array(300).fill({ win: true, tie: false }), ...Array(700).fill({ win: false, tie: false })]), be)).toBe('abaixo');
    expect(verdict(tally([...Array(540).fill({ win: true, tie: false }), ...Array(460).fill({ win: false, tie: false })]), be)).toBe('inconclusivo');
  });
});
