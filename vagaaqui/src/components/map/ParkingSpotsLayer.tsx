import { useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { useSimulationSnapshot } from '../../hooks/useSimulation';
import { getSimulation } from '../../simulation/WorldSimulation';
import { actions, useApp } from '../../store/appStore';
import { CarFleet } from './CarFleet';
import { CAR_COLORS } from './geometries';
import { ParkingSpot } from './ParkingSpot';

const tmp = new THREE.Object3D();

/** Todas as vagas monitoradas + os carros que de fato as ocupam no cenário. */
export function ParkingSpotsLayer({ maxDistance }: { maxDistance: number }) {
  const sim = getSimulation();
  const snapshot = useSimulationSnapshot();
  const selected = useApp((s) => s.selectedSpotId);
  const target = useApp((s) => (s.navStatus === 'navigating' || s.navStatus === 'arrived' ? s.targetSpotId : null));
  const recommended = useApp((s) => (s.recommendationsOpen ? s.recommendations[0]?.spotId ?? null : null));
  const curbSpots = useMemo(() => sim.spots.filter((s) => s.type === 'curb'), [sim]);

  const fill = useCallback(
    (mesh: THREE.InstancedMesh) => {
      const color = new THREE.Color();
      let i = 0;
      for (const spot of curbSpots) {
        if (!snapshot.occupiedVisible.has(spot.id)) continue;
        tmp.position.set(spot.position.x, 0.07, spot.position.z);
        tmp.rotation.set(0, spot.heading + (spot.id.charCodeAt(spot.id.length - 1) % 2 ? Math.PI : 0), 0);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
        mesh.setColorAt(i, color.set(CAR_COLORS[(spot.id.charCodeAt(spot.id.length - 1) + i) % CAR_COLORS.length]));
        i++;
      }
      return i;
    },
    [snapshot, curbSpots],
  );

  return (
    <group>
      <CarFleet capacity={curbSpots.length} fill={fill} version={fill} />
      {sim.spots.map((spot) => {
        const a = snapshot.assessments.get(spot.id);
        if (!a) return null;
        return (
          <ParkingSpot
            key={spot.id}
            spot={spot}
            assessment={a}
            selected={selected === spot.id || recommended === spot.id}
            target={target === spot.id}
            maxDistance={maxDistance}
            onSelect={actions.selectSpot}
          />
        );
      })}
    </group>
  );
}
