import type * as THREE from 'three';
import type { AvatarPose } from '../animationEngine';

export interface RigApplyOptions {
  dt: number;
  /** Relógio de parede (s) para respiração/piscadas — nunca usado para sincronia. */
  clock: number;
  /** true após seek: aplica a pose sem suavização. */
  snap: boolean;
  /** 0..1 — quanto da interpretação é "expressiva" (modo imersivo aumenta). */
  expressiveness: number;
}

export interface AvatarRig {
  kind: 'procedural' | 'glb';
  object: THREE.Object3D;
  apply(pose: AvatarPose, opts: RigApplyOptions): void;
  /** Pontos que precisam caber no enquadramento (topo da cabeça, mãos). */
  framingPoints(out: THREE.Vector3[]): void;
  dispose(): void;
}
