import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getCity } from '../../world/cityStore';

/** Partículas de "dados" subindo sobre a cidade (desligadas em aparelhos fracos). */
export function Particles({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = getCity().bounds;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = minX + Math.random() * (maxX - minX);
      positions[i * 3 + 1] = Math.random() * 140;
      positions[i * 3 + 2] = minZ + Math.random() * (maxZ - minZ);
      speeds[i] = 2 + Math.random() * 5;
    }
    return { positions, speeds };
  }, [count]);

  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = attr.getY(i) + speeds[i] * dt;
      if (y > 140) y = 0;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#6fb6ff" size={1.6} sizeAttenuation transparent opacity={0.55} depthWrite={false} toneMapped={false} />
    </points>
  );
}
