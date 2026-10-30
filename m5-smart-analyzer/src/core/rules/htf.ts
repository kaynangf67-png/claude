import { confluence, HTF_FRAMES } from '../htf';
import { fmtPrice } from '../format';
import { currentContact } from '../zones';
import type { Evidence } from '../types';
import { describeZone } from './aula01';
import { insufficientData, makeResult, missingOf, pendingConfig, type RuleDefinition } from './context';

/** Confluência da zona M5 em contato com zonas de M15/H1. HIPÓTESE; nasce desligada. */
export const htfConfluenceRule: RuleDefinition = {
  id: 'confluencia_tf_maior',
  name: 'Confluência com zona de timeframe maior (hipótese)',
  role: 'contexto_positivo',
  lesson: 'Hipótese a testar (a anotação F1 cita "timeframes maiores"; não é regra da aula)',
  evaluate(ctx) {
    const ruleText =
      'Hipótese, não regra da aula: a zona M5 em contato coincide com uma zona do mesmo lado em M15 ou H1? Os candles M15/H1 são montados com M5 fechados ' +
      '(só janelas completas), com as mesmas definições de zona. Favorável se há confluência em ao menos um. Ligue em Configurações e confira no Teste histórico ' +
      '(linhas "Confluência") se ajuda ou atrapalha antes de confiar.';
    const missing = missingOf(ctx, ['zoneToleranceMult', 'retractionMinMult', 'retractionWindow']);
    if (missing.length || ctx.tolerance === null) return pendingConfig(htfConfluenceRule, missing.length ? missing : ['zoneToleranceMult'], ruleText);

    // zona M5 em contato: pelo candle em formação, ou pelo último candle fechado
    const zone = ctx.entry
      ? ctx.zones.find((z) => z.id === ctx.entry!.zoneId)
      : ctx.zones.find((z) => {
        const c = currentContact(z, ctx.lastIndex);
        return c && (c.kind === 'toque' || c.kind === 'aproximacao');
      });
    if (!zone) {
      return makeResult(htfConfluenceRule, {
        status: 'pendente', reason: 'aguardando_confirmacao',
        explanation: 'Nenhuma zona M5 em contato; a confluência é avaliada quando o preço tocar ou se aproximar de uma zona.',
        rule: ruleText,
      });
    }
    const conf = confluence(ctx.candles, zone, ctx.tolerance, ctx.config);
    const evidence: Evidence[] = conf.details.map((d) => ({
      label: `Zonas ${d.frame}`,
      value: d.status === 'ok' ? `${d.solid.length} sólidas de ${d.zones.length} (${d.candles} candles)` : d.status === 'dados_insuficientes' ? `dados insuficientes (${d.candles} candles ${d.frame}; exigido ${ctx.config.params.htfContextWindow.value})` : 'parâmetro não definido',
    }));
    const technical = { zone: describeZone(zone), byFrame: conf.byFrame, price: fmtPrice(zone.level) };
    const evaluable = HTF_FRAMES.some((f) => conf.byFrame[f.id] !== null);
    if (!evaluable) {
      return insufficientData(htfConfluenceRule, ruleText,
        `Candles M5 insuficientes para montar zonas M15/H1 (a janela de ${ctx.config.params.htfContextWindow.value} candles de H1 exige 480+ candles M5).`);
    }
    const ok = conf.frames.length > 0;
    return makeResult(htfConfluenceRule, {
      status: ok ? 'favoravel' : 'desfavoravel',
      reason: ok ? 'criterio_atendido' : 'criterio_nao_atendido',
      explanation: ok
        ? `${describeZone(zone)} coincide com zona de ${conf.frames.join(' e ')}.`
        : `${describeZone(zone)} não coincide com nenhuma zona sólida de M15 ou H1.`,
      evidence, rule: ruleText, technical, supportingIndexes: zone.pivotIndexes,
    });
  },
};
