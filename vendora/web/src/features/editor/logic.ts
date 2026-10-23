export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditState {
  crop: CropRect | null;
  rotate: 0 | 90 | 180 | 270;
  flip: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  whiteBackground: boolean;
  square: boolean;
  size: number | null;
  format: 'jpeg' | 'png' | 'webp';
}

export const INITIAL_EDIT: EditState = {
  crop: null,
  rotate: 0,
  flip: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  whiteBackground: false,
  square: false,
  size: null,
  format: 'jpeg',
};

/* ---------- Histórico (desfazer/refazer) ---------- */

export interface History {
  past: EditState[];
  present: EditState;
  future: EditState[];
  /** Chave da última alteração: mexer no mesmo controle em sequência vira um passo só. */
  lastKey: string | null;
}

export type HistoryAction =
  | { type: 'set'; patch: Partial<EditState>; key?: string }
  | { type: 'commit' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' };

export const initialHistory = (present: EditState = INITIAL_EDIT): History => ({ past: [], present, future: [], lastKey: null });

export function historyReducer(h: History, action: HistoryAction): History {
  switch (action.type) {
    case 'set': {
      const next = { ...h.present, ...action.patch };
      if (action.key && action.key === h.lastKey) return { ...h, present: next, future: [] };
      return { past: [...h.past, h.present].slice(-50), present: next, future: [], lastKey: action.key ?? null };
    }
    case 'commit':
      return { ...h, lastKey: null };
    case 'undo': {
      const prev = h.past[h.past.length - 1];
      if (!prev) return h;
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastKey: null };
    }
    case 'redo': {
      const [next, ...rest] = h.future;
      if (!next) return h;
      return { past: [...h.past, h.present], present: next, future: rest, lastKey: null };
    }
    case 'reset':
      return { past: [...h.past, h.present], present: INITIAL_EDIT, future: [], lastKey: null };
  }
}

/* ---------- Recorte ---------- */

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/**
 * Retângulo a partir de dois pontos (frações 0–1 da imagem). Com aspect=1,
 * o quadrado é calculado em PIXELS (imageAspect = largura/altura), para que
 * seja quadrado de verdade na imagem final.
 */
export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
  aspect: number | null,
  imageAspect: number,
): CropRect {
  const ax = clamp(a.x);
  const ay = clamp(a.y);
  let bx = clamp(b.x);
  let by = clamp(b.y);
  if (aspect) {
    // largura em px = w * imgW; altura em px = h * imgH → h = w * imageAspect / aspect
    const dirX = Math.sign(bx - ax) || 1;
    const dirY = Math.sign(by - ay) || 1;
    let w = Math.abs(bx - ax);
    let h = (w * imageAspect) / aspect;
    const maxH = dirY > 0 ? 1 - ay : ay;
    const maxW = dirX > 0 ? 1 - ax : ax;
    if (h > maxH) {
      h = maxH;
      w = (h * aspect) / imageAspect;
    }
    if (w > maxW) {
      w = maxW;
      h = (w * imageAspect) / aspect;
    }
    bx = ax + dirX * w;
    by = ay + dirY * h;
  }
  return { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) };
}

export const isUsableCrop = (r: CropRect | null): r is CropRect => !!r && r.width > 0.02 && r.height > 0.02;

/* ---------- Ajustes de pixel (prévia) ---------- */

/**
 * Aproxima no navegador o que o servidor faz com sharp:
 * brilho/saturação (modulate) e contraste linear em torno de 128.
 * A imagem final é sempre processada no servidor.
 */
export function adjustPixels(data: Uint8ClampedArray, brightness: number, contrast: number, saturation: number) {
  const b = 1 + brightness / 100;
  const s = 1 + saturation / 100;
  const c = 1 + contrast / 100;
  const off = 128 * (1 - c);
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]! * b;
    let g = data[i + 1]! * b;
    let bl = data[i + 2]! * b;
    if (s !== 1) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      r = lum + (r - lum) * s;
      g = lum + (g - lum) * s;
      bl = lum + (bl - lum) * s;
    }
    data[i] = r * c + off;
    data[i + 1] = g * c + off;
    data[i + 2] = bl * c + off;
  }
  return data;
}

/** Converte o estado do editor no formato da API. */
export function toOperations(e: EditState) {
  return {
    ...(isUsableCrop(e.crop) ? { crop: e.crop } : {}),
    rotate: e.rotate,
    flip: e.flip,
    brightness: e.brightness,
    contrast: e.contrast,
    saturation: e.saturation,
    whiteBackground: e.whiteBackground,
    output: { ...(e.size ? { size: e.size } : {}), square: e.square, format: e.format },
  };
}

export const isPristine = (e: EditState) => JSON.stringify(toOperations(e)) === JSON.stringify(toOperations(INITIAL_EDIT));
