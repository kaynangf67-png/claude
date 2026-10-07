import { beforeEach, describe, expect, it } from 'vitest';
import { createMockWorld } from '../data/mockSpots';
import { dist, setGeoOrigin } from '../lib/geo';
import { WorldSimulation } from '../simulation/WorldSimulation';
import { generateCity } from './cityGenerator';
import { setCity } from './cityStore';
import { canTraverse, type CityData } from './cityTypes';
import { buildCityFromOsm } from './osm/buildFromOsm';
import { overpassToCompact } from './osm/compact';
import { buildOverpassFixture, FIXTURE_CENTER } from './osm/fixture';
import { buildOverpassQuery } from './osm/overpass';
import { buildRoute, sampleRoute, shortestPaths } from './roadGraph';

function osmCity(): CityData {
  setGeoOrigin({ lat: FIXTURE_CENTER[0], lon: FIXTURE_CENTER[1] });
  return buildCityFromOsm(overpassToCompact(buildOverpassFixture(), FIXTURE_CENTER, 650));
}

function driveUntilArrival(sim: WorldSimulation) {
  for (let k = 0; k < 60 * 600 && sim.vehicle.mode === 'driving'; k++) sim.update(1 / 60);
}

describe('Cidade procedural (reserva)', () => {
  const city = generateCity();
  beforeEach(() => setCity(city));

  it('gera malha conectada', () => {
    expect(city.nodes.size).toBe(81);
    expect(city.edges.size).toBe(144);
    const sp = shortestPaths(city, { edgeId: 'h-0-0', s: 10 });
    for (const d of sp.dist.values()) expect(Number.isFinite(d)).toBe(true);
  });

  it('gera vagas mock com lat/lon e estacionamentos', () => {
    setGeoOrigin({ lat: -20.329, lon: -40.292 });
    const w = createMockWorld(city, Date.now());
    expect(w.spots.length).toBeGreaterThan(60);
    expect(w.spots.filter((s) => s.type === 'lot')).toHaveLength(3);
    expect(w.spots[0].id).toBe('vaga-001');
    expect(Math.abs(w.spots[0].latitude + 20.329)).toBeLessThan(0.01);
  });

  it('constrói rota contínua que termina na vaga', () => {
    const sim = new WorldSimulation();
    const target = sim.candidates().find((c) => c.driveDistance > 300 && c.spot.type === 'curb')!.spot;
    const route = sim.startNavigation(target.id, 'teste')!;
    expect(route.length).toBeGreaterThan(100);
    expect(dist(sampleRoute(route, route.length).position, target.position)).toBeLessThan(0.5);
    for (let i = 1; i < route.points.length; i++) expect(dist(route.points[i - 1], route.points[i])).toBeLessThan(120);
    expect(route.instructions.some((i) => i.type === 'left' || i.type === 'right')).toBe(true);
    expect(route.instructions.at(-1)!.type).toBe('arrive');
  });

  it('o veículo percorre a rota e chega', () => {
    const sim = new WorldSimulation();
    const events: string[] = [];
    sim.onEvent((e) => events.push(e.type));
    sim.startNavigation(sim.spots.find((s) => s.type === 'curb')!.id, 'teste');
    driveUntilArrival(sim);
    expect(sim.vehicle.mode).toBe('arrived');
    expect(events).toContain('arrived');
  });

  it('rota na mesma aresta não lança', () => {
    const route = buildRoute(city, { position: { x: 0, z: 0 }, edge: { edgeId: 'h-4-4', s: 20 } }, { edgeId: 'h-4-4', s: 60 }, { x: 10, z: 10 }, 'x');
    expect(route.length).toBeGreaterThan(0);
  });
});

describe('Importador OpenStreetMap', () => {
  it('monta a consulta Overpass com a área e as camadas necessárias', () => {
    const q = buildOverpassQuery(FIXTURE_CENTER, 650);
    expect(q).toContain('[out:json]');
    expect(q).toMatch(/bbox:-20\.33\d+,-40\.29\d+,-20\.32\d+,-40\.28\d+/);
    for (const layer of ['highway', 'building', 'amenity"="parking', 'coastline', 'out body geom']) expect(q).toContain(layer);
  });

  it('converte vias, mão única, prédios, áreas, litoral e POIs', () => {
    const data = overpassToCompact(buildOverpassFixture(), FIXTURE_CENTER, 650);
    expect(data.roads.find((r) => r.n === 'Condomínio')).toBeUndefined();
    const contramao = data.roads.find((r) => r.n === 'Rua Contramão')!;
    expect(contramao.o).toBe(true);
    // oneway=-1 é normalizado: os nós passam a seguir o sentido permitido (sul → norte)
    expect(contramao.g[0][0]).toBeLessThan(contramao.g[contramao.g.length - 1][0]);
    expect(data.buildings.length).toBe(15);
    expect(data.areas.map((a) => a.k).sort()).toEqual(['beach', 'park', 'parking']);
    expect(data.coast).toHaveLength(1);
    expect(data.pois.map((p) => p.c)).toEqual(expect.arrayContaining(['hospital', 'restaurante', 'shopping', 'parque', 'praia']));
    expect(data.shops.length).toBeGreaterThanOrEqual(20);
  });

  it('constrói a cidade: grafo dirigido, prédios com altura real, estacionamento com capacidade', () => {
    const city = osmCity();
    expect(city.source).toBe('osm');
    expect(city.attribution).toContain('OpenStreetMap');
    const oneway = [...city.edges.values()].filter((e) => e.street === 'Rua Mão Única');
    expect(oneway.length).toBeGreaterThan(0);
    expect(oneway.every((e) => e.oneway && e.dir.z < 0)).toBe(true); // sentido norte = -z
    // a avenida curva vira vários trechos retos (vértices intermediários mantidos)
    expect([...city.edges.values()].filter((e) => e.street === 'Avenida Beira-Mar').length).toBeGreaterThan(8);
    const withLevels = city.buildings.filter((b) => b.measured);
    expect(withLevels.length).toBeGreaterThan(5);
    expect(city.buildings.some((b) => Math.abs(b.h - 42) < 0.01)).toBe(true);
    expect(city.lots).toHaveLength(1);
    expect(city.lots[0]).toMatchObject({ name: 'Estacionamento Teste', capacity: 90, capacityMeasured: true });
    expect(city.streetNames.map((s) => s.name)).toContain('Avenida Beira-Mar');
    expect(city.zoneAt({ x: 0, z: 370 })).toBe('orla');
    expect(city.pois.map((p) => p.name)).toEqual(expect.arrayContaining(['Shopping Teste', 'Hospital Teste', 'Praia Teste']));
    expect(city.slots.length).toBeGreaterThan(200);
  });

  it('rotas respeitam a mão única', () => {
    const city = osmCity();
    setCity(city);
    const target = [...city.edges.values()].find((e) => e.street === 'Rua Mão Única' && e.length > 60)!;
    const startEdge = [...city.edges.values()].find((e) => e.street === 'Rua Vertical 1')!;
    const sp = shortestPaths(city, { edgeId: startEdge.id, s: 5 });
    // percorre o caminho de nós e garante que nenhum trecho foi usado na contramão
    let cur: string | null | undefined = target.a;
    while (cur) {
      const prev = sp.prev.get(cur);
      if (prev) {
        const used = [...city.edges.values()].find(
          (e) => ((e.a === prev && e.b === cur) || (e.b === prev && e.a === cur)) && canTraverse(e, prev),
        );
        expect(used).toBeDefined();
      }
      cur = prev;
    }
    expect(Number.isFinite(sp.dist.get(target.a)!)).toBe(true);
  });

  it('simulação completa roda sobre o mapa OSM: carro chega e o trânsito respeita mão única', () => {
    const city = osmCity();
    setCity(city);
    const sim = new WorldSimulation();
    expect(sim.spots.length).toBeGreaterThan(20);
    expect(sim.spots.some((s) => s.type === 'lot')).toBe(true);
    const candidates = sim.candidates().filter((c) => Number.isFinite(c.driveDistance));
    expect(candidates.length).toBeGreaterThan(10);
    const far = candidates.sort((a, b) => b.driveDistance - a.driveDistance)[0];
    const route = sim.startNavigation(far.spot.id, 'teste')!;
    expect(route.length).toBeGreaterThan(200);
    driveUntilArrival(sim);
    expect(sim.vehicle.mode).toBe('arrived');
    for (let k = 0; k < 600; k++) {
      sim.update(1 / 20);
      for (const a of sim.agents) {
        const e = city.edges.get(a.edgeId)!;
        if (e.oneway) expect(a.forward).toBe(true);
      }
    }
  });
});
