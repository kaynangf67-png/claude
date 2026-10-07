import type { CityData } from '../../world/cityTypes';

/** Nome de cada rua, posicionado no seu trecho mais longo (o resto do fundo vem dos tiles). */
export interface StreetLabel {
  name: string;
  x: number;
  z: number;
  angle: number;
  length: number;
}

export function buildStreetLabels(city: CityData): StreetLabel[] {
  const best = new Map<string, StreetLabel>();
  for (const e of city.edges.values()) {
    if (!e.street || e.street === 'Via sem nome' || e.length < 35) continue;
    const cur = best.get(e.street);
    if (cur && cur.length >= e.length) continue;
    const a = city.nodes.get(e.a)!.position;
    best.set(e.street, {
      name: e.street,
      x: a.x + (e.dir.x * e.length) / 2,
      z: a.z + (e.dir.z * e.length) / 2,
      angle: Math.atan2(e.dir.z, e.dir.x),
      length: e.length,
    });
  }
  return [...best.values()];
}
