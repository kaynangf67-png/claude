import { fmtPrice } from '../format';
import { maReading } from '../ma';
import { currentContact } from '../zones';
import type { Evidence } from '../types';
import { describeZone } from './aula01';
import { insufficientData, makeResult, missingOf, pendingConfig, type RuleDefinition } from './context';

/** Alinhamento com a tendência das médias móveis. HIPÓTESE; nasce desligada. */
export const maFilterRule: RuleDefinition = {
  id: 'filtro_media_movel',
  name: 'Tendência das médias móveis a favor (hipótese)',
  role: 'contexto_positivo',
  lesson: 'Hipótese a testar (padrão técnico comum; não é regra de nenhuma aula)',
  evaluate(ctx) {
    const ruleText =
      'Hipótese, não regra da aula: com a zona em contato, a EMA rápida está do lado certo da EMA lenta? Compra em suporte pede rápida acima da lenta; ' +
      'venda em resistência pede rápida abaixo. Só candles fechados. Isto é filtro de CONTEXTO: nunca confirma gatilho. Ligue em Configurações e confira no ' +
      'Teste histórico (linha "Média móvel", com dados separados) se ajuda antes de confiar.';
    const missing = missingOf(ctx, ['maFastPeriod', 'maSlowPeriod']);
    if (missing.length) return pendingConfig(maFilterRule, missing, ruleText);
    const fast = ctx.config.params.maFastPeriod.value!;
    const slow = ctx.config.params.maSlowPeriod.value!;
    if (slow <= fast) {
      return makeResult(maFilterRule, {
        status: 'pendente', reason: 'parametro_nao_definido',
        explanation: `A média lenta (${slow}) precisa ser maior que a rápida (${fast}). Corrija em Configurações.`,
        rule: ruleText, missingParams: ['maSlowPeriod'],
      });
    }
    const zone = ctx.entry
      ? ctx.zones.find((z) => z.id === ctx.entry!.zoneId)
      : ctx.zones.find((z) => {
        const c = currentContact(z, ctx.lastIndex);
        return c && (c.kind === 'toque' || c.kind === 'aproximacao');
      });
    if (!zone) {
      return makeResult(maFilterRule, {
        status: 'pendente', reason: 'aguardando_confirmacao',
        explanation: 'Nenhuma zona em contato; o alinhamento com as médias é avaliado quando o preço tocar ou se aproximar de uma zona.',
        rule: ruleText,
      });
    }
    const r = maReading(ctx.candles.slice(0, ctx.lastIndex + 1), zone.side, fast, slow);
    if (!r) return insufficientData(maFilterRule, ruleText, `Candles insuficientes para a EMA ${slow} (precisa de ${slow * 3}+ candles fechados).`);
    const evidence: Evidence[] = [
      { label: `EMA ${fast}`, value: fmtPrice(r.fast) },
      { label: `EMA ${slow}`, value: fmtPrice(r.slow) },
      { label: 'Tendência pelas médias', value: r.trend },
    ];
    return makeResult(maFilterRule, {
      status: r.aligned ? 'favoravel' : 'desfavoravel',
      reason: r.aligned ? 'criterio_atendido' : 'criterio_nao_atendido',
      explanation: r.aligned
        ? `${describeZone(zone)}: médias em ${r.trend}, a favor de ${zone.side === 'suporte' ? 'compra' : 'venda'}.`
        : `${describeZone(zone)}: médias em ${r.trend}, contra ${zone.side === 'suporte' ? 'compra' : 'venda'} (retração contra a tendência).`,
      evidence, rule: ruleText, technical: { fast: r.fast, slow: r.slow, trend: r.trend }, supportingIndexes: zone.pivotIndexes,
    });
  },
};
