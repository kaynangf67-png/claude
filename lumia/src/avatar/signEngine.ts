/**
 * SIGN ENGINE — léxico de sinais, configurações de mão e datilologia.
 *
 * ⚠️ AVISO LINGUÍSTICO (honestidade do protótipo)
 * Os sinais abaixo são APROXIMAÇÕES escritas à mão para demonstrar a
 * arquitetura (configuração de mão + locação + movimento + orientação +
 * marcadores não manuais). Eles NÃO foram validados por intérpretes de Libras
 * nem por pessoas surdas e não devem ser usados como referência de ensino.
 * Por isso, toda interpretação que usa este léxico nasce com status
 * REVIEW_REQUIRED (ver ai/qualityEngine.ts).
 *
 * TODO: FUTURE AI INTEGRATION — substituir este léxico manual por:
 *   1. um banco de sinais capturado com motion capture de intérpretes surdos
 *      e ouvintes (corpo, dedos e rosto), versionado por região/variação;
 *   2. modelos generativos de movimento condicionados à representação
 *      linguística (SignRepresentation), para coarticulação natural.
 *   O formato SignLexiconEntry abaixo é o ponto de encaixe: um clipe de mocap
 *   pode ser convertido para as mesmas trilhas (pos/orientação/handshape).
 */
import type { SignLanguageCode } from '@/types/content';

export type Vec3 = [number, number, number];

// --------------------------------------------------------------------------
// Configurações de mão
// --------------------------------------------------------------------------

/**
 * Vetor de 20 números:
 *  [0..15]  4 dedos (indicador, médio, anelar, mínimo) × [mcp, pip, dip, afastamento]
 *  [16..19] polegar: [flexão CMC (oposição), abdução CMC, flexão MCP, flexão IP]
 * Valores 0..1 (afastamento -1..1). O rig converte para ângulos.
 */
export type HandShapeVector = number[];

const S = [0, 0, 0]; // dedo estendido
const FIST = [0.95, 1, 0.75];
const CURVE = [0.35, 0.5, 0.35];
const OCLOSE = [0.6, 0.75, 0.5];
const CLAW = [0.1, 0.9, 0.75];
const BENT = [0.95, 0.05, 0.05];
const HOOK = [0.15, 0.95, 0.85];
const HALF = [0.5, 0.6, 0.4];

const T_TUCK = [0.55, 0.1, 0.25, 0.1];
const T_SIDE = [0.1, 0.05, 0.05, 0.0];
const T_OUT = [0.0, 0.9, 0.0, 0.0];
const T_OVER = [0.85, 0.35, 0.45, 0.4];
const T_OPP = [0.65, 0.6, 0.3, 0.35];
const T_CURVE = [0.35, 0.75, 0.15, 0.25];
const T_UP = [0.0, 0.35, 0.0, 0.0];

function hs(fingers: [number[], number[], number[], number[]], spread: [number, number, number, number], thumb: number[]): HandShapeVector {
  const out: number[] = [];
  fingers.forEach((f, i) => out.push(f[0], f[1], f[2], spread[i]));
  out.push(...thumb);
  return out;
}

const TOGETHER: [number, number, number, number] = [0, 0, 0, 0];
const SPREAD: [number, number, number, number] = [-0.8, -0.2, 0.3, 0.9];

export const HANDSHAPES = {
  B: hs([S, S, S, S], TOGETHER, T_TUCK),
  '5': hs([S, S, S, S], SPREAD, T_OUT),
  A: hs([FIST, FIST, FIST, FIST], TOGETHER, T_SIDE),
  S: hs([FIST, FIST, FIST, FIST], TOGETHER, T_OVER),
  THUMB_UP: hs([FIST, FIST, FIST, FIST], TOGETHER, T_UP),
  '1': hs([S, FIST, FIST, FIST], TOGETHER, T_OVER),
  L: hs([S, FIST, FIST, FIST], TOGETHER, T_OUT),
  Y: hs([FIST, FIST, FIST, S], [0, 0, 0, 0.6], T_OUT),
  I: hs([FIST, FIST, FIST, S], TOGETHER, T_OVER),
  V: hs([S, S, FIST, FIST], [-0.7, 0.5, 0, 0], T_OVER),
  N: hs([S, S, FIST, FIST], TOGETHER, T_OVER),
  R: hs([S, S, FIST, FIST], [0.5, -0.7, 0, 0], T_OVER),
  M: hs([S, S, S, FIST], TOGETHER, T_OVER),
  W: hs([S, S, S, FIST], [-0.6, 0, 0.6, 0], T_OVER),
  C: hs([CURVE, CURVE, CURVE, CURVE], TOGETHER, T_CURVE),
  O: hs([OCLOSE, OCLOSE, OCLOSE, OCLOSE], TOGETHER, T_OPP),
  D: hs([S, OCLOSE, OCLOSE, OCLOSE], TOGETHER, T_OPP),
  E: hs([[0.2, 1, 0.8], [0.2, 1, 0.8], [0.2, 1, 0.8], [0.2, 1, 0.8]], TOGETHER, T_TUCK),
  F: hs([OCLOSE, S, S, S], [0, 0.2, 0.3, 0.5], T_OPP),
  CLAW: hs([CLAW, CLAW, CLAW, CLAW], SPREAD, T_CURVE),
  BENT: hs([BENT, BENT, BENT, BENT], TOGETHER, T_TUCK),
  X: hs([HOOK, FIST, FIST, FIST], TOGETHER, T_OVER),
  G: hs([S, FIST, FIST, FIST], TOGETHER, T_SIDE),
  H: hs([S, S, FIST, FIST], TOGETHER, T_OVER),
  K: hs([S, HALF, FIST, FIST], [-0.4, 0.2, 0, 0], T_OPP),
  P: hs([S, HALF, FIST, FIST], [-0.4, 0.2, 0, 0], T_OPP),
  Q: hs([S, FIST, FIST, FIST], TOGETHER, T_OUT),
  T: hs([HALF, S, S, S], [0, 0.2, 0.3, 0.5], T_OPP),
  U: hs([S, S, FIST, FIST], TOGETHER, T_OVER),
  RELAX: hs([[0.25, 0.3, 0.15], [0.3, 0.35, 0.2], [0.35, 0.4, 0.2], [0.4, 0.45, 0.25]], [-0.2, 0, 0.1, 0.3], [0.25, 0.35, 0.15, 0.15]),
} satisfies Record<string, HandShapeVector>;

export type HandShapeId = keyof typeof HANDSHAPES;

// --------------------------------------------------------------------------
// Espaço de sinalização (metros, referencial do sinalizador)
//   x > 0 = lado da própria mão (ipsilateral) · y = altura · z > 0 = à frente
// --------------------------------------------------------------------------

export const ANCHORS = {
  rest: [0.11, 0.99, 0.15],
  passive: [0.12, 1.06, 0.2],
  neutral: [0.1, 1.2, 0.3],
  center: [0.0, 1.22, 0.3],
  chest: [0.0, 1.3, 0.17],
  chin: [0.0, 1.485, 0.16],
  mouth: [0.0, 1.54, 0.155],
  cheek: [0.08, 1.55, 0.12],
  ear: [0.115, 1.585, 0.045],
  temple: [0.1, 1.65, 0.09],
  forehead: [0.0, 1.675, 0.155],
  eyes: [0.035, 1.6, 0.17],
  side: [0.3, 1.22, 0.2],
  high: [0.12, 1.45, 0.3],
  low: [0.1, 1.06, 0.27],
  spell: [0.17, 1.37, 0.27],
  forward: [0.04, 1.3, 0.45],
} satisfies Record<string, Vec3>;

export type AnchorId = keyof typeof ANCHORS;

/** Locações em contato com o corpo não encolhem quando a sinalização fica contida. */
export const BODY_ANCHORS: AnchorId[] = ['chest', 'chin', 'mouth', 'cheek', 'ear', 'temple', 'forehead', 'eyes'];

export const DIR = {
  up: [0, 1, 0] as Vec3,
  down: [0, -1, 0] as Vec3,
  fwd: [0, 0, 1] as Vec3,
  back: [0, 0, -1] as Vec3,
  in: [-1, 0, 0] as Vec3, // em direção à linha média do corpo
  out: [1, 0, 0] as Vec3,
};

export interface HandKeyframe {
  t: number; // 0..1 dentro do sinal
  anchor: AnchorId;
  offset?: Vec3;
  shape: HandShapeId;
  fingers: Vec3; // direção dos dedos (metacarpos)
  palm: Vec3; // normal da palma (para onde a palma "olha")
}

export interface Oscillation {
  axis: Vec3;
  amp: number; // metros
  freq: number; // Hz
  from?: number; // janela (0..1) dentro do sinal
  to?: number;
}

export interface HandTrack {
  keys: HandKeyframe[];
  osc?: Oscillation;
}

export interface SignLexiconEntry {
  id: string;
  language: SignLanguageCode;
  gloss: string;
  meaning: string;
  duration: number; // segundos em velocidade normal
  dominant: HandTrack;
  /** 'mirror' = mão não dominante espelha a dominante; 'alt' = espelha defasada. */
  nondominant?: HandTrack | 'mirror' | 'alt';
  mouthing?: boolean;
  validated: false; // nenhum sinal deste protótipo foi validado
  note?: string;
}

const k = (t: number, anchor: AnchorId, shape: HandShapeId, fingers: Vec3, palm: Vec3, offset?: Vec3): HandKeyframe => ({ t, anchor, shape, fingers, palm, offset });

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const d = (x: number, y: number, z: number) => norm([x, y, z]);

function sign(gloss: string, meaning: string, duration: number, dominant: HandTrack, nondominant?: SignLexiconEntry['nondominant'], extra: Partial<SignLexiconEntry> = {}): SignLexiconEntry {
  return { id: gloss, language: 'pt-BR-LIBRAS', gloss, meaning, duration, dominant, nondominant, mouthing: true, validated: false, ...extra };
}

/** Trilha passiva: a mão não dominante descansa diante do corpo. */
export const PASSIVE_TRACK: HandTrack = { keys: [k(0, 'passive', 'RELAX', d(0.3, -0.2, 1), d(-0.6, 0.2, 0.2))] };
export const REST_TRACK: HandTrack = { keys: [k(0, 'rest', 'RELAX', d(0.25, -0.6, 0.7), d(-0.9, 0.1, 0.1))] };

// --------------------------------------------------------------------------
// LÉXICO (aproximações — ver aviso no topo do arquivo)
// --------------------------------------------------------------------------

const L: SignLexiconEntry[] = [
  // ---- cena "A Ligação" ----
  sign('PORTA', 'porta', 0.7,
    { keys: [k(0, 'center', 'B', DIR.up, d(0.2, 0, 1), [0.05, 0.05, 0]), k(0.5, 'center', 'B', DIR.up, d(1, 0, 0.5), [0.05, 0.05, 0]), k(1, 'center', 'B', DIR.up, d(0.2, 0, 1), [0.05, 0.05, 0])] },
    { keys: [k(0, 'center', 'B', DIR.up, d(-0.2, 0, 1), [0.05, 0.05, 0])] }),
  sign('ABRIR', 'abrir (porta)', 0.6,
    { keys: [k(0, 'center', 'B', DIR.up, d(0, 0, 1), [0.05, 0.05, 0]), k(1, 'center', 'B', DIR.up, d(1, 0, 0), [0.09, 0.05, 0.1])] },
    { keys: [k(0, 'center', 'B', DIR.up, d(0, 0, 1), [0.05, 0.05, 0])] }),
  sign('BATER-FORTE', 'bater com força (porta)', 0.55,
    { keys: [k(0, 'side', 'B', DIR.up, d(1, 0, 0.3)), k(0.55, 'center', 'B', DIR.up, d(-0.2, 0, 1), [0.06, 0.05, 0.01]), k(1, 'center', 'B', DIR.up, d(-0.2, 0, 1), [0.06, 0.05, 0.01])] },
    { keys: [k(0, 'center', 'B', DIR.up, d(-0.2, 0, 1), [0.06, 0.05, -0.01])] }),
  sign('TELEFONE', 'telefone', 0.6,
    { keys: [k(0, 'cheek', 'Y', DIR.fwd, DIR.in, [0.05, -0.04, 0.08]), k(1, 'cheek', 'Y', DIR.fwd, DIR.in, [0.04, 0, 0.05])] }),
  sign('TELEFONE-TOCAR', 'telefone tocando', 1.4,
    { keys: [k(0, 'cheek', 'Y', DIR.fwd, DIR.in, [0.05, -0.02, 0.07]), k(1, 'cheek', 'Y', DIR.fwd, DIR.in, [0.05, -0.02, 0.07])], osc: { axis: [1, 0, 0], amp: 0.012, freq: 7, from: 0.15, to: 0.9 } }),
  sign('ALÔ', 'alô (atender o telefone)', 0.7,
    { keys: [k(0, 'cheek', 'Y', DIR.fwd, DIR.in, [0.07, -0.05, 0.12]), k(0.6, 'cheek', 'Y', DIR.fwd, DIR.in, [0.04, 0, 0.05]), k(1, 'cheek', 'Y', DIR.fwd, DIR.in, [0.04, 0, 0.05])] }),
  sign('NÚMERO', 'número', 0.6,
    { keys: [k(0, 'center', '1', d(0, 0.3, 1), DIR.down, [0.04, 0.05, 0]), k(0.5, 'center', '1', d(0, 0.3, 1), DIR.down, [0.04, 0.02, 0]), k(1, 'center', '1', d(0, 0.3, 1), DIR.down, [0.04, 0.05, 0])] },
    { keys: [k(0, 'center', 'B', d(0.3, 0, 1), DIR.up, [0.02, -0.03, 0])] }),
  sign('DESCONHECIDO', 'desconhecido (não conhecer)', 0.8,
    { keys: [k(0, 'forehead', 'B', DIR.up, DIR.back, [0.04, 0, 0.03]), k(1, 'temple', 'B', d(1, 1, 0), d(0, 0, 1), [0.16, 0.02, 0.15])] }),
  sign('EU', 'eu', 0.4,
    { keys: [k(0, 'chest', '1', d(0, 0.2, -1), DIR.in, [0.03, 0.02, 0.06]), k(1, 'chest', '1', d(0, 0.2, -1), DIR.in, [0.02, 0.02, 0.03])] }),
  sign('VOCÊ', 'você', 0.4,
    { keys: [k(0, 'neutral', '1', d(0, 0.1, 1), DIR.down, [-0.04, 0.06, -0.06]), k(1, 'neutral', '1', d(0, 0.1, 1), DIR.down, [-0.04, 0.06, 0.06])] }),
  sign('SAIR', 'sair', 0.6,
    { keys: [k(0, 'center', 'B', DIR.fwd, DIR.down, [0.02, -0.05, -0.04]), k(1, 'side', 'B', d(1, 0, 1), DIR.down, [0, 0.0, 0.12])] },
    { keys: [k(0, 'center', 'B', d(0.4, 0, 1), DIR.down, [0.02, 0.0, 0])] }),
  sign('AGORA', 'agora', 0.5,
    { keys: [k(0, 'neutral', 'Y', d(0, 0.2, 1), DIR.up, [0, 0.05, 0]), k(0.5, 'neutral', 'Y', d(0, 0.2, 1), DIR.up, [0, -0.03, 0]), k(1, 'neutral', 'Y', d(0, 0.2, 1), DIR.up, [0, -0.02, 0])] },
    'mirror'),
  sign('PRECISAR', 'precisar', 0.6,
    { keys: [k(0, 'neutral', 'X', DIR.fwd, DIR.down, [0, 0.06, 0]), k(0.35, 'neutral', 'X', DIR.fwd, DIR.down, [0, -0.02, 0]), k(0.65, 'neutral', 'X', DIR.fwd, DIR.down, [0, 0.04, 0]), k(1, 'neutral', 'X', DIR.fwd, DIR.down, [0, -0.03, 0])] }),
  sign('ACONTECER', 'acontecer', 0.7,
    { keys: [k(0, 'neutral', '1', d(0, 0.2, 1), DIR.up, [-0.02, 0, 0]), k(1, 'neutral', '1', d(0, 0.2, 1), DIR.down, [0.02, -0.02, 0.04])] }, 'mirror'),
  sign('O-QUE', 'o quê (interrogativo)', 0.7,
    { keys: [k(0, 'neutral', '1', DIR.up, DIR.fwd, [0, 0.08, 0]), k(1, 'neutral', '1', DIR.up, DIR.fwd, [0, 0.08, 0])], osc: { axis: [1, 0, 0], amp: 0.03, freq: 3.2, from: 0.05, to: 0.95 } }),
  sign('EXPLICAR', 'explicar', 0.8,
    { keys: [k(0, 'neutral', 'F', DIR.fwd, DIR.in, [-0.03, 0.04, -0.03]), k(0.5, 'neutral', 'F', DIR.fwd, DIR.in, [-0.03, 0.0, 0.06]), k(1, 'neutral', 'F', DIR.fwd, DIR.in, [-0.03, 0.04, -0.03])] }, 'alt'),
  sign('NÃO-DÁ', 'não dá / impossível', 0.7,
    { keys: [k(0, 'center', 'B', DIR.fwd, DIR.down, [-0.05, 0.02, 0]), k(1, 'side', 'B', DIR.fwd, DIR.down, [-0.02, 0.0, 0])] }, 'mirror'),
  sign('CONFIAR', 'confiar', 0.7,
    { keys: [k(0, 'forward', 'S', d(0, 0, 1), DIR.in, [0, -0.05, 0]), k(1, 'chest', 'S', d(0, 0.3, 1), DIR.in, [0.03, 0, 0.08])] },
    { keys: [k(0, 'neutral', 'S', d(-0.3, 0.2, 1), DIR.in, [-0.02, -0.06, 0.02])] }),
  sign('CHUVA', 'chuva', 0.8,
    { keys: [k(0, 'high', 'CLAW', DIR.fwd, DIR.down, [0, 0.08, 0]), k(0.5, 'neutral', 'CLAW', DIR.fwd, DIR.down), k(0.52, 'high', 'CLAW', DIR.fwd, DIR.down, [0, 0.06, 0]), k(1, 'neutral', 'CLAW', DIR.fwd, DIR.down)] }, 'mirror'),
  sign('PARAR', 'parar', 0.5,
    { keys: [k(0, 'center', 'B', DIR.fwd, DIR.in, [0.02, 0.12, 0]), k(0.6, 'center', 'B', DIR.fwd, DIR.in, [0.02, 0.02, 0]), k(1, 'center', 'B', DIR.fwd, DIR.in, [0.02, 0.02, 0])] },
    { keys: [k(0, 'center', 'B', d(0.4, 0, 1), DIR.up, [0.02, -0.02, 0])] }),
  sign('SILÊNCIO', 'silêncio', 0.8,
    { keys: [k(0, 'mouth', '1', DIR.up, DIR.in, [0.01, 0, 0.07]), k(1, 'mouth', '1', DIR.up, DIR.in, [0.01, 0, 0.04])] }, undefined, { mouthing: false }),
  sign('SOMBRA', 'sombra', 0.7,
    { keys: [k(0, 'center', '5', DIR.fwd, DIR.down, [0.06, 0.08, 0]), k(1, 'center', '5', DIR.fwd, DIR.down, [-0.06, 0.08, 0])] },
    { keys: [k(0, 'center', 'B', d(0.3, 0, 1), DIR.down, [0.02, -0.02, 0])] }),
  sign('CL:PESSOA-PARAR', 'classificador: pessoa chega e para (diante da porta)', 1.0,
    { keys: [k(0, 'side', '1', DIR.up, DIR.in, [0.05, 0, 0]), k(0.7, 'center', '1', DIR.up, DIR.in, [0.04, 0, 0.04]), k(1, 'center', '1', DIR.up, DIR.in, [0.04, 0, 0.04])] },
    { keys: [k(0, 'center', 'B', DIR.up, DIR.fwd, [0.05, 0.02, -0.03])] }, { note: 'Classificador de pessoa (dedo em pé) — estrutura típica de línguas de sinais.' }),
  sign('BATER-PORTA', 'bater à porta', 0.9,
    { keys: [k(0, 'high', 'A', DIR.up, DIR.fwd, [0, 0, 0.05]), k(1, 'high', 'A', DIR.up, DIR.fwd, [0, 0, 0.05])], osc: { axis: [0, 0, 1], amp: 0.03, freq: 3.4, from: 0.05, to: 0.95 } }),
  sign('ALGUÉM', 'alguém', 0.6,
    { keys: [k(0, 'neutral', '1', DIR.up, DIR.fwd, [0, 0.08, 0]), k(1, 'neutral', '1', DIR.up, DIR.fwd, [0, 0.08, 0])], osc: { axis: [1, 0, 0.5], amp: 0.018, freq: 2.2 } }),
  sign('TER', 'ter', 0.5,
    { keys: [k(0, 'chest', 'L', DIR.up, DIR.in, [0.05, 0.02, 0.07]), k(0.5, 'chest', 'L', DIR.up, DIR.in, [0.05, 0.02, 0.03]), k(1, 'chest', 'L', DIR.up, DIR.in, [0.05, 0.02, 0.06])] }),
  sign('CONTINUAR', 'continuar', 0.8,
    { keys: [k(0, 'neutral', 'THUMB_UP', DIR.fwd, DIR.in, [-0.02, 0, -0.04]), k(1, 'forward', 'THUMB_UP', DIR.fwd, DIR.in, [0.04, -0.02, 0.06])] }, 'mirror'),

  // ---- manifesto ----
  sign('OI', 'oi / olá', 0.8,
    { keys: [k(0, 'temple', 'B', DIR.up, DIR.fwd, [0.08, 0.03, 0.08]), k(1, 'temple', 'B', DIR.up, DIR.fwd, [0.1, 0.03, 0.1])], osc: { axis: [1, 0, 0], amp: 0.025, freq: 3 } }),
  sign('TUDO-BEM', 'tudo bem', 0.7,
    { keys: [k(0, 'neutral', 'THUMB_UP', DIR.fwd, DIR.in, [0, 0.0, -0.04]), k(1, 'neutral', 'THUMB_UP', DIR.fwd, DIR.in, [0, 0.04, 0.04])] }),
  sign('HOJE', 'hoje', 0.6,
    { keys: [k(0, 'neutral', 'Y', d(0, 0.2, 1), DIR.up, [0, 0.03, 0]), k(0.5, 'neutral', 'Y', d(0, 0.2, 1), DIR.up, [0, -0.02, 0]), k(1, 'neutral', 'Y', d(0, 0.2, 1), DIR.up, [0, 0.02, 0])] }, 'mirror'),
  sign('VAMOS', 'vamos', 0.6,
    { keys: [k(0, 'chest', 'B', DIR.fwd, DIR.in, [0.08, -0.04, 0.08]), k(1, 'forward', 'B', d(0.4, 0, 1), DIR.in, [0.05, -0.05, 0])] }),
  sign('COMEÇAR', 'começar', 0.7,
    { keys: [k(0, 'center', '1', DIR.fwd, DIR.in, [0.03, 0.03, -0.02]), k(1, 'center', '1', DIR.fwd, DIR.down, [0.03, 0.03, 0.03])] },
    { keys: [k(0, 'center', 'B', d(0.4, 0, 1), DIR.in, [0.02, 0, 0])] }),
  sign('CINEMA', 'cinema / filme', 0.8,
    { keys: [k(0, 'center', '5', DIR.up, DIR.fwd, [0.05, 0.08, 0.02]), k(1, 'center', '5', DIR.up, DIR.fwd, [0.05, 0.08, 0.02])], osc: { axis: [1, 0, 0], amp: 0.012, freq: 4 } },
    { keys: [k(0, 'center', 'B', DIR.up, DIR.back, [0.03, 0.06, -0.02])] }),
  sign('FILME', 'filme', 0.8,
    { keys: [k(0, 'center', '5', DIR.up, DIR.fwd, [0.05, 0.08, 0.02]), k(1, 'center', '5', DIR.up, DIR.fwd, [0.05, 0.08, 0.02])], osc: { axis: [1, 0, 0], amp: 0.012, freq: 4 } },
    { keys: [k(0, 'center', 'B', DIR.up, DIR.back, [0.03, 0.06, -0.02])] }),
  sign('TODOS', 'todos', 0.7,
    { keys: [k(0, 'neutral', 'B', DIR.fwd, DIR.down, [-0.14, 0.02, 0]), k(0.5, 'forward', 'B', DIR.fwd, DIR.down, [0.0, -0.08, 0]), k(1, 'side', 'B', DIR.fwd, DIR.down, [-0.04, 0, 0.06])] }),
  sign('ASSISTIR', 'assistir / ver', 0.6,
    { keys: [k(0, 'eyes', 'V', DIR.up, DIR.back, [0, -0.02, 0.05]), k(1, 'forward', 'V', DIR.fwd, DIR.down, [0, 0.1, 0])] }),
  sign('ENTENDER', 'entender', 0.7,
    { keys: [k(0, 'temple', '1', DIR.up, DIR.in, [0.02, 0, 0.03]), k(0.6, 'temple', 'L', d(0.3, 1, 0), DIR.fwd, [0.05, 0.03, 0.06]), k(1, 'temple', 'L', d(0.3, 1, 0), DIR.fwd, [0.05, 0.03, 0.06])] }),
  sign('VIVER', 'viver / vida', 0.7,
    { keys: [k(0, 'low', 'L', DIR.up, DIR.back, [-0.03, 0, -0.05]), k(1, 'chest', 'L', DIR.up, DIR.back, [0.06, 0.04, 0.06])] }, 'mirror'),
  sign('HISTÓRIA', 'história', 0.8,
    { keys: [k(0, 'center', 'F', DIR.fwd, DIR.in, [0.05, 0.05, 0]), k(0.5, 'center', 'F', DIR.fwd, DIR.in, [0.08, 0.02, 0.06]), k(1, 'center', 'F', DIR.fwd, DIR.in, [0.05, 0.05, 0])] }, 'alt'),
  sign('INTÉRPRETE', 'intérprete', 0.8,
    { keys: [k(0, 'center', 'I', DIR.fwd, DIR.in, [0.06, 0.04, 0]), k(0.5, 'center', 'I', DIR.fwd, DIR.down, [0.06, 0.04, 0]), k(1, 'center', 'I', DIR.fwd, DIR.in, [0.06, 0.04, 0])] }, 'alt'),

  // ---- vocabulário usado pelo motor de regras (laboratório / ao vivo) ----
  sign('AQUI', 'aqui', 0.45, { keys: [k(0, 'neutral', '1', d(0, -1, 0.4), DIR.in, [0, 0.04, 0]), k(1, 'neutral', '1', d(0, -1, 0.4), DIR.in, [0, -0.02, 0])] }),
  sign('LÁ', 'lá', 0.5, { keys: [k(0, 'neutral', '1', DIR.fwd, DIR.down), k(1, 'forward', '1', d(0.3, 0.2, 1), DIR.down, [0.05, 0.05, 0.03])] }),
  sign('DEVER', 'dever / deveria', 0.55, { keys: [k(0, 'neutral', 'X', DIR.fwd, DIR.down, [0, 0.05, 0]), k(0.5, 'neutral', 'X', DIR.fwd, DIR.down, [0, -0.02, 0.02]), k(1, 'neutral', 'X', DIR.fwd, DIR.down, [0, 0.03, 0])] }),
  sign('NÃO', 'não', 0.5, { keys: [k(0, 'neutral', '1', DIR.up, DIR.fwd, [0, 0.06, 0]), k(1, 'neutral', '1', DIR.up, DIR.fwd, [0, 0.06, 0])], osc: { axis: [1, 0, 0], amp: 0.03, freq: 3.5 } }),
  sign('SIM', 'sim', 0.45, { keys: [k(0, 'neutral', 'S', DIR.fwd, DIR.down, [0, 0.04, 0]), k(1, 'neutral', 'S', DIR.fwd, DIR.down, [0, 0.04, 0])], osc: { axis: [0, 1, 0], amp: 0.025, freq: 3 } }),
  sign('VIR', 'vir', 0.55, { keys: [k(0, 'forward', '1', DIR.up, DIR.back, [0, 0, 0]), k(1, 'chest', '1', DIR.up, DIR.back, [0.05, 0, 0.1])] }),
  sign('IR', 'ir', 0.55, { keys: [k(0, 'chest', '1', DIR.fwd, DIR.in, [0.05, -0.03, 0.1]), k(1, 'forward', '1', DIR.fwd, DIR.in, [0.04, -0.04, 0.04])] }),
  sign('CASA', 'casa', 0.6, { keys: [k(0, 'high', 'B', d(-1, 1, 0.3), d(-1, -1, 0.3), [-0.1, 0.02, 0]), k(1, 'neutral', 'B', DIR.up, DIR.in, [-0.02, 0.02, 0])] }, 'mirror'),
  sign('QUERER', 'querer', 0.6, { keys: [k(0, 'forward', 'CLAW', DIR.fwd, DIR.up, [0, -0.04, 0]), k(1, 'neutral', 'CLAW', DIR.fwd, DIR.up, [0, -0.02, -0.05])] }),
  sign('GOSTAR', 'gostar', 0.6, { keys: [k(0, 'chest', '5', DIR.up, DIR.back, [0.04, 0.03, 0.04]), k(1, 'chest', '5', DIR.up, DIR.back, [0.04, -0.04, 0.04])] }),
  sign('AJUDAR', 'ajudar', 0.6, { keys: [k(0, 'neutral', 'A', DIR.fwd, DIR.in, [-0.02, -0.02, 0]), k(1, 'high', 'A', DIR.fwd, DIR.in, [-0.02, -0.04, 0])] }, { keys: [k(0, 'neutral', 'B', d(0.4, 0, 1), DIR.up, [0, -0.08, 0]), k(1, 'high', 'B', d(0.4, 0, 1), DIR.up, [0, -0.1, 0])] }),
  sign('ONDE', 'onde', 0.6, { keys: [k(0, 'neutral', '1', DIR.up, DIR.fwd, [0, 0.06, 0]), k(1, 'neutral', '1', DIR.up, DIR.fwd, [0, 0.06, 0])], osc: { axis: [1, 0, 0], amp: 0.02, freq: 2.5 } }),
  sign('QUANDO', 'quando', 0.6, { keys: [k(0, 'neutral', '1', DIR.fwd, DIR.down, [0.02, 0.05, 0]), k(1, 'neutral', '1', DIR.fwd, DIR.down, [-0.02, 0.0, 0])] }, { keys: [k(0, 'neutral', '1', DIR.up, DIR.in)] }),
  sign('QUEM', 'quem', 0.6, { keys: [k(0, 'chin', 'L', DIR.up, DIR.in, [0.03, -0.02, 0.06]), k(1, 'chin', 'L', DIR.up, DIR.in, [0.03, -0.02, 0.06])], osc: { axis: [0, 0, 1], amp: 0.012, freq: 3 } }),
  sign('COMO', 'como', 0.6, { keys: [k(0, 'neutral', 'BENT', DIR.fwd, DIR.up), k(1, 'neutral', 'BENT', DIR.fwd, DIR.down)] }, 'mirror'),
  sign('POR-QUE', 'por quê', 0.6, { keys: [k(0, 'forehead', '1', DIR.up, DIR.back, [0.03, 0, 0.04]), k(1, 'neutral', 'Y', DIR.up, DIR.fwd, [0, 0.12, 0])] }),
  sign('AMANHÃ', 'amanhã', 0.6, { keys: [k(0, 'cheek', 'A', DIR.up, DIR.in, [0.02, 0, 0.04]), k(1, 'cheek', 'A', d(0, 1, 1), DIR.in, [0.05, 0.02, 0.14])] }),
  sign('ONTEM', 'ontem', 0.6, { keys: [k(0, 'cheek', 'A', DIR.up, DIR.in, [0.02, 0, 0.06]), k(1, 'ear', 'A', d(0, 1, -1), DIR.in, [0.02, 0.02, -0.02])] }),
  sign('PESSOA', 'pessoa', 0.6, { keys: [k(0, 'neutral', 'P', DIR.fwd, DIR.in, [0, 0.08, 0]), k(1, 'neutral', 'P', DIR.fwd, DIR.in, [0, -0.06, 0])] }),
  sign('MULHER', 'mulher', 0.55, { keys: [k(0, 'cheek', 'A', DIR.up, DIR.in, [0.02, 0.02, 0.03]), k(1, 'cheek', 'A', DIR.up, DIR.in, [0.02, -0.04, 0.03])] }),
  sign('HOMEM', 'homem', 0.55, { keys: [k(0, 'chin', 'C', DIR.up, DIR.back, [0, -0.01, 0.04]), k(1, 'chin', 'S', DIR.up, DIR.back, [0, -0.03, 0.04])] }),
  sign('AMIGO', 'amigo', 0.6, { keys: [k(0, 'center', 'X', DIR.fwd, DIR.down, [0.02, 0.03, 0]), k(1, 'center', 'X', DIR.fwd, DIR.up, [0.02, 0.03, 0])] }, { keys: [k(0, 'center', 'X', DIR.fwd, DIR.up, [0.02, 0.0, 0])] }),
  sign('OBRIGADO', 'obrigado', 0.6, { keys: [k(0, 'forehead', 'B', DIR.up, DIR.back, [0.04, -0.02, 0.03]), k(1, 'neutral', 'B', DIR.fwd, DIR.up, [0, 0.05, 0.05])] }),
  sign('BOM', 'bom', 0.5, { keys: [k(0, 'mouth', 'O', DIR.up, DIR.back, [0, 0, 0.05]), k(1, 'neutral', '5', DIR.up, DIR.fwd, [0, 0.12, 0])] }),
  sign('MEDO', 'medo', 0.7, { keys: [k(0, 'chest', 'CLAW', d(-1, 0.3, 0), DIR.back, [0.06, 0, 0.06]), k(1, 'chest', 'CLAW', d(-1, 0.3, 0), DIR.back, [0.06, 0, 0.06])], osc: { axis: [0, 1, 0], amp: 0.008, freq: 7 } }),
  sign('FELIZ', 'feliz', 0.6, { keys: [k(0, 'chest', 'B', DIR.in, DIR.back, [0.04, -0.04, 0.05]), k(1, 'chest', 'B', DIR.in, DIR.back, [0.04, 0.05, 0.05])] }, 'alt'),
  sign('TRISTE', 'triste', 0.7, { keys: [k(0, 'eyes', '5', DIR.up, DIR.back, [0, 0.0, 0.07]), k(1, 'chin', '5', DIR.up, DIR.back, [0, -0.06, 0.08])] }, 'mirror'),
  sign('AMOR', 'amor', 0.7, { keys: [k(0, 'chest', 'S', d(-1, 0.4, 0), DIR.back, [-0.04, 0, 0.08]), k(1, 'chest', 'S', d(-1, 0.4, 0), DIR.back, [-0.04, 0, 0.06])] }, 'mirror'),
  sign('ÁGUA', 'água', 0.5, { keys: [k(0, 'chin', 'L', DIR.up, DIR.in, [0.02, 0, 0.05]), k(0.5, 'chin', 'L', DIR.up, DIR.in, [0.02, -0.02, 0.05]), k(1, 'chin', 'L', DIR.up, DIR.in, [0.02, 0, 0.05])] }),
  sign('TRABALHAR', 'trabalhar', 0.6, { keys: [k(0, 'center', 'L', DIR.fwd, DIR.in, [0.04, 0, -0.03]), k(0.5, 'center', 'L', DIR.fwd, DIR.in, [0.04, 0, 0.04]), k(1, 'center', 'L', DIR.fwd, DIR.in, [0.04, 0, -0.03])] }, 'alt'),
  sign('SABER', 'saber', 0.5, { keys: [k(0, 'temple', 'B', DIR.up, DIR.back, [0.0, 0.0, 0.05]), k(1, 'temple', 'B', DIR.up, DIR.back, [0.0, 0.0, 0.04])], osc: { axis: [0, 0, 1], amp: 0.01, freq: 4 } }),
  sign('PENSAR', 'pensar', 0.6, { keys: [k(0, 'temple', '1', DIR.up, DIR.in, [0.01, 0, 0.03]), k(1, 'temple', '1', DIR.up, DIR.in, [0.01, 0, 0.03])], osc: { axis: [0, 1, 1], amp: 0.008, freq: 2.5 } }),
  sign('FALAR', 'falar', 0.6, { keys: [k(0, 'mouth', '1', DIR.up, DIR.in, [0.02, 0, 0.06]), k(1, 'mouth', '1', DIR.up, DIR.in, [0.02, 0, 0.06])], osc: { axis: [0, 0, 1], amp: 0.025, freq: 3 } }),
  sign('OLHAR', 'olhar', 0.5, { keys: [k(0, 'eyes', 'V', DIR.fwd, DIR.down, [0, -0.02, 0.06]), k(1, 'forward', 'V', DIR.fwd, DIR.down, [0, 0.12, 0])] }),
  sign('ESPERAR', 'esperar', 0.6, { keys: [k(0, 'neutral', '5', DIR.fwd, DIR.up, [0, 0, 0]), k(1, 'neutral', '5', DIR.fwd, DIR.up, [0, 0, 0])], osc: { axis: [0, 1, 0], amp: 0.01, freq: 3 } }, 'mirror'),
  sign('PERIGO', 'perigo', 0.6, { keys: [k(0, 'neutral', 'A', DIR.up, DIR.in, [0, -0.04, 0]), k(1, 'high', 'A', DIR.up, DIR.in, [0, -0.04, 0])] }, { keys: [k(0, 'neutral', 'B', DIR.fwd, DIR.in, [0.02, 0, 0])] }),
  sign('RÁPIDO', 'rápido', 0.45, { keys: [k(0, 'neutral', 'L', DIR.fwd, DIR.in, [-0.02, 0, -0.03]), k(1, 'neutral', 'X', DIR.fwd, DIR.in, [0.02, 0, 0.05])] }, 'mirror'),
];

export const LEXICON: Record<string, SignLexiconEntry> = Object.fromEntries(L.map((e) => [e.gloss, e]));

// --------------------------------------------------------------------------
// Datilologia (alfabeto manual) — aproximação estática de cada letra.
// Letras com movimento (H, J, K, X, Y, Z, Ç) recebem uma forma estática
// representativa. Requer validação.
// --------------------------------------------------------------------------

export const ALPHABET: Record<string, { shape: HandShapeId; fingers?: Vec3; palm?: Vec3 }> = {
  A: { shape: 'A' }, B: { shape: 'B' }, C: { shape: 'C', palm: DIR.in }, D: { shape: 'D' }, E: { shape: 'E' },
  F: { shape: 'F' }, G: { shape: 'G', fingers: DIR.up, palm: DIR.in }, H: { shape: 'H', fingers: DIR.in, palm: DIR.back },
  I: { shape: 'I' }, J: { shape: 'I', fingers: d(-0.3, 1, 0) }, K: { shape: 'K' }, L: { shape: 'L' },
  M: { shape: 'M', fingers: DIR.down, palm: DIR.back }, N: { shape: 'N', fingers: DIR.down, palm: DIR.back }, O: { shape: 'O', palm: DIR.in },
  P: { shape: 'P', fingers: d(0, -0.3, 1) }, Q: { shape: 'Q', fingers: DIR.down }, R: { shape: 'R' }, S: { shape: 'S' },
  T: { shape: 'T' }, U: { shape: 'U' }, V: { shape: 'V' }, W: { shape: 'W' }, X: { shape: 'X' },
  Y: { shape: 'Y' }, Z: { shape: '1', fingers: d(0.3, 1, 0.2) }, Ç: { shape: 'C', palm: DIR.in },
};

export const LETTER_DURATION = 0.17;

export function normalizeLetters(word: string): string {
  return word
    .toUpperCase()
    .replace(/[ÁÀÂÃÄ]/g, 'A')
    .replace(/[ÉÈÊË]/g, 'E')
    .replace(/[ÍÌÎÏ]/g, 'I')
    .replace(/[ÓÒÔÕÖ]/g, 'O')
    .replace(/[ÚÙÛÜ]/g, 'U')
    .replace(/[^A-ZÇ]/g, '');
}

/** Constrói, sob demanda, uma entrada de léxico para soletrar uma palavra. */
export function fingerspellEntry(word: string): SignLexiconEntry {
  const letters = normalizeLetters(word).split('');
  const n = Math.max(1, letters.length);
  const keys: HandKeyframe[] = [];
  letters.forEach((ch, i) => {
    const a = ALPHABET[ch] ?? ALPHABET.A;
    const fingers = a.fingers ?? DIR.up;
    const palm = a.palm ?? DIR.fwd;
    const drift: Vec3 = [i * 0.012, 0, 0];
    const t0 = i / n;
    const t1 = (i + 0.7) / n;
    keys.push(k(t0 + 0.12 / n, 'spell', a.shape, fingers, palm, drift));
    keys.push(k(Math.min(1, t1), 'spell', a.shape, fingers, palm, drift));
  });
  return {
    id: `#${letters.join('')}`,
    language: 'pt-BR-LIBRAS',
    gloss: `#${letters.join('')}`,
    meaning: `datilologia: ${letters.join('-')}`,
    duration: LETTER_DURATION * n + 0.12,
    dominant: { keys },
    mouthing: true,
    validated: false,
  };
}

export function lookupSign(gloss: string): SignLexiconEntry | undefined {
  return LEXICON[gloss];
}
