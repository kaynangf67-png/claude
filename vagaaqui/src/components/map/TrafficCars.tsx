import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { getSimulation } from '../../simulation/WorldSimulation';
import { CAR_COLORS, sharedCarGeometry } from './geometries';

const tmp = new THREE.Object3D();

/** Veículos em movimento. Usuários do VagaAqui têm um halo ciano. */
export function TrafficCars({ count }: { count: number }) {
  const sim = getSimulation();
  const cars = useRef<THREE.InstancedMesh>(null);
  const halos = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    sim.setTrafficDensity(count);
    const mesh = cars.current!;
    const color = new THREE.Color();
    sim.agents.forEach((a, i) => mesh.setColorAt(i, color.set(CAR_COLORS[a.colorIndex])));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [sim, count]);

  useFrame(() => {
    const mesh = cars.current;
    const halo = halos.current;
    if (!mesh || !halo) return;
    let h = 0;
    sim.agents.forEach((a, i) => {
      tmp.position.set(a.position.x, 0.02, a.position.z);
      tmp.rotation.set(0, a.heading, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      if (a.isUser) {
        tmp.position.y = 0.1;
        tmp.rotation.set(-Math.PI / 2, 0, 0);
        tmp.updateMatrix();
        halo.setMatrixAt(h++, tmp.matrix);
      }
    });
    mesh.count = sim.agents.length;
    halo.count = h;
    mesh.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={cars} args={[sharedCarGeometry(), undefined, Math.max(count, 1)]} frustumCulled={false}>
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={halos} args={[undefined, undefined, Math.max(count, 1)]} frustumCulled={false}>
        <ringGeometry args={[2.6, 3.4, 24]} />
        <meshBasicMaterial color="#3fd0ff" transparent opacity={0.45} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
