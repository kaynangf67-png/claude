import { candleIssue, candleMetrics, meanRange } from './candle';
import { configHash } from './config';
import { plural } from './format';
import { RULES, TRIGGER_RULES } from './rules';
import type { AnalysisContext, RuleDefinition, TriggerRule } from './rules/context';
import { detectSwings, validateSwings } from './swings';
import { buildZones, computeZoneEvents } from './zones';
import type {
  AnalysisConfig, AnalysisResult, Candle, DataSourceInfo, FilterResult, FilterStatus, IntrabarInfo,
  ScenarioState, TriggerEvaluation,
} from './types';

export const TIMEFRAME_SECONDS: Record<AnalysisConfig['timeframe'], number> = { M5: 300 };

export interface AnalyzeInput {
  /** Candles fechados em ordem cronológica. Só o que for passado é lido. */
  candles: Candle[];
  source: DataSourceInfo | null;
  config: AnalysisConfig;
  /** Informação do candle em formação, informada manualmente (opcional). */
  intrabar?: IntrabarInfo | null;
  /** Permite incorporar regras novas sem alterar o motor (padrão: registro oficial). */
  rules?: RuleDefinition[];
  triggers?: TriggerRule[];
}

const emptyCounts = (): Record<FilterStatus, number> => ({ favoravel: 0, desfavoravel: 0, pendente: 0, nao_avaliavel: 0 });

function notEvaluable(input: AnalyzeInput, reasons: string[], window: AnalysisResult['window'] = null): AnalysisResult {
  return {
    state: 'NAO_AVALIAVEL',
    summary: `Não avaliável: ${reasons.join(' ')}`,
    blockingReasons: [],
    incompleteReasons: [],
    invalidReasons: reasons,
    caveats: [],
    filters: [],
    counts: emptyCounts(),
    trigger: {
      status: 'nao_confirmado', confirmed: false, criteria: [],
      message: 'Gatilho não avaliado: os dados não permitem a análise.',
    },
    swings: [], zones: [], opportunities: [],
    window,
    rulesVersion: input.config.rulesVersion,
    configHash: configHash(input.config),
    cutoffT: input.candles.length ? input.candles[input.candles.length - 1]!.t : null,
    referenceRange: null,
  };
}

/**
 * Verifica se os dados permitem a análise. Valida somente o trecho que as
 * regras realmente usam (janela de contexto + margem do pivô).
 */
export function checkData(candles: Candle[], config: AnalysisConfig): string[] {
  const reasons: string[] = [];
  const minCandles = config.params.minCandles.value!;
  if (candles.length < minCandles) {
    reasons.push(`há ${plural(candles.length, 'candle', 'candles')}; o mínimo configurado é ${minCandles}.`);
    return reasons;
  }
  const step = TIMEFRAME_SECONDS[config.timeframe];
  const last = candles.length - 1;
  const need = config.params.contextWindow.value! + config.params.swingLookback.value! + 1;
  const from = Math.max(0, last - need + 1);
  for (let i = from; i <= last; i++) {
    const c = candles[i]!;
    const issue = candleIssue(c);
    if (issue) {
      reasons.push(`candle inválido no índice ${i} (${issue}).`);
      return reasons;
    }
    if (i > from) {
      const delta = c.t - candles[i - 1]!.t;
      if (delta <= 0) {
        reasons.push(`timestamps duplicados ou fora de ordem no índice ${i}.`);
        return reasons;
      }
      if (delta !== step) {
        reasons.push(
          delta > step
            ? `lacuna de ${plural(Math.round(delta / step) - 1, 'candle ausente', 'candles ausentes')} dentro da janela analisada (índice ${i}).`
            : `intervalo de ${delta}s entre candles consecutivos, incompatível com ${config.timeframe} (${step}s) (índice ${i}).`,
        );
        return reasons;
      }
    }
  }
  return reasons;
}

export function buildContext(input: AnalyzeInput): AnalysisContext | string[] {
  const { candles, config } = input;
  const last = candles.length - 1;
  const contextStart = Math.max(0, last - config.params.contextWindow.value! + 1);
  const obsStart = Math.max(0, last - config.params.observationWindow.value! + 1);
  const referenceRange = meanRange(candles, contextStart, last);
  if (referenceRange === null) return ['a amplitude média da janela é zero (preços constantes).'];

  const lookback = config.params.swingLookback.value!;
  const dispMult = config.params.swingMinDisplacementMult.value;
  const tolMult = config.params.zoneToleranceMult.value;
  const retMult = config.params.retractionMinMult.value;

  const swings = validateSwings(
    candles,
    detectSwings(candles, lookback, contextStart, last),
    dispMult === null ? null : dispMult * referenceRange,
    last,
  );
  const tolerance = tolMult === null ? null : tolMult * referenceRange;
  const zones = tolerance === null ? [] : buildZones(swings, tolerance);
  if (tolerance !== null) {
    for (const z of zones) {
      z.events = computeZoneEvents(z, candles, last, {
        tolerance,
        retractionMin: retMult === null ? null : retMult * referenceRange,
        retractionWindow: config.params.retractionWindow.value,
        wickRelevantRatio: config.params.wickRelevantRatio.value,
      });
    }
  }
  // Métricas só da parte realmente consultada pelas regras (as demais ficam vazias).
  const metricsFrom = Math.max(0, last - Math.max(
    config.params.contextWindow.value!, config.params.observationWindow.value!, config.params.alternationWindow.value!,
  ) - 1);
  const metrics = new Array<ReturnType<typeof candleMetrics>>(candles.length);
  for (let i = metricsFrom; i <= last; i++) metrics[i] = candleMetrics(candles[i]!);
  return {
    candles,
    metrics,
    config, lastIndex: last, contextStart, obsStart, referenceRange,
    swings, zones, tolerance,
    source: input.source, intrabar: input.intrabar ?? null, opportunities: [],
  };
}

/**
 * Motor de decisão. Função pura: não lê relógio, DOM nem armazenamento, e usa
 * exclusivamente os candles recebidos (o último é o "agora" da análise).
 *
 * Prioridades:
 *  1. dados inválidos/insuficientes → NAO_AVALIAVEL
 *  2. algum filtro de não entrada detectado → DESFAVORAVEL
 *  3. critério positivo não atendido, pendente ou filtro de não entrada sem
 *     configuração → AGUARDAR
 *  4. caso contrário → FAVORAVEL (sem implicar entrada confirmada)
 */
export function analyze(input: AnalyzeInput): AnalysisResult {
  const { config } = input;
  const rules = input.rules ?? RULES;
  const triggers = input.triggers ?? TRIGGER_RULES;

  const dataProblems = checkData(input.candles, config);
  if (dataProblems.length) return notEvaluable(input, dataProblems);
  const built = buildContext(input);
  if (Array.isArray(built)) return notEvaluable(input, built);
  const ctx = built;

  const filters: FilterResult[] = rules.filter((r) => config.enabled[r.id]).map((r) => r.evaluate(ctx));

  const counts = emptyCounts();
  for (const f of filters) if (f.role !== 'informativo') counts[f.status]++;

  const blockingFilters = filters.filter((f) => f.role === 'nao_entrada' && f.status === 'desfavoravel');
  const caveats: string[] = [];
  const incomplete: string[] = [];
  for (const f of filters) {
    if (f.role === 'informativo') continue;
    if (f.role === 'nao_entrada') {
      if (f.status === 'pendente' || (f.status === 'nao_avaliavel' && f.reason !== 'requer_candle_em_formacao')) {
        incomplete.push(`${f.name}: ${f.status === 'pendente' ? 'ausência da condição não pôde ser verificada (' + shortReason(f) + ')' : f.explanation}`);
      } else if (f.status === 'nao_avaliavel') {
        caveats.push(`${f.name}: exige o candle em formação e não pôde ser verificado com esta fonte.`);
      }
    } else if (f.status !== 'favoravel') {
      incomplete.push(`${f.name}: ${f.status === 'pendente' ? shortReason(f) : f.explanation}`);
    }
  }
  const positivesEnabled = filters.filter((f) => f.role === 'contexto_positivo');

  let state: ScenarioState;
  if (blockingFilters.length > 0) state = 'DESFAVORAVEL';
  else if (incomplete.length > 0 || positivesEnabled.length === 0) state = 'AGUARDAR';
  else state = 'FAVORAVEL';

  const trigger = evaluateTriggers(ctx, triggers, state);
  const blockingReasons = blockingFilters.map((f) => f.explanation);
  if (positivesEnabled.length === 0 && blockingFilters.length === 0) {
    incomplete.unshift('Nenhum critério positivo está habilitado em Configurações.');
  }

  const opportunities = state === 'FAVORAVEL' || state === 'AGUARDAR' ? ctx.opportunities : [];
  return {
    state,
    summary: buildSummary(state, blockingReasons, incomplete, caveats, trigger, counts),
    blockingReasons,
    incompleteReasons: incomplete,
    invalidReasons: [],
    caveats,
    filters,
    counts,
    trigger,
    swings: ctx.swings,
    zones: ctx.zones,
    opportunities,
    window: {
      fromIndex: ctx.contextStart, toIndex: ctx.lastIndex,
      fromT: ctx.candles[ctx.contextStart]!.t, toT: ctx.candles[ctx.lastIndex]!.t,
      count: ctx.lastIndex - ctx.contextStart + 1,
    },
    rulesVersion: config.rulesVersion,
    configHash: configHash(config),
    cutoffT: ctx.candles[ctx.lastIndex]!.t,
    referenceRange: ctx.referenceRange,
  };
}

function shortReason(f: FilterResult): string {
  if (f.reason === 'parametro_nao_definido') return 'parâmetro não definido';
  if (f.reason === 'aguardando_confirmacao') return 'aguardando';
  return f.reason.replace(/_/g, ' ');
}

function evaluateTriggers(ctx: AnalysisContext, triggers: TriggerRule[], state: ScenarioState): TriggerEvaluation {
  if (triggers.length === 0) {
    return { status: 'nao_definido', confirmed: false, criteria: [], message: 'Gatilho não definido nas aulas analisadas.' };
  }
  const criteria = triggers.map((t) => t.evaluate(ctx));
  const ok = criteria.filter((c) => c.status === 'atendido').length;
  const unknown = criteria.filter((c) => c.status === 'nao_avaliavel').length;
  const all = ok === criteria.length;
  const confirmed = all && state === 'FAVORAVEL';
  let message: string;
  if (confirmed) {
    message = 'Todos os critérios do gatilho registrados foram atendidos. Isso não garante resultado.';
  } else if (all) {
    message = 'Critérios do gatilho atendidos, mas o cenário não está favorável; gatilho não confirmado.';
  } else {
    message =
      `Gatilho não confirmado: ${ok} de ${criteria.length} critérios atendidos` +
      (unknown ? `, ${unknown} não avaliável(is) com os dados atuais` : '') + '.';
  }
  return { status: confirmed ? 'confirmado' : 'nao_confirmado', confirmed, criteria, message };
}

function buildSummary(
  state: ScenarioState, blocking: string[], incomplete: string[], caveats: string[],
  trigger: TriggerEvaluation, counts: Record<FilterStatus, number>,
): string {
  switch (state) {
    case 'DESFAVORAVEL':
      return `Cenário desfavorável: ${blocking.join(' ')} Recomendação: não operar neste cenário.`;
    case 'AGUARDAR': {
      const cfg = incomplete.filter((r) => r.includes('parâmetro não definido')).length;
      return (
        `Aguardar: ${plural(incomplete.length, 'critério ainda não satisfeito ou pendente', 'critérios ainda não satisfeitos ou pendentes')}` +
        (cfg ? `, ${cfg} deles por parâmetro(s) que a aula não define e que precisam ser configurados` : '') +
        '. Nenhum critério pendente é tratado como satisfeito.'
      );
    }
    case 'FAVORAVEL':
      return (
        `Cenário visualmente favorável: ${counts.favoravel} filtros favoráveis e nenhum filtro de não entrada detectado. ` +
        `Isto NÃO é uma entrada confirmada. ${trigger.message}` +
        (caveats.length ? ` Atenção: ${caveats.length} verificação(ões) exigem o candle em formação e não foram feitas.` : '')
      );
    default:
      return 'Não avaliável.';
  }
}
