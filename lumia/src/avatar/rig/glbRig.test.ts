/**
 * Testa o rig GLB com um esqueleto sintético no padrão Mixamo (T-pose),
 * sem precisar de um arquivo .glb: o IK precisa levar o punho até o alvo e
 * a mão precisa ficar com a orientação pedida.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GlbRig, findBones } from './glbRig';
import { evaluatePose, REST_POSE, type AvatarPose } from '../animationEngine';
import { emptyExpression } from '../expressionEngine';
import { toBody } from './math';

function bone(name: string, parent: THREE.Object3D, x: number, y: number, z: number) {
  const b = new THREE.Bone();
  b.name = `mixamorig:${name}`;
  b.position.set(x, y, z);
  parent.add(b);
  return b;
}

function syntheticHumanoid() {
  const root = new THREE.Group();
  const hips = bone('Hips', root, 0, 1.0, 0);
  const spine = bone('Spine', hips, 0, 0.1, 0);
  const spine1 = bone('Spine1', spine, 0, 0.15, 0);
  const spine2 = bone('Spine2', spine1, 0, 0.15, 0);
  const neck = bone('Neck', spine2, 0, 0.1, 0);
  bone('Head', neck, 0, 0.1, 0);
  for (const [S, sx] of [['Left', 1], ['Right', -1]] as const) {
    const sh = bone(`${S}Shoulder`, spine2, sx * 0.05, 0.08, 0);
    const arm = bone(`${S}Arm`, sh, sx * 0.13, 0, 0);
    const fore = bone(`${S}ForeArm`, arm, sx * 0.28, 0, 0);
    const hand = bone(`${S}Hand`, fore, sx * 0.25, 0, 0);
    // T-pose, palma para baixo: indicador à frente (+Z), mínimo atrás
    const fingers = { Index: 0.03, Middle: 0.01, Ring: -0.01, Pinky: -0.03 };
    for (const [f, z] of Object.entries(fingers)) {
      const f1 = bone(`${S}Hand${f}1`, hand, sx * 0.09, 0, z);
      const f2 = bone(`${S}Hand${f}2`, f1, sx * 0.04, 0, 0);
      bone(`${S}Hand${f}3`, f2, sx * 0.025, 0, 0);
    }
    const t1 = bone(`${S}HandThumb1`, hand, sx * 0.02, -0.01, 0.03);
    const t2 = bone(`${S}HandThumb2`, t1, sx * 0.03, 0, 0.01);
    bone(`${S}HandThumb3`, t2, sx * 0.025, 0, 0.005);
  }
  // malha mínima para o bounding box ter altura de corpo inteiro
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.7, 0.2));
  m.position.y = 0.85;
  root.add(m);
  return root;
}

describe('GlbRig (avatar realista)', () => {
  it('encontra os ossos com nomes Mixamo', () => {
    const bones = findBones(syntheticHumanoid());
    for (const k of ['Head', 'RightArm', 'RightForeArm', 'RightHand', 'LeftHandIndex3', 'RightHandThumb1'] as const) expect(bones[k]).toBeDefined();
  });

  it('IK leva o punho ao alvo e orienta a mão', () => {
    const model = syntheticHumanoid();
    const rig = new GlbRig(model, { enabled: true, url: '' });
    expect(rig.report.bonesMissing).toEqual([]);
    const pose: AvatarPose = {
      right: { pos: [0.1, 1.25, 0.3], fingers: [0, 1, 0], palm: [0, 0, 1], shape: new Array(20).fill(0) },
      left: REST_POSE,
      expression: emptyExpression(),
      activeSign: null,
    };
    rig.apply(pose, { dt: 1 / 60, clock: 0, snap: true, expressiveness: 0.5 });
    rig.object.updateMatrixWorld(true);
    const hand = findBones(model).RightHand!;
    const got = hand.getWorldPosition(new THREE.Vector3());
    // alvo do punho = centro da palma − 5 cm na direção dos dedos (referencial do corpo)
    const want = toBody([0.1, 1.25 - 0.05, 0.3], 'R');
    expect(got.distanceTo(want)).toBeLessThan(0.02);
    // dedos apontando para cima: o osso do dedo médio deve estar acima do punho
    const mid = findBones(model).RightHandMiddle1!.getWorldPosition(new THREE.Vector3());
    expect(mid.y - got.y).toBeGreaterThan(0.06);
  });

  it('segue uma interpretação inteira sem NaN', () => {
    const model = syntheticHumanoid();
    const rig = new GlbRig(model, { enabled: true, url: '' });
    const tl = { contentId: 'x', language: 'pt-BR-LIBRAS' as const, segments: [], signs: [] };
    for (let t = 0; t < 2; t += 0.1) rig.apply(evaluatePose(tl, t, {}), { dt: 0.1, clock: t, snap: false, expressiveness: 0.5 });
    model.traverse((o) => expect(Number.isFinite(o.quaternion.x + o.quaternion.w)).toBe(true));
  });
});
