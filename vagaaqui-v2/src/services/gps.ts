import { bearing, distance, type LonLat } from '../lib/geo';
import type { Fix } from '../model/detector';

export type GpsStatus = 'off' | 'searching' | 'ok' | 'weak' | 'denied' | 'unavailable';

export interface GpsState {
  status: GpsStatus;
  pos: LonLat | null;
  accuracy: number | null;
  /** graus, 0 = norte */
  heading: number | null;
  speed: number | null;
}

/**
 * GPS contínuo. Calcula velocidade e rumo entre leituras quando o aparelho não
 * informa. Sinal fraco não derruba o app: só muda o status para "weak".
 */
export function watchGps(onState: (s: GpsState) => void, onFix: (f: Fix) => void): () => void {
  if (!('geolocation' in navigator)) {
    onState({ status: 'unavailable', pos: null, accuracy: null, heading: null, speed: null });
    return () => undefined;
  }
  let prev: Fix | null = null;
  let heading: number | null = null;
  onState({ status: 'searching', pos: null, accuracy: null, heading: null, speed: null });
  const id = navigator.geolocation.watchPosition(
    (p) => {
      const pos: LonLat = [p.coords.longitude, p.coords.latitude];
      const at = p.timestamp || Date.now();
      let speed = p.coords.speed;
      if ((speed === null || Number.isNaN(speed)) && prev) {
        const dt = (at - prev.at) / 1000;
        speed = dt > 0 ? distance(prev.pos, pos) / dt : null;
      }
      if (p.coords.heading !== null && !Number.isNaN(p.coords.heading) && (speed ?? 0) > 1) heading = p.coords.heading;
      else if (prev && distance(prev.pos, pos) > 8) heading = bearing(prev.pos, pos);
      const fix: Fix = { pos, speed, at, accuracy: p.coords.accuracy };
      prev = fix;
      onFix(fix);
      onState({ status: p.coords.accuracy > 80 ? 'weak' : 'ok', pos, accuracy: p.coords.accuracy, heading, speed });
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) onState({ status: 'denied', pos: null, accuracy: null, heading: null, speed: null });
      // timeout/indisponível: mantém a última posição, só marca sinal fraco
      else onState({ status: prev ? 'weak' : 'searching', pos: prev?.pos ?? null, accuracy: null, heading, speed: null });
    },
    { enableHighAccuracy: true, maximumAge: 2000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
