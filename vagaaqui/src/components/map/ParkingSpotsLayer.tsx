import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSimulationSnapshot } from '../../hooks/useSimulation';
import { getSimulation } from '../../simulation/WorldSimulation';
import { actions, useApp } from '../../store/appStore';
import { CAR_COLORS, sharedCarGeometry } from './geometries';
import { ParkingSpot } from './ParkingSpot';

const tmp = new THREE.Object3D();

/** Todas as vagas monitoradas + os carros que de fato as ocupam no cenário. */
export function ParkingSpotsLayer({ maxDistance }: { maxDistance: number }) {
  const sim = getSimulation();
  const snapshot = useSimulationSnapshot();
  const selected = useApp((s) => s.selectedSpotId);
  const target = useApp((s) => (s.navStatus === 'navigating' || s.navStatus === 'arrived' ? s.targetSpotId : null));
  const recommended = useApp((s) => (s.recommendationsOpen ? s.recommendations[0]?.spotId ?? null : null));
  const carsRef = useRef<THREE.InstancedMesh>(null);
  const curbSpots = useMemo(() => sim.spots.filter((s) => s.type === 'curb'), [sim]);

  useLayoutEffect(() => {
    const mesh = carsRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    let i = 0;
    for (const spot of curbSpots) {
      if (!snapshot.occupiedVisible.has(spot.id)) continue;
      tmp.position.set(spot.position.x, 0.07, spot.position.z);
      tmp.rotation.set(0, spot.heading, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      mesh.setColorAt(i, color.set(CAR_COLORS[(spot.id.charCodeAt(spot.id.length - 1) + i) % CAR_COLORS.length]));
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [snapshot, curbSpots]);

  return (
    <group>
      <instancedMesh ref={carsRef} args={[sharedCarGeometry(), undefined, curbSpots.length]}>
        <meshLambertMaterial />
      </instancedMesh>
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
