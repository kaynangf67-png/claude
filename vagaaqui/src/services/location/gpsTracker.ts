import { latLonToWorld } from '../../lib/geo';
import type { GpsFix } from '../../simulation/WorldSimulation';
import type { Vec2 } from '../../types';

/** 'weak' é temporário (timeout/sem sinal): o rastreamento continua. */
export type GpsError = 'unsupported' | 'denied' | 'weak';

interface RawFix {
  position: Vec2;
  at: number;
  speed: number | null;
  heading: number | null;
  accuracy: number;
}

/**
 * Completa velocidade e rumo quando o aparelho não os informa (muitos não informam):
 * deriva das duas últimas leituras. Rumo só em movimento (parado, o GPS "passeia").
 */
export function deriveMotion(prev: RawFix | null, cur: RawFix): { speed: number; heading: number | null } {
  let speed = cur.speed != null && Number.isFinite(cur.speed) ? cur.speed : null;
  let heading: number | null = null;
  const dt = prev ? (cur.at - prev.at) / 1000 : 0;
  const dx = prev ? cur.position.x - prev.position.x : 0;
  const dz = prev ? cur.position.z - prev.position.z : 0;
  const moved = Math.hypot(dx, dz);
  if (speed == null) speed = prev && dt > 0.3 && dt < 10 ? moved / dt : 0;
  if (speed > 1.2) {
    if (cur.heading != null && Number.isFinite(cur.heading)) {
      // GPS: graus a partir do norte, horário → mundo 3D: rad a partir de +X (leste), anti-horário
      heading = Math.PI / 2 - (cur.heading * Math.PI) / 180;
    } else if (moved > Math.max(2, cur.accuracy * 0.3)) {
      heading = Math.atan2(-dz, dx);
    }
  }
  return { speed, heading };
}

/** GPS contínuo do navegador (watchPosition), convertido para o sistema do mapa 3D. */
export function startGpsTracking(onFix: (fix: GpsFix) => void, onError: (e: GpsError) => void): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('unsupported');
    return () => {};
  }
  let prev: RawFix | null = null;
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      const raw: RawFix = { position: latLonToWorld(latitude, longitude), at: pos.timestamp, speed, heading, accuracy };
      const motion = deriveMotion(prev, raw);
      prev = raw;
      onFix({ position: raw.position, heading: motion.heading, speed: motion.speed, accuracy, at: pos.timestamp });
    },
    (err) => onError(err.code === err.PERMISSION_DENIED ? 'denied' : 'weak'),
    // sem timeout: parado, o aparelho pode passar muito tempo sem nova leitura (a store vigia o atraso)
    { enableHighAccuracy: true, maximumAge: 1000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
