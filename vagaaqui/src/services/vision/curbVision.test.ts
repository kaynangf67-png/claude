import { describe, expect, it } from 'vitest';
import { CurbObserver, DEFAULT_CAMERA, focalPx, MotionTracker, spotInView, toGround, type CameraModel, type Detection, type Pose } from './curbVision';

const cam: CameraModel = { ...DEFAULT_CAMERA, width: 1280, height: 720 };

/** Caixa sintética de um carro cuja traseira está a `forward` m e `lateral` m à direita. */
function boxAt(forward: number, lateral: number): Detection {
  const f = focalPx(cam);
  const bottom = cam.horizon * cam.height + (cam.cameraHeight * f) / forward;
  const cx = cam.width / 2 + (lateral * f) / forward;
  const w = (1.8 * f) / forward;
  const h = (1.5 * f) / forward;
  return { category: 'car', score: 0.8, x: cx - w / 2, y: bottom - h, w, h };
}

describe('Sensor de câmera: geometria', () => {
  const pose: Pose = { position: { x: 0, z: 0 }, heading: 0 }; // frente = +X, direita = +Z

  it('a base da caixa vira distância e posição lateral corretas', () => {
    const g = toGround(boxAt(12, 3.5), cam, pose)!;
    expect(g.forward).toBeCloseTo(12, 5);
    expect(g.lateral).toBeCloseTo(3.5, 5);
    expect(g.curbside).toBe(true);
    expect(g.world.x).toBeCloseTo(14, 5); // +2 m até o centro do carro
    expect(g.world.z).toBeCloseTo(3.5, 5);
    // carro na própria faixa não conta como estacionado
    expect(toGround(boxAt(12, 0.5), cam, pose)!.curbside).toBe(false);
    // acima do horizonte / longe demais é descartado
    expect(toGround({ ...boxAt(12, 3), y: 10, h: 20 }, cam, pose)).toBeNull();
  });

  it('respeita a direção do carro (rumo norte)', () => {
    const north: Pose = { position: { x: 100, z: 100 }, heading: Math.PI / 2 }; // frente = -Z, direita = +X
    const g = toGround(boxAt(10, 3), cam, north)!;
    expect(g.world.x).toBeCloseTo(103, 5);
    expect(g.world.z).toBeCloseTo(88, 5);
  });

  it('vota por passagem: vaga com carro → ocupada; vaga vazia → livre', () => {
    const obs = new CurbObserver();
    const spots = [
      { id: 'cheia', position: { x: 20, z: 3.5 } },
      { id: 'vazia', position: { x: 32, z: -3.5 } },
    ];
    const out: ReturnType<CurbObserver['update']> = [];
    // o carro avança 1 m por quadro; o carro estacionado está na vaga "cheia"
    for (let t = 0; t < 40; t++) {
      const p: Pose = { position: { x: t, z: 0 }, heading: 0 };
      const parkedForward = 20 - 2 - t;
      const dets = parkedForward > 3 ? [boxAt(parkedForward, 3.5)] : [];
      const ground = dets.map((d) => toGround(d, cam, p)).filter((g): g is NonNullable<typeof g> => !!g);
      out.push(...obs.update(spots, ground, cam, p, t * 200));
    }
    const byId = Object.fromEntries(out.map((o) => [o.spotId, o]));
    expect(byId.cheia.kind).toBe('occupied');
    expect(byId.vazia.kind).toBe('available');
    expect(byId.cheia.trust).toBeGreaterThan(0.3);
    expect(byId.cheia.trust).toBeLessThanOrEqual(0.55);
    expect(spotInView({ x: 15, z: 3 }, cam, { position: { x: 0, z: 0 }, heading: 0 }).visible).toBe(true);
  });

  it('parado (semáforo) não acumula votos: carro ao lado não vira vaga ocupada', () => {
    const obs = new CurbObserver();
    const spots = [{ id: 'ao-lado', position: { x: 14, z: 3.5 } }];
    const p: Pose = { position: { x: 0, z: 0 }, heading: 0 };
    const ground = [toGround(boxAt(12, 3.5), cam, p)!];
    const out = [];
    for (let t = 0; t < 100; t++) out.push(...obs.update(spots, ground, cam, p, t * 200, 0));
    expect(out).toHaveLength(0);
  });

  it('rastreamento: carro andando ao lado não vira vaga ocupada; carro parado sim', () => {
    const tracker = new MotionTracker();
    const obs = new CurbObserver();
    const spots = [{ id: 'v', position: { x: 30, z: 3.5 } }];
    const out = [];
    for (let t = 0; t < 40; t++) {
      // nós a 5 m/s; o outro carro anda junto a 5 m/s, sempre 12 m à frente, 3,5 m à direita
      const p: Pose = { position: { x: t, z: 0 }, heading: 0 };
      const ground = [toGround(boxAt(12, 3.5), cam, p)!];
      tracker.update(ground, t * 200);
      if (t > 3) expect(ground[0].moving).toBe(true);
      out.push(...obs.update(spots, ground, cam, p, t * 200, 5));
    }
    expect(out.every((o) => o.kind !== 'occupied')).toBe(true);
    // carro estacionado: posição fixa no mundo → velocidade ~0
    const t2 = new MotionTracker();
    let last;
    for (let t = 0; t < 10; t++) {
      const p: Pose = { position: { x: t, z: 0 }, heading: 0 };
      last = [toGround(boxAt(20 - t, 3.5), cam, p)!];
      t2.update(last, t * 200);
    }
    expect(last![0].moving).toBe(false);
    expect(last![0].groundSpeed!).toBeLessThan(0.5);
  });
});
