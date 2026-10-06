import { describe, expect, it } from 'vitest';
import { fromLocal } from '../lib/geo';
import { ParkingDetector, type Fix } from './detector';
import { ORIGIN } from './testUtils';

/** gera leituras de 1 em 1 s andando em linha reta no eixo x */
function leg(start: { x: number; t: number }, speed: number, seconds: number): { fixes: Fix[]; end: { x: number; t: number } } {
  const fixes: Fix[] = [];
  let x = start.x;
  let t = start.t;
  for (let i = 0; i < seconds; i++) {
    x += speed;
    t += 1000;
    fixes.push({ pos: fromLocal(ORIGIN, x, 0), speed, at: t });
  }
  return { fixes, end: { x, t } };
}

function run(d: ParkingDetector, fixes: Fix[]) {
  return fixes.map((f) => d.push(f)).filter(Boolean);
}

describe('detecção de estacionamento', () => {
  it('dirigir → parar → sair andando = estacionou no ponto de parada', () => {
    const d = new ParkingDetector();
    const drive = leg({ x: 0, t: 0 }, 12, 60);
    const stop = leg(drive.end, 0, 30);
    const walk = leg(stop.end, 1.3, 60);
    const ev = run(d, [...drive.fixes, ...stop.fixes, ...walk.fixes]);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.type).toBe('parked');
    const expected = fromLocal(ORIGIN, drive.end.x, 0);
    expect(ev[0]!.pos[0]).toBeCloseTo(expected[0], 5);
  });

  it('semáforo (para e volta a dirigir) não é estacionar', () => {
    const d = new ParkingDetector();
    const a = leg({ x: 0, t: 0 }, 12, 60);
    const b = leg(a.end, 0, 45);
    const c = leg(b.end, 12, 30);
    expect(run(d, [...a.fixes, ...b.fixes, ...c.fixes])).toHaveLength(0);
  });

  it('parado no carro sem sair andando não gera evento', () => {
    const d = new ParkingDetector();
    const a = leg({ x: 0, t: 0 }, 12, 60);
    const b = leg(a.end, 0, 400);
    expect(run(d, [...a.fixes, ...b.fixes])).toHaveLength(0);
  });

  it('estacionado → volta ao carro → dirige = saiu da vaga', () => {
    const d = new ParkingDetector();
    const drive = leg({ x: 0, t: 0 }, 12, 60);
    const stop = leg(drive.end, 0, 20);
    const walkAway = leg(stop.end, 1.3, 60);
    const back = leg(walkAway.end, -1.3, 60); // volta ao carro
    const leave = leg(back.end, 10, 30);
    const ev = run(d, [...drive.fixes, ...stop.fixes, ...walkAway.fixes, ...back.fixes, ...leave.fixes]);
    expect(ev.map((e) => e!.type)).toEqual(['parked', 'left']);
  });

  it('pegar ônibus longe do carro não conta como saída da vaga', () => {
    const d = new ParkingDetector(fromLocal(ORIGIN, 0, 0));
    const walk = leg({ x: 0, t: 0 }, 1.3, 400); // ~520 m a pé
    const bus = leg(walk.end, 10, 60);
    expect(run(d, [...walk.fixes, ...bus.fixes])).toHaveLength(0);
  });

  it('leituras imprecisas são ignoradas', () => {
    const d = new ParkingDetector();
    expect(d.push({ pos: ORIGIN, speed: 20, at: 0, accuracy: 300 })).toBeNull();
    expect(d.mode).toBe('idle');
  });

  it('calcula velocidade quando o aparelho não informa', () => {
    const d = new ParkingDetector();
    const fixes = leg({ x: 0, t: 0 }, 12, 40).fixes.map((f) => ({ ...f, speed: null }));
    run(d, fixes);
    expect(d.mode).toBe('driving');
  });
});
