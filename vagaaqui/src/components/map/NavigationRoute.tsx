import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getSimulation } from '../../simulation/WorldSimulation';
import { useApp } from '../../store/appStore';
import type { RouteData } from '../../types';
import { createRouteMaterial } from './shaders';

function buildRibbon(route: RouteData, width: number) {
  const n = route.points.length;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const dists = new Float32Array(n * 2);
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = route.points[i];
    const a = route.points[Math.max(0, i - 1)];
    const b = route.points[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    const nx = -tz * (width / 2);
    const nz = tx * (width / 2);
    positions.set([p.x + nx, 0.13, p.z + nz, p.x - nx, 0.13, p.z - nz], i * 6);
    uvs.set([route.cumulative[i] / 10, 0, route.cumulative[i] / 10, 1], i * 4);
    dists[i * 2] = route.cumulative[i];
    dists[i * 2 + 1] = route.cumulative[i];
    if (i < n - 1) {
      const k = i * 2;
      indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('aDist', new THREE.BufferAttribute(dists, 1));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/** Rota desenhada no chão; a parte já percorrida desaparece atrás do carro. */
export function NavigationRoute() {
  const route = useApp((s) => s.route);
  const material = useMemo(() => createRouteMaterial('#5b8cff'), []);
  const geometry = useMemo(() => (route ? buildRibbon(route, 3.4) : null), [route]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt;
    material.uniforms.uProgress.value = getSimulation().vehicle.routeS - 2;
  });

  if (!route || !geometry) return null;
  const end = route.points[route.points.length - 1];
  return (
    <group>
      <mesh geometry={geometry} material={material} renderOrder={3} />
      <mesh position={[end.x, 0.14, end.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.2, 3.8, 40]} />
        <meshBasicMaterial color="#38f8b0" transparent opacity={0.9} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
