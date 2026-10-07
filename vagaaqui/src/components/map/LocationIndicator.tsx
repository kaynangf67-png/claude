import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

/** Halo pulsante + cone de direção sob o veículo do usuário. */
export function LocationIndicator({ color = '#5b8cff' }: { color?: string }) {
  const pulse = useRef<THREE.Mesh>(null);
  const pulse2 = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    [pulse.current, pulse2.current].forEach((m, i) => {
      if (!m) return;
      const k = (t * 0.6 + i * 0.5) % 1;
      m.scale.setScalar(1 + k * 4);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    });
  });
  return (
    <group>
      <mesh position={[0, 0.1, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[4.2, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={pulse} position={[0, 0.11, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.6, 4.1, 48]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={pulse2} position={[0, 0.11, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.6, 4.1, 48]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* feixe de direção à frente do carro */}
      <mesh position={[1.5, 0.1, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[10, 24, -0.42, 0.84]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
