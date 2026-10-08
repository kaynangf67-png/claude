/**
 * RIG GLB — dirige um avatar humano realista (GLB/GLTF) com o mesmo AvatarPose.
 *
 * ONDE COLOCAR O MODELO: /public/models/avatar.glb
 * COMO ATIVAR:           /public/models/avatar.config.json  →  "enabled": true
 * DETALHES:              /public/models/README.md
 *
 * Requisitos do modelo:
 *   - esqueleto humanoide (skeletal animation) com ossos de braço, mão e
 *     3 falanges por dedo (nomes estilo Mixamo, Unreal/MetaHuman, VRM/RPM ou
 *     mapeados em "boneAliases" no config);
 *   - blend shapes faciais no padrão ARKit (eyeBlinkLeft, jawOpen,
 *     browInnerUp, mouthSmileLeft …) — nomes diferentes podem ser mapeados em
 *     "morphAliases";
 *   - opcional: ossos LeftEye/RightEye para o olhar.
 *
 * Como funciona:
 *   - braços: IK analítico de dois ossos, "mirando" cada osso para a posição
 *     de cotovelo/punho calculada (independe do eixo local de cada rig);
 *   - mãos: orientação absoluta calibrada a partir da pose de ligação
 *     (bind pose), medindo dedos e palma do próprio modelo;
 *   - dedos: flexão em torno de um eixo calibrado (dedo × normal da palma);
 *   - rosto: aplica os pesos ARKit em todas as malhas que tiverem o morph.
 *
 * ⚠️ Testado com um esqueleto sintético nos testes automatizados
 *   (src/avatar/rig/glbRig.test.ts). Cada modelo real pode precisar de ajuste
 *   fino de aliases/eixos no config — isso é esperado e está documentado.
 *
 * Para clipes de motion capture: use playClip() com AnimationClips do
 * próprio GLB (ver TODO abaixo).
 */
import * as THREE from 'three';
import type { AvatarPose, HandPose } from '../animationEngine';
import type { AvatarRig, RigApplyOptions } from './types';
import { damp, handBasis, solveTwoBone, toBody, type Side } from './math';

export interface AvatarConfig {
  enabled: boolean;
  url: string;
  /** Altura do modelo (m). Se ausente, é medida pelo bounding box. */
  heightMeters?: number | null;
  rotationY?: number;
  boneAliases?: Partial<Record<BoneKey, string>>;
  morphAliases?: Record<string, string>;
  /** Inverte o sentido de flexão dos dedos, se o rig vier espelhado. */
  invertFingerCurl?: boolean;
}

type FingerName = 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Pinky';
export type BoneKey =
  | 'Hips' | 'Spine' | 'Spine1' | 'Spine2' | 'Neck' | 'Head' | 'LeftEye' | 'RightEye'
  | `${'Left' | 'Right'}${'Shoulder' | 'Arm' | 'ForeArm' | 'Hand'}`
  | `${'Left' | 'Right'}Hand${FingerName}${1 | 2 | 3}`;

const SIDE_NAME: Record<Side, 'Right' | 'Left'> = { R: 'Right', L: 'Left' };

/** Variações comuns de nomes de ossos (normalizados sem prefixo/pontuação). */
const ALIASES: Record<string, string[]> = {
  Hips: ['hips', 'pelvis', 'root'],
  Spine: ['spine', 'spine01', 'spine_01'],
  Spine1: ['spine1', 'spine02', 'spine_02', 'chest'],
  Spine2: ['spine2', 'spine03', 'spine_03', 'upperchest'],
  Neck: ['neck', 'neck01', 'neck_01'],
  Head: ['head'],
  LeftEye: ['lefteye', 'eyel', 'eye_l'],
  RightEye: ['righteye', 'eyer', 'eye_r'],
  LeftShoulder: ['leftshoulder', 'claviclel', 'clavicle_l', 'leftclavicle'],
  RightShoulder: ['rightshoulder', 'clavicler', 'clavicle_r', 'rightclavicle'],
  LeftArm: ['leftarm', 'upperarml', 'upperarm_l', 'leftupperarm'],
  RightArm: ['rightarm', 'upperarmr', 'upperarm_r', 'rightupperarm'],
  LeftForeArm: ['leftforearm', 'lowerarml', 'lowerarm_l', 'leftlowerarm'],
  RightForeArm: ['rightforearm', 'lowerarmr', 'lowerarm_r', 'rightlowerarm'],
  LeftHand: ['lefthand', 'handl', 'hand_l'],
  RightHand: ['righthand', 'handr', 'hand_r'],
};
for (const s of ['Left', 'Right'] as const) {
  const lr = s === 'Left' ? 'l' : 'r';
  const fingerAlt: Record<FingerName, string[]> = { Thumb: ['thumb'], Index: ['index'], Middle: ['middle'], Ring: ['ring'], Pinky: ['pinky', 'little'] };
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as FingerName[]) {
    for (const n of [1, 2, 3]) {
      ALIASES[`${s}Hand${f}${n}`] = fingerAlt[f].flatMap((a) => [`${s.toLowerCase()}hand${a}${n}`, `${a}0${n}${lr}`, `${a}0${n}_${lr}`, `${a}${n}${lr}`, `${a}_0${n}_${lr}`, `${s.toLowerCase()}${a}${n}`]);
    }
  }
}

const normName = (n: string) => n.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/^(cc_base_|bip01_?|armature[_|])/, '').replace(/[\s.:|-]/g, '');

export function findBones(root: THREE.Object3D, overrides: AvatarConfig['boneAliases'] = {}): Partial<Record<BoneKey, THREE.Object3D>> {
  const byName = new Map<string, THREE.Object3D>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone || o.type === 'Bone' || o.type === 'Object3D') byName.set(normName(o.name), o);
  });
  const out: Partial<Record<BoneKey, THREE.Object3D>> = {};
  for (const key of Object.keys(ALIASES) as BoneKey[]) {
    const ov = overrides?.[key];
    const cand = ov ? [normName(ov)] : [normName(key), ...ALIASES[key].map(normName)];
    for (const c of cand) {
      const b = byName.get(c);
      if (b) {
        out[key] = b;
        break;
      }
    }
  }
  return out;
}

interface ArmCal {
  upper: THREE.Object3D;
  fore: THREE.Object3D;
  hand: THREE.Object3D;
  a: number;
  b: number;
  bindLocal: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
  handCorrection: THREE.Quaternion; // C: handWorld = basis * C
  fingers: { bones: THREE.Object3D[]; bind: THREE.Quaternion[]; curlAxis: THREE.Vector3[]; spreadAxis: THREE.Vector3[] }[];
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qc = new THREE.Quaternion();

/** Gira `bone` para que a posição mundial de `child` vá até `target`. */
function aimBone(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
  bone.updateWorldMatrix(true, true);
  const bp = bone.getWorldPosition(_v1);
  const cp = child.getWorldPosition(_v2).sub(bp).normalize();
  const tp = _v3.copy(target).sub(bp).normalize();
  _qa.setFromUnitVectors(cp, tp);
  bone.getWorldQuaternion(_qb);
  _qb.premultiply(_qa);
  const parentQ = bone.parent ? bone.parent.getWorldQuaternion(_qc) : _qc.identity();
  bone.quaternion.copy(parentQ.invert().multiply(_qb));
}

function setWorldQuaternion(bone: THREE.Object3D, q: THREE.Quaternion) {
  const parentQ = bone.parent ? bone.parent.getWorldQuaternion(_qc) : _qc.identity();
  bone.quaternion.copy(parentQ.invert().multiply(q));
}

export class GlbRig implements AvatarRig {
  kind = 'glb' as const;
  object: THREE.Group;
  /** Referencial do corpo (pés na origem, olhando +Z, escala normalizada a 1,70 m). */
  private bodyFrame = new THREE.Group();
  private bones: Partial<Record<BoneKey, THREE.Object3D>>;
  private arms: Partial<Record<Side, ArmCal>> = {};
  private morphMeshes: THREE.Mesh[] = [];
  private morphAliases: Record<string, string>;
  private spineBind = new Map<THREE.Object3D, THREE.Quaternion>();
  private face: Record<string, number> = {};
  private scale: number;
  private nextBlink = 2;
  private blinkT = -1;
  readonly report: { bonesFound: number; bonesMissing: string[]; morphs: number };

  constructor(model: THREE.Object3D, private cfg: AvatarConfig) {
    this.object = new THREE.Group();
    const holder = new THREE.Group();
    holder.rotation.y = cfg.rotationY ?? 0;
    holder.add(model);
    this.object.add(holder, this.bodyFrame);
    this.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const h = cfg.heightMeters ?? Math.max(0.5, box.max.y - box.min.y);
    this.scale = 1.7 / h;
    holder.scale.setScalar(this.scale);
    holder.position.y = -box.min.y * this.scale;
    this.object.updateMatrixWorld(true);

    this.bones = findBones(model, cfg.boneAliases);
    this.morphAliases = cfg.morphAliases ?? {};
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).length) this.morphMeshes.push(m);
      if (m.isMesh) m.frustumCulled = false;
    });
    for (const k of ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftEye', 'RightEye'] as BoneKey[]) {
      const b = this.bones[k];
      if (b) this.spineBind.set(b, b.quaternion.clone());
    }
    for (const side of ['R', 'L'] as const) this.calibrateArm(side);
    const required: BoneKey[] = ['Head', 'RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand'];
    this.report = {
      bonesFound: Object.keys(this.bones).length,
      bonesMissing: required.filter((k) => !this.bones[k]),
      morphs: new Set(this.morphMeshes.flatMap((m) => Object.keys(m.morphTargetDictionary!))).size,
    };
  }

  private calibrateArm(side: Side) {
    const S = SIDE_NAME[side];
    const upper = this.bones[`${S}Arm`];
    const fore = this.bones[`${S}ForeArm`];
    const hand = this.bones[`${S}Hand`];
    if (!upper || !fore || !hand) return;
    const pu = upper.getWorldPosition(new THREE.Vector3());
    const pf = fore.getWorldPosition(new THREE.Vector3());
    const ph = hand.getWorldPosition(new THREE.Vector3());
    const idx = this.bones[`${S}HandIndex1`];
    const mid = this.bones[`${S}HandMiddle1`];
    const pky = this.bones[`${S}HandPinky1`] ?? this.bones[`${S}HandRing1`];
    const fingersDir = (mid ? mid.getWorldPosition(new THREE.Vector3()) : ph.clone().add(ph.clone().sub(pf))).sub(ph).normalize();
    let palm: THREE.Vector3;
    if (idx && pky) {
      const across = idx.getWorldPosition(new THREE.Vector3()).sub(pky.getWorldPosition(new THREE.Vector3())).normalize();
      palm = side === 'R' ? new THREE.Vector3().crossVectors(across, fingersDir) : new THREE.Vector3().crossVectors(fingersDir, across);
    } else palm = new THREE.Vector3(0, -1, 0);
    const basis = handBasis(fingersDir, palm);
    const handWorld = hand.getWorldQuaternion(new THREE.Quaternion());
    const handCorrection = basis.clone().invert().multiply(handWorld);
    const fingers: ArmCal['fingers'] = [];
    const curlWorld = new THREE.Vector3().crossVectors(fingersDir, palm).normalize().multiplyScalar(this.cfg.invertFingerCurl ? -1 : 1);
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'] as FingerName[]) {
      const bones = [1, 2, 3].map((n) => this.bones[`${S}Hand${f}${n}` as BoneKey]).filter(Boolean) as THREE.Object3D[];
      fingers.push({
        bones,
        bind: bones.map((b) => b.quaternion.clone()),
        curlAxis: bones.map((b) => curlWorld.clone().applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize()),
        spreadAxis: bones.map((b) => palm.clone().applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize()),
      });
    }
    this.arms[side] = {
      upper,
      fore,
      hand,
      a: pu.distanceTo(pf),
      b: pf.distanceTo(ph),
      bindLocal: [upper.quaternion.clone(), fore.quaternion.clone(), hand.quaternion.clone()],
      handCorrection,
      fingers,
    };
  }

  private body = { yaw: 0, lean: 0, hp: 0, hy: 0, hr: 0, gx: 0, gy: 0 };
  private _target = new THREE.Vector3();
  private _f = new THREE.Vector3();
  private _p = new THREE.Vector3();
  private _sh = new THREE.Vector3();
  private _el = new THREE.Vector3();
  private _pole = new THREE.Vector3();
  private _q = new THREE.Quaternion();
  private _e = new THREE.Euler();
  private smoothHands: Partial<Record<Side, { pos: THREE.Vector3; fingers: THREE.Vector3; palm: THREE.Vector3; shape: number[] }>> = {};

  apply(pose: AvatarPose, o: RigApplyOptions) {
    const ex = pose.expression;
    const lam = o.snap ? 1e6 : 9;
    const B = this.body;
    B.yaw = damp(B.yaw, ex.torsoYaw, lam, o.dt);
    B.lean = damp(B.lean, ex.lean, lam, o.dt);
    B.hp = damp(B.hp, ex.headPitch, lam, o.dt);
    B.hy = damp(B.hy, ex.headYaw, lam * 2, o.dt);
    B.hr = damp(B.hr, ex.headRoll, lam, o.dt);
    B.gx = damp(B.gx, ex.gazeX, lam, o.dt);
    B.gy = damp(B.gy, ex.gazeY, lam, o.dt);

    // coluna: distribui giro/inclinação entre as vértebras disponíveis
    const spine = (['Spine', 'Spine1', 'Spine2'] as BoneKey[]).map((k) => this.bones[k]).filter(Boolean) as THREE.Object3D[];
    spine.forEach((b) => {
      this._e.set(B.lean / spine.length, B.yaw / spine.length, 0, 'YXZ');
      b.quaternion.copy(this.spineBind.get(b)!).multiply(this._q.setFromEuler(this._e));
    });
    const head = this.bones.Head;
    if (head) {
      this._e.set(B.hp + 0.03, B.hy, B.hr, 'YXZ');
      head.quaternion.copy(this.spineBind.get(head)!).multiply(this._q.setFromEuler(this._e));
    }
    // referencial do corpo acompanha o giro do tronco (para os alvos das mãos)
    this.bodyFrame.position.set(0, 1.0, 0);
    this.bodyFrame.rotation.set(B.lean, B.yaw, 0, 'YXZ');
    this.object.updateMatrixWorld(true);

    for (const side of ['R', 'L'] as const) {
      const arm = this.arms[side];
      if (!arm) continue;
      const hp: HandPose = side === 'R' ? pose.right : pose.left;
      let sm = this.smoothHands[side];
      toBody(hp.pos, side, this._target);
      toBody(hp.fingers, side, this._f);
      toBody(hp.palm, side, this._p);
      if (!sm || o.snap) {
        sm = { pos: this._target.clone(), fingers: this._f.clone(), palm: this._p.clone(), shape: [...hp.shape] };
        this.smoothHands[side] = sm;
      } else {
        const k = 1 - Math.exp(-22 * o.dt);
        sm.pos.lerp(this._target, k);
        sm.fingers.lerp(this._f, k).normalize();
        sm.palm.lerp(this._p, k).normalize();
        sm.shape = sm.shape.map((v, i) => v + (hp.shape[i] - v) * k);
      }
      arm.upper.quaternion.copy(arm.bindLocal[0]);
      arm.fore.quaternion.copy(arm.bindLocal[1]);
      arm.hand.quaternion.copy(arm.bindLocal[2]);
      this.object.updateMatrixWorld(true);
      // alvos em coordenadas do mundo
      const wristBody = sm.pos.clone().addScaledVector(sm.fingers, -0.05);
      const wristW = this.bodyFrame.localToWorld(wristBody.sub(new THREE.Vector3(0, 1.0, 0)));
      const basisBody = handBasis(sm.fingers, sm.palm);
      const frameQ = this.bodyFrame.getWorldQuaternion(new THREE.Quaternion());
      const handWorldQ = frameQ.multiply(basisBody).multiply(arm.handCorrection);
      arm.upper.getWorldPosition(this._sh);
      const poleW = this._pole.set(side === 'R' ? -0.55 : 0.55, -1, -0.5).applyQuaternion(this.bodyFrame.quaternion);
      solveTwoBone(this._sh, wristW, arm.a, arm.b, poleW, this._el);
      aimBone(arm.upper, arm.fore, this._el);
      arm.fore.updateWorldMatrix(true, true);
      aimBone(arm.fore, arm.hand, wristW);
      arm.hand.updateWorldMatrix(true, false);
      setWorldQuaternion(arm.hand, handWorldQ);
      // dedos
      const shape = sm.shape;
      arm.fingers.forEach((f, fi) => {
        const isThumb = fi === 4;
        const curls = isThumb ? [shape[16] * 0.6, shape[18] * 1.0, shape[19] * 1.3] : [shape[fi * 4] * 1.55, shape[fi * 4 + 1] * 1.75, shape[fi * 4 + 2] * 1.25];
        const spread = isThumb ? shape[17] * 0.8 : shape[fi * 4 + 3] * 0.2 * (side === 'R' ? 1 : -1);
        f.bones.forEach((b, j) => {
          b.quaternion.copy(f.bind[j]);
          b.quaternion.multiply(this._q.setFromAxisAngle(f.curlAxis[j], curls[j]));
          if (j === 0 && spread) b.quaternion.multiply(this._q.setFromAxisAngle(f.spreadAxis[j], spread));
        });
      });
    }

    // olhos
    for (const k of ['LeftEye', 'RightEye'] as BoneKey[]) {
      const eye = this.bones[k];
      if (!eye) continue;
      this._e.set(0.07 - B.gy * 0.25, B.gx * 0.35 - B.hy * 0.4, 0, 'YXZ');
      eye.quaternion.copy(this.spineBind.get(eye)!).multiply(this._q.setFromEuler(this._e));
    }

    // rosto (ARKit)
    const target: Record<string, number> = { ...ex.face };
    if (ex.mouthing > 0.01) target.jawOpen = Math.max(target.jawOpen ?? 0, ex.mouthing * (0.14 + 0.1 * Math.sin(o.clock * 15)));
    if (o.clock > this.nextBlink && this.blinkT < 0) {
      this.blinkT = 0;
      this.nextBlink = o.clock + 2.4 + Math.random() * 3.2;
    }
    let blink = ex.blink;
    if (this.blinkT >= 0) {
      this.blinkT += o.dt;
      blink = Math.max(blink, Math.sin(Math.min(1, this.blinkT / 0.16) * Math.PI));
      if (this.blinkT > 0.16) this.blinkT = -1;
    }
    target.eyeBlinkLeft = Math.max(target.eyeBlinkLeft ?? 0, blink);
    target.eyeBlinkRight = Math.max(target.eyeBlinkRight ?? 0, blink);
    for (const name of new Set([...Object.keys(this.face), ...Object.keys(target)])) {
      this.face[name] = o.snap ? target[name] ?? 0 : damp(this.face[name] ?? 0, target[name] ?? 0, 14, o.dt);
    }
    for (const mesh of this.morphMeshes) {
      const dict = mesh.morphTargetDictionary!;
      const infl = mesh.morphTargetInfluences!;
      for (const [name, v] of Object.entries(this.face)) {
        const idx = dict[this.morphAliases[name] ?? name];
        if (idx !== undefined) infl[idx] = v;
      }
    }
  }

  framingPoints(out: THREE.Vector3[]) {
    this.object.updateMatrixWorld(true);
    out.length = 0;
    const head = this.bones.Head;
    if (head) out.push(head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.14, 0)));
    for (const s of ['R', 'L'] as const) {
      const a = this.arms[s];
      if (!a) continue;
      const p = a.hand.getWorldPosition(new THREE.Vector3());
      out.push(p.clone().add(new THREE.Vector3(0, 0.2, 0)), p.clone().add(new THREE.Vector3(0.1, 0, 0)), p.clone().add(new THREE.Vector3(-0.1, 0, 0)), p);
    }
  }

  /**
   * TODO: FUTURE MOTION CAPTURE INTEGRATION
   * Tocar um AnimationClip de mocap (do próprio GLB ou de um banco de sinais)
   * via THREE.AnimationMixer, sincronizado por video.currentTime
   * (mixer.setTime(t - clipStart)), em vez do IK procedural.
   */
  playClip(_clip: THREE.AnimationClip, _t: number) {
    void _clip;
    void _t;
  }

  dispose() {
    this.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mt) => mt?.dispose());
      }
    });
  }
}
