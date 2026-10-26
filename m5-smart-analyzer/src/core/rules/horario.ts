import { formatDateTime, hourOfDay } from '../time';
import { makeResult, type RuleDefinition } from './context';

/**
 * Regra 7 (aula 1): apenas REGISTRA o horário e a origem. A menção a
 * "5h–12h" não é garantia nem regra universal e não influencia a classificação.
 */
export const sessionRule: RuleDefinition = {
  id: 'horario_otc',
  name: 'Horário e mercado OTC',
  role: 'informativo',
  lesson: 'Aula 1 · Regra 7',
  evaluate(ctx) {
    const tz = ctx.source?.displayTimezone ?? 'UTC';
    const t = ctx.candles[ctx.lastIndex]!.t;
    return makeResult(sessionRule, {
      status: 'nao_avaliavel',
      reason: 'informativo',
      explanation:
        'Filtro informativo: registra o horário da observação e se o gráfico é OTC. Nenhum horário recebe preferência automática, ' +
        'e a equivalência entre fontes de preço não é presumida.',
      evidence: [
        { label: 'Último candle', value: `${formatDateTime(t, tz)} (${tz})` },
        { label: 'Hora cheia (fuso de exibição)', value: `${hourOfDay(t, tz)}h` },
        { label: 'Gráfico OTC (declarado pelo usuário)', value: ctx.source ? (ctx.source.otc ? 'sim' : 'não') : 'não informado' },
        { label: 'Origem dos dados', value: ctx.source ? `${ctx.source.kind === 'csv' ? 'CSV' : 'demonstração'} — ${ctx.source.origin || ctx.source.name}` : 'não informada' },
      ],
      rule: 'Somente registro. Sem peso na classificação.',
    });
  },
};
