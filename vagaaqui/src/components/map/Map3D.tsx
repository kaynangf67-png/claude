import { PerformanceMonitor, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import * as THREE from 'three';
import { QUALITY_PRESETS } from '../../hooks/deviceQuality';
import { getSimulation } from '../../simulation/WorldSimulation';
import { actions, effectiveTier, useApp } from '../../store/appStore';
import { CameraRig } from './CameraRig';
import { City } from './City';
import { NavigationRoute } from './NavigationRoute';
import { ParkingLots } from './ParkingLots';
import { ParkingSpotsLayer } from './ParkingSpotsLayer';
import { Particles } from './Particles';
import { PointsOfInterest } from './PointsOfInterest';
import { TrafficCars } from './TrafficCars';
import { Vehicle } from './Vehicle';

/** Ponte para testes E2E (só em dev ou com ?e2e): projeta uma vaga para coordenadas de tela. */
function TestBridge() {
  const { camera, size, controls } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV && !location.search.includes('e2e')) return;
    const w = window as unknown as { __vagaaqui?: unknown };
    w.__vagaaqui = {
      project(spotId: string) {
        const spot = getSimulation().spotsById.get(spotId);
        if (!spot) return null;
        const v = new THREE.Vector3(spot.position.x, 0.1, spot.position.z).project(camera);
        return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height, visible: v.z < 1 };
      },
      camera() {
        const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target ?? new THREE.Vector3();
        const offset = camera.position.clone().sub(target);
        const sph = new THREE.Spherical().setFromVector3(offset);
        return {
          target: [Math.round(target.x), Math.round(target.z)],
          distance: Math.round(sph.radius),
          tiltDeg: Math.round(THREE.MathUtils.radToDeg(sph.phi)),
          headingDeg: Math.round(THREE.MathUtils.radToDeg(sph.theta)),
        };
      },
      sim: getSimulation(),
    };
  }, [camera, size, controls]);
  return null;
}

/** Avança a simulação (trânsito, carro do usuário, dados) junto com o render. */
function SimulationDriver() {
  const sim = getSimulation();
  useFrame((_, dt) => sim.update(dt));
  return null;
}

function Lights({ shadows }: { shadows: boolean }) {
  return (
    <>
      <hemisphereLight args={['#6f8cff', '#0a0d16', 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[-180, 320, 140]}
        intensity={1.3}
        color="#cfdcff"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-500}
        shadow-camera-right={500}
        shadow-camera-top={500}
        shadow-camera-bottom={-500}
        shadow-camera-far={1200}
      />
    </>
  );
}

/**
 * Mapa 3D principal. Carregado com React.lazy: o bundle do three.js baixa
 * enquanto a animação de abertura roda.
 */
export default function Map3D() {
  const tier = useApp(effectiveTier);
  const q = QUALITY_PRESETS[tier];
  const [dpr, setDpr] = useState(q.dpr[1]);

  return (
    <Canvas
      key={tier}
      className="map-canvas"
      dpr={[q.dpr[0], Math.min(dpr, q.dpr[1])]}
      shadows={q.shadows ? 'percentage' : false}
      gl={{ antialias: q.antialias, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ fov: 50, near: 1, far: 5000, position: [-300, 260, 520] }}
      onPointerMissed={() => actions.selectSpot(null)}
    >
      <color attach="background" args={['#04060c']} />
      <fogExp2 attach="fog" args={['#04060c', tier === 'low' ? 0.0022 : 0.0015]} />
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(q.dpr[0], d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(q.dpr[1], d + 0.25))}
      />
      <SimulationDriver />
      <TestBridge />
      <Lights shadows={q.shadows} />
      <Suspense fallback={null}>
        <City buildingFraction={q.buildingFraction} parkedCarsFraction={q.parkedCarsFraction} detailed={tier !== 'low'} />
        <ParkingLots />
        <TrafficCars count={q.traffic} />
        <ParkingSpotsLayer maxDistance={q.markerDistance} />
        <NavigationRoute />
        <Vehicle shadows={q.shadows} />
        <PointsOfInterest />
        {q.particles > 0 && <Particles count={q.particles} />}
        {q.stars && <Stars radius={1600} depth={300} count={1500} factor={18} fade speed={0.4} />}
      </Suspense>
      <CameraRig />
    </Canvas>
  );
}
