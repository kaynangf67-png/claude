import { describe, expect, it } from 'vitest';
import { analyze } from '../core/engine';
import { fullConfig, rangeBound, strongTrend, testSource } from '../core/testing/fixtures';
import { DEFAULT_LAYERS, buildMarkers, buildZoneRects } from './chartLayers';

const run = (cs: ReturnType<typeof rangeBound>) => analyze({ candles: cs, source: testSource(cs), config: fullConfig() });

describe('camadas do gráfico', () => {
  const cs = rangeBound(5, 5);
  const a = run(cs);

  it('marca topos e fundos validados e candidatos de forma distinta, sem setas de compra/venda', () => {
    const m = buildMarkers(a, cs, DEFAULT_LAYERS, null);
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((x) => x.shape === 'circle' || x.shape === 'square')).toBe(true);
    expect(m.some((x) => x.text === 'topo' && x.shape === 'square')).toBe(true);
  });

  it('a oportunidade é rotulada como zona candidata e não como gatilho', () => {
    const opp = buildMarkers(a, cs, DEFAULT_LAYERS, null).find((x) => x.text.includes('zona candidata'))!;
    expect(opp.text).toMatch(/não é gatilho/);
    expect(opp.time).toBe(cs[cs.length - 1]!.t);
  });

  it('respeita as camadas desligadas', () => {
    const m = buildMarkers(a, cs, { swings: false, zones: false, opportunities: false, flow: false }, null);
    expect(m).toHaveLength(0);
    expect(buildZoneRects(a, { ...DEFAULT_LAYERS, zones: false }, cs)).toHaveLength(0);
  });

  it('gera um retângulo por zona, do primeiro pivô ao último candle, e limita a quantidade', () => {
    const rects = buildZoneRects(a, DEFAULT_LAYERS, cs);
    expect(rects.length).toBe(a.zones.length);
    for (const r of rects) {
      expect(r.lower).toBeLessThan(r.upper);
      expect(r.t1).toBe(cs[cs.length - 1]!.t);
      expect(r.t0).toBeLessThan(r.t1);
    }
    expect(rects.some((r) => r.label.startsWith('Resistência'))).toBe(true);
    expect(buildZoneRects(a, DEFAULT_LAYERS, cs, 1)).toHaveLength(1);
  });

  it('destaca os candles de um filtro e mantém a ordem cronológica', () => {
    const trend = strongTrend(60);
    const t = run(trend);
    const f = t.filters.find((x) => x.id === 'sequencia_direcional')!;
    const m = buildMarkers(t, trend, DEFAULT_LAYERS, { label: f.name, indexes: f.supportingIndexes });
    expect(m.some((x) => x.text.includes('mesma cor'))).toBe(true);
    for (let i = 1; i < m.length; i++) expect(m[i]!.time).toBeGreaterThanOrEqual(m[i - 1]!.time);
  });

  it('sem análise não há marcadores nem linhas', () => {
    expect(buildMarkers(null, cs, DEFAULT_LAYERS, null)).toEqual([]);
    expect(buildZoneRects(null, DEFAULT_LAYERS, cs)).toEqual([]);
  });
});
