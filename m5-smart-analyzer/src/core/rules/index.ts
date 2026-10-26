import type { RuleDefinition, TriggerRule } from './context';
import { alternationRule, minHistoryRule, swingsRule, undefinedStructureRule, wicksRule, zonesRule } from './aula01';
import {
  bigBodyRule, breakoutRule, continuousMoveRule, nascendoProximoRule, sameColorFlowRule, velaLentaRule,
} from './naoEntrada';
import { AULA02_TRIGGERS } from './gatilho';
import { sessionRule } from './horario';

/**
 * Registro de regras. Para incorporar uma nova aula:
 *  1. crie o módulo da regra (veja docs/NOVAS-TRANSCRICOES.md);
 *  2. acrescente o id em RULE_IDS (types.ts) e a regra à lista abaixo;
 *  3. incremente RULES_VERSION (config.ts) e adicione testes.
 */
export const RULES: RuleDefinition[] = [
  wicksRule,
  alternationRule,
  swingsRule,
  zonesRule,
  minHistoryRule,
  bigBodyRule,
  sameColorFlowRule,
  nascendoProximoRule,
  velaLentaRule,
  undefinedStructureRule,
  continuousMoveRule,
  breakoutRule,
  sessionRule,
];

export const TRIGGER_RULES: TriggerRule[] = AULA02_TRIGGERS;

export type { RuleDefinition, TriggerRule, AnalysisContext } from './context';
