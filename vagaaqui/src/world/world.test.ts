import { describe, expect, it } from 'vitest';
import { dist } from '../lib/geo';
import { createMockWorld } from '../data/mockSpots';
import { WorldSimulation } from '../simulation/WorldSimulation';
import { getCity } from './cityGenerator';
import { buildRoute, sampleRoute, shortestPaths } from './roadGraph';

describe('Cidade e rotas', () => {
  const city = getCity();

  it('gera malha conectada', () => {
    expect(city.nodes.size).toBe(81);
    expect(city.edges.size).toBe(144);
    const sp = shortestPaths(city, { edgeId: 'h-0-0', s: 10 });
    for (const d of sp.dist.values()) expect(Number.isFinite(d)).toBe(true);
  });

  it('gera vagas mock com lat/lon e estacionamentos', () => {
    const w = createMockWorld(city, Date.now());
    expect(w.spots.length).toBeGreaterThan(60);
    expect(w.spots.filter((s) => s.type === 'lot')).toHaveLength(3);
    expect(w.spots[0].id).toBe('vaga-001');
    expect(Math.abs(w.spots[0].latitude + 20.329)).toBeLessThan(0.01);
  });

  it('constrói rota contínua que termina na vaga', () => {
    const sim = new WorldSimulation();
    const target = sim.spots.find((s) => s.edgeId === 'v-6-1')!;
    const route = sim.startNavigation(target.id, 'teste')!;
    expect(route.length).toBeGreaterThan(100);
    const end = sampleRoute(route, route.length).position;
    expect(dist(end, target.position)).toBeLessThan(0.5);
    for (let i = 1; i < route.points.length; i++) expect(dist(route.points[i - 1], route.points[i])).toBeLessThan(120);
    expect(route.instructions.some((i) => i.type === 'left' || i.type === 'right')).toBe(true);
    expect(route.instructions.at(-1)!.type).toBe('arrive');
  });

  it('o veículo percorre a rota e chega', () => {
    const sim = new WorldSimulation();
    const events: string[] = [];
    sim.onEvent((e) => events.push(e.type));
    const target = sim.spots.find((s) => s.type === 'curb')!;
    sim.startNavigation(target.id, 'teste');
    for (let k = 0; k < 60 * 400 && sim.vehicle.mode === 'driving'; k++) sim.update(1 / 60);
    expect(sim.vehicle.mode).toBe('arrived');
    expect(events).toContain('arrived');
  });

  it('rota a partir de rua com aresta inexistente cai em fallback sem lançar', () => {
    const route = buildRoute(
      city,
      { position: { x: 0, z: 0 }, edge: { edgeId: 'h-4-4', s: 20 } },
      { edgeId: 'h-4-4', s: 60 },
      { x: 10, z: 10 },
      'x',
    );
    expect(route.length).toBeGreaterThan(0);
  });
});
