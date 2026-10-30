import { directionRuns } from '../candle';
import { fmtPct, fmtPrice, plural } from '../format';
import { currentContact, priorValidTouches } from '../zones';
import type { Evidence, Zone } from '../types';
import {
  insufficientData, makeResult, missingOf, p, pendingConfig,
  type AnalysisContext, type RuleDefinition,
} from './context';

/** Regras extraídas da primeira videoaula (escolha de pares para retração no M5). */

const L1 = 'Aula 1';

function candleRows(ctx: AnalysisContext, from: number, to: number) {
  const rows = [];
  for (let i = from; i <= to; i++) {
    const m = ctx.metrics[i]!;
    rows.push({
      index: i, t: ctx.candles[i]!.t, direction: m.direction, body: m.body,
      upperWick: m.upperWick, lowerWick: m.lowerWick, range: m.range,
      bodyRatio: m.bodyRatio, upperWickRatio: m.upperWickRatio, lowerWickRatio: m.lowerWickRatio,
    });
  }
  return rows;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function describeZone(z: Zone): string {
  return `${z.side === 'resistencia' ? 'Resistência' : 'Suporte'} ${fmtPrice(z.lower)}–${fmtPrice(z.upper)}`;
}

// ------------------------------------------------------------------ Regra 1

export const wicksRule: RuleDefinition = {
  id: 'pavios',
  name: 'Pavios visíveis',
  role: 'contexto_positivo',
  lesson: `${L1} · Regra 1`,
  evaluate(ctx) {
    const from = ctx.obsStart;
    const to = ctx.lastIndex;
    const rows = candleRows(ctx, from, to);
    const valid = rows.filter((r) => r.range > 0);
    const meanUpper = valid.length ? valid.reduce((s, r) => s + (r.upperWickRatio ?? 0), 0) / valid.length : 0;
    const meanLower = valid.length ? valid.reduce((s, r) => s + (r.lowerWickRatio ?? 0), 0) / valid.length : 0;
    const base: Evidence[] = [
      { label: 'Candles observados', value: String(rows.length) },
      { label: 'Pavio superior médio / amplitude', value: fmtPct(meanUpper) },
      { label: 'Pavio inferior médio / amplitude', value: fmtPct(meanLower) },
    ];
    const ratio = p(ctx, 'wickRelevantRatio');
    const minCount = p(ctx, 'minRelevantWickCandles');
    const ruleText =
      'Conta candles da janela de observação cujo maior pavio ocupa ao menos o limite configurado da amplitude; ' +
      'favorável se a contagem atinge o mínimo configurado. Ter pavio não é sinal de entrada.';
    const technical = { window: { from, to }, candles: rows, ratio, minCount };
    const missing = missingOf(ctx, ['wickRelevantRatio', 'minRelevantWickCandles']);
    if (missing.length) return pendingConfig(wicksRule, missing, ruleText, base, { technical, supportingIndexes: range(from, to) });

    const relevant = valid.filter((r) => Math.max(r.upperWickRatio ?? 0, r.lowerWickRatio ?? 0) >= ratio!);
    const ok = relevant.length >= minCount!;
    return makeResult(wicksRule, {
      status: ok ? 'favoravel' : 'desfavoravel',
      reason: ok ? 'criterio_atendido' : 'criterio_nao_atendido',
      explanation: ok
        ? `${plural(relevant.length, 'candle tem', 'candles têm')} pavio relevante (≥ ${fmtPct(ratio!)} da amplitude) na janela observada.`
        : `Só ${plural(relevant.length, 'candle tem', 'candles têm')} pavio relevante (≥ ${fmtPct(ratio!)} da amplitude); o mínimo configurado é ${minCount}.`,
      evidence: [...base, { label: `Candles com pavio ≥ ${fmtPct(ratio!)}`, value: `${relevant.length} (mínimo ${minCount})` }],
      rule: ruleText,
      supportingIndexes: relevant.map((r) => r.index),
      technical: { ...technical, relevantIndexes: relevant.map((r) => r.index) },
    });
  },
};

// ------------------------------------------------------------------ Regra 2

export const alternationRule: RuleDefinition = {
  id: 'alternancia',
  name: 'Alternância de cores',
  role: 'contexto_positivo',
  lesson: `${L1} · Regra 2`,
  evaluate(ctx) {
    const win = p(ctx, 'alternationWindow')!;
    const from = Math.max(0, ctx.lastIndex - win + 1);
    const to = ctx.lastIndex;
    const dirs = ctx.metrics.slice(from, to + 1).map((m) => m.direction);
    let pairs = 0;
    let alternations = 0;
    for (let i = 1; i < dirs.length; i++) {
      if (dirs[i] === 'doji' || dirs[i - 1] === 'doji') continue;
      pairs++;
      if (dirs[i] !== dirs[i - 1]) alternations++;
    }
    const ups = dirs.filter((d) => d === 'alta').length;
    const downs = dirs.filter((d) => d === 'baixa').length;
    const dojis = dirs.length - ups - downs;
    const runs = directionRuns(ctx.candles, from, to);
    const longest = runs.filter((r) => r.direction !== 'doji').reduce((m, r) => Math.max(m, r.length), 0);
    const rate = pairs > 0 ? alternations / pairs : null;
    const dominant = dirs.length > 0 ? Math.max(ups, downs) / dirs.length : 0;
    const base: Evidence[] = [
      { label: 'Janela', value: `${dirs.length} candles` },
      { label: 'Altas / baixas / dojis', value: `${ups} / ${downs} / ${dojis}` },
      { label: 'Taxa de alternância', value: rate === null ? '—' : fmtPct(rate) },
      { label: 'Maior sequência da mesma cor', value: String(longest) },
      { label: 'Parcela da cor predominante', value: fmtPct(dominant) },
    ];
    const ruleText =
      'Taxa = trocas de cor entre candles consecutivos ÷ pares comparáveis (dojis ignorados). ' +
      'Favorável se a taxa atinge o limite de alternância frequente e nenhuma cor predomina além do limite. ' +
      'Sequência de uma só cor não é, por si, motivo para entrada contrária.';
    const technical = { window: { from, to }, directions: dirs, pairs, alternations, runs, rate, dominant };
    const supportingIndexes = range(from, to);
    if (rate === null) return insufficientData(alternationRule, ruleText, 'Janela sem pares de candles comparáveis.');

    const missing = missingOf(ctx, ['alternationFavorableMin', 'directionalDominanceMin']);
    if (missing.length) return pendingConfig(alternationRule, missing, ruleText, base, { technical, supportingIndexes });

    const minRate = p(ctx, 'alternationFavorableMin')!;
    const domMin = p(ctx, 'directionalDominanceMin')!;
    if (dominant >= domMin) {
      return makeResult(alternationRule, {
        status: 'desfavoravel', reason: 'criterio_nao_atendido',
        explanation: `Predominância direcional: ${fmtPct(dominant)} da janela tem a mesma cor (limite ${fmtPct(domMin)}).`,
        evidence: base, rule: ruleText, technical, supportingIndexes,
      });
    }
    const ok = rate >= minRate;
    return makeResult(alternationRule, {
      status: ok ? 'favoravel' : 'desfavoravel',
      reason: ok ? 'criterio_atendido' : 'criterio_nao_atendido',
      explanation: ok
        ? `Alternância frequente: ${fmtPct(rate)} (limite ${fmtPct(minRate)}).`
        : `Alternância abaixo do limite: ${fmtPct(rate)} (limite ${fmtPct(minRate)}).`,
      evidence: base, rule: ruleText, technical, supportingIndexes,
    });
  },
};

// ------------------------------------------------------------------ Regra 3

export const swingsRule: RuleDefinition = {
  id: 'topos_fundos',
  name: 'Topos e fundos identificáveis',
  role: 'contexto_positivo',
  lesson: `${L1} · Regra 3`,
  evaluate(ctx) {
    const tops = ctx.swings.filter((s) => s.kind === 'topo');
    const bottoms = ctx.swings.filter((s) => s.kind === 'fundo');
    const validated = ctx.swings.filter((s) => s.validated);
    const lookback = p(ctx, 'swingLookback')!;
    const base: Evidence[] = [
      { label: 'Candidatos geométricos', value: `${tops.length} topos · ${bottoms.length} fundos` },
      { label: 'Validados', value: String(validated.length) },
      { label: 'Candles de cada lado do pivô', value: String(lookback) },
    ];
    const ruleText =
      `Candidato geométrico: máxima (mínima) maior (menor) que a dos ${lookback} candles de cada lado; ele só é conhecido ${lookback} candles depois. ` +
      'Validado: o preço se afastou do pivô ao menos o mínimo configurado (× amplitude média) usando apenas candles já fechados. ' +
      'Favorável se há o mínimo configurado de pivôs validados na janela de contexto.';
    const technical = {
      swings: ctx.swings.map((s) => ({
        kind: s.kind, index: s.index, t: s.t, price: s.price, confirmedAtIndex: s.confirmedAtIndex, confirmedAtT: s.confirmedAtT,
        displacement: s.displacement, validated: s.validated, validatedAtIndex: s.validatedAtIndex, validatedAtT: s.validatedAtT,
      })),
    };
    const supportingIndexes = [...new Set(validated.flatMap((s) => s.supportingIndexes))].sort((a, b) => a - b);
    const missing = missingOf(ctx, ['swingMinDisplacementMult', 'minValidatedSwings']);
    if (missing.length) {
      return pendingConfig(swingsRule, missing, ruleText, base, {
        technical, supportingIndexes: [...new Set(ctx.swings.flatMap((s) => s.supportingIndexes))],
      });
    }
    const min = p(ctx, 'minValidatedSwings')!;
    const ok = validated.length >= min;
    return makeResult(swingsRule, {
      status: ok ? 'favoravel' : 'desfavoravel',
      reason: ok ? 'criterio_atendido' : 'criterio_nao_atendido',
      explanation: ok
        ? `${validated.length} topos/fundos validados na janela de contexto (mínimo ${min}).`
        : `Só ${validated.length} topos/fundos validados na janela de contexto (mínimo ${min}); a estrutura ainda não está bem definida.`,
      evidence: base, rule: ruleText, technical, supportingIndexes,
    });
  },
};

// ------------------------------------------------------------------ Regra 4

export const zonesRule: RuleDefinition = {
  id: 'zonas',
  name: 'Regiões com retrações anteriores',
  role: 'contexto_positivo',
  lesson: `${L1} · Regra 4`,
  evaluate(ctx) {
    const ruleText =
      'Agrupa pivôs do mesmo lado a menos da tolerância em zonas de suporte/resistência. Classifica o último candle em relação a cada zona: ' +
      'toque (extremo alcança a faixa), aproximação (a até uma tolerância da faixa) ou rompimento (fechamento além da borda externa). ' +
      'Favorável se o último candle está tocando ou se aproximando de uma zona. Não pressupõe que a zona continuará funcionando.';
    if (ctx.tolerance === null) {
      return pendingConfig(zonesRule, ['zoneToleranceMult'], ruleText, [
        { label: 'Pivôs candidatos', value: String(ctx.swings.length) },
      ]);
    }
    const zoneRows = ctx.zones.map((z) => {
      const touches = z.events.filter((e) => e.kind === 'toque');
      const confirmed = touches.filter((e) => e.retraction?.status === 'confirmada').length;
      const breakouts = z.events.filter((e) => e.kind === 'rompimento').length;
      const cur = currentContact(z, ctx.lastIndex);
      return { zone: z, touches: touches.length, confirmed, breakouts, current: cur?.kind ?? null };
    });
    let inContact = zoneRows.filter((r) => r.current === 'toque' || r.current === 'aproximacao');
    // com candle em formação, o contato é medido pelo preço de agora
    if (ctx.entry) inContact = zoneRows.filter((r) => r.zone.id === ctx.entry!.zoneId).map((r) => ({ ...r, current: 'toque' as const }));
    const retractionDefined = p(ctx, 'retractionMinMult') !== null && p(ctx, 'retractionWindow') !== null;
    const evidence: Evidence[] = [
      { label: 'Zonas identificadas', value: String(ctx.zones.length) },
      { label: 'Tolerância', value: fmtPrice(ctx.tolerance) },
      ...zoneRows.slice(-6).map((r) => ({
        label: describeZone(r.zone),
        value:
          `${plural(r.zone.pivotIndexes.length, 'pivô', 'pivôs')} · ${plural(r.touches, 'toque', 'toques')}` +
          (retractionDefined ? ` (${r.confirmed} com retração observada)` : ' (retração por toque: critério não definido)') +
          ` · ${plural(r.breakouts, 'rompimento', 'rompimentos')}` +
          (r.current ? ` · agora: ${r.current}` : ''),
      })),
    ];
    const technical = {
      zones: ctx.zones.map((z) => ({ id: z.id, side: z.side, lower: z.lower, upper: z.upper, pivots: z.pivotIndexes, events: z.events })),
    };
    const supportingIndexes = [...new Set(inContact.flatMap((r) => r.zone.pivotIndexes))].sort((a, b) => a - b);
    if (inContact.length > 0) {
      return makeResult(zonesRule, {
        status: 'favoravel', reason: 'criterio_atendido',
        explanation:
          `Último candle em contato com: ${inContact.map((r) => `${describeZone(r.zone)} (${r.current})`).join('; ')}. ` +
          'Isso é uma região de interesse, não um gatilho.',
        evidence, rule: ruleText, technical, supportingIndexes,
      });
    }
    return makeResult(zonesRule, {
      status: 'pendente', reason: 'aguardando_confirmacao',
      explanation: ctx.zones.length
        ? 'Há zonas identificadas, mas o último candle não está tocando nem se aproximando de nenhuma. Aguardar o preço chegar a uma região.'
        : 'Nenhuma zona identificada na janela de contexto.',
      evidence, rule: ruleText, technical,
    });
  },
};

// ------------------------------------------------------------------ Regra 5

export const minHistoryRule: RuleDefinition = {
  id: 'historico_minimo',
  name: 'Histórico mínimo de toques válidos',
  role: 'contexto_positivo',
  lesson: `${L1} · Regra 5 (critério provisório)`,
  evaluate(ctx) {
    const minPrior = p(ctx, 'minPriorValidTouches')!;
    const ruleText =
      `Critério provisório: antes de considerar um novo toque como possível oportunidade, a zona precisa ter ao menos ${minPrior} toques anteriores ` +
      'válidos (toque + retração observável pelos critérios configurados). Três aproximações de preço não contam automaticamente como três toques.';
    const missing = missingOf(ctx, ['zoneToleranceMult', 'retractionMinMult', 'retractionWindow']);
    if (missing.length) {
      return pendingConfig(minHistoryRule, missing, ruleText, [{ label: 'Toques anteriores exigidos', value: String(minPrior) }]);
    }
    const rows = ctx.entry
      ? ctx.zones.filter((z) => z.id === ctx.entry!.zoneId).map((z) => ({
        zone: z, cur: { kind: 'toque' as const, startIndex: ctx.lastIndex + 1 }, priors: priorValidTouches(z, ctx.lastIndex + 1),
      }))
      : ctx.zones
        .map((z) => ({ zone: z, cur: currentContact(z, ctx.lastIndex) }))
        .filter((r) => r.cur && (r.cur.kind === 'toque' || r.cur.kind === 'aproximacao'))
        .map((r) => ({ ...r, priors: priorValidTouches(r.zone, r.cur!.startIndex) }));
    const evidence: Evidence[] = [{ label: 'Toques anteriores exigidos', value: String(minPrior) }];
    for (const r of rows) {
      evidence.push({
        label: describeZone(r.zone),
        value: `${r.priors.length} toque(s) válido(s) anterior(es); evento atual: ${r.cur!.kind}`,
      });
    }
    const technical = { zonesInContact: rows.map((r) => ({ id: r.zone.id, current: r.cur, priors: r.priors })) };
    if (rows.length === 0) {
      return makeResult(minHistoryRule, {
        status: 'pendente', reason: 'aguardando_confirmacao',
        explanation: 'Nenhuma zona em contato com o último candle; não há toque a avaliar.',
        evidence, rule: ruleText, technical,
      });
    }
    const best = rows.reduce((a, b) => (b.priors.length > a.priors.length ? b : a));
    if (best.priors.length >= minPrior) {
      const nth = best.priors.length + 1;
      ctx.opportunities.push({
        zoneId: best.zone.id, side: best.zone.side, index: ctx.lastIndex, t: ctx.candles[ctx.lastIndex]!.t,
        priorValidTouches: best.priors.length, entryConfirmed: false,
        note: `Possível ${nth}º toque em ${describeZone(best.zone)}. Zona candidata, não é gatilho de entrada.`,
      });
      return makeResult(minHistoryRule, {
        status: 'favoravel', reason: 'criterio_atendido',
        explanation: `${describeZone(best.zone)} tem ${plural(best.priors.length, 'toque válido anterior', 'toques válidos anteriores')}; o contato atual seria o ${nth}º. Zona candidata, sem gatilho confirmado.`,
        evidence, rule: ruleText, technical,
        supportingIndexes: [...best.priors.map((e) => e.extremeIndex!), ctx.lastIndex],
      });
    }
    return makeResult(minHistoryRule, {
      status: 'desfavoravel', reason: 'criterio_nao_atendido',
      explanation: `Zona em contato, mas com histórico insuficiente: ${best.priors.length} de ${minPrior} toques válidos anteriores.`,
      evidence, rule: ruleText, technical,
    });
  },
};

// ------------------------------------------------------------------ Regra 6c

export const undefinedStructureRule: RuleDefinition = {
  id: 'estrutura_indefinida',
  name: 'Topos e fundos pouco definidos',
  role: 'nao_entrada',
  lesson: `${L1} · Regra 6`,
  evaluate(ctx) {
    const validated = ctx.swings.filter((s) => s.validated);
    const ruleText =
      'Filtro de não entrada: detectado quando há menos topos/fundos validados na janela de contexto do que o mínimo configurado na Regra 3.';
    const missing = missingOf(ctx, ['swingMinDisplacementMult', 'minValidatedSwings']);
    const evidence: Evidence[] = [
      { label: 'Candidatos geométricos', value: String(ctx.swings.length) },
      { label: 'Validados', value: String(validated.length) },
    ];
    if (missing.length) return pendingConfig(undefinedStructureRule, missing, ruleText, evidence);
    const min = p(ctx, 'minValidatedSwings')!;
    const hit = validated.length < min;
    return makeResult(undefinedStructureRule, {
      status: hit ? 'desfavoravel' : 'favoravel',
      reason: hit ? 'condicao_detectada' : 'condicao_ausente',
      explanation: hit
        ? `Topos e fundos pouco definidos: ${validated.length} validados (mínimo ${min}).`
        : `Estrutura definida: ${validated.length} topos/fundos validados (mínimo ${min}).`,
      evidence, rule: ruleText,
      supportingIndexes: [...new Set(validated.flatMap((s) => s.supportingIndexes))].sort((a, b) => a - b),
    });
  },
};
