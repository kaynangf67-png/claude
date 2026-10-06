import { describe, expect, it } from 'vitest';
import { fromLocal } from '../lib/geo';
import { ORIGIN } from '../model/testUtils';
import { estimateEta, navLinks } from './route';

describe('tempo de viagem e links', () => {
  it('estimativa: 3 km em cidade ≈ 12 min', () => {
    const eta = estimateEta(ORIGIN, fromLocal(ORIGIN, 3000, 0));
    expect(eta.source).toBe('estimate');
    expect(eta.minutes).toBeGreaterThanOrEqual(10);
    expect(eta.minutes).toBeLessThanOrEqual(14);
  });
  it('links do Waze e Google Maps no formato oficial', () => {
    const l = navLinks([-40.2976, -20.3155]);
    expect(l.waze).toBe('https://waze.com/ul?ll=-20.315500%2C-40.297600&navigate=yes');
    expect(l.google).toContain('destination=-20.315500%2C-40.297600');
    expect(l.google).toContain('travelmode=driving');
  });
});
