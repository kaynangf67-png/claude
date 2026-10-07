import { worldToLatLon } from '../../lib/geo';
import { getSimulation } from '../../simulation/WorldSimulation';
import { actions } from '../../store/appStore';
import { cameraBus } from '../../store/cameraBus';
import { sampleRoute } from '../../world/roadGraph';

/**
 * Ponte para testes E2E (só em dev ou com ?e2e na URL). Cada mapa (2D/3D) informa
 * como projetar uma vaga para a tela e como ler a câmera.
 */
export function installTestBridge(view: { project: (spotId: string) => unknown; camera: () => unknown }) {
  if (!import.meta.env.DEV && !location.search.includes('e2e')) return;
  (window as unknown as { __vagaaqui?: unknown }).__vagaaqui = {
    ...view,
    sim: getSimulation(),
    /** navega até uma vaga de meio-fio a pelo menos `minDistance` m */
    navigateToCurb(minDistance = 200) {
      const c = getSimulation()
        .candidates()
        .filter((x) => x.spot.type === 'curb' && Number.isFinite(x.driveDistance) && x.driveDistance > minDistance)
        .sort((a, b) => a.driveDistance - b.driveDistance)[0];
      if (c) actions.navigateTo(c.spot.id);
      return c?.spot.id ?? null;
    },
    vehicleLatLon() {
      return worldToLatLon(getSimulation().vehicle.position);
    },
    /** pontos da rota atual a cada `step` m, em lat/lon (para simular GPS) */
    routeLatLon(step = 8) {
      const route = getSimulation().vehicle.route;
      if (!route) return [];
      const out: { lat: number; lon: number }[] = [];
      for (let s = 0; s <= route.length; s += step) out.push(worldToLatLon(sampleRoute(route, s).position));
      out.push(worldToLatLon(route.points[route.points.length - 1]));
      return out;
    },
    focus(x: number, z: number, distance = 160) {
      cameraBus.emit({ type: 'focus', x, z, distance });
    },
  };
}
