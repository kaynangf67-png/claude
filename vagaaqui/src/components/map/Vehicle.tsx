import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { getSimulation } from '../../simulation/WorldSimulation';
import { LocationIndicator } from './LocationIndicator';

/** Veículo do usuário — design próprio VagaAqui (frente para +X). */
export function Vehicle({ shadows }: { shadows: boolean }) {
  const sim = getSimulation();
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const brake = useRef<THREE.MeshBasicMaterial>(null);
  const lastSpeed = useRef(0);

  useFrame(({ clock }) => {
    const v = sim.vehicle;
    const g = group.current;
    if (!g) return;
    g.position.set(v.position.x, 0.06, v.position.z);
    g.rotation.y = v.heading;
    // leve inclinação ao frear/acelerar
    const accel = v.speed - lastSpeed.current;
    lastSpeed.current = v.speed;
    if (body.current) {
      body.current.rotation.z = THREE.MathUtils.lerp(body.current.rotation.z, THREE.MathUtils.clamp(accel * 0.25, -0.03, 0.03), 0.1);
      body.current.position.y = v.speed > 0.5 ? Math.sin(clock.elapsedTime * 18) * 0.012 : 0;
    }
    if (brake.current) brake.current.color.set(accel < -0.01 || v.speed < 0.2 ? '#ff2a4a' : '#7a1020');
  });

  return (
    <group ref={group}>
      <LocationIndicator />
      <group ref={body}>
        <RoundedBox args={[4.6, 1.0, 2.0]} radius={0.35} smoothness={3} position={[0, 0.75, 0]} castShadow={shadows}>
          <meshStandardMaterial color="#e9eef7" metalness={0.6} roughness={0.25} />
        </RoundedBox>
        <RoundedBox args={[2.5, 0.75, 1.75]} radius={0.3} smoothness={3} position={[-0.3, 1.55, 0]}>
          <meshStandardMaterial color="#0b1222" metalness={0.9} roughness={0.1} />
        </RoundedBox>
        {/* faróis em faixa contínua */}
        <mesh position={[2.31, 0.85, 0]}>
          <boxGeometry args={[0.05, 0.12, 1.7]} />
          <meshBasicMaterial color="#d9f3ff" toneMapped={false} />
        </mesh>
        <mesh position={[-2.31, 0.9, 0]}>
          <boxGeometry args={[0.05, 0.14, 1.8]} />
          <meshBasicMaterial ref={brake} color="#ff2a4a" toneMapped={false} />
        </mesh>
        {/* assinatura luminosa lateral */}
        <mesh position={[0, 0.32, 1.01]}>
          <boxGeometry args={[3.6, 0.05, 0.02]} />
          <meshBasicMaterial color="#38f8b0" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.32, -1.01]}>
          <boxGeometry args={[3.6, 0.05, 0.02]} />
          <meshBasicMaterial color="#38f8b0" toneMapped={false} />
        </mesh>
        {[1.45, -1.45].map((x) =>
          [0.95, -0.95].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.36, z]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.36, 0.36, 0.26, 14]} />
              <meshStandardMaterial color="#0a0d14" roughness={0.8} />
            </mesh>
          )),
        )}
      </group>
      {/* luz dos faróis no asfalto */}
      <mesh position={[8, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[11, 4]} />
        <meshBasicMaterial color="#cfe9ff" transparent opacity={0.07} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
