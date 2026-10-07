import { describe, expect, it } from 'vitest';
import { fromLocal, lineLength } from '../lib/geo';
import { ORIGIN } from '../model/testUtils';
import { chopLine, segmentsFromTiles } from './tileStreets';

const L = (pts: [number, number][]) => pts.map(([x, y]) => fromLocal(ORIGIN, x, y));

describe('ruas a partir das peças do mapa', () => {
  it('corta uma rua longa em quarteirões de ~110 m', () => {
    const parts = chopLine(L([[0, 0], [500, 0]]));
    expect(parts.length).toBe(5);
    expect(lineLength(parts[0])).toBeCloseTo(110, 0);
    // o resto curto (60 m) vira um pedaço próprio; abaixo de 25 m é juntado ao anterior
    expect(chopLine(L([[0, 0], [230, 0]])).length).toBe(2);
  });

  it('gera trechos só de ruas com nome e classe de carro, perto do destino', () => {
    const { segments } = segmentsFromTiles(
      [
        { name: 'Rua A', cls: 'minor', lines: [L([[-200, 0], [200, 0]])] },
        { name: 'Av. B', cls: 'primary', lines: [L([[0, -150], [0, 150]])] },
        { name: 'Trilha', cls: 'path', lines: [L([[0, 50], [100, 50]])] },
        { name: '', cls: 'minor', lines: [L([[0, 80], [100, 80]])] },
        { name: 'Rua Longe', cls: 'minor', lines: [L([[3000, 0], [3200, 0]])] },
      ],
      [],
      ORIGIN,
      400,
    );
    const names = new Set(segments.map((s) => s.name));
    expect(names).toEqual(new Set(['Rua A', 'Av. B']));
  });

  it('remove a duplicata da mesma rua na borda entre duas peças', () => {
    const line = L([[0, 0], [100, 0]]);
    const { segments } = segmentsFromTiles(
      [
        { name: 'Rua A', cls: 'minor', lines: [line] },
        { name: 'Rua A', cls: 'minor', lines: [line] },
      ],
      [],
      ORIGIN,
      400,
    );
    expect(segments.length).toBe(1);
  });

  it('comércio por perto torna a rua comercial; estacionamentos viram plano B', () => {
    const shops = Array.from({ length: 5 }, (_, i) => ({ cls: 'shop', pos: fromLocal(ORIGIN, 20 + i * 10, 10) }));
    const { segments, lots } = segmentsFromTiles(
      [{ name: 'Rua A', cls: 'minor', lines: [L([[0, 0], [100, 0]])] }],
      [...shops, { cls: 'parking', name: 'Estac. X', pos: fromLocal(ORIGIN, 50, 50) }],
      ORIGIN,
      400,
    );
    expect(segments[0].profile).toBe('commercial');
    expect(lots).toEqual([expect.objectContaining({ name: 'Estac. X' })]);
  });
});
