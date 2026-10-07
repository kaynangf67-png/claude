import type { CityEdge } from '../../world/cityTypes';

/** Estilo compartilhado pelos mapas 2D e 3D — sem dependência de three.js. */

export const CAR_COLORS = ['#c4c8ce', '#e9eaec', '#1c1e22', '#6f747c', '#9aa0a8', '#7a1d24', '#1f3d68', '#e3e4e6', '#3a3d42', '#b9b2a6'];

/** Largura da calçada de cada lado da via (m). */
export function sidewalkWidth(e: CityEdge) {
  if (['primary', 'secondary', 'trunk'].includes(e.highway)) return 3.5;
  if (e.highway.endsWith('_link') || e.highway === 'motorway') return 0.8;
  return 2.6;
}
