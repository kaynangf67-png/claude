import { getCity } from '../../world/cityStore';
import { polygonCentroid } from '../../world/cityTypes';
import type { PointOfInterest } from '../../types';
import { labelTexture } from './markerTextures';

const ICON: Record<PointOfInterest['category'], { glyph: string; color: string }> = {
  shopping: { glyph: 'S', color: '#b98cff' },
  hospital: { glyph: '+', color: '#ff6b7d' },
  praia: { glyph: '~', color: '#3fd0ff' },
  universidade: { glyph: 'U', color: '#ffc93c' },
  restaurante: { glyph: 'R', color: '#ff9f4a' },
  escritorio: { glyph: 'E', color: '#7fa2ff' },
  parque: { glyph: '♣', color: '#38f8b0' },
};

export function PointsOfInterest() {
  const city = getCity();
  return (
    <group>
      {city.pois.map((poi) => {
        const { glyph, color } = ICON[poi.category];
        const tex = labelTexture(poi.name, glyph, color);
        const img = tex.image as HTMLCanvasElement;
        const aspect = img.width / img.height;
        const tall = city.buildings.reduce((h, b) => {
          const c = polygonCentroid(b.footprint);
          return Math.abs(c.x - poi.position.x) < 45 && Math.abs(c.z - poi.position.z) < 45 ? Math.max(h, b.h) : h;
        }, 0);
        return (
          <group key={poi.id} position={[poi.position.x, 0, poi.position.z]}>
            <mesh position={[0, (tall + 18) / 2, 0]}>
              <cylinderGeometry args={[0.15, 0.15, tall + 18, 6]} />
              <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
            </mesh>
            <sprite position={[0, tall + 24, 0]} scale={[9 * aspect, 9, 1]} renderOrder={5}>
              <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
            </sprite>
          </group>
        );
      })}
    </group>
  );
}
