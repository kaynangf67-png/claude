import { afterEach, describe, expect, it, vi } from 'vitest';
import { targetSide } from '../hooks/useSimulation';
import { deriveMotion } from '../services/location/gpsTracker';
import { generateCity } from '../world/cityGenerator';
import { setCity } from '../world/cityStore';
import { sampleRoute } from '../world/roadGraph';
import { WorldSimulation } from './WorldSimulation';

function fixAt(sim: WorldSimulation, s: number, offset = 0) {
  const p = sampleRoute(sim.vehicle.route!, s);
  return {
    position: { x: p.position.x + offset, z: p.position.z + offset },
    heading: p.heading,
    speed: 8,
    accuracy: 6,
    at: Date.now(),
  };
}

describe('GPS real', () => {
  afterEach(() => vi.useRealTimers());

  it('o carro segue o GPS pela rota e chega na vaga', () => {
    setCity(generateCity());
    const sim = new WorldSimulation();
    const events: string[] = [];
    sim.onEvent((e) => events.push(e.type));
    const target = sim.candidates().find((c) => c.driveDistance > 250 && c.spot.type === 'curb')!.spot;
    const route = sim.startNavigation(target.id, 'x')!;
    expect(sim.applyGpsFix(fixAt(sim, 0))).toBe(true);
    // leituras a cada 8 m com 2 m de erro lateral, 30 quadros entre elas
    for (let s = 0; s <= route.length && sim.vehicle.mode === 'driving'; s += 8) {
      sim.applyGpsFix(fixAt(sim, Math.min(s, route.length), 2));
      for (let k = 0; k < 30; k++) sim.update(1 / 30);
    }
    sim.applyGpsFix(fixAt(sim, route.length));
    for (let k = 0; k < 30; k++) sim.update(1 / 30);
    expect(events).toContain('arrived');
    expect(sim.vehicle.mode).toBe('arrived');
  });

  it('fora da área do mapa é recusado; longe da rota por 4 s pede recálculo', () => {
    vi.useFakeTimers();
    setCity(generateCity());
    const sim = new WorldSimulation();
    expect(sim.applyGpsFix({ position: { x: 5000, z: 5000 }, heading: null, speed: 0, accuracy: 5, at: 0 })).toBe(false);
    const events: string[] = [];
    sim.onEvent((e) => events.push(e.type));
    const target = sim.candidates().find((c) => c.driveDistance > 250)!.spot;
    sim.startNavigation(target.id, 'x');
    sim.applyGpsFix(fixAt(sim, 0));
    const away = { ...fixAt(sim, 0), position: { x: sim.vehicle.position.x + 52, z: sim.vehicle.position.z + 52 } };
    for (let t = 0; t < 6; t++) {
      vi.advanceTimersByTime(1000);
      sim.applyGpsFix({ ...away, at: Date.now() });
      sim.update(0.1);
    }
    expect(events).toContain('offroute');
  });

  it('identifica de que lado fica a vaga', () => {
    setCity(generateCity());
    const sim = new WorldSimulation();
    const target = sim.candidates().find((c) => c.driveDistance > 150 && c.spot.type === 'curb')!.spot;
    const route = sim.startNavigation(target.id, 'x')!;
    const side = targetSide(route);
    const end = sampleRoute(route, route.length - 14);
    // confere com o produto vetorial direto entre a direção final e a vaga
    const d = { x: Math.cos(end.heading), z: -Math.sin(end.heading) };
    const v = { x: target.position.x - end.position.x, z: target.position.z - end.position.z };
    expect(side).toBe(d.x * v.z - d.z * v.x > 0 ? 'right' : 'left');
  });

  it('deriva velocidade e rumo quando o aparelho não informa', () => {
    const a = { position: { x: 0, z: 0 }, at: 0, speed: null, heading: null, accuracy: 5 };
    const b = { position: { x: 0, z: -10 }, at: 1000, speed: null, heading: null, accuracy: 5 }; // 10 m para o norte em 1 s
    const m = deriveMotion(a, b);
    expect(m.speed).toBeCloseTo(10, 5);
    expect(m.heading).toBeCloseTo(Math.PI / 2, 5);
    // rumo do aparelho (graus, norte=0, leste=90) tem prioridade
    expect(deriveMotion(a, { ...b, speed: 8, heading: 90 }).heading).toBeCloseTo(0, 5);
    // parado: sem rumo
    expect(deriveMotion(a, { ...b, position: { x: 0.5, z: 0 } }).heading).toBeNull();
  });
});
