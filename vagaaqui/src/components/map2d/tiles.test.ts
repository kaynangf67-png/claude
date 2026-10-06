import { describe, expect, it } from 'vitest';
import { LEVELS, pickLevel, tileMeters, tilesFor } from './tiles';

describe('tiles do mapa 2D', () => {
  it('escolhe o menor nível com resolução suficiente para a tela', () => {
    expect(LEVELS[pickLevel(0.1)]).toBe(0.25);
    expect(LEVELS[pickLevel(3)]).toBe(4);
    expect(LEVELS[pickLevel(5.2)]).toBe(8);
    expect(LEVELS[pickLevel(100)]).toBe(16); // além do máximo: usa o mais detalhado
  });

  it('cobre o retângulo visível sem buracos', () => {
    const level = pickLevel(2);
    const m = tileMeters(level);
    const box = { minX: -10, maxX: m * 2 + 5, minZ: 3, maxZ: m - 1 };
    const tiles = tilesFor(level, box);
    expect(tiles).toContainEqual([-1, 0]);
    expect(tiles).toContainEqual([2, 0]);
    expect(tiles.length).toBe(4);
  });
});
