/**
 * SIGN ANIMATION ENGINE
 *
 * Entrada: LIBRAS REPRESENTATION já agendada (InterpretationTimeline).
 * Saída: AvatarPose — alvos das duas mãos (posição, orientação, configuração
 * de mão), tronco, cabeça, olhar e blend shapes faciais.
 *
 * evaluatePose(timeline, t) é uma FUNÇÃO PURA do tempo do vídeo:
 * mesma entrada, mesma pose. Isso garante sincronia em pausa, seek,
 * retrocesso e qualquer velocidade de reprodução.
 *
 * A pose é independente do avatar: o rig procedural e o rig GLB (modelo
 * realista em /public/models/avatar.glb) consomem exatamente o mesmo objeto.
 *
 * Preparado para futuras fontes de movimento:
 *   - motion capture / captura de intérpretes humanos → converter clipes para
 *     HandTrack (pos/orientação/handshape por quadro) ou tocar como AnimationClip
 *     no rig GLB (ver rig/glbRig.ts → playClip);
 *   - keyframes profissionais → mesmo formato de HandKeyframe;
 *   - modelos generativos de movimento → podem substituir evaluatePose
 *     mantendo a interface AvatarPose.
 */
import { ANCHORS, BODY_ANCHORS, HANDSHAPES, PASSIVE_TRACK, REST_TRACK, type HandTrack, type Vec3 } from './signEngine';
import { evaluateExpression, type ExpressionState } from './expressionEngine';
import { signIndexAt, type InterpretationTimeline, type ScheduledSign } from './timelineEngine';

export interface HandPose {
  pos: Vec3; // centro da palma, referencial ipsilateral do sinalizador
  fingers: Vec3;
  palm: Vec3;
  shape: number[];
}

export interface AvatarPose {
  right: HandPose;
  left: HandPose;
  expression: ExpressionState;
  activeSign: ScheduledSign | null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};
const v3lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const v3norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const nlerp = (a: Vec3, b: Vec3, t: number) => v3norm(v3lerp(a, b, t));

export function blendHand(a: HandPose, b: HandPose, t: number): HandPose {
  return {
    pos: v3lerp(a.pos, b.pos, t),
    fingers: nlerp(a.fingers, b.fingers, t),
    palm: nlerp(a.palm, b.palm, t),
    shape: a.shape.map((x, i) => lerp(x, b.shape[i], t)),
  };
}

const SPACE_CENTER: Vec3 = [0.0, 1.27, 0.17];

function evalTrack(track: HandTrack, u: number, amplitude = 1, signingSpace = 1, durationSec = 0.7): HandPose {
  const keys = track.keys;
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (u >= keys[i].t && u <= keys[i + 1].t) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  if (u <= keys[0].t) b = a;
  if (u >= keys[keys.length - 1].t) a = b;
  const span = b.t - a.t;
  const s = span > 0 ? smooth((u - a.t) / span) : 0;
  const pa = keyPos(a.anchor, a.offset);
  const pb = keyPos(b.anchor, b.offset);
  let pos = v3lerp(pa, pb, s);
  // amplitude: amplia/contrai o movimento em torno da posição inicial do sinal
  const p0 = keyPos(keys[0].anchor, keys[0].offset);
  pos = v3lerp(p0, pos, amplitude);
  if (track.osc) {
    const o = track.osc;
    const from = o.from ?? 0;
    const to = o.to ?? 1;
    if (u > from && u < to) {
      const env = Math.sin(((u - from) / (to - from)) * Math.PI);
      const ph = Math.sin(u * durationSec * o.freq * Math.PI * 2);
      pos = [pos[0] + o.axis[0] * o.amp * ph * env * amplitude, pos[1] + o.axis[1] * o.amp * ph * env * amplitude, pos[2] + o.axis[2] * o.amp * ph * env * amplitude];
    }
  }
  // espaço de sinalização contido (ex.: sussurro) — não afeta sinais em contato com o corpo
  if (signingSpace !== 1 && !BODY_ANCHORS.includes(a.anchor) && !BODY_ANCHORS.includes(b.anchor)) {
    pos = v3lerp(SPACE_CENTER, pos, signingSpace);
  }
  return {
    pos,
    fingers: nlerp(a.fingers, b.fingers, s),
    palm: nlerp(a.palm, b.palm, s),
    shape: HANDSHAPES[a.shape].map((x, i) => lerp(x, HANDSHAPES[b.shape][i], s)),
  };
}

function keyPos(anchor: keyof typeof ANCHORS, off?: Vec3): Vec3 {
  const p = ANCHORS[anchor];
  return off ? [p[0] + off[0], p[1] + off[1], p[2] + off[2]] : [p[0], p[1], p[2]];
}

export const REST_POSE: HandPose = evalTrack(REST_TRACK, 0);
const PASSIVE_POSE: HandPose = evalTrack(PASSIVE_TRACK, 0);

/** Pose de um sinal num instante relativo u (0..1). */
export function signPose(sign: ScheduledSign, u: number): { right: HandPose; left: HandPose } {
  const e = sign.entry;
  if (!e) {
    // Sinal desconhecido: mão em posição neutra relaxada (o painel mostra a glosa).
    const p = evalTrack({ keys: [{ t: 0, anchor: 'neutral', shape: 'RELAX', fingers: [0, 0.5, 0.8], palm: [-0.7, 0, 0.3] }] }, 0);
    return { right: p, left: PASSIVE_POSE };
  }
  const dur = sign.end - sign.start;
  const right = evalTrack(e.dominant, u, sign.amplitude, sign.signingSpace, dur);
  let left: HandPose = PASSIVE_POSE;
  if (e.nondominant === 'mirror') left = right;
  else if (e.nondominant === 'alt') left = evalTrack(e.dominant, (u + 0.5) % 1, sign.amplitude, sign.signingSpace, dur);
  else if (e.nondominant) left = evalTrack(e.nondominant, u, sign.amplitude, sign.signingSpace, dur);
  return { right, left };
}

const MAX_BRIDGE = 0.8;
const TO_REST = 0.42;

export function evaluateHands(timeline: InterpretationTimeline, t: number): { right: HandPose; left: HandPose; active: ScheduledSign | null } {
  const signs = timeline.signs;
  const i = signIndexAt(signs, t);
  const cur = signs[i];
  if (cur && t < cur.end) {
    const u = (t - cur.start) / Math.max(0.001, cur.end - cur.start);
    return { ...signPose(cur, u), active: cur };
  }
  const prev = cur;
  const next = signs[i + 1];
  const rest = { right: REST_POSE, left: REST_POSE };
  const from = prev ? signPose(prev, 1) : rest;
  const to = next ? signPose(next, 0) : rest;
  if (prev && next && next.start - prev.end <= MAX_BRIDGE) {
    const k = smooth((t - prev.end) / (next.start - prev.end));
    return { right: blendHand(from.right, to.right, k), left: blendHand(from.left, to.left, k), active: null };
  }
  if (prev && t - prev.end < TO_REST) {
    const k = smooth((t - prev.end) / TO_REST);
    return { right: blendHand(from.right, REST_POSE, k), left: blendHand(from.left, REST_POSE, k), active: null };
  }
  if (next && next.start - t < TO_REST) {
    const k = smooth(1 - (next.start - t) / TO_REST);
    return { right: blendHand(REST_POSE, to.right, k), left: blendHand(REST_POSE, to.left, k), active: null };
  }
  return { ...rest, active: null };
}

export function evaluatePose(timeline: InterpretationTimeline, t: number, loci: Record<string, 'left' | 'right' | 'center'>): AvatarPose {
  const hands = evaluateHands(timeline, t);
  return { right: hands.right, left: hands.left, expression: evaluateExpression(timeline, t, loci), activeSign: hands.active };
}

/** Pontos extremos que o enquadramento precisa manter visíveis (mãos + cabeça). */
export const HAND_LENGTH = 0.19;
