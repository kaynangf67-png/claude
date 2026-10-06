import { env } from '../config/env';
import type { Vec2 } from '../types';

const M_PER_DEG_LAT = 110_574;

function mPerDegLon(lat: number) {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

/** Projeção equirretangular local: precisa o suficiente para alguns quilômetros. */
export function latLonToWorld(lat: number, lon: number, origin = env.mapCenter): Vec2 {
  return {
    x: (lon - origin.lon) * mPerDegLon(origin.lat),
    z: -(lat - origin.lat) * M_PER_DEG_LAT,
  };
}

export function worldToLatLon(p: Vec2, origin = env.mapCenter): { lat: number; lon: number } {
  return {
    lat: origin.lat - p.z / M_PER_DEG_LAT,
    lon: origin.lon + p.x / mPerDegLon(origin.lat),
  };
}

export function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

/** Ângulo (rad, eixo Y do three.js) para um carro cuja frente aponta para +X local. */
export function headingOf(from: Vec2, to: Vec2) {
  return Math.atan2(-(to.z - from.z), to.x - from.x);
}

export function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
