import { meanRange } from './candle';
import { detectSwings, validateSwings } from './swings';
import { buildZones, computeZoneEvents, priorValidTouches } from './zones';
import type { AnalysisConfig, Candle, Zone } from './types';

/**
 * Contexto de timeframe maior (HIPÓTESE, não vem da aula). Os candles M15 e H1
 * são montados a partir de candles M5 FECHADOS; um candle maior só existe
 * quando seus 5 (ou 12) M5 estão todos presentes. Assim o candle maior ainda
 * em formação nunca é usado (sem look-ahead) e nada é preenchido.
 */

export const HTF_FRAMES = [
  { id: 'M15', factor: 3 },
  { id: 'H1', factor: 12 },
] as const;
export type HtfId = (typeof HTF_FRAMES)[number]['id'];

/** Agrega M5 em candles de `factor` × 5 min, só com janelas completas e alinhadas. */
export function aggregate(c5: Candle[], factor: number): Candle[] {
  const span = 300 * factor;
  const out: Candle[] = [];
  let i = 0;
  while (i < c5.length) {
    const k = Math.floor(c5[i]!.t / span) * span;
    let j = i;
    while (j < c5.length && Math.floor(c5[j]!.t / span) * span === k) j++;
    const g = c5.slice(i, j);
    if (g.length === factor && g.every((c, n) => c.t === k + n * 300)) {
      out.push({ t: k, o: g[0]!.o, h: Math.max(...g.map((x) => x.h)), l: Math.min(...g.map((x) => x.l)), c: g[g.length - 1]!.c });
    }
    i = j;
  }
  return out;
}

export interface HtfZones {
  frame: HtfId;
  status: 'ok' | 'dados_insuficientes' | 'parametro_nao_definido';
  zones: Zone[];
  /** Zonas com toques válidos suficientes (htfMinTouches). */
  solid: Zone[];
  candles: number;
}

/** Zonas do timeframe maior, usando as mesmas definições e múltiplos da análise M5. */
export function htfZones(c5: Candle[], frame: (typeof HTF_FRAMES)[number], config: AnalysisConfig): HtfZones {
  const p = config.params;
  const base = { frame: frame.id, zones: [] as Zone[], solid: [] as Zone[], candles: 0 };
  const tolMult = p.zoneToleranceMult.value;
  const retMult = p.retractionMinMult.value;
  const retWin = p.retractionWindow.value;
  if (tolMult === null || retMult === null || retWin === null) return { ...base, status: 'parametro_nao_definido' };

  const all = aggregate(c5, frame.factor);
  // só a sequência contígua mais recente (lacunas quebram a série)
  let start = all.length - 1;
  while (start > 0 && all[start]!.t - all[start - 1]!.t === 300 * frame.factor) start--;
  const htf = all.slice(Math.max(0, start >= 0 ? start : 0));
  const lookback = p.swingLookback.value!;
  const window = p.htfContextWindow.value!;
  if (htf.length < Math.max(window, 8 + 2 * lookback)) return { ...base, status: 'dados_insuficientes', candles: htf.length };

  const last = htf.length - 1;
  const from = Math.max(0, htf.length - window);
  const ref = meanRange(htf, from, last);
  if (ref === null) return { ...base, status: 'dados_insuficientes', candles: htf.length };
  const dispMult = p.swingMinDisplacementMult.value;
  const swings = validateSwings(htf, detectSwings(htf, lookback, from, last), dispMult === null ? null : dispMult * ref, last);
  const tolerance = tolMult * ref;
  const zones = buildZones(swings, tolerance);
  for (const z of zones) {
    z.events = computeZoneEvents(z, htf, last, {
      tolerance, retractionMin: retMult * ref, retractionWindow: retWin, wickRelevantRatio: p.wickRelevantRatio.value,
    });
  }
  const minTouches = p.htfMinTouches.value ?? 1;
  const solid = zones.filter((z) => priorValidTouches(z, htf.length).length >= minTouches);
  return { frame: frame.id, status: 'ok', zones, solid, candles: htf.length };
}

export interface Confluence {
  /** true/false por timeframe; null = não avaliável (dados ou parâmetros). */
  byFrame: Record<HtfId, boolean | null>;
  /** Quais timeframes têm zona coincidente. */
  frames: HtfId[];
  details: HtfZones[];
}

/**
 * Uma zona M5 está em confluência com um timeframe maior quando existe zona
 * do MESMO lado cuja faixa se sobrepõe à faixa M5 (ampliada pela tolerância M5).
 */
export function confluence(
  c5: Candle[], zone: Pick<Zone, 'side' | 'lower' | 'upper'>, tolerance: number, config: AnalysisConfig,
): Confluence {
  const details = HTF_FRAMES.map((f) => htfZones(c5, f, config));
  const byFrame = { M15: null, H1: null } as Record<HtfId, boolean | null>;
  const frames: HtfId[] = [];
  for (const d of details) {
    if (d.status !== 'ok') continue;
    const hit = d.solid.some((z) => z.side === zone.side && z.lower <= zone.upper + tolerance && z.upper >= zone.lower - tolerance);
    byFrame[d.frame] = hit;
    if (hit) frames.push(d.frame);
  }
  return { byFrame, frames, details };
}
