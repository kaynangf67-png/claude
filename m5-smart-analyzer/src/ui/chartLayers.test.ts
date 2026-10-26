import { describe, expect, it } from 'vitest';
import { analyze } from '../core/engine';
import { fullConfig, rangeBound, strongTrend, testSource } from '../core/testing/fixtures';
import { DEFAULT_LAYERS, buildMarkers, buildZoneLines } from './chartLayers';

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
    expect(buildZoneLines(a, { ...DEFAULT_LAYERS, zones: false })).toHaveLength(0);
  });

  it('gera bordas superior e inferior para cada zona e limita a quantidade', () => {
    const lines = buildZoneLines(a, DEFAULT_LAYERS);
    expect(lines.length).toBe(a.zones.length * 2);
    expect(buildZoneLines(a, DEFAULT_LAYERS, 1)).toHaveLength(2);
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
    expect(buildZoneLines(null, DEFAULT_LAYERS)).toEqual([]);
  });
});
