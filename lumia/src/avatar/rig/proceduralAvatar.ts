/**
 * AVATAR DE REFERÊNCIA (procedural)
 *
 * Por que existe: o briefing pede um humano 3D realista e proíbe trocá-lo por
 * um boneco cartunesco. Um humano fotorrealista exige um asset profissional
 * (escaneamento/modelagem + rig facial + mãos detalhadas) — isso não se gera
 * com código. Este avatar é a "figura de estúdio" usada enquanto o modelo real
 * não é instalado: proporções humanas, cabeça esculpida com blend shapes no
 * padrão ARKit, olhos com pálpebras e íris, mãos com 15 falanges cada, roupa
 * escura de intérprete (contraste das mãos) e iluminação cinematográfica.
 *
 * Para usar um avatar realista: coloque o arquivo em /public/models/avatar.glb
 * e ative /public/models/avatar.config.json (ver /public/models/README.md).
 * O mesmo AvatarPose dirige os dois rigs.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { AvatarPose, HandPose } from '../animationEngine';
import type { AvatarRig, RigApplyOptions } from './types';
import { damp, handBasis, placeSegment, solveTwoBone, toBody, type Side } from './math';
import { hairTexture, irisTexture, knitTexture, noiseTexture } from './textures';

// ---------------------------------------------------------------------------
// Medidas (metros)
// ---------------------------------------------------------------------------
const TORSO_Y = 1.0;
const SHOULDER = new THREE.Vector3(0.19, 0.415, -0.005); // relativo ao tronco (lado esquerdo do avatar = +X)
const UPPER = 0.285;
const FORE = 0.255;
const HEAD_PIVOT = new THREE.Vector3(0, 0.535, -0.005);
const HEAD_OFFSET = new THREE.Vector3(0, 0.066, 0.008);
const HX = 0.077;
const HY = 0.112;
const HZ = 0.098;

const sstep = (e0: number, e1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = (d2: number) => Math.exp(-d2);

// ---------------------------------------------------------------------------
// Escultura da cabeça (direção unitária → ponto em metros)
// ---------------------------------------------------------------------------
function sculpt(ux: number, uy: number, uz: number, out = new THREE.Vector3()) {
  let X = ux * HX;
  let Y = uy * HY;
  let Z = uz * HZ;
  const jt = sstep(-0.05, -0.95, uy);
  X *= 1 - 0.25 * jt;
  Z *= uz > 0 ? 1 - 0.1 * jt : 1 - 0.38 * jt;
  if (uz < 0) Z *= 1.06;
  if (uz > 0) Z *= 0.94;
  const front = sstep(0.35, 0.92, uz);
  const ax = Math.abs(ux);
  // testa levemente inclinada
  if (uy > 0.35 && uz > 0) Z -= 0.008 * (uy - 0.35) * uz;
  // nariz: ponte → ponta → columela
  const noseY = uy > -0.2 ? sstep(0.16, -0.2, uy) : 1 - sstep(-0.2, -0.33, uy);
  Z += 0.021 * noseY * noseY * gauss((ux / 0.09) ** 2) * front;
  // asas do nariz
  Z += 0.005 * gauss(((ax - 0.12) / 0.07) ** 2 + ((uy + 0.27) / 0.06) ** 2) * front;
  // órbitas
  Z -= 0.009 * gauss(((ax - 0.42) / 0.16) ** 2 + ((uy - 0.13) / 0.12) ** 2) * front;
  // arco das sobrancelhas
  Z += 0.005 * gauss(((uy - 0.29) / 0.07) ** 2) * (ax < 0.68 ? 1 : 0.3) * front;
  // maçãs do rosto
  Z += 0.005 * gauss(((ax - 0.52) / 0.17) ** 2 + ((uy + 0.12) / 0.14) ** 2) * front;
  X += Math.sign(ux) * 0.003 * gauss(((ax - 0.75) / 0.15) ** 2 + ((uy + 0.08) / 0.15) ** 2) * sstep(0, 0.5, uz);
  // lábios
  Z += 0.0055 * gauss((ux / 0.3) ** 4 + ((uy + 0.43) / 0.045) ** 2) * front;
  Z += 0.006 * gauss((ux / 0.27) ** 4 + ((uy + 0.535) / 0.05) ** 2) * front;
  // queixo
  Z += 0.006 * gauss((ux / 0.25) ** 2 + ((uy + 0.8) / 0.1) ** 2) * front;
  // sulco entre lábio e queixo
  Z -= 0.002 * gauss((ux / 0.25) ** 2 + ((uy + 0.64) / 0.04) ** 2) * front;
  return out.set(X, Y, Z);
}

function surfaceNormal(p: THREE.Vector3) {
  return new THREE.Vector3(p.x / (HX * HX), p.y / (HY * HY), p.z / (HZ * HZ)).normalize();
}

// ---------------------------------------------------------------------------
// Blend shapes (padrão ARKit) — deslocamentos por vértice
// ---------------------------------------------------------------------------
const MOUTH_UY = -0.475;
const CORNER_UX = 0.34;
const JAW_HINGE = new THREE.Vector3(0, -0.012, -0.03);
const JAW_ANGLE = 0.3;

type DeltaFn = (ux: number, uy: number, uz: number, p: THREE.Vector3, lower: boolean, out: THREE.Vector3) => void;

const side = (name: string): 1 | -1 => (name.endsWith('Left') ? 1 : -1);

function cornerWeight(ux: number, uy: number, uz: number, s: number, rx = 0.17, ry = 0.13) {
  return gauss(((ux - s * CORNER_UX) / rx) ** 2 + ((uy - MOUTH_UY) / ry) ** 2) * sstep(0.2, 0.7, uz);
}
function lipRegion(ux: number, uy: number, uz: number) {
  return gauss((ux / 0.42) ** 4 + ((uy - MOUTH_UY) / 0.12) ** 2) * sstep(0.3, 0.8, uz);
}
const _r = new THREE.Vector3();
const _q = new THREE.Quaternion();
const X_AXIS = new THREE.Vector3(1, 0, 0);

const FACE_SHAPES: Record<string, DeltaFn> = {
  jawOpen: (_ux, _uy, uz, p, lower, o) => {
    if (!lower) {
      o.set(0, 0, 0);
      return;
    }
    const w = sstep(-0.35, 0.25, uz);
    _q.setFromAxisAngle(X_AXIS, JAW_ANGLE);
    _r.copy(p).sub(JAW_HINGE).applyQuaternion(_q).add(JAW_HINGE).sub(p);
    o.copy(_r).multiplyScalar(w);
  },
  jawForward: (_ux, _uy, uz, _p, lower, o) => o.set(0, 0, lower ? 0.004 * sstep(-0.2, 0.4, uz) : 0),
  mouthClose: (ux, uy, uz, _p, lower, o) => o.set(0, lower ? 0.001 * lipRegion(ux, uy, uz) : -0.0008 * lipRegion(ux, uy, uz), 0),
};
for (const nm of ['Left', 'Right']) {
  const s = nm === 'Left' ? 1 : -1;
  FACE_SHAPES[`mouthSmile${nm}`] = (ux, uy, uz, _p, _l, o) => {
    const w = cornerWeight(ux, uy, uz, s);
    const ck = gauss(((ux - s * 0.45) / 0.18) ** 2 + ((uy + 0.22) / 0.14) ** 2) * sstep(0.2, 0.7, uz);
    o.set(s * 0.0042 * w, 0.0048 * w + 0.0022 * ck, -0.0018 * w + 0.0012 * ck);
  };
  FACE_SHAPES[`mouthFrown${nm}`] = (ux, uy, uz, _p, _l, o) => {
    const w = cornerWeight(ux, uy, uz, s);
    o.set(s * 0.001 * w, -0.0042 * w, 0);
  };
  FACE_SHAPES[`mouthStretch${nm}`] = (ux, uy, uz, _p, _l, o) => {
    const w = cornerWeight(ux, uy, uz, s, 0.24, 0.17);
    o.set(s * 0.0045 * w, -0.0022 * w, -0.0012 * w);
  };
  FACE_SHAPES[`mouthPress${nm}`] = (ux, uy, uz, _p, lower, o) => {
    const w = lipRegion(ux, uy, uz) * sstep(-0.1, 0.3, s * ux);
    o.set(0, lower ? 0.0008 * w : -0.0006 * w, -0.0012 * w);
  };
  FACE_SHAPES[`cheekSquint${nm}`] = (ux, uy, uz, _p, _l, o) => {
    const w = gauss(((ux - s * 0.45) / 0.16) ** 2 + ((uy + 0.02) / 0.1) ** 2) * sstep(0.2, 0.7, uz);
    o.set(0, 0.0026 * w, 0.0008 * w);
  };
  FACE_SHAPES[`eyeSquint${nm}`] = (ux, uy, uz, _p, _l, o) => {
    const w = gauss(((ux - s * 0.42) / 0.14) ** 2 + ((uy + 0.0) / 0.06) ** 2) * sstep(0.3, 0.8, uz);
    o.set(0, 0.0016 * w, 0.0005 * w);
  };
  FACE_SHAPES[`noseSneer${nm}`] = (ux, uy, uz, _p, _l, o) => {
    const w = gauss(((ux - s * 0.12) / 0.08) ** 2 + ((uy + 0.18) / 0.1) ** 2) * sstep(0.5, 0.9, uz);
    o.set(0, 0.0022 * w, 0);
  };
  FACE_SHAPES[`browDown${nm}`] = (ux, uy, uz, _p, _l, o) => {
    const w = gauss(((ux - s * 0.4) / 0.24) ** 2 + ((uy - 0.33) / 0.11) ** 2) * sstep(0.2, 0.7, uz);
    o.set(-s * 0.0018 * w, -0.0042 * w, 0.0012 * w);
  };
  FACE_SHAPES[`browOuterUp${nm}`] = (ux, uy, uz, _p, _l, o) => {
    const w = gauss(((ux - s * 0.66) / 0.17) ** 2 + ((uy - 0.33) / 0.14) ** 2) * sstep(0.1, 0.6, uz);
    o.set(0, 0.0045 * w, 0);
  };
}
FACE_SHAPES.browInnerUp = (ux, uy, uz, _p, _l, o) => {
  const w = gauss((ux / 0.3) ** 2 + ((uy - 0.36) / 0.14) ** 2) * sstep(0.3, 0.8, uz);
  o.set(0, 0.005 * w, 0);
};
FACE_SHAPES.mouthPucker = (ux, uy, uz, p, _l, o) => {
  const w = lipRegion(ux, uy, uz);
  o.set(-p.x * 0.3 * w, 0, 0.0045 * w);
};
FACE_SHAPES.mouthFunnel = (ux, uy, uz, p, lower, o) => {
  const w = lipRegion(ux, uy, uz);
  o.set(-p.x * 0.22 * w, (lower ? -0.0022 : 0.0012) * w, 0.0035 * w);
};
FACE_SHAPES.cheekPuff = (ux, uy, uz, _p, _l, o) => {
  const w = gauss(((Math.abs(ux) - 0.55) / 0.18) ** 2 + ((uy + 0.4) / 0.18) ** 2) * sstep(0.0, 0.6, uz);
  o.set(Math.sign(ux) * 0.005 * w, 0, 0.002 * w);
};
void side;

// ---------------------------------------------------------------------------
// Construção da geometria da cabeça
// ---------------------------------------------------------------------------
const SEG_W = 104;
const SEG_H = 84;

function unitDir(iy: number, ix: number) {
  const phi = (iy / SEG_H) * Math.PI;
  const th = (ix / SEG_W) * Math.PI * 2;
  return [Math.sin(phi) * Math.sin(th), Math.cos(phi), Math.sin(phi) * Math.cos(th)] as const;
}

function buildHeadGeometry() {
  // linha da boca: a fileira mais próxima de MOUTH_UY
  let iyM = 0;
  let best = 9;
  for (let iy = 0; iy <= SEG_H; iy++) {
    const y = Math.cos((iy / SEG_H) * Math.PI);
    if (Math.abs(y - MOUTH_UY) < best) {
      best = Math.abs(y - MOUTH_UY);
      iyM = y > MOUTH_UY ? iy : iy - 1;
    }
  }
  const yA = Math.cos((iyM / SEG_H) * Math.PI);
  const yB = Math.cos(((iyM + 1) / SEG_H) * Math.PI);
  const gapM = (yA - yB) * HY;

  const n = (SEG_H + 1) * (SEG_W + 1);
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 3);
  const units: Array<[number, number, number, boolean]> = [];
  const p = new THREE.Vector3();
  const lipCol = new THREE.Color(0.74, 0.47, 0.46);
  const c = new THREE.Color();
  for (let iy = 0; iy <= SEG_H; iy++) {
    for (let ix = 0; ix <= SEG_W; ix++) {
      const i = iy * (SEG_W + 1) + ix;
      const [ux, uy, uz] = unitDir(iy, ix);
      sculpt(ux, uy, uz, p);
      const lower = iy > iyM;
      // fecha a boca em repouso: as duas fileiras da fenda se encontram
      const mouthW = sstep(CORNER_UX + 0.06, CORNER_UX - 0.04, Math.abs(ux)) * sstep(0.4, 0.8, uz);
      if (iy === iyM) p.y -= gapM * 0.47 * mouthW;
      if (iy === iyM + 1) p.y += gapM * 0.47 * mouthW;
      pos.set([p.x, p.y, p.z], i * 3);
      uv.set([ix / SEG_W, 1 - iy / SEG_H], i * 2);
      units.push([ux, uy, uz, lower]);
      // cor: lábios, bochechas, olheiras
      const lip = gauss((ux / 0.36) ** 6 + ((uy - MOUTH_UY) / 0.085) ** 2) * sstep(0.45, 0.85, uz);
      const cheek = gauss(((Math.abs(ux) - 0.5) / 0.2) ** 2 + ((uy + 0.18) / 0.18) ** 2) * sstep(0.2, 0.7, uz);
      const under = gauss(((Math.abs(ux) - 0.4) / 0.14) ** 2 + ((uy + 0.0) / 0.06) ** 2) * sstep(0.3, 0.8, uz);
      c.setRGB(1, 1, 1).lerp(lipCol, lip * 0.95);
      c.r *= 1 - 0.02 * cheek;
      c.g *= 1 - 0.07 * cheek;
      c.b *= 1 - 0.06 * cheek;
      c.multiplyScalar(1 - 0.07 * under);
      col.set([c.r, c.g, c.b], i * 3);
    }
  }
  const index: number[] = [];
  for (let iy = 0; iy < SEG_H; iy++) {
    for (let ix = 0; ix < SEG_W; ix++) {
      const a = iy * (SEG_W + 1) + ix;
      const b = (iy + 1) * (SEG_W + 1) + ix;
      const cc = b + 1;
      const d = a + 1;
      if (iy === iyM) {
        const [ux, , uz] = unitDir(iy, ix + 0.5);
        if (Math.abs(ux) < CORNER_UX && uz > 0.5) continue; // fenda labial
      }
      index.push(a, b, d, b, cc, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  ensureOutwardWinding(g);

  // morph targets (relativos)
  const names = Object.keys(FACE_SHAPES);
  const morphs: THREE.BufferAttribute[] = [];
  const o = new THREE.Vector3();
  for (const name of names) {
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [ux, uy, uz, lower] = units[i];
      p.fromArray(pos, i * 3);
      FACE_SHAPES[name](ux, uy, uz, p, lower, o);
      arr[i * 3] = o.x;
      arr[i * 3 + 1] = o.y;
      arr[i * 3 + 2] = o.z;
    }
    const attr = new THREE.BufferAttribute(arr, 3);
    attr.name = name;
    morphs.push(attr);
  }
  g.morphAttributes.position = morphs;
  g.morphTargetsRelative = true;
  const mouth = sculpt(0, MOUTH_UY, Math.sqrt(1 - MOUTH_UY * MOUTH_UY));
  return { geometry: g, names, mouth };
}

function ensureOutwardWinding(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  let score = 0;
  const p = new THREE.Vector3();
  const nn = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 37) {
    p.fromBufferAttribute(pos, i);
    nn.fromBufferAttribute(nor, i);
    score += Math.sign(p.dot(nn));
  }
  if (score < 0) {
    const idx = g.getIndex()!;
    const arr = idx.array as unknown as number[];
    for (let i = 0; i < arr.length; i += 3) {
      const t = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = t;
    }
    idx.needsUpdate = true;
    g.computeVertexNormals();
  }
}

function buildHairGeometry() {
  const W = 72;
  const Hh = 56;
  const pos: number[] = [];
  const uv: number[] = [];
  const p = new THREE.Vector3();
  for (let iy = 0; iy <= Hh; iy++) {
    for (let ix = 0; ix <= W; ix++) {
      const phi = (iy / Hh) * Math.PI;
      const th = (ix / W) * Math.PI * 2;
      const ux = Math.sin(phi) * Math.sin(th);
      const uy = Math.cos(phi);
      const uz = Math.sin(phi) * Math.cos(th);
      sculpt(ux, uy, uz, p);
      // linha do cabelo: alta na testa, desce pelas têmporas, nuca baixa
      const ax = Math.abs(ux);
      const front = uz > 0 ? 0.74 - 0.5 * ax * ax : 0.6;
      const temple = ax > 0.7 ? THREE.MathUtils.lerp(front, 0.02, sstep(0.7, 0.95, ax)) : front;
      const line = uz < 0 ? THREE.MathUtils.lerp(temple, -0.6, sstep(0, -0.6, uz)) : temple;
      const m = sstep(line - 0.06, line + 0.05, uy);
      const thick = (0.026 + 0.03 * sstep(0.5, 1, uy) + 0.022 * sstep(0, -0.8, uz)) * m * m * m;
      p.multiplyScalar(m > 0.02 ? 1.004 + thick : 0.975);
      // volume pentado para trás
      if (uz < 0) p.z -= 0.006 * m;
      pos.push(p.x, p.y, p.z);
      uv.push(ix / W, 1 - iy / Hh);
    }
  }
  const index: number[] = [];
  for (let iy = 0; iy < Hh; iy++) {
    for (let ix = 0; ix < W; ix++) {
      const a = iy * (W + 1) + ix;
      const b = (iy + 1) * (W + 1) + ix;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  ensureOutwardWinding(g);
  return g;
}

/** Sobrancelha como fita com volume, presa à superfície, com os mesmos blend shapes. */
function buildBrowGeometry(s: 1 | -1, morphNames: string[]) {
  const N = 18;
  const rows = [-1, 0, 1];
  const basePts: Array<[number, number, number]> = [];
  const ctrl = [
    [0.13, 0.31],
    [0.3, 0.37],
    [0.47, 0.385],
    [0.62, 0.35],
    [0.72, 0.29],
  ];
  const curve = new THREE.SplineCurve(ctrl.map(([x, y]) => new THREE.Vector2(x, y)));
  const positions: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const pt = curve.getPoint(t);
    const width = THREE.MathUtils.lerp(0.05, 0.018, t) * (1 - 0.5 * Math.max(0, t - 0.85) / 0.15);
    for (const r of rows) {
      const ux = s * pt.x;
      const uy = pt.y + r * width * 0.5 - 0.004;
      const uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));
      sculpt(ux, uy, uz, p);
      const nrm = surfaceNormal(p);
      p.addScaledVector(nrm, r === 0 ? 0.0016 : 0.0006);
      positions.push(p.x, p.y, p.z);
      basePts.push([ux, uy, uz]);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < N - 1; i++) {
    for (let r = 0; r < rows.length - 1; r++) {
      const a = i * rows.length + r;
      const b = (i + 1) * rows.length + r;
      if (s > 0) index.push(a, b, a + 1, b, b + 1, a + 1);
      else index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  const morphs: THREE.BufferAttribute[] = [];
  const o = new THREE.Vector3();
  for (const name of morphNames) {
    const arr = new Float32Array(positions.length);
    basePts.forEach(([ux, uy, uz], i) => {
      p.fromArray(positions, i * 3);
      FACE_SHAPES[name](ux, uy, uz, p, false, o);
      arr.set([o.x, o.y, o.z], i * 3);
    });
    const attr = new THREE.BufferAttribute(arr, 3);
    attr.name = name;
    morphs.push(attr);
  }
  g.morphAttributes.position = morphs;
  g.morphTargetsRelative = true;
  return g;
}

// ---------------------------------------------------------------------------
// Mão: palma + 5 dedos (3 falanges cada) + unhas
// ---------------------------------------------------------------------------
interface FingerDef {
  base: THREE.Vector3;
  lengths: [number, number, number];
  radius: number;
}

class Hand {
  group = new THREE.Group();
  private fingers: { def: FingerDef; segs: THREE.Mesh[] }[] = [];
  private thumb: THREE.Mesh[] = [];
  private s: number;

  constructor(private sideKey: Side, skin: THREE.Material, nail: THREE.Material) {
    this.s = sideKey === 'R' ? 1 : -1;
    const s = this.s;
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.092, 0.026, 3, 0.011), skin);
    palm.position.set(0, 0.05, 0);
    this.group.add(palm);
    // eminências tênar e hipotênar dão forma orgânica à palma
    const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.019, 20, 14), skin);
    thenar.scale.set(1, 1.5, 0.75);
    thenar.position.set(s * 0.021, 0.03, 0.007);
    const hypo = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 14), skin);
    hypo.scale.set(1, 1.9, 0.7);
    hypo.position.set(-s * 0.026, 0.04, 0.006);
    const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.0235, 0.035, 6, 16), skin);
    wrist.scale.set(1.15, 1, 0.8);
    wrist.position.set(0, -0.012, 0);
    this.group.add(thenar, hypo, wrist);
    const defs: FingerDef[] = [
      { base: new THREE.Vector3(s * 0.028, 0.094, 0), lengths: [0.041, 0.025, 0.019], radius: 0.0088 },
      { base: new THREE.Vector3(s * 0.0095, 0.097, 0), lengths: [0.045, 0.029, 0.021], radius: 0.0091 },
      { base: new THREE.Vector3(-s * 0.0095, 0.094, 0), lengths: [0.042, 0.027, 0.02], radius: 0.0086 },
      { base: new THREE.Vector3(-s * 0.027, 0.087, 0), lengths: [0.033, 0.02, 0.017], radius: 0.0076 },
    ];
    for (const def of defs) {
      const segs = def.lengths.map((len, j) => {
        const r = def.radius * (1 - j * 0.09);
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 0.6), 6, 14), skin);
        if (j === 2) {
          const nm = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), nail);
          nm.scale.set(r * 0.82, len * 0.36, r * 0.32);
          nm.position.set(0, len * 0.16, -r * 0.82);
          m.add(nm);
        }
        this.group.add(m);
        return m;
      });
      this.fingers.push({ def, segs });
    }
    this.thumb = [0.044, 0.031, 0.027].map((len, j) => {
      const r = 0.0112 - j * 0.0012;
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - r * 0.5, 6, 14), skin);
      if (j === 2) {
        const nm = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), nail);
        nm.scale.set(r * 0.85, len * 0.36, r * 0.3);
        nm.position.set(0, len * 0.14, -r * 0.82);
        m.add(nm);
      }
      this.group.add(m);
      return m;
    });
    void this.sideKey;
  }

  private _a = new THREE.Vector3();
  private _b = new THREE.Vector3();
  private _dir = new THREE.Vector3();
  private _axis = new THREE.Vector3();
  private _q = new THREE.Quaternion();

  /** shape: vetor de 20 valores (ver signEngine.HANDSHAPES). */
  setShape(shape: number[]) {
    const s = this.s;
    this.fingers.forEach(({ def, segs }, f) => {
      const [mcp, pip, dip, spread] = shape.slice(f * 4, f * 4 + 4);
      this._dir.set(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), spread * 0.2 * s);
      this._axis.set(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), spread * 0.2 * s);
      this._a.copy(def.base);
      const angles = [mcp * 1.55, pip * 1.75, dip * 1.25];
      segs.forEach((m, j) => {
        this._q.setFromAxisAngle(this._axis, angles[j]);
        this._dir.applyQuaternion(this._q);
        this._b.copy(this._a).addScaledVector(this._dir, def.lengths[j]);
        placeSegment(m, this._a, this._b);
        this._a.copy(this._b);
      });
    });
    // polegar: direção do metacarpo interpolada entre aduzido, abduzido e oposto
    const [flex, abd, mcpT, ipT] = shape.slice(16, 20);
    const d0 = new THREE.Vector3(s * 0.32, 1, 0.12).normalize();
    const d1 = new THREE.Vector3(s * 1, 0.35, 0.18).normalize();
    const d2 = new THREE.Vector3(-s * 0.3, 0.75, 0.95).normalize();
    this._dir.copy(d0).addScaledVector(d1.sub(d0), abd).addScaledVector(d2.sub(d0), flex).normalize();
    const toward = new THREE.Vector3(-s * 0.7, 0.35, 0.8).normalize();
    this._axis.crossVectors(this._dir, toward).normalize();
    this._a.set(s * 0.028, 0.018, 0.009);
    const angles = [0, mcpT * 1.0, ipT * 1.3];
    this.thumb.forEach((m, j) => {
      if (angles[j]) {
        this._q.setFromAxisAngle(this._axis, angles[j]);
        this._dir.applyQuaternion(this._q);
      }
      const len = [0.044, 0.031, 0.027][j];
      this._b.copy(this._a).addScaledVector(this._dir, len);
      placeSegment(m, this._a, this._b);
      this._a.copy(this._b);
    });
  }
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
interface SmoothedHand {
  pos: THREE.Vector3;
  fingers: THREE.Vector3;
  palm: THREE.Vector3;
  shape: number[];
}

export class ProceduralAvatar implements AvatarRig {
  kind = 'procedural' as const;
  object = new THREE.Group();
  private torso = new THREE.Group();
  private headPivot = new THREE.Group();
  private head = new THREE.Group();
  private faceMeshes: THREE.Mesh[] = [];
  private morphNames: string[];
  private eyes: { pivot: THREE.Group; upper: THREE.Group; lower: THREE.Group }[] = [];
  private lowerTeeth = new THREE.Group();
  private arms: Record<Side, { upper: THREE.Mesh; elbow: THREE.Mesh; fore: THREE.Mesh; cuff: THREE.Mesh; hand: Hand }>;
  private smooth: Record<Side, SmoothedHand>;
  private face: Record<string, number> = {};
  private body = { torsoYaw: 0, lean: 0, shrug: 0, headPitch: 0, headYaw: 0, headRoll: 0, gazeX: 0, gazeY: 0, mouthing: 0, blink: 0 };
  private nextBlink = 2;
  private blinkT = -1;
  private disposables: Array<{ dispose(): void }> = [];

  constructor() {
    const skinBump = noiseTexture(256, 1, 0.35);
    skinBump.repeat.set(6, 6);
    const skin = new THREE.MeshPhysicalMaterial({
      color: '#a6735a',
      roughness: 0.5,
      metalness: 0,
      sheen: 0.25,
      sheenColor: new THREE.Color('#d98a74'),
      sheenRoughness: 0.55,
      bumpMap: skinBump,
      bumpScale: 0.25,
    });
    const faceSkin = skin.clone();
    faceSkin.vertexColors = true;
    const knit = knitTexture();
    const cloth = new THREE.MeshPhysicalMaterial({ color: '#15171c', roughness: 0.86, sheen: 0.7, sheenColor: new THREE.Color('#3b4252'), sheenRoughness: 0.75, bumpMap: knit, bumpScale: 0.6 });
    const hairTex = hairTexture();
    const hair = new THREE.MeshPhysicalMaterial({ color: '#1a110c', roughness: 0.52, sheen: 1, sheenColor: new THREE.Color('#6b4a36'), sheenRoughness: 0.45, bumpMap: hairTex, bumpScale: 1.4, clearcoat: 0.15, clearcoatRoughness: 0.4 });
    const nail = new THREE.MeshPhysicalMaterial({ color: '#d6a594', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const eyeWhite = new THREE.MeshPhysicalMaterial({ color: '#bfb3aa', roughness: 0.42 });
    const iris = new THREE.MeshPhysicalMaterial({ map: irisTexture(), roughness: 0.4 });
    const cornea = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transparent: true, opacity: 0.12, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false });
    const brow = new THREE.MeshStandardMaterial({ color: '#2e1e15', roughness: 0.95, side: THREE.DoubleSide });
    const lash = new THREE.MeshStandardMaterial({ color: '#0d0907', roughness: 0.8 });
    const teeth = new THREE.MeshStandardMaterial({ color: '#e6ded0', roughness: 0.35 });
    const cavity = new THREE.MeshStandardMaterial({ color: '#2a0b0d', roughness: 0.8 });
    this.disposables.push(skin, faceSkin, cloth, hair, nail, eyeWhite, iris, cornea, brow, lash, teeth, cavity, skinBump, knit, hairTex);

    this.object.add(this.torso);
    this.torso.position.set(0, TORSO_Y, 0);

    // tronco
    const prof = [
      [0.15, -0.42], [0.16, -0.2], [0.16, -0.02], [0.151, 0.06], [0.158, 0.16], [0.171, 0.26], [0.178, 0.33], [0.174, 0.38], [0.158, 0.425], [0.118, 0.458], [0.074, 0.476], [0.056, 0.482],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const torsoMesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), cloth);
    torsoMesh.scale.set(1.12, 1, 0.64);
    this.torso.add(torsoMesh);
    for (const sx of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 18), cloth);
      sh.scale.set(1.05, 0.8, 0.95);
      sh.position.set(sx * 0.178, 0.404, -0.006);
      this.torso.add(sh);
    }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.008, 10, 40), cloth);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1.05, 0.88, 1);
    collar.position.set(0, 0.476, 0.004);
    this.torso.add(collar);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.056, 0.13, 28), skin);
    neck.position.set(0, 0.52, -0.004);
    this.torso.add(neck);

    // cabeça
    this.headPivot.position.copy(HEAD_PIVOT);
    this.torso.add(this.headPivot);
    this.head.position.copy(HEAD_OFFSET);
    this.headPivot.add(this.head);
    const { geometry, names, mouth } = buildHeadGeometry();
    this.morphNames = names;
    const headMesh = new THREE.Mesh(geometry, faceSkin);
    this.head.add(headMesh);
    this.faceMeshes.push(headMesh);

    // cavidade da boca e dentes
    const cav = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), cavity);
    cav.scale.set(0.018, 0.012, 0.014);
    cav.position.set(0, mouth.y - 0.005, mouth.z - 0.03);
    this.head.add(cav);
    const upperTeeth = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.007, 0.008, 2, 0.003), teeth);
    upperTeeth.position.set(0, mouth.y + 0.0035, mouth.z - 0.012);
    this.head.add(upperTeeth);
    this.lowerTeeth.position.copy(JAW_HINGE);
    const lt = new THREE.Mesh(new RoundedBoxGeometry(0.027, 0.006, 0.008, 2, 0.003), teeth);
    lt.position.set(0, mouth.y - 0.0045, mouth.z - 0.013).sub(JAW_HINGE);
    this.lowerTeeth.add(lt);
    this.head.add(this.lowerTeeth);

    // olhos
    for (const s of [1, -1] as const) {
      const ux = s * 0.42;
      const uy = 0.125;
      const surf = sculpt(ux, uy, Math.sqrt(1 - ux * ux - uy * uy));
      const R = 0.0121;
      const socket = new THREE.Group();
      socket.position.set(surf.x * 0.99, surf.y, surf.z - R + 0.0035);
      this.head.add(socket);
      const pivot = new THREE.Group();
      socket.add(pivot);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), eyeWhite);
      pivot.add(ball);
      const irisMesh = new THREE.Mesh(new THREE.CircleGeometry(R * 0.56, 32), iris);
      irisMesh.position.z = R * 1.004;
      pivot.add(irisMesh);
      const corneaMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 0.56, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.6), cornea);
      corneaMesh.rotation.x = Math.PI / 2;
      corneaMesh.position.z = R * 0.72;
      pivot.add(corneaMesh);
      // pálpebras
      const upper = new THREE.Group();
      const ul = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 32, 16, 0, Math.PI * 2, 0, 1.0), skin);
      upper.add(ul);
      const lashMesh = new THREE.Mesh(new THREE.TorusGeometry(R * 1.07 * Math.sin(1.0), 0.00055, 6, 32, Math.PI * 0.95), lash);
      lashMesh.position.y = R * 1.07 * Math.cos(1.0);
      lashMesh.rotation.x = Math.PI / 2;
      lashMesh.rotation.z = Math.PI * 0.025;
      upper.add(lashMesh);
      const lower = new THREE.Group();
      const ll = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 32, 12, 0, Math.PI * 2, Math.PI - 1.06, 1.06), skin);
      lower.add(ll);
      socket.add(upper, lower);
      this.eyes.push({ pivot, upper, lower });
    }

    // sobrancelhas (com os mesmos blend shapes da pele)
    const browNames = names.filter((n) => n.startsWith('brow'));
    for (const s of [1, -1] as const) {
      const bm = new THREE.Mesh(buildBrowGeometry(s, browNames), brow);
      this.head.add(bm);
      this.faceMeshes.push(bm);
    }

    // orelhas
    for (const s of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), skin);
      ear.scale.set(0.0095, 0.029, 0.018);
      ear.position.set(s * HX * 0.97, -0.004, -0.01);
      ear.rotation.y = s * 0.35;
      this.head.add(ear);
      const helix = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0032, 8, 24, Math.PI * 1.3), skin);
      helix.scale.set(1, 1.7, 1);
      helix.position.set(s * (HX * 0.97 + 0.004), 0.002, -0.012);
      helix.rotation.set(0, s * (Math.PI / 2 - 0.35), Math.PI * 0.35);
      this.head.add(helix);
    }

    // cabelo preso (coque)
    const hairMesh = new THREE.Mesh(buildHairGeometry(), hair);
    this.head.add(hairMesh);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.036, 28, 20), hair);
    bun.scale.set(1.15, 0.95, 0.85);
    bun.position.set(0, 0.012, -0.118);
    this.head.add(bun);

    // braços e mãos
    const mkArm = (sideKey: Side) => {
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.043, UPPER - 0.06, 8, 20), cloth);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.041, 20, 16), cloth);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, FORE - 0.07, 8, 20), cloth);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.034, 0.03, 20), cloth);
      const hand = new Hand(sideKey, skin, nail);
      this.torso.add(upper, elbow, fore, cuff, hand.group);
      return { upper, elbow, fore, cuff, hand };
    };
    this.arms = { R: mkArm('R'), L: mkArm('L') };

    this.object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.frustumCulled = false;
        const g = (o as THREE.Mesh).geometry;
        if (g) this.disposables.push(g);
      }
    });
    const init = (): SmoothedHand => ({ pos: new THREE.Vector3(), fingers: new THREE.Vector3(0, 1, 0), palm: new THREE.Vector3(0, 0, 1), shape: new Array(20).fill(0) });
    this.smooth = { R: init(), L: init() };
    this.first = true;
  }

  private first: boolean;
  private _t = new THREE.Vector3();
  private _f = new THREE.Vector3();
  private _p = new THREE.Vector3();
  private _sh = new THREE.Vector3();
  private _wr = new THREE.Vector3();
  private _el = new THREE.Vector3();
  private _pole = new THREE.Vector3();
  private _hq = new THREE.Quaternion();
  private _cuffEnd = new THREE.Vector3();

  apply(pose: AvatarPose, o: RigApplyOptions) {
    const snap = o.snap || this.first;
    this.first = false;
    const k = snap ? 1 : 1 - Math.exp(-22 * o.dt);
    const ex = pose.expression;

    // corpo / cabeça
    const breath = Math.sin(o.clock * ((Math.PI * 2) / 4.2));
    const micro = (a: number, f: number, ph: number) => a * Math.sin(o.clock * f + ph) * 0.6 + a * Math.sin(o.clock * f * 2.3 + ph * 1.7) * 0.4;
    const lam = snap ? 1e6 : 9;
    const B = this.body;
    B.torsoYaw = damp(B.torsoYaw, ex.torsoYaw, lam, o.dt);
    B.lean = damp(B.lean, ex.lean * (0.8 + 0.4 * o.expressiveness), lam, o.dt);
    B.shrug = damp(B.shrug, ex.shrug, lam, o.dt);
    B.headPitch = damp(B.headPitch, ex.headPitch, lam * 1.4, o.dt);
    B.headYaw = damp(B.headYaw, ex.headYaw, lam * 2, o.dt);
    B.headRoll = damp(B.headRoll, ex.headRoll, lam, o.dt);
    B.gazeX = damp(B.gazeX, ex.gazeX, lam * 1.6, o.dt);
    B.gazeY = damp(B.gazeY, ex.gazeY, lam * 1.6, o.dt);
    B.mouthing = damp(B.mouthing, ex.mouthing, 18, o.dt);

    this.torso.rotation.set(B.lean + breath * 0.004, B.torsoYaw + micro(0.008, 0.6, 1), micro(0.005, 0.5, 2), 'YXZ');
    this.torso.scale.set(1, 1 + breath * 0.0035, 1 + breath * 0.006);
    this.headPivot.rotation.set(B.headPitch + 0.03 + micro(0.012, 0.9, 0.3), B.headYaw + micro(0.015, 0.7, 2.1), B.headRoll + micro(0.01, 0.8, 4), 'YXZ');

    // rosto
    const targetFace: Record<string, number> = { ...ex.face };
    const m = B.mouthing;
    if (m > 0.01) {
      const ph = o.clock * 15;
      targetFace.jawOpen = Math.max(targetFace.jawOpen ?? 0, m * (0.14 + 0.1 * Math.sin(ph)));
      targetFace.mouthFunnel = Math.max(targetFace.mouthFunnel ?? 0, m * 0.25 * Math.max(0, Math.sin(ph * 0.7 + 1)));
      targetFace.mouthPucker = Math.max(targetFace.mouthPucker ?? 0, m * 0.2 * Math.max(0, Math.sin(ph * 0.45 + 2)));
    }
    for (const name of this.morphNames) {
      const cur = this.face[name] ?? 0;
      this.face[name] = snap ? targetFace[name] ?? 0 : damp(cur, targetFace[name] ?? 0, 14, o.dt);
    }
    for (const mesh of this.faceMeshes) {
      const dict = mesh.morphTargetDictionary!;
      const infl = mesh.morphTargetInfluences!;
      for (const name in dict) infl[dict[name]] = this.face[name] ?? 0;
    }
    this.lowerTeeth.rotation.x = (this.face.jawOpen ?? 0) * JAW_ANGLE;

    // piscadas naturais + piscada de fronteira prosódica
    if (o.clock > this.nextBlink && this.blinkT < 0) {
      this.blinkT = 0;
      this.nextBlink = o.clock + 2.4 + Math.random() * 3.2;
    }
    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += o.dt;
      blink = Math.sin(Math.min(1, this.blinkT / 0.16) * Math.PI);
      if (this.blinkT > 0.16) this.blinkT = -1;
    }
    blink = Math.max(blink, ex.blink);
    this.eyes.forEach((e, i) => {
      const nm = i === 0 ? 'Left' : 'Right';
      const wide = this.face[`eyeWide${nm}`] ?? ex.face[`eyeWide${nm}`] ?? 0;
      const squint = this.face[`eyeSquint${nm}`] ?? 0;
      const open = 0.38 - wide * 0.3 + squint * 0.16;
      e.upper.rotation.x = THREE.MathUtils.lerp(open, 0.86, blink);
      e.lower.rotation.x = -squint * 0.16 - wide * 0.03 + blink * 0.05;
      // olhar para a câmera (levemente abaixo) + desvio expressivo
      e.pivot.rotation.set(0.07 - B.gazeY * 0.25 + B.headPitch * 0.5, B.gazeX * 0.35 - B.headYaw * 0.4 + B.torsoYaw * -0.5, 0, 'YXZ');
    });
    // ombros encolhidos (medo)
    const shrugY = B.shrug * 0.025;

    // braços (IK) e mãos
    for (const sideKey of ['R', 'L'] as const) {
      const target: HandPose = sideKey === 'R' ? pose.right : pose.left;
      const S = this.smooth[sideKey];
      toBody(target.pos, sideKey, this._t);
      toBody(target.fingers, sideKey, this._f);
      toBody(target.palm, sideKey, this._p);
      if (snap) {
        S.pos.copy(this._t);
        S.fingers.copy(this._f);
        S.palm.copy(this._p);
        S.shape = [...target.shape];
      } else {
        S.pos.lerp(this._t, k);
        S.fingers.lerp(this._f, k).normalize();
        S.palm.lerp(this._p, k).normalize();
        S.shape = S.shape.map((v, i) => v + (target.shape[i] - v) * Math.min(1, k * 1.2));
      }
      const sx = sideKey === 'R' ? -1 : 1;
      const arm = this.arms[sideKey];
      this._sh.set(sx * SHOULDER.x, SHOULDER.y + shrugY, SHOULDER.z);
      handBasis(S.fingers, S.palm, this._hq);
      // punho = centro da palma − 5 cm na direção dos dedos (referencial do tronco)
      this._wr.set(S.pos.x, S.pos.y - TORSO_Y, S.pos.z).addScaledVector(S.fingers, -0.05);
      this._pole.set(sx * 0.55, -1, -0.5);
      solveTwoBone(this._sh, this._wr, UPPER, FORE, this._pole, this._el);
      placeSegment(arm.upper, this._sh, this._el);
      arm.elbow.position.copy(this._el);
      this._cuffEnd.copy(this._wr).sub(this._el).normalize();
      const foreEnd = this._wr.clone().addScaledVector(this._cuffEnd, -0.028);
      placeSegment(arm.fore, this._el, foreEnd);
      placeSegment(arm.cuff, foreEnd.clone().addScaledVector(this._cuffEnd, -0.006), this._wr.clone().addScaledVector(this._cuffEnd, -0.012));
      arm.hand.group.position.copy(this._wr);
      arm.hand.group.quaternion.copy(this._hq);
      arm.hand.setShape(S.shape);
    }
  }

  private _tmp = new THREE.Vector3();
  framingPoints(out: THREE.Vector3[]) {
    this.object.updateMatrixWorld(true);
    out.length = 0;
    out.push(this.head.localToWorld(this._tmp.set(0, HY + 0.02, 0)).clone());
    for (const s of ['R', 'L'] as const) {
      const h = this.arms[s].hand.group;
      for (const local of [
        [0, 0.2, 0],
        [0.06, 0.1, 0],
        [-0.06, 0.1, 0],
        [0, -0.03, 0],
      ] as const)
        out.push(h.localToWorld(this._tmp.set(local[0], local[1], local[2])).clone());
    }
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
