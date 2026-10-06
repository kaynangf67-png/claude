import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { sharedCarBody, sharedCarDark } from './geometries';

interface Props {
  capacity: number;
  /** escreve matrizes (e cores) na malha da carroceria e retorna quantos carros há */
  fill: (body: THREE.InstancedMesh) => number;
  /** chamar `fill` a cada frame (carros em movimento) */
  animated?: boolean;
  /** muda quando os dados mudam (carros parados) */
  version?: unknown;
  castShadow?: boolean;
}

/** Frota instanciada: carroceria colorida + vidros/rodas escuros com as mesmas matrizes. */
export function CarFleet({ capacity, fill, animated = false, version, castShadow = false }: Props) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const darkRef = useRef<THREE.InstancedMesh>(null);

  const sync = () => {
    const b = bodyRef.current;
    const d = darkRef.current;
    if (!b || !d) return;
    const count = fill(b);
    b.count = count;
    d.count = count;
    (d.instanceMatrix.array as Float32Array).set((b.instanceMatrix.array as Float32Array).subarray(0, count * 16));
    b.instanceMatrix.needsUpdate = true;
    d.instanceMatrix.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
    if (!animated) {
      b.computeBoundingSphere();
      d.computeBoundingSphere();
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(sync, [version, capacity]);
  useFrame(() => {
    if (animated) sync();
  });

  if (capacity <= 0) return null;
  return (
    <group>
      <instancedMesh key={`b${capacity}`} ref={bodyRef} args={[sharedCarBody(), undefined, capacity]} castShadow={castShadow} frustumCulled={!animated}>
        <meshStandardMaterial metalness={0.55} roughness={0.38} />
      </instancedMesh>
      <instancedMesh key={`d${capacity}`} ref={darkRef} args={[sharedCarDark(), undefined, capacity]} frustumCulled={!animated}>
        <meshStandardMaterial color="#0d0f13" metalness={0.3} roughness={0.25} />
      </instancedMesh>
    </group>
  );
}
