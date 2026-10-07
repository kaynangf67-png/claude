export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  dpr: [number, number];
  antialias: boolean;
  /** fração dos prédios renderizados */
  buildingFraction: number;
  traffic: number;
  particles: number;
  shadows: boolean;
  stars: boolean;
  /** fração dos carros estacionados renderizados */
  parkedCarsFraction: number;
  /** teto absoluto de carros estacionados (bairros reais podem ter >10 mil vagas) */
  parkedCarsMax: number;
  /** distância máxima (m) para desenhar marcadores de vaga */
  markerDistance: number;
}

export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  low: {
    tier: 'low',
    dpr: [0.75, 1],
    antialias: false,
    buildingFraction: 0.75,
    traffic: 16,
    particles: 0,
    shadows: false,
    stars: false,
    parkedCarsFraction: 0.3,
    parkedCarsMax: 700,
    markerDistance: 420,
  },
  medium: {
    tier: 'medium',
    dpr: [1, 1.5],
    antialias: true,
    buildingFraction: 0.8,
    traffic: 30,
    particles: 140,
    shadows: false,
    stars: true,
    parkedCarsFraction: 0.42,
    parkedCarsMax: 1500,
    markerDistance: 700,
  },
  high: {
    tier: 'high',
    dpr: [1, 2],
    antialias: true,
    buildingFraction: 1,
    traffic: 42,
    particles: 360,
    shadows: true,
    stars: true,
    parkedCarsFraction: 0.5,
    parkedCarsMax: 2400,
    markerDistance: 1200,
  },
};

/**
 * Heurística de capacidade do aparelho: núcleos, memória, GPU (quando o navegador
 * revela), tela e preferência por movimento reduzido. Erra para o lado conservador.
 */
export function detectQualityTier(): QualityTier {
  if (typeof window === 'undefined') return 'medium';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let gpu = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'low';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    return 'low';
  }
  const softwareGpu = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
  const weakGpu = /mali-[gt]?[4-7]\d|adreno \(tm\) [3-5]\d\d|powervr|intel\(r\) hd graphics [2-5]/i.test(gpu);

  let score = 0;
  score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
  score += memory >= 8 ? 2 : memory >= 4 ? 1 : 0;
  score += mobile ? -1 : 1;
  if (weakGpu) score -= 2;
  if (softwareGpu) return 'low';
  if (reducedMotion) score -= 1;
  if (score >= 4) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}
