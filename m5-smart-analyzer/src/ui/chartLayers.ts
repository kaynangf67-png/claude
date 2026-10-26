import type { AnalysisResult, Candle, Zone } from '../core/types';
import { describeZone } from '../core/rules/aula01';

/**
 * Camadas do gráfico calculadas a partir da análise, sem depender do DOM.
 * Nenhum marcador usa seta de compra/venda: o aplicativo não define gatilho.
 */

export interface Layers {
  swings: boolean;
  zones: boolean;
  opportunities: boolean;
  flow: boolean;
}

export const DEFAULT_LAYERS: Layers = { swings: true, zones: true, opportunities: true, flow: true };

export interface MarkerSpec {
  time: number;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  shape: 'circle' | 'square';
  color: string;
  text: string;
  size: number;
}

export const COLORS = {
  up: '#4caf7d',
  down: '#e5675f',
  warn: '#e0a84a',
  info: '#7aa2d6',
  swingValidated: '#c9ced4',
  swingCandidate: '#6b727a',
  resistance: '#e5675f',
  support: '#4caf7d',
} as const;

export function buildMarkers(
  analysis: AnalysisResult | null, candles: Candle[], layers: Layers, focus: { label: string; indexes: number[] } | null,
): MarkerSpec[] {
  const out: MarkerSpec[] = [];
  if (analysis) {
    if (layers.swings) {
      for (const s of analysis.swings) {
        out.push({
          time: s.t,
          position: s.kind === 'topo' ? 'aboveBar' : 'belowBar',
          shape: s.validated ? 'square' : 'circle',
          color: s.validated ? COLORS.swingValidated : COLORS.swingCandidate,
          text: s.validated ? (s.kind === 'topo' ? 'topo' : 'fundo') : (s.kind === 'topo' ? 'topo?' : 'fundo?'),
          size: s.validated ? 1 : 0.6,
        });
      }
    }
    if (layers.flow) {
      const f = analysis.filters.find((x) => x.id === 'sequencia_direcional');
      if (f && f.status === 'desfavoravel' && f.supportingIndexes.length) {
        const last = f.supportingIndexes[f.supportingIndexes.length - 1]!;
        out.push({ time: candles[last]!.t, position: 'inBar', shape: 'square', color: COLORS.down, text: `${f.supportingIndexes.length}× mesma cor`, size: 1 });
      }
    }
    if (layers.opportunities) {
      for (const o of analysis.opportunities) {
        out.push({
          time: o.t,
          position: o.side === 'resistencia' ? 'aboveBar' : 'belowBar',
          shape: 'circle', color: COLORS.warn, size: 1.6,
          text: 'zona candidata · não é gatilho',
        });
      }
    }
  }
  if (focus) {
    for (const i of focus.indexes) {
      const c = candles[i];
      if (c) out.push({ time: c.t, position: 'inBar', shape: 'circle', color: COLORS.info, text: '', size: 0.8 });
    }
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

export interface ZoneLine {
  price: number;
  color: string;
  title: string;
  zoneId: string;
}

/** Linhas de preço (borda superior e inferior) das zonas mais recentes. */
export function buildZoneLines(analysis: AnalysisResult | null, layers: Layers, limit = 6): ZoneLine[] {
  if (!analysis || !layers.zones) return [];
  const lastTouch = (z: Zone) => z.events.length ? z.events[z.events.length - 1]!.endIndex : z.firstIndex;
  const zones = [...analysis.zones].sort((a, b) => lastTouch(b) - lastTouch(a)).slice(0, limit);
  const lines: ZoneLine[] = [];
  for (const z of zones) {
    const color = z.side === 'resistencia' ? COLORS.resistance : COLORS.support;
    const touches = z.events.filter((e) => e.kind === 'toque').length;
    lines.push({ price: z.upper, color, title: `${describeZone(z).split(' ')[0]} · ${touches} toque(s)`, zoneId: z.id });
    lines.push({ price: z.lower, color, title: '', zoneId: z.id });
  }
  return lines;
}
