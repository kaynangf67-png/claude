import { useFrame } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { getSimulation } from '../../simulation/WorldSimulation';
import { CarFleet } from './CarFleet';
import { CAR_COLORS } from './geometries';

const tmp = new THREE.Object3D();
const color = new THREE.Color();

/** Veículos em movimento. Usuários do VagaAqui têm um halo discreto no chão. */
export function TrafficCars({ count }: { count: number }) {
  const sim = getSimulation();
  const halos = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    sim.setTrafficDensity(count);
  }, [sim, count]);

  const fill = useCallback(
    (mesh: THREE.InstancedMesh) => {
      sim.agents.forEach((a, i) => {
        tmp.position.set(a.position.x, 0.07, a.position.z);
        tmp.rotation.set(0, a.heading, 0);
        tmp.scale.set(1, 1, 1);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
        mesh.setColorAt(i, color.set(CAR_COLORS[a.colorIndex % CAR_COLORS.length]));
      });
      return sim.agents.length;
    },
    [sim],
  );

  useFrame(() => {
    const halo = halos.current;
    if (!halo) return;
    let h = 0;
    for (const a of sim.agents) {
      if (!a.isUser) continue;
      tmp.position.set(a.position.x, 0.12, a.position.z);
      tmp.rotation.set(-Math.PI / 2, 0, 0);
      tmp.updateMatrix();
      halo.setMatrixAt(h++, tmp.matrix);
    }
    halo.count = h;
    halo.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <CarFleet capacity={Math.max(count, 1)} fill={fill} animated />
      <instancedMesh ref={halos} args={[undefined, undefined, Math.max(count, 1)]} frustumCulled={false}>
        <ringGeometry args={[2.7, 3.1, 28]} />
        <meshBasicMaterial color="#3fd0ff" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
