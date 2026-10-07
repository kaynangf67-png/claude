import { describe, expect, it } from 'vitest';
import { computeMetrics } from './metrics';

describe('métricas do piloto', () => {
  it('acerto e erro da previsão a partir das respostas de chegada', () => {
    const m = computeMetrics([
      { name: 'app_open', at: 0 },
      { name: 'forecast_shown', at: 1, props: { ms: 300, sinceOpenMs: 4000 } },
      { name: 'forecast_shown', at: 2, props: { ms: 500, sinceOpenMs: null } },
      { name: 'answer', at: 3, props: { answer: 'street', predicted: 0.8 } }, // acertou
      { name: 'answer', at: 4, props: { answer: 'full', predicted: 0.2 } }, // acertou
      { name: 'answer', at: 5, props: { answer: 'full', predicted: 0.7 } }, // errou
      { name: 'report', at: 6, props: { kind: 'free', auto: false } },
      { name: 'report', at: 7, props: { kind: 'parked', auto: true } },
      { name: 'subscribe_click', at: 8 },
    ]);
    expect(m.forecasts).toBe(2);
    expect(m.medianForecastMs).toBe(400);
    expect(m.medianOpenToAnswerMs).toBe(4000);
    expect(m.hitRate).toBeCloseTo(2 / 3);
    expect(m.brier).toBeCloseTo((0.04 + 0.04 + 0.49) / 3);
    expect(m.foundRate).toBeCloseTo(1 / 3);
    expect(m.reports).toBe(1);
    expect(m.autoReports).toBe(1);
    expect(m.subscribeClicks).toBe(1);
  });
  it('sem dados: nada inventado', () => {
    const m = computeMetrics([]);
    expect(m.hitRate).toBeNull();
    expect(m.brier).toBeNull();
    expect(m.reportsPerWeek).toBeNull();
  });
});
