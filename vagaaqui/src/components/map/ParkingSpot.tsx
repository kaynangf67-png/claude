import { useFrame } from '@react-three/fiber';
import { memo, useRef } from 'react';
import * as THREE from 'three';
import { STATUS_COLORS } from '../../config/constants';
import type { ParkingSpot as Spot, SpotAssessment } from '../../types';
import { ParkingSpotMarker } from './ParkingSpotMarker';
import { spotPadTexture } from './markerTextures';

interface Props {
  spot: Spot;
  assessment: SpotAssessment;
  selected: boolean;
  target: boolean;
  maxDistance: number;
  onSelect: (id: string) => void;
}

/** Uma possível vaga: moldura luminosa no chão + indicador de probabilidade. */
export const ParkingSpot = memo(function ParkingSpot({ spot, assessment, selected, target, maxDistance, onSelect }: Props) {
  const beam = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const color = STATUS_COLORS[assessment.status];
  const highlight = selected || target;
  const isLot = spot.type === 'lot';

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beam.current) {
      (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 3) * 0.08;
    }
    if (ring.current) {
      const k = (t * 0.8) % 1;
      ring.current.scale.setScalar(1 + k * 3);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
    }
  });

  return (
    <group>
      <group position={[spot.position.x, 0, spot.position.z]} rotation-y={spot.heading}>
        <mesh
          position={[0, 0.1, 0]}
          rotation-x={-Math.PI / 2}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(spot.id);
          }}
        >
          <planeGeometry args={isLot ? [9, 4] : [5.6, 2.5]} />
          <meshBasicMaterial
            map={spotPadTexture()}
            color={color}
            transparent
            opacity={highlight ? 1 : 0.85}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {highlight && (
          <>
            <mesh ref={beam} position={[0, 14, 0]}>
              <cylinderGeometry args={[1.4, 2.2, 28, 20, 1, true]} />
              <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh ref={ring} position={[0, 0.12, 0]} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[2.6, 3.1, 40]} />
              <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
            </mesh>
          </>
        )}
      </group>
      <ParkingSpotMarker
        position={[spot.position.x, isLot ? 9 : 4.5, spot.position.z]}
        status={assessment.status}
        probability={assessment.probability}
        highlight={highlight}
        isLot={isLot}
        maxDistance={maxDistance}
        onSelect={() => onSelect(spot.id)}
      />
    </group>
  );
});
