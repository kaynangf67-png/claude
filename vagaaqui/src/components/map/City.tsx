import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createRng } from '../../lib/random';
import { getSimulation } from '../../simulation/WorldSimulation';
import { getCity } from '../../world/cityStore';
import { pointInPolygon, polygonArea, type CityData } from '../../world/cityTypes';
import { CarFleet } from './CarFleet';
import {
  buildBuildingGeometry,
  buildFlatGeometry,
  buildJunctionGeometry,
  buildPolylineRibbon,
  buildRoadGeometry,
  buildSidewalkGeometry,
} from './cityGeometry';
import { CAR_COLORS } from './geometries';
import { streetNameTexture } from './markerTextures';
import {
  createBuildingMaterial,
  createGroundMaterial,
  createRoadMaterial,
  createSidewalkMaterial,
  createWaterMaterial,
} from './shaders';

const tmp = new THREE.Object3D();

/** Altura do "chão" das áreas (o terreno é plano; as ruas ficam alguns cm acima). */
const surfaceY = (_city: CityData) => 0;

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
  const sidewalks = useDisposable(() => buildSidewalkGeometry(city), [city]);
  const material = useMemo(() => createRoadMaterial(), []);
  const sidewalkMat = useMemo(() => createSidewalkMaterial(), []);
  return (
    <group>
      <mesh geometry={sidewalks} material={sidewalkMat} />
      {/* emendas das curvas: mesmo shader do asfalto, sem sinalização */}
      <mesh geometry={junctions} material={material} />
      <mesh geometry={roads} material={material} />
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
  ctx.fillStyle = '#28292d';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(225,226,222,0.75)';
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
        <meshLambertMaterial color="#8a7a5a" />
      </mesh>
      <mesh geometry={parks}>
        <meshLambertMaterial color="#2f4a2c" />
      </mesh>
      <mesh geometry={plazas}>
        <meshLambertMaterial color="#55575b" />
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
  const canopy = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(2.6, 1);
    g.scale(1, 0.85, 1);
    g.translate(0, 4.6, 0);
    return g;
  }, []);
  const trunk = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.22, 0.3, 3, 6);
    g.translate(0, 1.5, 0);
    return g;
  }, []);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const src = ref.current;
    const dst = trunkRef.current;
    if (!src || !dst) return;
    dst.instanceMatrix.copy(src.instanceMatrix);
    dst.instanceMatrix.needsUpdate = true;
    dst.computeBoundingSphere();
  }, [trees]);
  if (!trees.length) return null;
  return (
    <group>
      <instancedMesh key={`c${trees.length}`} ref={ref} args={[canopy, undefined, trees.length]} castShadow>
        <meshLambertMaterial color="#3d6b35" flatShading />
      </instancedMesh>
      <instancedMesh key={`t${trees.length}`} ref={trunkRef} args={[trunk, undefined, trees.length]}>
        <meshLambertMaterial color="#4a3a2a" />
      </instancedMesh>
    </group>
  );
}

/** Alguns carros estacionados nas vagas não monitoradas, para dar escala às ruas. */
function ParkedCars({ fraction, max }: { fraction: number; max: number }) {
  const sim = getSimulation();
  const slots = useMemo(() => {
    const rng = createRng(5);
    const all = sim.world.parkedSlots;
    const keep = Math.min(fraction, max / Math.max(1, all.length));
    return all.filter(() => rng.next() < keep);
  }, [sim, fraction, max]);
  const fill = useMemo(
    () => (mesh: THREE.InstancedMesh) => {
      const rng = createRng(12);
      const color = new THREE.Color();
      slots.forEach((s, i) => {
        tmp.position.set(s.position.x + rng.range(-0.2, 0.2), 0.07, s.position.z + rng.range(-0.15, 0.15));
        tmp.rotation.set(0, s.heading + (rng.chance(0.5) ? Math.PI : 0) + rng.range(-0.03, 0.03), 0);
        tmp.scale.set(rng.range(0.92, 1.06), 1, 1);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
        mesh.setColorAt(i, color.set(rng.pick(CAR_COLORS)));
      });
      return slots.length;
    },
    [slots],
  );
  return <CarFleet capacity={slots.length} fill={fill} version={fill} />;
}

function Coastline({ city }: { city: CityData }) {
  const geometry = useDisposable(() => buildPolylineRibbon(city.coastlines, 2.4, 0.08), [city]);
  if (!city.coastlines.length) return null;
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color="#c9d6dd" transparent opacity={0.35} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

const labelPos = new THREE.Vector3();
/** Nomes das ruas pintados no chão, alinhados com a via (como num mapa de navegação). */
function StreetLabels({ city, max }: { city: CityData; max: number }) {
  const group = useRef<THREE.Group>(null);
  const labels = useMemo(() => {
    // trecho mais longo de cada rua, para o nome caber
    const best = new Map<string, { x: number; z: number; angle: number; length: number; width: number }>();
    for (const e of city.edges.values()) {
      if (!e.street || e.street === 'Via sem nome' || e.length < 40) continue;
      const cur = best.get(e.street);
      if (cur && cur.length >= e.length) continue;
      const a = city.nodes.get(e.a)!.position;
      let angle = Math.atan2(-e.dir.z, e.dir.x);
      // mantém o texto de pé para quem olha de cima (nunca de cabeça para baixo)
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      best.set(e.street, { x: a.x + (e.dir.x * e.length) / 2, z: a.z + (e.dir.z * e.length) / 2, angle, length: e.length, width: e.width });
    }
    return [...best.entries()]
      .sort((p, q) => q[1].length - p[1].length)
      .slice(0, max)
      .map(([name, l]) => {
        const tex = streetNameTexture(name);
        const img = tex.image as HTMLCanvasElement;
        const h = Math.min(3.2, l.width * 0.32);
        const w = Math.min(l.length * 0.7, h * (img.width / img.height));
        return { name, ...l, tex, w, h: w / (img.width / img.height) };
      });
  }, [city, max]);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((child) => {
      child.getWorldPosition(labelPos);
      child.visible = camera.position.distanceTo(labelPos) < 320;
    });
  });
  return (
    <group ref={group}>
      {labels.map((l) => (
        <mesh key={l.name} position={[l.x, 0.09, l.z]} rotation={[-Math.PI / 2, 0, l.angle]} renderOrder={2}>
          <planeGeometry args={[l.w, l.h]} />
          <meshBasicMaterial map={l.tex} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function City({
  buildingFraction,
  parkedCarsFraction,
  parkedCarsMax,
  detailed,
  showBuildings,
}: {
  buildingFraction: number;
  parkedCarsFraction: number;
  parkedCarsMax: number;
  detailed: boolean;
  showBuildings: boolean;
}) {
  const city = getCity();
  return (
    <group>
      <Ground city={city} />
      <Areas city={city} />
      <Roads city={city} />
      <Coastline city={city} />
      {showBuildings && <Buildings city={city} fraction={buildingFraction} />}
      <Trees city={city} max={detailed ? 900 : 250} />
      <ParkedCars fraction={parkedCarsFraction} max={parkedCarsMax} />
      <StreetLabels city={city} max={detailed ? 60 : 25} />
    </group>
  );
}
