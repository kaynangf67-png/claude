import { env } from '../config/env';
import type { Vec2 } from '../types';

const M_PER_DEG_LAT = 110_574;

/** Origem (0,0) do mundo 3D. Definida pelos dados de mapa carregados. */
let origin = { ...env.mapCenter };
export function setGeoOrigin(o: { lat: number; lon: number }) {
  origin = { ...o };
}
export function getGeoOrigin() {
  return origin;
}

function mPerDegLon(lat: number) {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

/** Projeção equirretangular local: precisa o suficiente para alguns quilômetros. */
export function latLonToWorld(lat: number, lon: number, o = origin): Vec2 {
  return {
    x: (lon - o.lon) * mPerDegLon(o.lat),
    z: -(lat - o.lat) * M_PER_DEG_LAT,
  };
}

export function worldToLatLon(p: Vec2, o = origin): { lat: number; lon: number } {
  return {
    lat: o.lat - p.z / M_PER_DEG_LAT,
    lon: o.lon + p.x / mPerDegLon(o.lat),
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
