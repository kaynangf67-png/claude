import { fmtPct, plural } from '../format';
import { currentContact, priorWickTouches } from '../zones';
import { candleMetrics } from '../candle';
import type { TriggerCriterion } from '../types';
import { describeZone } from './aula01';
import { p, type AnalysisContext, type TriggerRule } from './context';

/**
 * Gatilho de entrada da retração M5 (aulas 2 e 3). Os filtros F1–F4 de não
 * entrada (reversão, vela nascendo perto, fluxo, vela lenta/parada) ficam em
 * `naoEntrada.ts` e já bloqueiam o cenário; aqui estão os critérios positivos.
 * O gatilho só é confirmado se todos forem atendidos E o cenário for FAVORÁVEL.
 */

/** "2 toques na região deixando pavio" (aula 2). */
export const REQUIRED_WICK_TOUCHES = 2;

const criterion = (
  id: string, name: string, status: TriggerCriterion['status'], explanation: string,
): TriggerCriterion => ({ id, name, status, explanation });

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export const timeTrigger: TriggerRule = {
  id: 'gatilho_tempo_restante',
  name: 'Tempo restante de pelo menos 2:30',
  evaluate(ctx: AnalysisContext) {
    const min = p(ctx, 'triggerMinRemainingSeconds');
    const { id, name } = timeTrigger;
    if (min === null) return criterion(id, name, 'nao_avaliavel', 'Tempo mínimo não definido.');
    if (!ctx.intrabar) {
      return criterion(id, name, 'nao_avaliavel',
        'Exige o cronômetro do candle atual. O CSV só traz candles fechados: informe o tempo restante (como a corretora mostra) ou conecte o feed ao vivo.');
    }
    const r = ctx.intrabar.remainingSeconds;
    return criterion(id, name, r >= min ? 'atendido' : 'nao_atendido',
      `${fmtClock(Math.max(0, r))} restantes no candle; é preciso ter pelo menos ${fmtClock(min)} (não entrar com menos).`);
  },
};

export const priorWicksTrigger: TriggerRule = {
  id: 'gatilho_velas_com_pavio',
  name: 'Velas anteriores com força a favor',
  evaluate(ctx) {
    const { id, name } = priorWicksTrigger;
    const ratio = p(ctx, 'wickRelevantRatio');
    const need = p(ctx, 'prevCandlesRequired');
    if (!ctx.entry) return criterion(id, name, 'nao_avaliavel', 'Precisa de uma zona em contato com o candle em formação para saber o lado.');
    if (ratio === null || need === null || ctx.lastIndex < 1) {
      return criterion(id, name, 'nao_avaliavel', 'Limite de pavio (Regra 1) e/ou "quantas velas anteriores" ainda não definidos.');
    }
    const res = ctx.entry.side === 'resistencia';
    const flags = [ctx.lastIndex - 1, ctx.lastIndex].map((i) => {
      const m = candleMetrics(ctx.candles[i]!);
      const wick = res ? m.upperWickRatio : m.lowerWickRatio;
      const colorFavors = res ? m.direction === 'baixa' : m.direction === 'alta';
      return (wick !== null && wick >= ratio) || colorFavors;
    });
    const ok = flags.filter(Boolean).length >= need;
    return criterion(id, name, ok ? 'atendido' : 'nao_atendido',
      `${flags.map((f) => (f ? 'com força a favor' : 'sem força a favor')).join(' e ')} (pavio ≥ ${fmtPct(ratio)} do lado da zona, ou cor a favor); exigido: ${need} de 2.`);
  },
};

/**
 * "Pico de vela" (aula 2, G3). A anotação não define o termo; interpretação
 * provisória, a confirmar: o preço do candle em formação alcançou a borda de
 * entrada da zona (a entrada acontece no pico/extremo, não antes).
 */
export const candlePeakTrigger: TriggerRule = {
  id: 'gatilho_pico_de_vela',
  name: 'Pico de vela: preço na borda da zona (interpretação)',
  evaluate(ctx) {
    const { id, name } = candlePeakTrigger;
    if (!ctx.intrabar?.forming) {
      return criterion(id, name, 'nao_avaliavel', 'Exige o preço do candle em formação.');
    }
    return ctx.entry
      ? criterion(id, name, 'atendido', `Preço em ${ctx.entry.entry.toFixed(5)}, na borda da zona (entrada no extremo).`)
      : criterion(id, name, 'nao_atendido', 'O candle em formação ainda não alcançou a borda de nenhuma zona.');
  },
};

export const twoWickTouchesTrigger: TriggerRule = {
  id: 'gatilho_dois_toques_com_pavio',
  name: '2 toques na região deixando pavio',
  evaluate(ctx) {
    const { id, name } = twoWickTouchesTrigger;
    if (ctx.tolerance === null || p(ctx, 'wickRelevantRatio') === null) {
      return criterion(id, name, 'nao_avaliavel', 'Requer a tolerância das zonas (Regra 4) e o limite de pavio relevante (Regra 1), ainda não definidos.');
    }
    const rows = ctx.entry
      ? ctx.zones.filter((z) => z.id === ctx.entry!.zoneId).map((z) => ({ z, priors: priorWickTouches(z, ctx.lastIndex + 1) }))
      : ctx.zones
        .map((z) => ({ z, cur: currentContact(z, ctx.lastIndex) }))
        .filter((r) => r.cur && (r.cur.kind === 'toque' || r.cur.kind === 'aproximacao'))
        .map((r) => ({ z: r.z, priors: priorWickTouches(r.z, r.cur!.startIndex) }));
    if (rows.length === 0) return criterion(id, name, 'nao_atendido', 'Nenhuma zona em contato.');
    const best = rows.reduce((a, b) => (b.priors.length > a.priors.length ? b : a));
    const ok = best.priors.length >= REQUIRED_WICK_TOUCHES;
    return criterion(id, name, ok ? 'atendido' : 'nao_atendido',
      `${describeZone(best.z)}: ${plural(best.priors.length, 'toque anterior deixou', 'toques anteriores deixaram')} pavio relevante (≥ ${fmtPct(p(ctx, 'wickRelevantRatio')!)}); exigido: ${REQUIRED_WICK_TOUCHES}.`);
  },
};

export const AULA03_TRIGGERS: TriggerRule[] = [timeTrigger, priorWicksTrigger, candlePeakTrigger, twoWickTouchesTrigger];
