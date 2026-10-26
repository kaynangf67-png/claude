import { PARAM_SPECS, paramValue } from '../config';
import type {
  AnalysisConfig, Candle, CandleMetrics, DataSourceInfo, Evidence, FilterReason, FilterResult,
  FilterRole, FilterStatus, IntrabarInfo, Opportunity, ParamKey, RuleId, Swing, TriggerCriterion, Zone,
} from '../types';

/**
 * Tudo o que uma regra pode ler. O contexto é construído apenas com candles
 * até `lastIndex`; as regras nunca recebem candles posteriores.
 */
export interface AnalysisContext {
  candles: Candle[];
  metrics: CandleMetrics[];
  config: AnalysisConfig;
  lastIndex: number;
  /** Primeiro índice da janela de contexto (topos/fundos, zonas). */
  contextStart: number;
  /** Primeiro índice da janela de observação (pavios, sequências...). */
  obsStart: number;
  referenceRange: number | null;
  swings: Swing[];
  zones: Zone[];
  /** Tolerância absoluta de preço das zonas; null se o parâmetro não foi definido. */
  tolerance: number | null;
  source: DataSourceInfo | null;
  intrabar: IntrabarInfo | null;
  /** Oportunidades produzidas pelas regras (zona candidata; nunca gatilho). */
  opportunities: Opportunity[];
}

export interface RuleDefinition {
  id: RuleId;
  name: string;
  role: FilterRole;
  /** Origem da regra (aula / anotação) para a documentação e o painel. */
  lesson: string;
  evaluate(ctx: AnalysisContext): FilterResult;
}

export interface TriggerRule {
  id: string;
  name: string;
  evaluate(ctx: AnalysisContext): TriggerCriterion;
}

export function p(ctx: AnalysisContext, key: ParamKey): number | null {
  return paramValue(ctx.config, key);
}

export function labelOf(key: ParamKey): string {
  return PARAM_SPECS[key].label;
}

export function missingOf(ctx: AnalysisContext, keys: ParamKey[]): ParamKey[] {
  return keys.filter((k) => p(ctx, k) === null);
}

interface ResultInit {
  status: FilterStatus;
  reason: FilterReason;
  explanation: string;
  evidence?: Evidence[];
  rule: string;
  missingParams?: ParamKey[];
  supportingIndexes?: number[];
  technical?: Record<string, unknown>;
}

export function makeResult(def: RuleDefinition, init: ResultInit): FilterResult {
  return {
    id: def.id,
    name: def.name,
    role: def.role,
    lesson: def.lesson,
    status: init.status,
    reason: init.reason,
    explanation: init.explanation,
    evidence: init.evidence ?? [],
    rule: init.rule,
    missingParams: init.missingParams ?? [],
    supportingIndexes: init.supportingIndexes ?? [],
    technical: init.technical ?? {},
  };
}

/** Resultado padrão para "parâmetro não definido pela aula". */
export function pendingConfig(
  def: RuleDefinition, missing: ParamKey[], rule: string, evidence: Evidence[] = [],
  extra: Partial<ResultInit> = {},
): FilterResult {
  return makeResult(def, {
    status: 'pendente',
    reason: 'parametro_nao_definido',
    explanation:
      `Pendente de configuração: a aula não define ${missing.map((k) => `"${labelOf(k)}"`).join(', ')}. ` +
      'Defina em Configurações para que este filtro seja avaliado; ele não é tratado como satisfeito.',
    evidence,
    rule,
    missingParams: missing,
    ...extra,
  });
}

export function insufficientData(def: RuleDefinition, rule: string, why: string): FilterResult {
  return makeResult(def, {
    status: 'nao_avaliavel',
    reason: 'dados_insuficientes',
    explanation: why,
    rule,
  });
}
