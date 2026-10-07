import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SpotStatus } from '../../types';
import { markerTexture } from './markerTextures';

interface Props {
  position: [number, number, number];
  status: SpotStatus;
  probability: number;
  highlight: boolean;
  isLot: boolean;
  maxDistance: number;
  onSelect: () => void;
}

const worldPos = new THREE.Vector3();

/** Indicador flutuante acima da vaga com a probabilidade. Mantém tamanho legível em qualquer zoom. */
export function ParkingSpotMarker({ position, status, probability, highlight, isLot, maxDistance, onSelect }: Props) {
  const ref = useRef<THREE.Sprite>(null);
  const percent = Math.round(probability * 100);
  const texture = useMemo(() => markerTexture(status, percent, highlight, isLot), [status, percent, highlight, isLot]);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ camera, clock }) => {
    const s = ref.current;
    if (!s) return;
    s.getWorldPosition(worldPos);
    const d = camera.position.distanceTo(worldPos);
    s.visible = highlight || d < maxDistance;
    const base = THREE.MathUtils.clamp(d * 0.05, 2.2, 30) * (highlight ? 1.35 : isLot ? 1.15 : 1);
    s.scale.set(base, base * 0.625, 1);
    s.position.y = position[1] + base * 0.32 + Math.sin(clock.elapsedTime * 2 + phase) * (highlight ? 0.6 : 0.15);
  });

  return (
    <sprite
      ref={ref}
      position={position}
      renderOrder={highlight ? 12 : 10}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
