/**
 * FACIAL EXPRESSION ENGINE
 *
 * Em Libras o rosto é gramática: sobrancelhas marcam perguntas e tópicos,
 * a cabeça nega, o olhar referencia pessoas no espaço, a intensidade aparece
 * nos olhos e na boca. Este motor combina três camadas:
 *
 *   1. EMOÇÃO da unidade (EMOTION ENGINE) → expressão de base;
 *   2. MARCADORES NÃO MANUAIS de cada sinal (wh, yn, topic, neg, intensifier,
 *      whisper) → sobrepõem-se à emoção;
 *   3. INCORPORAÇÃO (role shift) → giro de tronco/cabeça e direção do olhar
 *      para o personagem que está falando/ouvindo.
 *
 * A saída usa os nomes de blend shapes do padrão ARKit (52 formas, o mesmo
 * vocabulário usado por muitos avatares GLB). O rig procedural implementa um
 * subconjunto; o rig GLB aplica qualquer forma que o modelo possuir.
 */
import type { Emotion, NonManualMarker } from '@/ai/types';
import { activeSignAt, segmentAt, type InterpretationTimeline } from './timelineEngine';

export type FaceWeights = Record<string, number>;

export type ExpressionName = Emotion | 'attention' | 'doubt' | 'irony' | 'curiosity';

export const EXPRESSION_LABEL: Record<ExpressionName, string> = {
  neutral: 'neutra', happy: 'felicidade', sad: 'tristeza', angry: 'raiva', fear: 'medo', surprise: 'surpresa', confused: 'confusão',
  excited: 'animação', urgent: 'urgência', romantic: 'ternura', threatening: 'ameaça', attention: 'atenção', doubt: 'dúvida', irony: 'ironia', curiosity: 'curiosidade',
};

interface Preset {
  face: FaceWeights;
  headPitch?: number; // + = queixo para baixo
  headRoll?: number;
  lean?: number; // + = inclina para frente
  shrug?: number;
}

const both = (name: string, v: number): FaceWeights => ({ [`${name}Left`]: v, [`${name}Right`]: v });

export const EXPRESSIONS: Record<ExpressionName, Preset> = {
  neutral: { face: {} },
  happy: { face: { ...both('mouthSmile', 0.6), ...both('cheekSquint', 0.35), ...both('eyeSquint', 0.15) }, headRoll: 0.02 },
  sad: { face: { browInnerUp: 0.75, ...both('mouthFrown', 0.55), ...both('mouthPress', 0.2), ...both('eyeSquint', 0.1) }, headPitch: 0.08, lean: -0.01 },
  angry: { face: { ...both('browDown', 0.85), ...both('eyeSquint', 0.4), ...both('mouthPress', 0.45), ...both('noseSneer', 0.35) }, headPitch: 0.05, lean: 0.04 },
  fear: { face: { browInnerUp: 0.9, ...both('browOuterUp', 0.45), ...both('eyeWide', 0.75), ...both('mouthStretch', 0.35), jawOpen: 0.06 }, lean: -0.03, shrug: 0.45 },
  surprise: { face: { browInnerUp: 0.75, ...both('browOuterUp', 0.85), ...both('eyeWide', 0.85), jawOpen: 0.28, mouthFunnel: 0.15 }, headPitch: -0.04, lean: -0.02 },
  confused: { face: { browDownLeft: 0.6, browOuterUpRight: 0.55, browInnerUp: 0.2, mouthPressLeft: 0.35, eyeSquintLeft: 0.25 }, headRoll: 0.08 },
  excited: { face: { ...both('mouthSmile', 0.65), ...both('eyeWide', 0.45), ...both('browOuterUp', 0.45), jawOpen: 0.08 }, lean: 0.03 },
  urgent: { face: { browInnerUp: 0.55, ...both('browDown', 0.35), ...both('eyeWide', 0.45), ...both('mouthStretch', 0.2), ...both('mouthPress', 0.15) }, lean: 0.06 },
  romantic: { face: { ...both('mouthSmile', 0.3), ...both('eyeSquint', 0.35), ...both('cheekSquint', 0.2) }, headRoll: -0.06 },
  threatening: { face: { ...both('browDown', 0.75), ...both('eyeSquint', 0.5), ...both('mouthPress', 0.35), ...both('noseSneer', 0.2) }, headPitch: 0.07, lean: 0.05 },
  attention: { face: { browInnerUp: 0.3, ...both('browOuterUp', 0.35), ...both('eyeWide', 0.35) }, headPitch: -0.02 },
  doubt: { face: { browDownLeft: 0.45, browOuterUpRight: 0.35, mouthPucker: 0.25, mouthPressRight: 0.2 }, headRoll: 0.06 },
  irony: { face: { mouthSmileLeft: 0.5, browOuterUpLeft: 0.35, eyeSquintRight: 0.25 }, headRoll: -0.05 },
  curiosity: { face: { ...both('browOuterUp', 0.5), browInnerUp: 0.3, ...both('eyeWide', 0.2) }, headRoll: 0.07, lean: 0.03 },
};

const NMM: Record<NonManualMarker, Preset> = {
  topic: { face: { browInnerUp: 0.55, ...both('browOuterUp', 0.6), ...both('eyeWide', 0.2) }, headPitch: -0.07 },
  wh: { face: { ...both('browDown', 0.85), ...both('eyeSquint', 0.35), browInnerUp: 0.15 }, headPitch: 0.05, lean: 0.03 },
  yn: { face: { browInnerUp: 0.7, ...both('browOuterUp', 0.7), ...both('eyeWide', 0.35) }, headPitch: 0.07, lean: 0.04 },
  neg: { face: { ...both('mouthFrown', 0.4), ...both('browDown', 0.3) } },
  intensifier: { face: { ...both('eyeSquint', 0.3), ...both('mouthPress', 0.35), ...both('cheekSquint', 0.15) }, lean: 0.03 },
  whisper: { face: { ...both('eyeWide', 0.3), mouthPucker: 0.2 }, lean: 0.07, shrug: 0.3 },
  exclamation: { face: { ...both('eyeWide', 0.5), ...both('browOuterUp', 0.4) } },
};

export interface ExpressionState {
  face: FaceWeights;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  torsoYaw: number;
  lean: number;
  shrug: number;
  gazeX: number; // -1..1 (direita do avatar → esquerda)
  gazeY: number;
  mouthing: number; // 0..1 movimento labial de articulação
  blink: number; // piscada de fronteira prosódica
  expression: ExpressionName;
  markers: NonManualMarker[];
}

function addPreset(out: ExpressionState, p: Preset, w: number) {
  if (w <= 0) return;
  for (const [k, v] of Object.entries(p.face)) out.face[k] = Math.min(1, Math.max(out.face[k] ?? 0, v * w));
  out.headPitch += (p.headPitch ?? 0) * w;
  out.headRoll += (p.headRoll ?? 0) * w;
  out.lean += (p.lean ?? 0) * w;
  out.shrug = Math.max(out.shrug, (p.shrug ?? 0) * w);
}

const ramp = (x: number, w: number) => Math.max(0, Math.min(1, x / w));
const smooth = (x: number) => x * x * (3 - 2 * x);

export function emptyExpression(): ExpressionState {
  return { face: {}, headPitch: 0, headYaw: 0, headRoll: 0, torsoYaw: 0, lean: 0, shrug: 0, gazeX: 0, gazeY: 0, mouthing: 0, blink: 0, expression: 'neutral', markers: [] };
}

export function evaluateExpression(timeline: InterpretationTimeline, t: number, loci: Record<string, 'left' | 'right' | 'center'> = {}): ExpressionState {
  const out = emptyExpression();
  const seg = segmentAt(timeline, t, 0.45);
  if (!seg) return out;
  const w = smooth(Math.min(ramp(t - (seg.signStart - 0.35), 0.35), ramp(seg.signEnd + 0.45 - t, 0.45)));
  const rep = seg.representation;
  const kind = seg.unit.kind;
  const expr: ExpressionName = kind === 'dialogue' ? rep.expression : rep.expression === 'neutral' ? 'attention' : rep.expression;
  out.expression = expr;
  addPreset(out, EXPRESSIONS[expr], w * (0.55 + rep.intensity * 0.5));
  if (kind !== 'dialogue') {
    addPreset(out, EXPRESSIONS.attention, w * 0.6);
    out.gazeX = 0.35 * w; // olhar desvia brevemente para "onde está o som/evento"
    out.gazeY = 0.05 * w;
  }
  // incorporação de personagem
  if (rep.roleShift) {
    const locus = loci[rep.roleShift] ?? 'center';
    const dir = locus === 'left' ? 1 : locus === 'right' ? -1 : 0;
    out.torsoYaw = 0.17 * dir * w;
    out.headYaw = 0.1 * dir * w;
    out.gazeX = -0.45 * dir * w; // olha para o interlocutor (locus oposto)
  }
  // marcadores não manuais do sinal ativo (com rampas curtas)
  const sign = activeSignAt(timeline, t);
  const markers = new Set<NonManualMarker>();
  for (const s of timeline.signs) {
    if (s.segmentIndex !== timeline.segments.indexOf(seg)) continue;
    const mw = smooth(Math.min(ramp(t - (s.start - 0.12), 0.12), ramp(s.end + 0.15 - t, 0.15)));
    if (mw <= 0) continue;
    for (const m of s.token.markers) {
      markers.add(m);
      addPreset(out, NMM[m], mw);
      if (m === 'neg') out.headYaw += Math.sin(t * Math.PI * 2 * 2.6) * 0.14 * mw;
      if (m === 'yn' || m === 'wh') out.gazeX *= 0.4; // perguntas: olhar volta para o interlocutor/câmera
    }
  }
  out.markers = [...markers];
  if (sign?.entry?.mouthing !== false && sign) {
    const u = (t - sign.start) / Math.max(0.01, sign.end - sign.start);
    out.mouthing = Math.sin(Math.PI * u) * (kind === 'dialogue' ? 1 : 0.6) * (sign.token.markers.includes('whisper') ? 0.5 : 1);
  }
  // piscada que marca fronteira de frase (comum em línguas de sinais)
  const sinceEnd = t - seg.signEnd;
  if (sinceEnd > 0.02 && sinceEnd < 0.2) out.blink = Math.sin((sinceEnd / 0.18) * Math.PI);
  return out;
}
