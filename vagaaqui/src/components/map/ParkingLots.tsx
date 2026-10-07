import { useSimulationSnapshot } from '../../hooks/useSimulation';
import { labelTexture } from './markerTextures';

/** Estacionamentos com integração: superfície pintada + placa com vagas informadas pela API. */
export function ParkingLots() {
  const { lots } = useSimulationSnapshot();
  return (
    <group>
      {lots.map((lot) => {
        const text = lot.reportedFree != null ? `${lot.name} · ${lot.reportedFree} livres` : `${lot.name} · sem dados ao vivo`;
        const tex = labelTexture(text, 'P', lot.reportedFree != null ? '#5b8cff' : '#8a93a6');
        const img = tex.image as HTMLCanvasElement;
        const aspect = img.width / img.height;
        // a superfície pintada do estacionamento vem das áreas do mapa (City/Areas)
        return (
          <group key={lot.id} position={[lot.position.x, 0, lot.position.z]}>
            <mesh position={[0, 9, 0]}>
              <boxGeometry args={[0.6, 18, 0.6]} />
              <meshLambertMaterial color="#1a2238" />
            </mesh>
            <sprite position={[0, 22, 0]} scale={[7 * aspect, 7, 1]}>
              <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
            </sprite>
          </group>
        );
      })}
    </group>
  );
}
