/**
 * Tipos centrais do núcleo de análise. Nada aqui depende de React ou do DOM.
 * Todos os instantes (`t`) são segundos Unix em UTC.
 */

export type Direction = 'alta' | 'baixa' | 'doji';

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export interface CandleMetrics {
  direction: Direction;
  /** |close - open| */
  body: number;
  /** high - max(open, close) */
  upperWick: number;
  /** min(open, close) - low */
  lowerWick: number;
  /** high - low */
  range: number;
  /** body / range; null quando a amplitude é zero */
  bodyRatio: number | null;
  upperWickRatio: number | null;
  lowerWickRatio: number | null;
}

// ---------------------------------------------------------------- parâmetros

/**
 * Origem de cada parâmetro. Serve para nunca apresentar como "ensinado na
 * aula" um valor que não veio da aula.
 *  - aula:                valor citado explicitamente na videoaula
 *  - padrao_tecnico:      escolha técnica neutra do aplicativo (ex.: tamanho de janela)
 *  - preset_exploratorio: valor de teste aplicado pelo usuário; NÃO vem da aula
 *  - usuario:             definido manualmente pelo usuário
 *  - nao_definido:        a aula não define; o filtro fica pendente
 */
export type ParamOrigin =
  | 'aula'
  | 'padrao_tecnico'
  | 'preset_exploratorio'
  | 'usuario'
  | 'nao_definido';

export interface Param {
  value: number | null;
  origin: ParamOrigin;
}

export const PARAM_KEYS = [
  'minCandles',
  'contextWindow',
  'observationWindow',
  'wickRelevantRatio',
  'minRelevantWickCandles',
  'alternationWindow',
  'alternationFavorableMin',
  'directionalDominanceMin',
  'swingLookback',
  'swingMinDisplacementMult',
  'minValidatedSwings',
  'zoneToleranceMult',
  'retractionMinMult',
  'retractionWindow',
  'minPriorValidTouches',
  'bigBodyRatio',
  'bigBodyMinCount',
  'maxSameDirectionRun',
  'triggerMinRemainingSeconds',
  'approachATR',
  'reversalATR',
  'slowEfficiencyMax',
  'stoppedRangeATR',
  'prevCandlesRequired',
  'payoutPercent',
  'htfContextWindow',
  'htfMinTouches',
  'maFastPeriod',
  'maSlowPeriod',
  'continuousMoveEfficiency',
] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

export const RULE_IDS = [
  'pavios',
  'alternancia',
  'topos_fundos',
  'zonas',
  'historico_minimo',
  'corpo_grande',
  'sequencia_direcional',
  'reversao',
  'vela_proxima_regiao',
  'vela_lenta_parada',
  'estrutura_indefinida',
  'confluencia_tf_maior',
  'filtro_media_movel',
  'movimento_continuo',
  'rompimento_sem_retracao',
  'horario_otc',
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export type Timeframe = 'M5';

export interface AnalysisConfig {
  /** Versão do conjunto de regras (aula/transcrição incorporada). */
  rulesVersion: string;
  timeframe: Timeframe;
  enabled: Record<RuleId, boolean>;
  params: Record<ParamKey, Param>;
}

// -------------------------------------------------------------------- fonte

export type SourceKind = 'demo_sintetico' | 'csv' | 'binance_live' | 'mt5_arquivo';

export interface DataSourceInfo {
  kind: SourceKind;
  /** Nome do arquivo ou do conjunto de demonstração. */
  name: string;
  /** Descrição livre da procedência informada pelo usuário. */
  origin: string;
  /** Verdadeiro para dados fictícios (demo embutida ou CSV marcado como teste). */
  synthetic: boolean;
  /** Ativo informado pelo usuário (opcional). */
  asset: string;
  /** O usuário declarou que o gráfico é OTC. */
  otc: boolean;
  /** Fuso usado para interpretar timestamps sem offset (ou 'UTC'). */
  timezone: string;
  /** Fuso para exibir horários ao usuário. */
  displayTimezone: string;
  importedAt: number;
  rows: number;
  firstT: number;
  lastT: number;
  /** Identificador estável do conjunto (nome + primeiro/último instante + contagem). */
  datasetId: string;
}

// ------------------------------------------------------------------- filtros

export type FilterStatus = 'favoravel' | 'desfavoravel' | 'pendente' | 'nao_avaliavel';

/**
 *  - contexto_positivo: evidência a favor de um cenário de retração
 *  - nao_entrada:       condição que, se detectada, leva a "desfavorável"
 *  - informativo:       só registra informação; não entra na classificação
 */
export type FilterRole = 'contexto_positivo' | 'nao_entrada' | 'informativo';

export type FilterReason =
  | 'parametro_nao_definido'
  | 'criterio_nao_atendido'
  | 'aguardando_confirmacao'
  | 'dados_insuficientes'
  | 'requer_candle_em_formacao'
  | 'condicao_detectada'
  | 'condicao_ausente'
  | 'criterio_atendido'
  | 'informativo';

export interface Evidence {
  label: string;
  value: string;
}

export interface FilterResult {
  id: RuleId;
  name: string;
  role: FilterRole;
  lesson: string;
  status: FilterStatus;
  reason: FilterReason;
  /** Explicação objetiva em português. */
  explanation: string;
  evidence: Evidence[];
  /** Regra usada, em linguagem natural, com os limites efetivos. */
  rule: string;
  /** Parâmetros ainda não definidos que impedem a conclusão. */
  missingParams: ParamKey[];
  /** Índices (no vetor completo de candles) que sustentam a classificação. */
  supportingIndexes: number[];
  /** Dados brutos para o painel "detalhes técnicos". */
  technical: Record<string, unknown>;
}

// ------------------------------------------------------------ estrutura/zonas

export interface Swing {
  index: number;
  t: number;
  kind: 'topo' | 'fundo';
  price: number;
  /** Índice do candle em que o candidato passou a ser conhecido (index + lookback). */
  confirmedAtIndex: number;
  confirmedAtT: number;
  /** Candles que sustentam o pivô (vizinhos usados na comparação). */
  supportingIndexes: number[];
  /** Maior afastamento do preço desde o pivô, usando só candles até o corte. */
  displacement: number;
  /** Validado pelo critério de afastamento mínimo (requer parâmetro definido). */
  validated: boolean;
  validatedAtIndex: number | null;
  validatedAtT: number | null;
}

export type RetractionStatus =
  | 'confirmada'
  | 'aguardando'
  | 'ausente'
  | 'rompida'
  | 'em_andamento'
  | 'indefinida';

export interface ContactEvent {
  kind: 'toque' | 'aproximacao' | 'rompimento';
  startIndex: number;
  endIndex: number;
  startT: number;
  endT: number;
  /** Para toques: o pavio ultrapassou a borda externa da zona sem fechar além dela. */
  pierced: boolean;
  /** Para toques: candle que marcou o extremo do contato (maior máxima / menor mínima). */
  extremeIndex: number | null;
  /** Para toques: o candle do extremo deixou pavio relevante do lado da zona (null = limite de pavio não definido). */
  leftWick: boolean | null;
  /** Apenas para toques. */
  retraction: {
    status: RetractionStatus;
    magnitude: number;
    confirmedAtIndex: number | null;
    confirmedAtT: number | null;
  } | null;
  /** Apenas para rompimentos: o preço voltou a fechar do lado original da zona. */
  returned: boolean | null;
}

export interface Zone {
  id: string;
  side: 'resistencia' | 'suporte';
  lower: number;
  upper: number;
  level: number;
  pivotIndexes: number[];
  firstIndex: number;
  events: ContactEvent[];
}

export interface Opportunity {
  zoneId: string;
  side: 'resistencia' | 'suporte';
  index: number;
  t: number;
  priorValidTouches: number;
  /** Sempre falso: o aplicativo não define gatilho de entrada. */
  entryConfirmed: false;
  note: string;
}

// ------------------------------------------------------------------- gatilho

export interface TriggerCriterion {
  id: string;
  name: string;
  /** nao_avaliavel = a fonte de dados atual não traz a informação necessária. */
  status: 'atendido' | 'nao_atendido' | 'nao_avaliavel';
  explanation: string;
}

export interface TriggerEvaluation {
  /**
   *  - nao_definido:   nenhuma regra de gatilho registrada
   *  - nao_confirmado: algum critério não atendido ou não avaliável
   *  - confirmado:     todos os critérios atendidos
   */
  status: 'nao_definido' | 'nao_confirmado' | 'confirmado';
  confirmed: boolean;
  message: string;
  criteria: TriggerCriterion[];
}

/**
 * Informação do candle em formação (intra-candle). Vem do feed ao vivo ou,
 * parcialmente, de entrada manual (só `remainingSeconds`).
 */
export interface IntrabarInfo {
  /** Segundos que faltam para o candle M5 fechar (como o cronômetro da corretora). */
  remainingSeconds: number;
  /** OHLC do candle em formação até agora. Ausente na entrada manual. */
  forming?: { o: number; h: number; l: number; c: number };
  /** Candles de 1 minuto já fechados dentro do candle em formação. */
  m1?: Candle[];
  /** Dica para análises históricas: avaliar contato apenas com esta zona. */
  focusZoneId?: string;
}

/** Zona em contato com o candle em formação: onde uma entrada seria avaliada. */
export interface EntryCandidate {
  zoneId: string;
  side: 'resistencia' | 'suporte';
  /** Borda de entrada da zona (limite inferior da resistência / superior do suporte). */
  edge: number;
  /** Preço de entrada presumido: o preço atual limitado à borda. */
  entry: number;
  /** Toques anteriores válidos (com retração observável). */
  priorValidTouches: number;
  /** Atende ao histórico mínimo de toques válidos (critério provisório da aula 1). */
  armed: boolean;
}

// ------------------------------------------------------------------- análise

export type ScenarioState = 'FAVORAVEL' | 'DESFAVORAVEL' | 'AGUARDAR' | 'NAO_AVALIAVEL';

export interface AnalysisResult {
  state: ScenarioState;
  summary: string;
  /** Motivos de não entrada (apenas filtros `nao_entrada` detectados). */
  blockingReasons: string[];
  /** Critérios pendentes ou ainda não atendidos. */
  incompleteReasons: string[];
  /** Quando NAO_AVALIAVEL: por quê. */
  invalidReasons: string[];
  /** Verificações que a fonte de dados atual não permite fazer (ex.: candle em formação). Não bloqueiam, mas devem ser lidas. */
  caveats: string[];
  filters: FilterResult[];
  counts: Record<FilterStatus, number>;
  trigger: TriggerEvaluation;
  /** Zona em contato com o candle em formação (null sem candle em formação ou sem contato). */
  entry: EntryCandidate | null;
  swings: Swing[];
  zones: Zone[];
  opportunities: Opportunity[];
  window: { fromIndex: number; toIndex: number; fromT: number; toT: number; count: number } | null;
  rulesVersion: string;
  configHash: string;
  /** Instante do último candle usado (corte). Nenhum candle posterior foi lido. */
  cutoffT: number | null;
  /** Escala de referência (amplitude média da janela). */
  referenceRange: number | null;
}
