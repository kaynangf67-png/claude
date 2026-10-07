import { describe, expect, it } from 'vitest';
import { describeRecurrence, expandRecurrence, nextOccurrence } from './recurrence';

const until = new Date(2026, 9, 31);

describe('expandRecurrence', () => {
  it('uma vez gera exatamente uma ocorrência', () => {
    const out = expandRecurrence({ frequency: 'none', time: '20:00', startDate: '2026-10-10' }, { until });
    expect(out).toHaveLength(1);
    expect(out[0].getDate()).toBe(10);
    expect(out[0].getHours()).toBe(20);
  });

  it('diária respeita data final inclusiva', () => {
    const out = expandRecurrence({ frequency: 'daily', time: '08:30', startDate: '2026-10-01', endDate: '2026-10-05' }, { until });
    expect(out.map((d) => d.getDate())).toEqual([1, 2, 3, 4, 5]);
  });

  it('segunda a sexta pula fim de semana', () => {
    // 2026-10-05 é segunda
    const out = expandRecurrence({ frequency: 'weekdays', time: '20:00', startDate: '2026-10-05', endDate: '2026-10-11' }, { until });
    expect(out.map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5]);
  });

  it('dias específicos', () => {
    const out = expandRecurrence({ frequency: 'weekly', weekdays: [0, 3], time: '10:00', startDate: '2026-10-01', endDate: '2026-10-14' }, { until });
    expect(out.every((d) => d.getDay() === 0 || d.getDay() === 3)).toBe(true);
    expect(out).toHaveLength(4);
  });

  it('intervalo personalizado', () => {
    const out = expandRecurrence({ frequency: 'interval', intervalDays: 3, time: '10:00', startDate: '2026-10-01', endDate: '2026-10-10' }, { until });
    expect(out.map((d) => d.getDate())).toEqual([1, 4, 7, 10]);
  });

  it('from descarta ocorrências passadas e respeita o limite', () => {
    const from = new Date(2026, 9, 3, 21, 0);
    const out = expandRecurrence({ frequency: 'daily', time: '20:00', startDate: '2026-10-01' }, { from, until, limit: 3 });
    expect(out.map((d) => d.getDate())).toEqual([4, 5, 6]);
  });

  it('nextOccurrence e descrição', () => {
    const rule = { frequency: 'daily' as const, time: '20:00', startDate: '2026-10-01' };
    expect(nextOccurrence(rule, new Date(2026, 9, 7, 21))?.getDate()).toBe(8);
    expect(describeRecurrence(rule)).toBe('Todos os dias às 20:00');
    expect(describeRecurrence({ ...rule, frequency: 'weekly', weekdays: [5, 1] })).toBe('Seg, Sex às 20:00');
  });
});
