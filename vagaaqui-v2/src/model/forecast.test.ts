import { describe, expect, it } from 'vitest';
import { fromLocal } from '../lib/geo';
import { estimateSegment, forecastDestination, MODEL } from './forecast';
import { priorFree, typicalOccupancy } from './prior';
import { ORIGIN, seg } from './testUtils';
import type { Report } from './types';

// terça-feira 10h (pico comercial) e 3h da manhã
const TUE_10 = new Date(2026, 9, 6, 10, 0).getTime();
const TUE_03 = new Date(2026, 9, 6, 3, 0).getTime();
const rep = (segmentId: string, kind: Report['kind'], minAgo: number, now = TUE_10, trust = 1): Report => ({ id: `${segmentId}-${kind}-${minAgo}`, segmentId, kind, at: now - minAgo * 60000, trust });

describe('histórico (estimativa inicial)', () => {
  it('área comercial lota de dia e esvazia de madrugada', () => {
    expect(typicalOccupancy('commercial', new Date(TUE_10))).toBeGreaterThan(0.9);
    expect(typicalOccupancy('commercial', new Date(TUE_03))).toBeLessThan(0.4);
  });
  it('residencial é o contrário', () => {
    expect(typicalOccupancy('residential', new Date(TUE_03))).toBeGreaterThan(typicalOccupancy('residential', new Date(TUE_10)));
  });
  it('trecho maior tem mais chance de ter alguma vaga', () => {
    const small = seg('a', 0, 0, 30, 0);
    const big = seg('b', 0, 0, 150, 0);
    expect(priorFree(big, new Date(TUE_10))).toBeGreaterThan(priorFree(small, new Date(TUE_10)));
  });
});

describe('estimativa de um trecho', () => {
  const s = seg('s1', 0, 0, 100, 0);

  it('sem relatos: usa o histórico, confiança zero e faixa larga', () => {
    const e = estimateSegment(s, [], TUE_10);
    expect(e.confidence).toBe(0);
    expect(e.reportsUsed).toBe(0);
    expect(e.high - e.low).toBeGreaterThan(0.4);
  });

  it('nunca passa de 95% nem cai abaixo de 3%', () => {
    const many = Array.from({ length: 50 }, (_, i) => rep('s1', 'left', 0, TUE_10 + i));
    expect(estimateSegment(s, many, TUE_10).p).toBeLessThanOrEqual(MODEL.maxP);
    const full = Array.from({ length: 50 }, (_, i) => rep('s1', 'full', 0, TUE_10 + i));
    expect(estimateSegment(s, full, TUE_10).p).toBeGreaterThanOrEqual(MODEL.minP);
  });

  it('"saindo da vaga" agora sobe a chance; "lotado" agora derruba', () => {
    const base = estimateSegment(s, [], TUE_10).p;
    expect(estimateSegment(s, [rep('s1', 'left', 1)], TUE_10).p).toBeGreaterThan(base + 0.2);
    expect(estimateSegment(s, [rep('s1', 'full', 1)], TUE_10 - 0).p).toBeLessThan(base);
  });

  it('relato perde força com o tempo até a chegada', () => {
    const r = rep('s1', 'left', 0);
    const now = estimateSegment(s, [r], TUE_10);
    const in15 = estimateSegment(s, [r], TUE_10 + 15 * 60000);
    expect(in15.p).toBeLessThan(now.p);
    expect(in15.confidence).toBeLessThan(now.confidence);
  });

  it('relato de outro trecho não influencia', () => {
    expect(estimateSegment(s, [rep('outro', 'left', 0)], TUE_10).reportsUsed).toBe(0);
  });

  it('detecção automática pesa menos que relato manual', () => {
    const manual = estimateSegment(s, [rep('s1', 'full', 0, TUE_10, 1)], TUE_10);
    const auto = estimateSegment(s, [rep('s1', 'full', 0, TUE_10, 0.6)], TUE_10);
    expect(auto.p).toBeGreaterThan(manual.p);
  });

  it('trecho proibido de estacionar fica no mínimo', () => {
    const np = seg('np', 0, 0, 100, 0, 'commercial', { noParking: true });
    expect(estimateSegment(np, [rep('np', 'left', 0)], TUE_10).p).toBe(MODEL.minP);
  });
});

describe('previsão para o destino', () => {
  const dest = fromLocal(ORIGIN, 0, 0);
  const near = seg('perto', -50, 10, 50, 10);
  const far = seg('longe', -50, 150, 50, 150);
  const outside = seg('fora', -50, 900, 50, 900);

  it('só considera trechos no raio de caminhada', () => {
    const f = forecastDestination({ segments: [near, far, outside], reports: [], destination: dest, now: TUE_10, etaMin: 10, radiusM: 400 });
    expect(f.all.map((x) => x.segment.id).sort()).toEqual(['longe', 'perto']);
  });

  it('prefere um trecho um pouco mais longe com vaga recém-liberada', () => {
    const reports = [rep('longe', 'left', 1), rep('perto', 'full', 1)];
    const f = forecastDestination({ segments: [near, far], reports, destination: dest, now: TUE_10, etaMin: 2, radiusM: 400 });
    expect(f.best[0].segment.id).toBe('longe');
  });

  it('sem relatos, avisa que é estimativa', () => {
    const f = forecastDestination({ segments: [near, far], reports: [], destination: dest, now: TUE_10, etaMin: 10, radiusM: 400 });
    expect(f.dataIsEstimate).toBe(true);
    expect(f.sourcesText).toMatch(/Só histórico/);
  });

  it('chance combinada fica entre a do melhor trecho e 95%', () => {
    const f = forecastDestination({ segments: [near, far], reports: [], destination: dest, now: TUE_03, etaMin: 10, radiusM: 400 });
    expect(f.overall).toBeGreaterThanOrEqual(Math.max(...f.best.map((b) => b.p)) - 1e-9);
    expect(f.overall).toBeLessThanOrEqual(MODEL.maxP);
    expect(f.overallLow).toBeLessThanOrEqual(f.overall);
    expect(f.overallHigh).toBeGreaterThanOrEqual(f.overall);
  });

  it('a previsão é para a hora da chegada, não para agora', () => {
    // relato "saindo" agora: chegando em 1 min vale muito; em 40 min quase nada
    const reports = [rep('perto', 'left', 0)];
    const soon = forecastDestination({ segments: [near], reports, destination: dest, now: TUE_10, etaMin: 1, radiusM: 400 });
    const late = forecastDestination({ segments: [near], reports, destination: dest, now: TUE_10, etaMin: 40, radiusM: 400 });
    expect(soon.best[0].p).toBeGreaterThan(late.best[0].p + 0.2);
  });

  it('sem trechos no raio: chance desconhecida', () => {
    const f = forecastDestination({ segments: [outside], reports: [], destination: dest, now: TUE_10, etaMin: 5, radiusM: 400 });
    expect(f.level).toBe('unknown');
    expect(f.best).toHaveLength(0);
  });
});

describe('lista das 3 melhores', () => {
  it('prefere ruas diferentes', () => {
    const dest = fromLocal(ORIGIN, 0, 0);
    const a1 = seg('a1', -100, 10, 0, 10);
    const a2 = seg('a2', 0, 10, 100, 10);
    a2.name = a1.name;
    const b = seg('b', -50, 120, 50, 120);
    const c = seg('c', -50, -150, 50, -150);
    const f = forecastDestination({ segments: [a1, a2, b, c], reports: [], destination: dest, now: TUE_10, etaMin: 5, radiusM: 400 });
    expect(new Set(f.best.map((x) => x.segment.name)).size).toBe(3);
  });
});
