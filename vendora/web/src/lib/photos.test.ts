import { describe, expect, it } from 'vitest';
import { fitWithin } from './photos';

describe('fitWithin', () => {
  it('reduz mantendo a proporção', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });
  it('não amplia fotos pequenas', () => {
    expect(fitWithin(800, 600, 2000)).toEqual({ width: 800, height: 600 });
  });
});
