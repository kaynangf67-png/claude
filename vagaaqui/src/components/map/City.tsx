import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createRng } from '../../lib/random';
import { getSimulation } from '../../simulation/WorldSimulation';
import { getCity } from '../../world/cityStore';
import { pointInPolygon, polygonArea, type CityData } from '../../world/cityTypes';
import {
  buildBuildingGeometry,
  buildFlatGeometry,
  buildJunctionGeometry,
  buildPolylineRibbon,
  buildRoadGeometry,
} from './cityGeometry';
import { CAR_COLORS, sharedCarGeometry } from './geometries';
import { labelTexture } from './markerTextures';
import { createBuildingMaterial, createGroundMaterial, createRoadMaterial, createWaterMaterial } from './shaders';

const tmp = new THREE.Object3D();

/** Altura do "chão" das áreas: na grade procedural os quarteirões são elevados. */
const surfaceY = (city: CityData) => (city.blocks.length ? 0.25 : 0);

function useDisposable<T extends { dispose: () => void }>(factory: () => T, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

function Ground({ city }: { city: CityData }) {
  const material = useMemo(() => createGroundMaterial(), []);
  const cx = (city.bounds.minX + city.bounds.maxX) / 2;
  const cz = (city.bounds.minZ + city.bounds.maxZ) / 2;
  return (
    <mesh position={[cx, -0.05, cz]} rotation-x={-Math.PI / 2} material={material}>
      <planeGeometry args={[8000, 8000]} />
    </mesh>
  );
}

function Roads({ city }: { city: CityData }) {
  const roads = useDisposable(() => buildRoadGeometry(city), [city]);
  const junctions = useDisposable(() => buildJunctionGeometry(city), [city]);
  const material = useMemo(() => createRoadMaterial(), []);
  return (
    <group>
      <mesh geometry={junctions}>
        <meshBasicMaterial color="#090b12" toneMapped={false} />
      </mesh>
      <mesh geometry={roads} material={material} />
    </group>
  );
}

/** Calçadas e lotes dos quarteirões (só na cidade procedural). */
function Blocks({ city }: { city: CityData }) {
  const sidewalks = useRef<THREE.InstancedMesh>(null);
  const plots = useRef<THREE.InstancedMesh>(null);
  const blocks = city.blocks;
  useLayoutEffect(() => {
    const walk = sidewalks.current;
    const plot = plots.current;
    if (!walk || !plot) return;
    const color = new THREE.Color();
    blocks.forEach((b, i) => {
      tmp.rotation.set(0, 0, 0);
      tmp.position.set(b.center.x, 0.1, b.center.z);
      tmp.scale.set(b.size, 0.2, b.size);
      tmp.updateMatrix();
      walk.setMatrixAt(i, tmp.matrix);
      tmp.position.set(b.center.x, 0.12, b.center.z);
      tmp.scale.set(b.size - 8, 0.24, b.size - 8);
      tmp.updateMatrix();
      plot.setMatrixAt(i, tmp.matrix);
      plot.setColorAt(i, color.set(b.kind === 'park' ? '#0b3326' : '#0c1220'));
    });
    walk.instanceMatrix.needsUpdate = true;
    plot.instanceMatrix.needsUpdate = true;
    if (plot.instanceColor) plot.instanceColor.needsUpdate = true;
  }, [blocks]);
  if (!blocks.length) return null;
  return (
    <group>
      <instancedMesh ref={sidewalks} args={[undefined, undefined, blocks.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#1c2538" emissive="#080d1a" />
      </instancedMesh>
      <instancedMesh ref={plots} args={[undefined, undefined, blocks.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
    </group>
  );
}

function Buildings({ city, fraction }: { city: CityData; fraction: number }) {
  const list = useMemo(() => {
    if (fraction >= 1) return city.buildings;
    // em aparelhos fracos mantemos os maiores prédios (os que definem a silhueta)
    const sorted = [...city.buildings].sort((a, b) => b.area * b.h - a.area * a.h);
    return sorted.slice(0, Math.max(1, Math.round(sorted.length * fraction)));
  }, [city, fraction]);
  const geometry = useDisposable(() => buildBuildingGeometry(list, surfaceY(city)), [list, city]);
  const material = useMemo(() => createBuildingMaterial(), []);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}

function lotSurfaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0b101c';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(160,190,230,0.4)';
  ctx.lineWidth = 3;
  for (let x = 8; x < 128; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x, 54);
    ctx.moveTo(x, 74);
    ctx.lineTo(x, 118);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Parques, praias, praças, estacionamentos e água. */
function Areas({ city }: { city: CityData }) {
  const y = surfaceY(city);
  const byKind = (kind: string) => city.areas.filter((a) => a.kind === kind).map((a) => a.polygon);
  const parks = useDisposable(() => buildFlatGeometry(byKind('park'), y + 0.03), [city]);
  const beaches = useDisposable(() => buildFlatGeometry(byKind('beach'), 0.025), [city]);
  const plazas = useDisposable(() => buildFlatGeometry(byKind('plaza'), y + 0.035), [city]);
  const lots = useDisposable(() => buildFlatGeometry(byKind('lot'), y + 0.04, 12), [city]);
  const water = useDisposable(() => buildFlatGeometry(byKind('water'), -0.02), [city]);
  const lotTex = useMemo(() => lotSurfaceTexture(), []);
  const waterMat = useMemo(() => createWaterMaterial(), []);
  useFrame((_, dt) => {
    waterMat.uniforms.uTime.value += dt;
  });
  return (
    <group>
      <mesh geometry={water} material={waterMat} />
      <mesh geometry={beaches}>
        <meshBasicMaterial color="#2a2518" toneMapped={false} />
      </mesh>
      <mesh geometry={parks}>
        <meshBasicMaterial color="#0b2a20" toneMapped={false} />
      </mesh>
      <mesh geometry={plazas}>
        <meshBasicMaterial color="#141b2b" toneMapped={false} />
      </mesh>
      <mesh geometry={lots}>
        <meshBasicMaterial map={lotTex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Trees({ city, max }: { city: CityData; max: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => {
    const rng = createRng(31);
    const out: { x: number; z: number; s: number }[] = [];
    const parks = city.areas.filter((a) => a.kind === 'park');
    const totalArea = parks.reduce((sum, p) => sum + Math.abs(polygonArea(p.polygon)), 0) || 1;
    for (const park of parks) {
      const area = Math.abs(polygonArea(park.polygon));
      const want = Math.min(400, Math.round((area / totalArea) * max), Math.round(area / 220));
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of park.polygon) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }
      for (let tries = 0, n = 0; n < want && tries < want * 6; tries++) {
        const p = { x: rng.range(minX, maxX), z: rng.range(minZ, maxZ) };
        if (!pointInPolygon(p, park.polygon)) continue;
        out.push({ ...p, s: rng.range(0.7, 1.4) });
        n++;
      }
    }
    return out;
  }, [city, max]);
  const y = surfaceY(city);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    trees.forEach((t, i) => {
      tmp.position.set(t.x, y, t.z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(t.s, t.s, t.s);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [trees, y]);
  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(2.4, 7.5, 6);
    g.translate(0, 4, 0);
    return g;
  }, []);
  if (!trees.length) return null;
  return (
    <instancedMesh key={trees.length} ref={ref} args={[geometry, undefined, trees.length]}>
      <meshLambertMaterial color="#1f7a5a" emissive="#0a3326" />
    </instancedMesh>
  );
}

/** Carros estacionados em vagas não monitoradas: dão vida às ruas. */
function ParkedCars({ fraction, max }: { fraction: number; max: number }) {
  const sim = getSimulation();
  const ref = useRef<THREE.InstancedMesh>(null);
  const slots = useMemo(() => {
    const rng = createRng(5);
    const all = sim.world.parkedSlots;
    const keep = Math.min(fraction, max / Math.max(1, all.length));
    return all.filter(() => rng.next() < keep);
  }, [sim, fraction, max]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rng = createRng(12);
    const color = new THREE.Color();
    slots.forEach((s, i) => {
      tmp.position.set(s.position.x + rng.range(-0.25, 0.25), 0.07, s.position.z + rng.range(-0.25, 0.25));
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
  if (!slots.length) return null;
  return (
    <instancedMesh key={slots.length} ref={ref} args={[sharedCarGeometry(), undefined, slots.length]}>
      <meshLambertMaterial />
    </instancedMesh>
  );
}

function Coastline({ city }: { city: CityData }) {
  const geometry = useDisposable(() => buildPolylineRibbon(city.coastlines, 2.4, 0.08), [city]);
  if (!city.coastlines.length) return null;
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color="#3fd0ff" transparent opacity={0.75} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

const labelPos = new THREE.Vector3();
/** Nomes das ruas: aparecem quando a câmera está perto (confirma que são as ruas reais). */
function StreetLabels({ city, max }: { city: CityData; max: number }) {
  const group = useRef<THREE.Group>(null);
  const labels = useMemo(
    () =>
      city.streetNames.slice(0, max).map((s) => {
        const tex = labelTexture(s.name, '›', '#7fa2ff');
        const img = tex.image as HTMLCanvasElement;
        return { ...s, tex, aspect: img.width / img.height };
      }),
    [city, max],
  );
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const high = camera.position.y > 420;
    g.children.forEach((child) => {
      child.getWorldPosition(labelPos);
      child.visible = !high && camera.position.distanceTo(labelPos) < 380;
    });
  });
  return (
    <group ref={group}>
      {labels.map((l) => (
        <sprite key={l.name} position={[l.position.x, 5, l.position.z]} scale={[4.2 * l.aspect, 4.2, 1]} renderOrder={4}>
          <spriteMaterial map={l.tex} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

export function City({
  buildingFraction,
  parkedCarsFraction,
  parkedCarsMax,
  detailed,
}: {
  buildingFraction: number;
  parkedCarsFraction: number;
  parkedCarsMax: number;
  detailed: boolean;
}) {
  const city = getCity();
  return (
    <group>
      <Ground city={city} />
      <Areas city={city} />
      <Blocks city={city} />
      <Roads city={city} />
      <Coastline city={city} />
      <Buildings city={city} fraction={buildingFraction} />
      <Trees city={city} max={detailed ? 900 : 250} />
      <ParkedCars fraction={parkedCarsFraction} max={parkedCarsMax} />
      <StreetLabels city={city} max={detailed ? 60 : 25} />
    </group>
  );
}
