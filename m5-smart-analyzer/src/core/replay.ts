import { analyze, type AnalyzeInput } from './engine';
import type { AnalysisResult, Candle, DataSourceInfo, AnalysisConfig, ScenarioState } from './types';

/**
 * Reprodução histórica "ponto no tempo": para cada candle `i`, a análise
 * recebe SOMENTE `candles[0..i]`. Nenhum candle futuro é visível, então o
 * resultado em `i` é exatamente o que estaria disponível naquele momento.
 *
 * Esta função NÃO calcula taxa de acerto: não há gatilho/expiração
 * suficientemente definidos para medir resultado, e não otimizamos parâmetros.
 */
export interface ReplayPoint {
  index: number;
  t: number;
  state: ScenarioState;
  result: AnalysisResult;
}

export function replay(
  candles: Candle[], config: AnalysisConfig, source: DataSourceInfo | null,
  options: { from?: number; to?: number; step?: number; extra?: Partial<AnalyzeInput> } = {},
): ReplayPoint[] {
  const points: ReplayPoint[] = [];
  const from = Math.max(options.from ?? config.params.minCandles.value! - 1, 0);
  const to = Math.min(options.to ?? candles.length - 1, candles.length - 1);
  const step = Math.max(1, options.step ?? 1);
  for (let i = from; i <= to; i += step) {
    const result = analyze({ candles: candles.slice(0, i + 1), source, config, ...options.extra });
    points.push({ index: i, t: candles[i]!.t, state: result.state, result });
  }
  return points;
}

export function stateDistribution(points: ReplayPoint[]): Record<ScenarioState, number> {
  const d: Record<ScenarioState, number> = { FAVORAVEL: 0, DESFAVORAVEL: 0, AGUARDAR: 0, NAO_AVALIAVEL: 0 };
  for (const p of points) d[p.state]++;
  return d;
}
