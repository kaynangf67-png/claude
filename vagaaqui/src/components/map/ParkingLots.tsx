import { useMemo } from 'react';
import * as THREE from 'three';
import { useSimulationSnapshot } from '../../hooks/useSimulation';
import { labelTexture } from './markerTextures';

function lotSurfaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0b101c';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(160,190,230,0.35)';
  ctx.lineWidth = 3;
  for (let row = 0; row < 4; row++) {
    const y = 40 + row * 118;
    for (let x = 30; x <= 482; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 52);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(91,140,255,0.8)';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 500);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Estacionamentos com integração: superfície pintada + placa com vagas informadas pela API. */
export function ParkingLots() {
  const { lots } = useSimulationSnapshot();
  const surface = useMemo(() => lotSurfaceTexture(), []);
  return (
    <group>
      {lots.map((lot) => {
        const text = lot.reportedFree != null ? `${lot.name} · ${lot.reportedFree} livres` : `${lot.name} · sem dados ao vivo`;
        const tex = labelTexture(text, 'P', lot.reportedFree != null ? '#5b8cff' : '#8a93a6');
        const aspect = tex.image.width / tex.image.height;
        return (
          <group key={lot.id} position={[lot.position.x, 0, lot.position.z]}>
            <mesh position={[0, 0.26, 0]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[lot.size.w, lot.size.d]} />
              <meshBasicMaterial map={surface} toneMapped={false} />
            </mesh>
            <mesh position={[0, 9, -lot.size.d / 2 + 2]}>
              <boxGeometry args={[0.6, 18, 0.6]} />
              <meshLambertMaterial color="#1a2238" />
            </mesh>
            <sprite position={[0, 22, -lot.size.d / 2 + 2]} scale={[7 * aspect, 7, 1]}>
              <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
            </sprite>
          </group>
        );
      })}
    </group>
  );
}
