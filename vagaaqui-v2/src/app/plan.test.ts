import { describe, expect, it } from 'vitest';
import { creditReport, isPro, proDaysLeft } from './plan';

describe('plano Pro', () => {
  it('cada 3 relatos ganham 1 dia de Pro, somando ao que já tem', () => {
    const now = 1_000_000_000_000;
    let plan = { proUntil: 0, reports: 0, waitlisted: false };
    const earned: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const r = creditReport(plan, now);
      plan = r.plan;
      earned.push(r.earnedDay);
    }
    expect(earned).toEqual([false, false, true, false, false, true]);
    expect(isPro(plan, now)).toBe(true);
    expect(proDaysLeft(plan, now)).toBe(2);
    expect(isPro(plan, now + 3 * 86400000)).toBe(false);
  });
});
