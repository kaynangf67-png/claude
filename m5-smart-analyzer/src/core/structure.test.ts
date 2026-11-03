import { describe, expect, it } from 'vitest';
import { detectSwings, validateSwings } from './swings';
import { buildZones, computeZoneEvents, relationToZone, type EventParams } from './zones';
import { candles, fromCloses } from './testing/fixtures';
import type { Zone } from './types';

describe('topos e fundos (Regra 3)', () => {
  // índice:        0     1     2     3     4     5     6     7     8
  const highs = [1.00, 1.02, 1.05, 1.03, 1.01, 1.02, 1.04, 1.03, 1.02];
  const lows = highs.map((h) => h - 0.02);
  const cs = candles(highs.map((h, i) => [h - 0.01, h, lows[i]!, h - 0.01] as [number, number, number, number]));

  it('detecta candidatos geométricos a topo e fundo', () => {
    const sw = detectSwings(cs, 2, 0, cs.length - 1);
    expect(sw.map((s) => `${s.kind}@${s.index}`)).toEqual(['topo@2', 'fundo@4', 'topo@6']);
    expect(sw[0]).toMatchObject({ price: 1.05, supportingIndexes: [0, 1, 2, 3, 4] });
  });

  it('só conhece o pivô `lookback` candles depois (sem look-ahead)', () => {
    const sw = detectSwings(cs, 2, 0, cs.length - 1);
    for (const s of sw) {
      expect(s.confirmedAtIndex).toBe(s.index + 2);
      expect(s.confirmedAtT).toBe(cs[s.index + 2]!.t);
    }
    // com dados até o candle 3, o topo do candle 2 ainda NÃO é conhecido
    expect(detectSwings(cs.slice(0, 4), 2, 0, 3)).toHaveLength(0);
    // com dados até o candle 4, ele passa a existir
    expect(detectSwings(cs.slice(0, 5), 2, 0, 4).map((s) => s.index)).toContain(2);
  });

  it('o conjunto de pivôs conhecidos em `i` é o mesmo calculado só com dados até `i`', () => {
    const full = detectSwings(cs, 2, 0, cs.length - 1);
    for (let i = 0; i < cs.length; i++) {
      const known = full.filter((s) => s.confirmedAtIndex <= i).map((s) => `${s.kind}@${s.index}`);
      const prefix = detectSwings(cs.slice(0, i + 1), 2, 0, i).map((s) => `${s.kind}@${s.index}`);
      expect(prefix).toEqual(known);
    }
  });

  it('marca só o primeiro de dois topos idênticos adjacentes', () => {
    const t = candles([
      [1, 1.1, 0.9, 1], [1, 1.2, 1, 1.1], [1.1, 1.5, 1.1, 1.3], [1.3, 1.5, 1.2, 1.3], [1.3, 1.3, 1.1, 1.2], [1.2, 1.2, 1.0, 1.1],
    ]);
    const tops = detectSwings(t, 2, 0, t.length - 1).filter((s) => s.kind === 'topo');
    expect(tops.map((s) => s.index)).toEqual([2]);
  });

  it('diferencia candidato de pivô validado e registra quando a validação ficou disponível', () => {
    const sw = detectSwings(cs, 2, 0, cs.length - 1);
    const none = validateSwings(cs, sw, null, cs.length - 1);
    expect(none.every((s) => !s.validated)).toBe(true); // critério não definido => ninguém é validado

    const v = validateSwings(cs, sw, 0.03, cs.length - 1);
    const top = v.find((s) => s.index === 2)!;
    expect(top.validated).toBe(true);
    expect(top.validatedAtIndex!).toBeGreaterThanOrEqual(top.confirmedAtIndex);
    expect(top.validatedAtT).toBe(cs[top.validatedAtIndex!]!.t);
    const strict = validateSwings(cs, sw, 0.5, cs.length - 1);
    expect(strict.every((s) => !s.validated)).toBe(true);
  });

  it('não usa candles além de lastIndex para medir o afastamento', () => {
    const sw = detectSwings(cs, 2, 0, cs.length - 1);
    const early = validateSwings(cs, sw, 0.03, 4).find((s) => s.index === 2)!;
    const late = validateSwings(cs, sw, 0.03, 8).find((s) => s.index === 2)!;
    expect(early.displacement).toBeLessThanOrEqual(late.displacement);
    expect(early.validatedAtIndex).toBeLessThanOrEqual(4);
  });
});

describe('zonas, toques, aproximações e rompimentos (Regra 4)', () => {
  const zone: Zone = {
    id: 'R-0', side: 'resistencia', lower: 1.1010, upper: 1.1012, level: 1.1011, pivotIndexes: [0], firstIndex: 0, events: [],
  };
  const tol = 0.0004;
  const params: EventParams = { tolerance: tol, retractionMin: 0.0005, retractionWindow: 3, wickRelevantRatio: 0.3 };

  it('classifica toque, aproximação, rompimento e distância', () => {
    const c = (h: number, cl: number) => ({ t: 0, o: 1.1, h, l: 1.0995, c: cl });
    expect(relationToZone(zone, c(1.1011, 1.1008), tol)).toBe('toque');
    expect(relationToZone(zone, c(1.1015, 1.1008), tol)).toBe('toque'); // pavio ultrapassa, fecha abaixo
    expect(relationToZone(zone, c(1.1008, 1.1005), tol)).toBe('aproximacao');
    expect(relationToZone(zone, c(1.1020, 1.1015), tol)).toBe('rompimento');
    expect(relationToZone(zone, c(1.1000, 1.0998), tol)).toBe('distante');
  });

  it('espelha a lógica para suporte', () => {
    const sup: Zone = { ...zone, id: 'S-0', side: 'suporte', lower: 1.0988, upper: 1.0990 };
    const c = (l: number, cl: number) => ({ t: 0, o: 1.1, h: 1.1005, l, c: cl });
    expect(relationToZone(sup, c(1.0989, 1.0995), tol)).toBe('toque');
    expect(relationToZone(sup, c(1.0992, 1.0996), tol)).toBe('aproximacao');
    expect(relationToZone(sup, c(1.0980, 1.0985), tol)).toBe('rompimento');
  });

  const base: Array<[number, number, number, number]> = [[1.1000, 1.1005, 1.0999, 1.1004]];

  it('toque com retração confirmada (e pavio) vira evento válido', () => {
    const cs = candles([...base,
      [1.1004, 1.1013, 1.1003, 1.1006], // toque com pavio superior grande
      [1.1006, 1.1006, 1.1000, 1.1001], // recuo
      [1.1001, 1.1003, 1.0998, 1.1000],
    ]);
    const ev = computeZoneEvents(zone, cs, cs.length - 1, params);
    const touch = ev.find((e) => e.kind === 'toque')!;
    expect(touch.retraction).toMatchObject({ status: 'confirmada', confirmedAtIndex: 2 });
    expect(touch.leftWick).toBe(true);
    expect(touch.pierced).toBe(true);
    expect(touch.extremeIndex).toBe(1);
  });

  it('rompimento antes da retração marca o toque como rompido', () => {
    const cs = candles([...base,
      [1.1004, 1.1011, 1.1003, 1.1010],
      [1.1010, 1.1020, 1.1009, 1.1018], // fecha acima da borda externa
      [1.1018, 1.1022, 1.1015, 1.1020],
    ]);
    const ev = computeZoneEvents(zone, cs, cs.length - 1, params);
    expect(ev.find((e) => e.kind === 'toque')!.retraction!.status).toBe('rompida');
    const br = ev.find((e) => e.kind === 'rompimento')!;
    expect(br).toMatchObject({ startIndex: 2, endIndex: 3, returned: false });
  });

  it('rompimento seguido de retorno é marcado como revertido', () => {
    const cs = candles([...base,
      [1.1004, 1.1011, 1.1003, 1.1010],
      [1.1010, 1.1020, 1.1009, 1.1018],
      [1.1018, 1.1019, 1.1005, 1.1006], // volta para dentro
    ]);
    const br = computeZoneEvents(zone, cs, cs.length - 1, params).find((e) => e.kind === 'rompimento')!;
    expect(br.returned).toBe(true);
  });

  it('ausência de retração só é declarada depois da janela', () => {
    const flat: Array<[number, number, number, number]> = [
      [1.1009, 1.1010, 1.1008, 1.1009], [1.1009, 1.1010, 1.1008, 1.1009], [1.1009, 1.1010, 1.1008, 1.1009],
    ];
    const touch: [number, number, number, number] = [1.1004, 1.1011, 1.1003, 1.1010];
    const cs = candles([...base, touch, ...flat]);
    // contato continua (candles planos ainda dentro da faixa): evento em andamento
    expect(computeZoneEvents(zone, cs, cs.length - 1, params).at(-1)!.retraction!.status).toBe('em_andamento');
    // saiu do contato mas a janela ainda não terminou
    const away = candles([...base, touch, [1.1010, 1.1010, 1.1002, 1.1003], [1.1003, 1.1004, 1.1002, 1.1003]]);
    expect(computeZoneEvents(zone, away, away.length - 1, { ...params, retractionMin: 0.0009 }).find((e) => e.kind === 'toque')!.retraction!.status).toBe('aguardando');
    // janela de 1 candle esgotada sem retração suficiente
    const after = candles([...base, touch, [1.1004, 1.1004, 1.1002, 1.1003], [1.1003, 1.1004, 1.1002, 1.1003]]);
    expect(computeZoneEvents(zone, after, after.length - 1, { ...params, retractionWindow: 1, retractionMin: 0.0012 }).find((e) => e.kind === 'toque')!.retraction!.status).toBe('ausente');
  });

  it('sem critério de retração definido o estado é indefinido (nunca "confirmada")', () => {
    const cs = candles([...base, [1.1004, 1.1013, 1.1003, 1.1006], [1.1006, 1.1006, 1.1000, 1.1001]]);
    const ev = computeZoneEvents(zone, cs, cs.length - 1, { ...params, retractionMin: null });
    expect(ev.find((e) => e.kind === 'toque')!.retraction!.status).toBe('indefinida');
  });

  it('aproximação não conta como toque', () => {
    const cs = candles([...base, [1.1004, 1.1008, 1.1003, 1.1006], [1.1006, 1.1006, 1.1000, 1.1001]]);
    const ev = computeZoneEvents(zone, cs, cs.length - 1, params);
    expect(ev.filter((e) => e.kind === 'toque')).toHaveLength(0);
    expect(ev.some((e) => e.kind === 'aproximacao')).toBe(true);
  });

  it('agrupa pivôs próximos numa zona e separa os distantes', () => {
    const cs = fromCloses([5, 10, 15, 10, 5, 10, 15.5, 10, 5, 10, 25, 10, 5, 10], {}, 0.2, 0);
    const sw = detectSwings(cs, 2, 0, cs.length - 1).filter((s) => s.kind === 'topo');
    const zones = buildZones(sw, 0.0002);
    expect(zones.filter((z) => z.side === 'resistencia')).toHaveLength(2);
    const near = zones.find((z) => z.pivotIndexes.length === 2)!;
    expect(near.lower).toBeLessThan(near.upper);
  });
});
