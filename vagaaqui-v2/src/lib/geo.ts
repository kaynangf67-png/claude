/** Coordenadas sempre como [lon, lat] (padrão GeoJSON). */
export type LonLat = [number, number];

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distância em metros entre dois pontos (haversine). */
export function distance(a: LonLat, b: LonLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Projeção local em metros (equiretangular) — boa para raios de poucos km. */
export function toLocal(origin: LonLat, p: LonLat): { x: number; y: number } {
  return {
    x: rad(p[0] - origin[0]) * R * Math.cos(rad(origin[1])),
    y: rad(p[1] - origin[1]) * R,
  };
}

export function fromLocal(origin: LonLat, x: number, y: number): LonLat {
  return [origin[0] + (x / (R * Math.cos(rad(origin[1])))) * (180 / Math.PI), origin[1] + (y / R) * (180 / Math.PI)];
}

/** Distância de um ponto a uma polilinha, em metros. */
export function distanceToLine(p: LonLat, line: LonLat[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = toLocal(p, line[i]);
    const b = toLocal(p, line[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return line.length === 1 ? distance(p, line[0]) : best;
}

export function lineLength(line: LonLat[]): number {
  let s = 0;
  for (let i = 0; i < line.length - 1; i++) s += distance(line[i], line[i + 1]);
  return s;
}

/** Ponto no meio do comprimento da linha. */
export function midpoint(line: LonLat[]): LonLat {
  const total = lineLength(line);
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const d = distance(line[i], line[i + 1]);
    if (acc + d >= total / 2) {
      const t = d ? (total / 2 - acc) / d : 0;
      return [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t];
    }
    acc += d;
  }
  return line[0];
}

/** Rumo de a para b em graus (0 = norte, sentido horário). */
export function bearing(a: LonLat, b: LonLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function bboxAround(c: LonLat, radiusM: number): BBox {
  const sw = fromLocal(c, -radiusM, -radiusM);
  const ne = fromLocal(c, radiusM, radiusM);
  return { west: sw[0], south: sw[1], east: ne[0], north: ne[1] };
}
