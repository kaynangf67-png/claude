import { useEffect, useState, useSyncExternalStore } from 'react';
import { CITY_SPEED_MS } from '../config/constants';
import { getSimulation } from '../simulation/WorldSimulation';
import type { RouteData, RouteInstruction } from '../types';
import { sampleRoute } from '../world/roadGraph';

/** Distância (m) a partir da qual entra o modo de chegada. */
export const ARRIVAL_DISTANCE = 200;

/** Lado da vaga em relação ao sentido de viagem no fim da rota. */
export function targetSide(route: RouteData): 'left' | 'right' | null {
  if (route.length < 20) return null;
  const end = route.points[route.points.length - 1];
  const a = sampleRoute(route, Math.max(0, route.length - 26)).position;
  const b = sampleRoute(route, route.length - 14).position;
  const d = { x: b.x - a.x, z: b.z - a.z };
  const v = { x: end.x - b.x, z: end.z - b.z };
  const cross = d.x * v.z - d.z * v.x;
  if (Math.abs(cross) < 1e-3) return null;
  return cross > 0 ? 'right' : 'left';
}

export function useSimulationSnapshot() {
  const sim = getSimulation();
  return useSyncExternalStore(sim.subscribe, sim.getSnapshot, sim.getSnapshot);
}

export function useAssessment(spotId: string | null) {
  const snap = useSimulationSnapshot();
  return spotId ? snap.assessments.get(spotId) ?? null : null;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface NavProgress {
  remaining: number;
  etaSeconds: number;
  speedKmh: number;
  next: RouteInstruction | null;
  distanceToNext: number;
  progress: number;
  /** perto da vaga: modo de chegada */
  arriving: boolean;
  side: 'left' | 'right' | null;
}

/** Lê o estado do veículo a 5 Hz (o carro anda a 60 fps, mas a UI não precisa). */
export function useNavProgress(active: boolean): NavProgress | null {
  const [state, setState] = useState<NavProgress | null>(null);
  useEffect(() => {
    if (!active) {
      setState(null);
      return;
    }
    const tick = () => {
      const v = getSimulation().vehicle;
      if (!v.route) return;
      const remaining = Math.max(0, v.stopAt - v.routeS);
      const next = v.route.instructions.find((i) => i.at > v.routeS + 2) ?? null;
      const turnsLeft = v.route.instructions.filter((i) => i.at > v.routeS && (i.type === 'left' || i.type === 'right')).length;
      setState({
        remaining,
        etaSeconds: remaining / CITY_SPEED_MS + turnsLeft * 8,
        speedKmh: v.speed * 3.6,
        next,
        distanceToNext: next ? Math.max(0, next.at - v.routeS) : 0,
        progress: v.route.length ? v.routeS / v.route.length : 0,
        arriving: remaining < ARRIVAL_DISTANCE,
        side: targetSide(v.route),
      });
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [active]);
  return state;
}
