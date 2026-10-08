/**
 * AvatarViewer — renderização 3D do intérprete (React Three Fiber).
 *
 * Desempenho: a renderização do AVATAR fica em um <canvas> WebGL próprio,
 * separado do elemento <video> (que é decodificado e composto pelo navegador).
 * O avatar lê video.currentTime a cada quadro por uma função (getTime), sem
 * passar por estado React — nenhuma re-renderização da página por quadro.
 * Quando o intérprete está oculto, o loop de renderização para (frameloop="never").
 * O DPR se adapta ao FPS (PerformanceMonitor) para nunca competir com o vídeo.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { evaluatePose, type AvatarPose } from '@/avatar/animationEngine';
import type { InterpretationTimeline } from '@/avatar/timelineEngine';
import { ProceduralAvatar } from '@/avatar/rig/proceduralAvatar';
import { GlbRig, type AvatarConfig } from '@/avatar/rig/glbRig';
import type { AvatarRig } from '@/avatar/rig/types';

export interface AvatarStatus {
  kind: 'loading' | 'procedural' | 'glb' | 'error';
  message: string;
}

export interface Ambience {
  /** 0..1 luminância média do quadro do vídeo */
  lum: number;
  color: [number, number, number];
}

export interface AvatarViewerProps {
  getTime: () => number;
  timeline: InterpretationTimeline | null;
  loci?: Record<string, 'left' | 'right' | 'center'>;
  visible?: boolean;
  expressiveness?: number;
  ambience?: Ambience | null;
  onStatus?: (s: AvatarStatus) => void;
  /** cpuMs = custo de JS (pose + rig + enquadramento) deste quadro. */
  onPose?: (p: AvatarPose, cpuMs: number) => void;
  className?: string;
  /** Teto de quadros por segundo do avatar (sinais não precisam de 60 fps; o vídeo agradece). */
  fpsCap?: number;
}

const LOOK_Y = 1.32;
const BASE_DIST = 2.95;
const FOV = 20;

async function loadConfig(): Promise<AvatarConfig | null> {
  try {
    const r = await fetch('/models/avatar.config.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return null;
    return (await r.json()) as AvatarConfig;
  } catch {
    return null;
  }
}

function Scene({ getTime, timeline, loci, expressiveness = 0.5, ambience, onStatus, onPose, fpsCap = 30 }: AvatarViewerProps) {
  const { scene, camera, gl, invalidate } = useThree();

  // renderização sob demanda com teto de FPS: o avatar nunca disputa a GPU/CPU com o vídeo
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const interval = 1000 / fpsCap - 2;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last >= interval) {
        last = now;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [invalidate, fpsCap]);
  const [rig, setRig] = useState<AvatarRig | null>(null);
  const lastT = useRef<number | null>(null);
  const dist = useRef(BASE_DIST);
  const pts = useRef<THREE.Vector3[]>([]);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const empty = useMemo<InterpretationTimeline>(() => ({ contentId: '', language: 'pt-BR-LIBRAS', segments: [], signs: [] }), []);

  // ambiente de reflexos (sem download de HDR)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.32;
    return () => {
      env.dispose();
      pmrem.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);

  // carrega GLB realista se configurado; senão, avatar de referência
  useEffect(() => {
    let alive = true;
    let created: AvatarRig | null = null;
    (async () => {
      onStatus?.({ kind: 'loading', message: 'Carregando intérprete 3D…' });
      const cfg = await loadConfig();
      if (cfg?.enabled) {
        try {
          const gltf = await new GLTFLoader().loadAsync(cfg.url);
          if (!alive) return;
          const g = new GlbRig(gltf.scene, cfg);
          created = g;
          setRig(g);
          onStatus?.({
            kind: 'glb',
            message: g.report.bonesMissing.length ? `Modelo GLB carregado — ossos não encontrados: ${g.report.bonesMissing.join(', ')}` : `Modelo GLB carregado (${g.report.morphs} blend shapes)`,
          });
          return;
        } catch (e) {
          console.warn('[LUMIA] Falha ao carregar avatar GLB, usando avatar de referência:', e);
          onStatus?.({ kind: 'error', message: `Não foi possível carregar ${cfg.url}. Usando avatar de referência.` });
        }
      }
      if (!alive) return;
      const p = new ProceduralAvatar();
      created = p;
      setRig(p);
      if (!cfg?.enabled) onStatus?.({ kind: 'procedural', message: 'Avatar de referência — instale /models/avatar.glb para realismo fotográfico' });
    })();
    return () => {
      alive = false;
      created?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, dt) => {
    if (!rig) return;
    const c0 = performance.now();
    const t = getTime();
    const snap = lastT.current === null || Math.abs(t - lastT.current) > 0.6 || t < lastT.current - 0.08;
    lastT.current = t;
    const pose = evaluatePose(timeline ?? empty, t, loci ?? {});
    rig.apply(pose, { dt: Math.min(dt, 0.1), clock: state.clock.elapsedTime, snap, expressiveness });

    // enquadramento automático: mãos e cabeça SEMPRE dentro do quadro
    camera.updateMatrixWorld();
    rig.framingPoints(pts.current);
    let maxX = 0;
    let maxY = 0;
    const v = new THREE.Vector3();
    for (const p of pts.current) {
      v.copy(p).project(camera);
      maxX = Math.max(maxX, Math.abs(v.x));
      maxY = Math.max(maxY, Math.abs(v.y));
    }
    const m = Math.max(maxX, maxY);
    // NDC escala ~ 1/distância: distância que deixaria o ponto mais extremo em 0,82
    const desired = THREE.MathUtils.clamp(dist.current * (m / 0.82), BASE_DIST, BASE_DIST * 2);
    dist.current = snap ? desired : THREE.MathUtils.lerp(dist.current, desired, 1 - Math.exp(-(desired > dist.current ? 14 : 1.6) * Math.min(dt, 0.1)));
    camera.position.set(0, LOOK_Y + 0.02, dist.current);
    camera.lookAt(0, LOOK_Y, 0);
    onPose?.(pose, performance.now() - c0);

    // iluminação adaptativa ao vídeo (modo cinema)
    if (keyRef.current && fillRef.current && rimRef.current) {
      const lum = ambience?.lum ?? 0.5;
      const c = ambience?.color ?? [0.55, 0.65, 0.9];
      keyRef.current.intensity = THREE.MathUtils.lerp(keyRef.current.intensity, 1.6 + lum * 1.1, 0.05);
      rimRef.current.color.lerp(new THREE.Color(0.45 + c[0] * 0.55, 0.45 + c[1] * 0.55, 0.5 + c[2] * 0.5), 0.05);
      fillRef.current.intensity = THREE.MathUtils.lerp(fillRef.current.intensity, 0.45 + lum * 0.4, 0.05);
    }
  });

  useEffect(() => {
    if (!rig) return;
    scene.add(rig.object);
    return () => {
      scene.remove(rig.object);
    };
  }, [rig, scene]);

  return (
    <>
      <hemisphereLight args={['#b9c7ff', '#1d140e', 0.35]} />
      <directionalLight ref={keyRef} position={[-1.3, 2.4, 2.2]} intensity={2.2} color="#ffe3c8" />
      <directionalLight ref={fillRef} position={[1.6, 1.3, 1.9]} intensity={0.6} color="#a9bcff" />
      <directionalLight ref={rimRef} position={[1.3, 2.1, -1.6]} intensity={2.4} color="#8fb3ff" />
      <directionalLight position={[-1.5, 1.7, -1.3]} intensity={1.3} color="#ffb37a" />
    </>
  );
}

export default function AvatarViewer(props: AvatarViewerProps) {
  const [dpr, setDpr] = useState(() => Math.min(1.5, window.devicePixelRatio || 1));
  return (
    <Canvas
      className={props.className}
      frameloop={props.visible === false ? 'never' : 'demand'}
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      camera={{ fov: FOV, near: 0.1, far: 20, position: [0, LOOK_Y, BASE_DIST] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))} onIncline={() => setDpr((d) => Math.min(1.5, d + 0.25))} />
      <Scene {...props} />
    </Canvas>
  );
}
