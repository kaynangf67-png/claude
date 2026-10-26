import { fmtPct, plural } from '../format';
import { currentContact, priorWickTouches } from '../zones';
import type { TriggerCriterion } from '../types';
import { describeZone, wicksRule } from './aula01';
import { p, type AnalysisContext, type TriggerRule } from './context';

/**
 * Gatilho de entrada da retração M5 (aula 2, anotações manuscritas).
 * Todos os critérios precisam ser atendidos E o cenário precisa estar
 * "favorável" (sem filtros de não entrada detectados).
 */

/** "2 toques na região deixando pavio" (aula 2). */
export const REQUIRED_WICK_TOUCHES = 2;

const criterion = (
  id: string, name: string, status: TriggerCriterion['status'], explanation: string,
): TriggerCriterion => ({ id, name, status, explanation });

export const timerTrigger: TriggerRule = {
  id: 'gatilho_cronometro',
  name: 'Cronômetro acima de 2 min 30 s',
  evaluate(ctx: AnalysisContext) {
    const min = p(ctx, 'triggerMinElapsedSeconds');
    const name = timerTrigger.name;
    if (min === null) return criterion(timerTrigger.id, name, 'nao_avaliavel', 'Tempo mínimo não definido.');
    if (!ctx.intrabar) {
      return criterion(timerTrigger.id, name, 'nao_avaliavel',
        'Exige saber há quanto tempo o candle atual está aberto. O CSV traz só candles fechados: informe os segundos decorridos (entrada manual) para avaliar.');
    }
    const e = ctx.intrabar.elapsedSeconds;
    return criterion(timerTrigger.id, name, e >= min ? 'atendido' : 'nao_atendido',
      `${e}s decorridos no candle atual (informado manualmente); mínimo ${min}s.`);
  },
};

export const priorWicksTrigger: TriggerRule = {
  id: 'gatilho_velas_com_pavio',
  name: 'Velas anteriores deixando pavio',
  evaluate(ctx) {
    const r = wicksRule.evaluate(ctx);
    const name = priorWicksTrigger.name;
    if (r.status === 'favoravel') return criterion(priorWicksTrigger.id, name, 'atendido', r.explanation);
    if (r.status === 'desfavoravel') return criterion(priorWicksTrigger.id, name, 'nao_atendido', r.explanation);
    return criterion(priorWicksTrigger.id, name, 'nao_avaliavel', 'Limites de pavio da Regra 1 ainda não definidos.');
  },
};

export const candlePeakTrigger: TriggerRule = {
  id: 'gatilho_pico_de_vela',
  name: 'Pico de vela',
  evaluate: () =>
    criterion(candlePeakTrigger.id, candlePeakTrigger.name, 'nao_avaliavel',
      'Anotação "pico de vela" sem definição operacional (parece depender do preço do candle em formação atingir o extremo da região). Não implementado.'),
};

export const twoWickTouchesTrigger: TriggerRule = {
  id: 'gatilho_dois_toques_com_pavio',
  name: '2 toques na região deixando pavio',
  evaluate(ctx) {
    const name = twoWickTouchesTrigger.name;
    const id = twoWickTouchesTrigger.id;
    if (ctx.tolerance === null || p(ctx, 'wickRelevantRatio') === null) {
      return criterion(id, name, 'nao_avaliavel', 'Requer a tolerância das zonas (Regra 4) e o limite de pavio relevante (Regra 1), ainda não definidos.');
    }
    const rows = ctx.zones
      .map((z) => ({ z, cur: currentContact(z, ctx.lastIndex) }))
      .filter((r) => r.cur && (r.cur.kind === 'toque' || r.cur.kind === 'aproximacao'))
      .map((r) => ({ ...r, priors: priorWickTouches(r.z, r.cur!.startIndex) }));
    if (rows.length === 0) return criterion(id, name, 'nao_atendido', 'Nenhuma zona em contato com o último candle.');
    const best = rows.reduce((a, b) => (b.priors.length > a.priors.length ? b : a));
    const ok = best.priors.length >= REQUIRED_WICK_TOUCHES;
    return criterion(id, name, ok ? 'atendido' : 'nao_atendido',
      `${describeZone(best.z)}: ${plural(best.priors.length, 'toque anterior deixou', 'toques anteriores deixaram')} pavio relevante (≥ ${fmtPct(p(ctx, 'wickRelevantRatio')!)}); exigido: ${REQUIRED_WICK_TOUCHES}.`);
  },
};

export const AULA02_TRIGGERS: TriggerRule[] = [timerTrigger, priorWicksTrigger, candlePeakTrigger, twoWickTouchesTrigger];
