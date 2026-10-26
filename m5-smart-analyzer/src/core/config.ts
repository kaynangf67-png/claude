import {
  PARAM_KEYS, RULE_IDS,
  type AnalysisConfig, type Param, type ParamKey, type ParamOrigin, type RuleId,
} from './types';

/** Versão do conjunto de regras. Incrementar ao incorporar novas aulas. */
export const RULES_VERSION = 'aula-02@0.1.0';
export const CONFIG_STORAGE_KEY = 'm5sa.config.v1';

export interface ParamSpec {
  key: ParamKey;
  label: string;
  description: string;
  group: string;
  min: number;
  max: number;
  step: number;
  integer: boolean;
  /** Mostra como porcentagem (0–1 → 0–100%) na interface. */
  percent?: boolean;
  unit?: string;
}

export const PARAM_SPECS: Record<ParamKey, ParamSpec> = {
  minCandles: { key: 'minCandles', group: 'Geral', label: 'Mínimo de candles', description: 'Abaixo disso a análise fica "não avaliável".', min: 10, max: 5000, step: 1, integer: true, unit: 'candles' },
  contextWindow: { key: 'contextWindow', group: 'Geral', label: 'Janela de contexto', description: 'Candles recentes usados para topos/fundos, zonas e rompimentos.', min: 20, max: 1000, step: 1, integer: true, unit: 'candles' },
  observationWindow: { key: 'observationWindow', group: 'Geral', label: 'Janela de observação', description: 'Candles recentes usados em pavios, corpos grandes, sequências e movimento contínuo.', min: 3, max: 200, step: 1, integer: true, unit: 'candles' },

  wickRelevantRatio: { key: 'wickRelevantRatio', group: 'Regra 1 · Pavios', label: 'Pavio relevante (≥ % da amplitude)', description: 'Um candle tem pavio relevante se o maior pavio ocupa ao menos esta fração da amplitude (high − low).', min: 0.05, max: 0.95, step: 0.05, integer: false, percent: true },
  minRelevantWickCandles: { key: 'minRelevantWickCandles', group: 'Regra 1 · Pavios', label: 'Mínimo de candles com pavio relevante', description: 'Quantos candles da janela de observação precisam ter pavio relevante.', min: 1, max: 200, step: 1, integer: true, unit: 'candles' },

  alternationWindow: { key: 'alternationWindow', group: 'Regra 2 · Alternância', label: 'Janela de alternância', description: 'Candles observados para medir a alternância de cor.', min: 4, max: 200, step: 1, integer: true, unit: 'candles' },
  alternationFavorableMin: { key: 'alternationFavorableMin', group: 'Regra 2 · Alternância', label: 'Alternância frequente (taxa ≥)', description: 'Taxa de trocas de cor entre candles consecutivos que caracteriza alternância frequente.', min: 0.1, max: 1, step: 0.05, integer: false, percent: true },
  directionalDominanceMin: { key: 'directionalDominanceMin', group: 'Regra 2 · Alternância', label: 'Predominância direcional (parcela ≥)', description: 'Se uma só cor ocupa ao menos esta parcela da janela, há predominância direcional.', min: 0.5, max: 1, step: 0.05, integer: false, percent: true },

  swingLookback: { key: 'swingLookback', group: 'Regra 3 · Topos e fundos', label: 'Candles de cada lado do pivô', description: 'Um topo (fundo) geométrico precisa ser a maior máxima (menor mínima) entre N candles à esquerda e N à direita.', min: 1, max: 10, step: 1, integer: true, unit: 'candles' },
  swingMinDisplacementMult: { key: 'swingMinDisplacementMult', group: 'Regra 3 · Topos e fundos', label: 'Afastamento mínimo para validar (× amplitude média)', description: 'Quanto o preço precisa se afastar do pivô para ele deixar de ser só um candidato geométrico.', min: 0.1, max: 20, step: 0.1, integer: false, unit: '×' },
  minValidatedSwings: { key: 'minValidatedSwings', group: 'Regra 3 · Topos e fundos', label: 'Topos/fundos validados necessários', description: 'Quantidade mínima de pivôs validados na janela de contexto para considerar a estrutura definida.', min: 1, max: 50, step: 1, integer: true },

  zoneToleranceMult: { key: 'zoneToleranceMult', group: 'Regra 4 · Zonas', label: 'Tolerância da zona (× amplitude média)', description: 'Distância máxima entre pivôs para formarem a mesma zona; define também a largura da zona e da faixa de aproximação.', min: 0.05, max: 10, step: 0.05, integer: false, unit: '×' },
  retractionMinMult: { key: 'retractionMinMult', group: 'Regra 4 · Zonas', label: 'Retração mínima (× amplitude média)', description: 'Afastamento mínimo a partir do toque para a retração contar como observável.', min: 0.1, max: 20, step: 0.1, integer: false, unit: '×' },
  retractionWindow: { key: 'retractionWindow', group: 'Regra 4 · Zonas', label: 'Janela para a retração', description: 'Candles após o toque em que a retração deve ocorrer.', min: 1, max: 100, step: 1, integer: true, unit: 'candles' },

  minPriorValidTouches: { key: 'minPriorValidTouches', group: 'Regra 5 · Histórico mínimo', label: 'Toques válidos anteriores', description: 'A aula cita "pelo menos dois" antes de considerar um terceiro toque. Critério provisório.', min: 1, max: 10, step: 1, integer: true, unit: 'toques' },

  bigBodyRatio: { key: 'bigBodyRatio', group: 'Regra 6 · Não entrada', label: 'Corpo grande (corpo ≥ % da amplitude)', description: 'Candle de corpo grande e pavios pequenos: corpo ocupa ao menos esta fração da amplitude.', min: 0.5, max: 1, step: 0.05, integer: false, percent: true },
  bigBodyMinCount: { key: 'bigBodyMinCount', group: 'Regra 6 · Não entrada', label: 'Candles de corpo grande para evitar', description: 'Quantidade mínima de candles de corpo grande na janela de observação.', min: 1, max: 200, step: 1, integer: true, unit: 'candles' },
  maxSameDirectionRun: { key: 'maxSameDirectionRun', group: 'Regra 6 · Não entrada', label: 'Fluxo da mesma cor que deve ser evitado (≥)', description: 'Sequência de candles da mesma direção, terminando no último candle, que caracteriza fluxo a evitar. A aula 2 cita "três ou mais velas".', min: 2, max: 100, step: 1, integer: true, unit: 'candles' },
  triggerMinElapsedSeconds: { key: 'triggerMinElapsedSeconds', group: 'Gatilho', label: 'Cronômetro mínimo no candle', description: 'Segundos decorridos no candle em formação a partir dos quais o critério de tempo do gatilho é atendido. Aula 2: 2 min 30 s.', min: 1, max: 299, step: 1, integer: true, unit: 's' },
  continuousMoveEfficiency: { key: 'continuousMoveEfficiency', group: 'Regra 6 · Não entrada', label: 'Movimento contínuo (eficiência direcional ≥)', description: 'Razão entre o deslocamento líquido e o caminho percorrido pelos fechamentos. Perto de 1 = movimento sem retrações.', min: 0.1, max: 1, step: 0.05, integer: false, percent: true },
};

const UNDEFINED: Param = { value: null, origin: 'nao_definido' };
const technical = (value: number): Param => ({ value, origin: 'padrao_tecnico' });

export function defaultConfig(): AnalysisConfig {
  const params = Object.fromEntries(PARAM_KEYS.map((k) => [k, { ...UNDEFINED }])) as Record<ParamKey, Param>;
  params.minCandles = technical(30);
  params.contextWindow = technical(60);
  params.observationWindow = technical(12);
  params.alternationWindow = technical(12);
  params.swingLookback = technical(2);
  // Único valor que vem da aula: "pelo menos dois" topos/fundos válidos.
  params.minPriorValidTouches = { value: 2, origin: 'aula' };
  // Aula 2 (anotações): "fluxo de velas da mesma cor, três ou mais velas".
  params.maxSameDirectionRun = { value: 3, origin: 'aula' };
  // Aula 2 (anotações): cronômetro acima de 2 min 30 s no candle.
  params.triggerMinElapsedSeconds = { value: 150, origin: 'aula' };
  const enabled = Object.fromEntries(RULE_IDS.map((id) => [id, true])) as Record<RuleId, boolean>;
  return { rulesVersion: RULES_VERSION, timeframe: 'M5', enabled, params };
}

/**
 * Valores de EXPLORAÇÃO para testar o aplicativo. Não vêm da aula e não
 * foram validados estatisticamente. São marcados como `preset_exploratorio`.
 */
export const EXPLORATORY_PRESET: Partial<Record<ParamKey, number>> = {
  wickRelevantRatio: 0.35,
  minRelevantWickCandles: 5,
  alternationFavorableMin: 0.6,
  directionalDominanceMin: 0.75,
  swingMinDisplacementMult: 1.5,
  minValidatedSwings: 3,
  zoneToleranceMult: 0.75,
  retractionMinMult: 1.5,
  retractionWindow: 6,
  bigBodyRatio: 0.8,
  bigBodyMinCount: 4,
  continuousMoveEfficiency: 0.6,
};

export function applyExploratoryPreset(config: AnalysisConfig): AnalysisConfig {
  const params = { ...config.params };
  for (const [k, v] of Object.entries(EXPLORATORY_PRESET) as Array<[ParamKey, number]>) {
    // Não sobrescreve o que o usuário definiu à mão.
    if (params[k].origin === 'nao_definido' || params[k].origin === 'preset_exploratorio') {
      params[k] = { value: v, origin: 'preset_exploratorio' };
    }
  }
  return { ...config, params };
}

export function clearUndefinedParams(config: AnalysisConfig): AnalysisConfig {
  const base = defaultConfig();
  const params = { ...config.params };
  for (const k of PARAM_KEYS) {
    if (params[k].origin === 'preset_exploratorio') params[k] = base.params[k];
  }
  return { ...config, params };
}

export function setParam(config: AnalysisConfig, key: ParamKey, value: number | null): AnalysisConfig {
  const param: Param = value === null ? { value: null, origin: 'nao_definido' } : { value, origin: 'usuario' };
  return { ...config, params: { ...config.params, [key]: param } };
}

export function setRuleEnabled(config: AnalysisConfig, id: RuleId, enabled: boolean): AnalysisConfig {
  return { ...config, enabled: { ...config.enabled, [id]: enabled } };
}

/** Valor efetivo de um parâmetro (null = não definido). */
export function paramValue(config: AnalysisConfig, key: ParamKey): number | null {
  return config.params[key].value;
}

export function validateParamValue(key: ParamKey, value: number): string | null {
  const spec = PARAM_SPECS[key];
  if (!Number.isFinite(value)) return 'Valor inválido.';
  if (value < spec.min || value > spec.max) return `Use um valor entre ${spec.min} e ${spec.max}.`;
  if (spec.integer && !Number.isInteger(value)) return 'Use um número inteiro.';
  return null;
}

/** Hash estável (FNV-1a) da configuração efetiva, para comparar versões. */
export function configHash(config: AnalysisConfig): string {
  const payload = JSON.stringify({
    v: config.rulesVersion,
    tf: config.timeframe,
    e: RULE_IDS.map((id) => [id, config.enabled[id]]),
    p: PARAM_KEYS.map((k) => [k, config.params[k].value, config.params[k].origin]),
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// -------------------------------------------------------------- persistência

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const ORIGINS: ParamOrigin[] = ['aula', 'padrao_tecnico', 'preset_exploratorio', 'usuario', 'nao_definido'];

/**
 * Reconstrói uma configuração a partir de dados não confiáveis (localStorage).
 * Campos inválidos voltam ao padrão; nunca lança exceção.
 */
export function sanitizeConfig(raw: unknown): AnalysisConfig {
  const base = defaultConfig();
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;

  const enabledRaw = (typeof r.enabled === 'object' && r.enabled !== null ? r.enabled : {}) as Record<string, unknown>;
  for (const id of RULE_IDS) if (typeof enabledRaw[id] === 'boolean') base.enabled[id] = enabledRaw[id] as boolean;

  const paramsRaw = (typeof r.params === 'object' && r.params !== null ? r.params : {}) as Record<string, unknown>;
  for (const k of PARAM_KEYS) {
    const p = paramsRaw[k];
    if (typeof p !== 'object' || p === null) continue;
    const { value, origin } = p as { value?: unknown; origin?: unknown };
    if (!ORIGINS.includes(origin as ParamOrigin)) continue;
    if (value === null) {
      base.params[k] = { value: null, origin: 'nao_definido' };
    } else if (typeof value === 'number' && validateParamValue(k, value) === null) {
      base.params[k] = { value, origin: origin === 'nao_definido' ? 'usuario' : (origin as ParamOrigin) };
    }
  }
  // Os parâmetros essenciais de janela nunca podem ficar indefinidos.
  for (const k of ['minCandles', 'contextWindow', 'observationWindow', 'alternationWindow', 'swingLookback', 'minPriorValidTouches', 'maxSameDirectionRun', 'triggerMinElapsedSeconds'] as const) {
    if (base.params[k].value === null) base.params[k] = defaultConfig().params[k];
  }
  return base;
}

export function loadConfig(store: KeyValueStore): AnalysisConfig {
  try {
    const text = store.getItem(CONFIG_STORAGE_KEY);
    if (!text) return defaultConfig();
    return sanitizeConfig(JSON.parse(text));
  } catch {
    return defaultConfig();
  }
}

/** Retorna false se o armazenamento recusar a gravação (cota, modo privado). */
export function saveConfig(store: KeyValueStore, config: AnalysisConfig): boolean {
  try {
    store.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}
