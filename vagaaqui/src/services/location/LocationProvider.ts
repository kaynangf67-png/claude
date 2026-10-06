import { latLonToWorld } from '../../lib/geo';
import type { Vec2 } from '../../types';

export type LocationResult =
  | { kind: 'gps'; position: Vec2; accuracy: number }
  | { kind: 'unavailable'; reason: string };

/** Lê uma posição do GPS do navegador e converte para coordenadas do mapa. */
export function requestBrowserLocation(timeoutMs = 8000): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ kind: 'unavailable', reason: 'Este navegador não oferece geolocalização.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          kind: 'gps',
          position: latLonToWorld(pos.coords.latitude, pos.coords.longitude),
          accuracy: pos.coords.accuracy,
        }),
      (err) =>
        resolve({
          kind: 'unavailable',
          reason: err.code === err.PERMISSION_DENIED ? 'Permissão de localização negada.' : 'Não foi possível obter o GPS.',
        }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
