import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getSimulation } from '../../simulation/WorldSimulation';
import { CITY_SIZE, GRID, SPACING, getCity, streetCoord } from '../../world/cityGenerator';
import { createRng } from '../../lib/random';
import { CAR_COLORS, createGroundPlane, sharedCarGeometry } from './geometries';
import {
  createBuildingMaterial,
  createGroundMaterial,
  createIntersectionMaterial,
  createRoadMaterial,
  createWaterMaterial,
} from './shaders';

const tmp = new THREE.Object3D();

function Ground() {
  const material = useMemo(() => createGroundMaterial(), []);
  return (
    <mesh position={[0, -0.05, 0]} rotation-x={-Math.PI / 2} material={material}>
      <planeGeometry args={[6000, 6000]} />
    </mesh>
  );
}

function Roads() {
  const city = getCity();
  const segRef = useRef<THREE.InstancedMesh>(null);
  const crossRef = useRef<THREE.InstancedMesh>(null);
  const segLength = GRID.blockSize;
  const segGeo = useMemo(() => createGroundPlane(segLength, GRID.roadWidth), [segLength]);
  const crossGeo = useMemo(() => createGroundPlane(GRID.roadWidth, GRID.roadWidth), []);
  const segMat = useMemo(() => createRoadMaterial(segLength, GRID.roadWidth), [segLength]);
  const crossMat = useMemo(() => createIntersectionMaterial(GRID.roadWidth), []);
  const edges = [...city.edges.values()];
  const nodes = [...city.nodes.values()];

  useLayoutEffect(() => {
    const seg = segRef.current!;
    edges.forEach((e, i) => {
      const a = city.nodes.get(e.a)!.position;
      const b = city.nodes.get(e.b)!.position;
      tmp.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
      tmp.rotation.set(0, e.axis === 'h' ? 0 : Math.PI / 2, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      seg.setMatrixAt(i, tmp.matrix);
    });
    seg.instanceMatrix.needsUpdate = true;
    const cross = crossRef.current!;
    nodes.forEach((n, i) => {
      tmp.position.set(n.position.x, 0.025, n.position.z);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      cross.setMatrixAt(i, tmp.matrix);
    });
    cross.instanceMatrix.needsUpdate = true;
  }, [city, edges, nodes]);

  return (
    <group>
      <instancedMesh ref={segRef} args={[segGeo, segMat, edges.length]} frustumCulled={false} />
      <instancedMesh ref={crossRef} args={[crossGeo, crossMat, nodes.length]} frustumCulled={false} />
    </group>
  );
}

function Blocks() {
  const city = getCity();
  const sidewalks = useRef<THREE.InstancedMesh>(null);
  const plots = useRef<THREE.InstancedMesh>(null);
  const blocks = city.blocks;
  useLayoutEffect(() => {
    const walk = sidewalks.current!;
    const plot = plots.current!;
    const color = new THREE.Color();
    const inner = GRID.blockSize - GRID.sidewalk * 2;
    blocks.forEach((b, i) => {
      tmp.rotation.set(0, 0, 0);
      tmp.position.set(b.center.x, 0.1, b.center.z);
      tmp.scale.set(GRID.blockSize, 0.2, GRID.blockSize);
      tmp.updateMatrix();
      walk.setMatrixAt(i, tmp.matrix);
      tmp.position.set(b.center.x, 0.12, b.center.z);
      tmp.scale.set(inner, 0.24, inner);
      tmp.updateMatrix();
      plot.setMatrixAt(i, tmp.matrix);
      plot.setColorAt(i, color.set(b.kind === 'park' ? '#0b3326' : b.kind === 'lot' ? '#0b101c' : '#0c1220'));
    });
    walk.instanceMatrix.needsUpdate = true;
    plot.instanceMatrix.needsUpdate = true;
    if (plot.instanceColor) plot.instanceColor.needsUpdate = true;
  }, [blocks]);
  return (
    <group>
      <instancedMesh ref={sidewalks} args={[undefined, undefined, blocks.length]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#1c2538" emissive="#080d1a" />
      </instancedMesh>
      <instancedMesh ref={plots} args={[undefined, undefined, blocks.length]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
    </group>
  );
}

function Buildings({ fraction }: { fraction: number }) {
  const city = getCity();
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => createBuildingMaterial(), []);
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const list = useMemo(() => {
    if (fraction >= 1) return city.buildings;
    const rng = createRng(9);
    // em aparelhos fracos mantemos o prédio principal de cada quarteirão
    return city.buildings.filter((b) => b.primary || rng.next() < fraction - 0.25);
  }, [city, fraction]);

  useLayoutEffect(() => {
    const mesh = ref.current!;
    const seeds = new Float32Array(list.length);
    list.forEach((b, i) => {
      tmp.position.set(b.x, 0.24, b.z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(b.w, b.h, b.d);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      seeds[i] = (i * 0.618) % 1;
    });
    mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [list]);

  return <instancedMesh key={list.length} ref={ref} args={[geometry, material, list.length]} castShadow />;
}

function Parks({ detailed }: { detailed: boolean }) {
  const city = getCity();
  const ref = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => {
    const rng = createRng(31);
    const out: { x: number; z: number; s: number }[] = [];
    for (const b of city.blocks.filter((bl) => bl.kind === 'park')) {
      const n = detailed ? 38 : 14;
      for (let k = 0; k < n; k++) {
        out.push({
          x: b.center.x + rng.range(-36, 36),
          z: b.center.z + rng.range(-36, 36),
          s: rng.range(0.8, 1.5),
        });
      }
    }
    return out;
  }, [city, detailed]);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    trees.forEach((t, i) => {
      tmp.position.set(t.x, 0.24, t.z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(t.s, t.s, t.s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [trees]);
  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(2.6, 8, 6);
    g.translate(0, 4.2, 0);
    return g;
  }, []);
  return (
    <instancedMesh key={trees.length} ref={ref} args={[geometry, undefined, trees.length]}>
      <meshLambertMaterial color="#1f7a5a" emissive="#0a3326" />
    </instancedMesh>
  );
}

/** Carros estacionados em vagas não monitoradas: dão vida às ruas. */
function ParkedCars({ fraction }: { fraction: number }) {
  const sim = getSimulation();
  const ref = useRef<THREE.InstancedMesh>(null);
  const slots = useMemo(() => {
    const rng = createRng(5);
    return sim.world.parkedSlots.filter(() => rng.next() < fraction);
  }, [sim, fraction]);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    const rng = createRng(12);
    const color = new THREE.Color();
    slots.forEach((s, i) => {
      tmp.position.set(s.position.x + rng.range(-0.3, 0.3), 0.02, s.position.z + rng.range(-0.3, 0.3));
      tmp.rotation.set(0, s.heading + (rng.chance(0.5) ? Math.PI : 0), 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      mesh.setColorAt(i, color.set(rng.pick(CAR_COLORS)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [slots]);
  return (
    <instancedMesh key={slots.length} ref={ref} args={[sharedCarGeometry(), undefined, slots.length]}>
      <meshLambertMaterial />
    </instancedMesh>
  );
}

function Shore() {
  const water = useMemo(() => createWaterMaterial(), []);
  useFrame((_, dt) => {
    water.uniforms.uTime.value += dt;
  });
  const half = CITY_SIZE / 2;
  return (
    <group>
      {/* calçadão + areia */}
      <mesh position={[0, 0.06, half + 12]}>
        <boxGeometry args={[CITY_SIZE + 400, 0.12, 10]} />
        <meshLambertMaterial color="#1b2233" emissive="#0a1226" />
      </mesh>
      <mesh position={[0, 0.03, half + 45]}>
        <boxGeometry args={[CITY_SIZE + 400, 0.06, 56]} />
        <meshLambertMaterial color="#3a3324" emissive="#120f08" />
      </mesh>
      <mesh position={[0, -0.02, half + 73 + 900]} rotation-x={-Math.PI / 2} material={water}>
        <planeGeometry args={[6000, 1800]} />
      </mesh>
    </group>
  );
}

/** Luminárias ao longo da avenida principal: ajudam na leitura de profundidade. */
function StreetLights() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    const avenueX = streetCoord(4);
    const beachZ = streetCoord(GRID.blocks);
    for (let k = -GRID.blocks / 2; k <= GRID.blocks / 2; k += 0.5) {
      out.push({ x: avenueX - 8.5, z: k * SPACING + 20 });
      out.push({ x: avenueX + 8.5, z: k * SPACING - 20 });
      out.push({ x: k * SPACING, z: beachZ + 8.5 });
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    positions.forEach((p, i) => {
      tmp.position.set(p.x, 6, p.z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [positions]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[0.5, 8, 8]} />
      <meshBasicMaterial color="#9fd8ff" toneMapped={false} />
    </instancedMesh>
  );
}

export function City({ buildingFraction, parkedCarsFraction, detailed }: { buildingFraction: number; parkedCarsFraction: number; detailed: boolean }) {
  return (
    <group>
      <Ground />
      <Blocks />
      <Roads />
      <Buildings fraction={buildingFraction} />
      <Parks detailed={detailed} />
      <ParkedCars fraction={parkedCarsFraction} />
      <Shore />
      {detailed && <StreetLights />}
    </group>
  );
}
