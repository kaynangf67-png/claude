import { describe, expect, it } from 'vitest';
import { fromLocal } from '../lib/geo';
import { buildRoute, formatDistance, routeProgress, stepText, type OsrmStep } from './nav';
import { ORIGIN } from './testUtils';

const st = (type: string, modifier: string | undefined, name: string, exit?: number): OsrmStep => ({ distance: 0, name, maneuver: { type, modifier, location: [0, 0], exit } });

describe('instruções em português', () => {
  it('traduz as manobras mais comuns', () => {
    expect(stepText(st('turn', 'right', 'Rua Sete')).text).toBe('Vire à direita na Rua Sete');
    expect(stepText(st('turn', 'left', '')).text).toBe('Vire à esquerda');
    expect(stepText(st('depart', undefined, 'Av. Vitória')).text).toBe('Siga pela Av. Vitória');
    expect(stepText(st('roundabout', 'right', 'Av. Beira Mar', 2)).text).toBe('Na rotatória, pegue a 2ª saída para a Av. Beira Mar');
    expect(stepText(st('turn', 'uturn', '')).icon).toBe('uturn');
    expect(stepText(st('arrive', undefined, '')).text).toBe('Você chegou ao destino');
    expect(stepText(st('new name', 'straight', 'Rua B')).text).toBe('Continue pela Rua B');
  });
});

describe('progresso na rota', () => {
  // L: 300 m para leste e depois 200 m para norte
  const line = [fromLocal(ORIGIN, 0, 0), fromLocal(ORIGIN, 300, 0), fromLocal(ORIGIN, 300, 200)];
  const steps: OsrmStep[] = [
    { distance: 300, name: 'Rua A', maneuver: { type: 'depart', location: line[0] } },
    { distance: 200, name: 'Rua B', maneuver: { type: 'turn', modifier: 'left', location: line[1] } },
    { distance: 0, name: '', maneuver: { type: 'arrive', location: line[2] } },
  ];
  const r = buildRoute(line, 100, steps);

  it('calcula distância total e posição das manobras', () => {
    expect(r.distanceM).toBeCloseTo(500, 0);
    expect(r.steps[1].atM).toBeCloseTo(300, 0);
  });

  it('projeta a posição, distância até a próxima manobra e o que falta', () => {
    const p = routeProgress(r, fromLocal(ORIGIN, 100, 5));
    expect(p.alongM).toBeCloseTo(100, 0);
    expect(p.offRouteM).toBeCloseTo(5, 0);
    expect(p.next?.text).toBe('Vire à esquerda na Rua B');
    expect(p.toNextM).toBeCloseTo(200, 0);
    expect(p.remainingM).toBeCloseTo(400, 0);
    expect(p.remainingS).toBeCloseTo(80, 0);
  });

  it('detecta quando o carro saiu da rota', () => {
    expect(routeProgress(r, fromLocal(ORIGIN, 150, 120)).offRouteM).toBeGreaterThan(100);
  });

  it('formata distâncias para o motorista', () => {
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(237)).toBe('240 m');
    expect(formatDistance(42)).toBe('40 m');
  });
});
