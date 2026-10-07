import { describe, expect, it } from 'vitest';
import { assessSpot, statusFor, type ConfidenceContext } from './confidence';
import { recommend, type Candidate } from './recommendation';
import { applyReward, DEFAULT_PROFILE, levelFor, accuracy } from './rewards';
import type { ParkingSpot, SpotReport } from '../types';

const NOW = new Date('2026-10-06T14:00:00-03:00').getTime();

function spot(reports: Partial<SpotReport>[] = [], extra: Partial<ParkingSpot> = {}): ParkingSpot {
  return {
    id: 'vaga-test',
    latitude: -20.329,
    longitude: -40.292,
    position: { x: 0, z: 0 },
    heading: 0,
    edgeId: 'h-1-1',
    t: 0.5,
    streetName: 'Rua Teste',
    zone: 'centro',
    type: 'curb',
    segmentCapacity: 12,
    reports: reports.map((r, i) => ({
      id: `r${i}`,
      kind: 'available',
      source: 'crowd',
      timestamp: NOW,
      trust: 1,
      ...r,
    })),
    ...extra,
  };
}

const ctx = (patch: Partial<ConfidenceContext> = {}): ConfidenceContext => ({
  now: NOW,
  date: new Date(NOW),
  nearbyUsers: 0,
  cruisingNearby: 0,
  flowPerMin: 6,
  avgNearbySpeed: null,
  ...patch,
});

describe('Índice de Confiança da Vaga', () => {
  it('nunca mostra 100% nem 0%', () => {
    const many = Array.from({ length: 10 }, () => ({ kind: 'available' as const, timestamp: NOW - 1000 }));
    const a = assessSpot(spot(many), ctx());
    expect(a.probability).toBeLessThanOrEqual(0.95);
    const occ = Array.from({ length: 10 }, () => ({ kind: 'parked' as const, timestamp: NOW - 1000 }));
    const b = assessSpot(spot(occ), ctx());
    expect(b.probability).toBeGreaterThanOrEqual(0.03);
  });

  it('confirmação recente de vaga livre eleva a probabilidade e a confiabilidade', () => {
    const orla = { zone: 'orla' as const };
    const base = assessSpot(spot([], orla), ctx());
    const fresh = assessSpot(spot([{ kind: 'available', timestamp: NOW - 18_000 }], orla), ctx({ nearbyUsers: 2 }));
    expect(fresh.probability).toBeGreaterThan(base.probability + 0.3);
    expect(fresh.reliabilityLevel).toBe('alta');
    expect(fresh.status).toBe('likely_available');
  });

  it('no centro saturado a mesma confirmação vale menos (vagas somem em ~2 min)', () => {
    const r = [{ kind: 'available' as const, timestamp: NOW - 18_000 }];
    const centro = assessSpot(spot(r), ctx());
    const orla = assessSpot(spot(r, { zone: 'orla' }), ctx());
    expect(centro.probability).toBeLessThan(orla.probability);
  });

  it('confirmação antiga decai e vira cinza (baixa confiabilidade)', () => {
    const old = assessSpot(spot([{ kind: 'available', timestamp: NOW - 30 * 60_000 }]), ctx());
    expect(old.status).toBe('stale');
  });

  it('"estacionei aqui" marca como provavelmente ocupada', () => {
    const a = assessSpot(spot([{ kind: 'parked', timestamp: NOW - 5000 }]), ctx({ nearbyUsers: 1 }));
    expect(a.status).toBe('likely_occupied');
  });

  it('"saí da vaga" logo após "estacionei" reinicia o estado como livre', () => {
    const a = assessSpot(
      spot([
        { kind: 'parked', timestamp: NOW - 600_000 },
        { kind: 'left', timestamp: NOW - 5_000 },
      ], { zone: 'orla' }),
      ctx(),
    );
    expect(a.status).toBe('likely_available');
  });

  it('concorrência de motoristas procurando vaga reduz a chance', () => {
    const r = [{ kind: 'available' as const, timestamp: NOW - 60_000 }];
    const calm = assessSpot(spot(r), ctx());
    const busy = assessSpot(spot(r), ctx({ cruisingNearby: 3 }));
    expect(busy.probability).toBeLessThan(calm.probability);
  });

  it('dados frescos de estacionamento com vagas livres dão alta chance', () => {
    const a = assessSpot(spot([], { type: 'lot' }), ctx({ lot: { capacity: 120, reportedFree: 30, reportedAt: NOW - 20_000 } }));
    expect(a.probability).toBeGreaterThan(0.85);
    expect(a.status).toBe('likely_available');
  });

  it('status por faixa', () => {
    expect(statusFor(0.87, 0.9)).toBe('likely_available');
    expect(statusFor(0.5, 0.9)).toBe('uncertain');
    expect(statusFor(0.2, 0.9)).toBe('likely_occupied');
    expect(statusFor(0.9, 0.1)).toBe('stale');
  });
});

describe('Rota inteligente', () => {
  it('não escolhe simplesmente a vaga mais próxima', () => {
    const near: Candidate = {
      spot: spot([], { id: 'perto' }),
      assessment: { ...assessSpot(spot([{ kind: 'occupied', timestamp: NOW - 20_000 }]), ctx()), spotId: 'perto' },
      driveDistance: 80,
      turns: 0,
    };
    const far: Candidate = {
      spot: spot([], { id: 'longe' }),
      assessment: { ...assessSpot(spot([{ kind: 'available', timestamp: NOW - 15_000 }]), ctx({ nearbyUsers: 2 })), spotId: 'longe' },
      driveDistance: 350,
      turns: 1,
    };
    const recs = recommend([near, far]);
    expect(recs[0].spotId).toBe('longe');
    expect(recs[0].reasons.join(' ')).toMatch(/mais próxima/);
  });

  it('respeita vagas excluídas', () => {
    const c: Candidate = {
      spot: spot([], { id: 'x' }),
      assessment: assessSpot(spot([{ kind: 'available', timestamp: NOW }]), ctx()),
      driveDistance: 100,
      turns: 0,
    };
    expect(recommend([c], { exclude: new Set(['x']) })).toHaveLength(0);
  });
});

describe('Recompensas', () => {
  it('pontua conforme a ação e calcula níveis', () => {
    const { profile } = applyReward(DEFAULT_PROFILE, 'parked', 'v', true);
    expect(profile.points).toBe(1260);
    expect(levelFor(1240).current.name).toBe('Prata');
    expect(levelFor(0).current.name).toBe('Bronze');
    expect(levelFor(12000).current.name).toBe('Diamante');
    expect(Math.round(accuracy(DEFAULT_PROFILE) * 100)).toBe(92);
  });
});
