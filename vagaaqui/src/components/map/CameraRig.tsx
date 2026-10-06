import { MapControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import { getSimulation } from '../../simulation/WorldSimulation';
import { actions, appStore, useApp } from '../../store/appStore';
import { cameraBus } from '../../store/cameraBus';
import { getCity } from '../../world/cityStore';

const desiredPos = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();
const forward = new THREE.Vector3();
const offset = new THREE.Vector3();
const spherical = new THREE.Spherical();


/**
 * Câmera do VagaAqui.
 *  - follow: acompanha o carro como um GPS automotivo (gira com a direção, olha à frente).
 *  - free:   o usuário assumiu o controle (arrastar/pinçar) durante a navegação.
 *  - preview: exploração livre estilo mapa 3D (Preview 3D).
 * Gestos (MapControls): 1 dedo/arrastar = mover · pinça/scroll = zoom ·
 * 2 dedos = girar (lateral) e inclinar (vertical) · botão direito = girar/inclinar.
 */
export function CameraRig() {
  const { camera, size } = useThree();
  const controls = useRef<MapControlsImpl>(null);
  const mode = useApp((s) => s.cameraMode);
  const navStatus = useApp((s) => s.navStatus);
  const driverMode = useApp((s) => s.driverMode);
  const sim = getSimulation();

  const blend = useRef({ v: 1 });
  const startPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const heading = useRef(sim.vehicle.heading);
  const zoom = useRef(1);
  const tween = useRef<gsap.core.Tween | null>(null);
  const baseFog = useRef<number | null>(null);

  const tweenTo = (pos: THREE.Vector3, target: THREE.Vector3, duration = 1.3) => {
    const c = controls.current;
    if (!c) return;
    tween.current?.kill();
    const from = { px: camera.position.x, py: camera.position.y, pz: camera.position.z, tx: c.target.x, ty: c.target.y, tz: c.target.z };
    tween.current = gsap.to(from, {
      px: pos.x,
      py: pos.y,
      pz: pos.z,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      duration,
      ease: 'power3.inOut',
      onUpdate: () => {
        camera.position.set(from.px, from.py, from.pz);
        c.target.set(from.tx, from.ty, from.tz);
        c.update();
      },
    });
  };

  // Transições entre modos com GSAP
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (mode === 'follow') {
      tween.current?.kill();
      startPos.current.copy(camera.position);
      startTarget.current.copy(c.target);
      blend.current.v = 0;
      gsap.to(blend.current, { v: 1, duration: 1.4, ease: 'power3.inOut' });
    } else if (mode === 'preview') {
      const v = sim.vehicle;
      const target = new THREE.Vector3(v.position.x, 0, v.position.z);
      offset.copy(camera.position).sub(c.target);
      spherical.setFromVector3(offset);
      spherical.radius = 320;
      spherical.phi = THREE.MathUtils.degToRad(52);
      const pos = new THREE.Vector3().setFromSpherical(spherical).add(target);
      tweenTo(pos, target, 1.6);
    }
    c.zoomToCursor = mode !== 'follow';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Interação do usuário durante o acompanhamento → modo livre (com botão "Recentralizar")
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const onStart = () => {
      tween.current?.kill();
      if (appStore.get().cameraMode === 'follow' && !appStore.get().driverMode) actions.setCameraMode('free');
    };
    c.addEventListener('start', onStart);
    return () => c.removeEventListener('start', onStart);
  }, []);

  // Comandos dos botões de controle do mapa
  useEffect(
    () =>
      cameraBus.on((cmd) => {
        const c = controls.current;
        if (!c) return;
        const following = appStore.get().cameraMode === 'follow';
        if (cmd.type === 'zoom' && following) {
          zoom.current = THREE.MathUtils.clamp(zoom.current * cmd.factor, 0.35, 3.5);
          return;
        }
        if (following && cmd.type !== 'zoom') actions.setCameraMode('free');
        offset.copy(camera.position).sub(c.target);
        spherical.setFromVector3(offset);
        const target = c.target.clone();
        switch (cmd.type) {
          case 'zoom':
            spherical.radius = THREE.MathUtils.clamp(spherical.radius * cmd.factor, 15, 1400);
            break;
          case 'rotate':
            spherical.theta += cmd.radians;
            break;
          case 'tilt':
            spherical.phi = THREE.MathUtils.clamp(spherical.phi + cmd.radians, 0.08, THREE.MathUtils.degToRad(80));
            break;
          case 'north':
            spherical.theta = 0;
            break;
          case 'focus':
            target.set(cmd.x, 0, cmd.z);
            spherical.radius = cmd.distance ?? Math.min(spherical.radius, 220);
            spherical.phi = Math.min(spherical.phi, THREE.MathUtils.degToRad(60));
            break;
          case 'overview': {
            const b = getCity().bounds;
            target.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
            spherical.radius = Math.min(1350, Math.max(500, Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 1.15));
            spherical.phi = THREE.MathUtils.degToRad(40);
            break;
          }
        }
        const pos = new THREE.Vector3().setFromSpherical(spherical).add(target);
        tweenTo(pos, target, cmd.type === 'focus' || cmd.type === 'overview' ? 1.4 : 0.6);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ scene }, dt) => {
    const c = controls.current;
    if (!c) return;
    // neblina proporcional à distância: atmosfera de perto, cidade inteira visível de longe
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      if (baseFog.current == null) baseFog.current = fog.density;
      const d = camera.position.distanceTo(c.target);
      fog.density = baseFog.current * Math.min(1, 320 / Math.max(320, d));
    }
    if (mode !== 'follow') {
      const b = getCity().bounds;
      c.target.x = THREE.MathUtils.clamp(c.target.x, b.minX - 200, b.maxX + 200);
      c.target.z = THREE.MathUtils.clamp(c.target.z, b.minZ - 200, b.maxZ + 200);
      c.target.y = 0;
      return;
    }
    const v = sim.vehicle;
    // direção suavizada: a câmera gira com o carro sem trancos
    let d = v.heading - heading.current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    heading.current += d * (1 - Math.exp(-dt * 2.2));

    const driving = navStatus === 'navigating';
    // tela em pé (celular): mais distância e alvo mais à frente, para o carro não ficar sob o painel
    const portrait = size.height > size.width * 1.1 ? 1.45 : 1;
    const distance = (driving ? (driverMode ? 52 : 44) : driverMode ? 150 : 190) * zoom.current * (driving ? portrait : 1);
    const pitch = THREE.MathUtils.degToRad((portrait > 1 && driving ? 9 : 0) + (driving ? (driverMode ? 30 : 25) : 38));
    // em pé, mira atrás do carro para ele subir na tela (acima do painel inferior)
    const lookAhead = driving ? (portrait > 1 ? 4 + v.speed * 0.6 : 10 + v.speed * 1.4) : 0;

    forward.set(Math.cos(heading.current), 0, -Math.sin(heading.current));
    desiredTarget.set(v.position.x, 0, v.position.z).addScaledVector(forward, lookAhead);
    desiredPos
      .copy(desiredTarget)
      .addScaledVector(forward, -distance * Math.cos(pitch))
      .setY(distance * Math.sin(pitch) + 2);

    const k = 1 - Math.exp(-dt * 5);
    if (blend.current.v < 1) {
      camera.position.lerpVectors(startPos.current, desiredPos, blend.current.v);
      c.target.lerpVectors(startTarget.current, desiredTarget, blend.current.v);
    } else {
      camera.position.lerp(desiredPos, k);
      c.target.lerp(desiredTarget, k);
    }
    camera.lookAt(c.target);
  });

  return (
    <MapControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={15}
      maxDistance={1400}
      maxPolarAngle={THREE.MathUtils.degToRad(80)}
      screenSpacePanning={false}
      enabled={!(driverMode && mode === 'follow')}
    />
  );
}
