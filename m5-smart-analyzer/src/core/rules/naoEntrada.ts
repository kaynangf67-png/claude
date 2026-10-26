import { directionRuns } from '../candle';
import { fmtNum, fmtPct, fmtPrice, plural } from '../format';
import type { Evidence } from '../types';
import { describeZone } from './aula01';
import { insufficientData, makeResult, missingOf, p, pendingConfig, type RuleDefinition } from './context';

/**
 * Filtros de NÃO entrada. Quando detectados, o cenário é "desfavorável".
 * Regra 6 da aula 1 e filtros F da aula 2 (anotações manuscritas).
 */

const L1 = 'Aula 1 · Regra 6';
const L2 = 'Aula 2 · Filtros de não entrada (anotações)';
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// -------------------------------------------- corpo grande e pavios pequenos

export const bigBodyRule: RuleDefinition = {
  id: 'corpo_grande',
  name: 'Corpos grandes com pavios pequenos',
  role: 'nao_entrada',
  lesson: L1,
  evaluate(ctx) {
    const from = ctx.obsStart;
    const to = ctx.lastIndex;
    const ratio = p(ctx, 'bigBodyRatio');
    const minCount = p(ctx, 'bigBodyMinCount');
    const ruleText =
      'Candle de corpo grande e pavios pequenos = corpo ≥ limite configurado da amplitude. Detectado quando a janela de observação ' +
      'tem ao menos o mínimo configurado desses candles. (A amplitude absoluta do candle não é considerada; refinamento pendente.)';
    const rows = ctx.metrics.slice(from, to + 1).map((m, i) => ({ index: from + i, bodyRatio: m.bodyRatio }));
    const mean = rows.filter((r) => r.bodyRatio !== null);
    const evidence: Evidence[] = [
      { label: 'Candles observados', value: String(rows.length) },
      { label: 'Corpo médio / amplitude', value: mean.length ? fmtPct(mean.reduce((s, r) => s + r.bodyRatio!, 0) / mean.length) : '—' },
    ];
    const missing = missingOf(ctx, ['bigBodyRatio', 'bigBodyMinCount']);
    if (missing.length) return pendingConfig(bigBodyRule, missing, ruleText, evidence, { technical: { rows } });
    const big = rows.filter((r) => r.bodyRatio !== null && r.bodyRatio >= ratio!);
    const hit = big.length >= minCount!;
    return makeResult(bigBodyRule, {
      status: hit ? 'desfavoravel' : 'favoravel',
      reason: hit ? 'condicao_detectada' : 'condicao_ausente',
      explanation: hit
        ? `${plural(big.length, 'candle tem', 'candles têm')} corpo ≥ ${fmtPct(ratio!)} da amplitude (mínimo ${minCount}): corpos grandes com pavios pequenos.`
        : `${plural(big.length, 'candle tem', 'candles têm')} corpo grande (≥ ${fmtPct(ratio!)}); abaixo do mínimo de ${minCount}.`,
      evidence: [...evidence, { label: `Candles com corpo ≥ ${fmtPct(ratio!)}`, value: String(big.length) }],
      rule: ruleText, supportingIndexes: big.map((r) => r.index), technical: { rows, bigIndexes: big.map((r) => r.index) },
    });
  },
};

// ------------------------------------------------ fluxo da mesma cor (aula 2)

export const sameColorFlowRule: RuleDefinition = {
  id: 'sequencia_direcional',
  name: 'Fluxo de velas da mesma cor',
  role: 'nao_entrada',
  lesson: `${L2} · F3 (e Regra 6 da aula 1)`,
  evaluate(ctx) {
    const limit = p(ctx, 'maxSameDirectionRun');
    // Fluxo atual: caminha para trás a partir do último candle.
    const dirOf = (c: { o: number; c: number }) => (c.c === c.o ? 'doji' : c.c > c.o ? 'alta' : 'baixa');
    const dirNow = dirOf(ctx.candles[ctx.lastIndex]!);
    let startIdx = ctx.lastIndex;
    while (startIdx > 0 && dirOf(ctx.candles[startIdx - 1]!) === dirNow) startIdx--;
    const last = { direction: dirNow, startIndex: startIdx, endIndex: ctx.lastIndex, length: ctx.lastIndex - startIdx + 1 };
    const trailing = dirNow === 'doji' ? 0 : last.length;
    const from = ctx.obsStart;
    const longestInWindow = directionRuns(ctx.candles, from, ctx.lastIndex)
      .filter((r) => r.direction !== 'doji')
      .reduce((m, r) => Math.max(m, r.length), 0);
    const evidence: Evidence[] = [
      { label: 'Fluxo atual (terminando no último candle)', value: trailing ? `${trailing} candles de ${last.direction}` : 'último candle é doji' },
      { label: 'Maior sequência na janela de observação', value: String(longestInWindow) },
    ];
    const ruleText =
      'Aula 2: "fluxo de vela da mesma cor, três ou mais velas" é filtro de não entrada. Medido pela sequência de mesma direção que TERMINA no último candle ' +
      '(o fluxo atual); sequências antigas já interrompidas não bloqueiam. Dojis interrompem a sequência.';
    const technical = { trailingRun: last, longestInWindow };
    if (limit === null) return pendingConfig(sameColorFlowRule, ['maxSameDirectionRun'], ruleText, evidence, { technical });
    const hit = trailing >= limit;
    return makeResult(sameColorFlowRule, {
      status: hit ? 'desfavoravel' : 'favoravel',
      reason: hit ? 'condicao_detectada' : 'condicao_ausente',
      explanation: hit
        ? `Fluxo de ${trailing} candles de ${last.direction} consecutivos (limite: ${limit} ou mais).`
        : `Fluxo atual de ${trailing} candle(s) da mesma cor, abaixo do limite de ${limit}.`,
      evidence, rule: ruleText, technical,
      supportingIndexes: hit ? range(last.startIndex, last.endIndex) : [],
    });
  },
};

// ---------------------------- filtros que exigem o candle em formação (aula 2)

function intrabarOnly(
  id: 'vela_proxima_regiao' | 'vela_lenta_parada', name: string, tag: string, sentence: string, ruleText: string,
): RuleDefinition {
  const def: RuleDefinition = {
    id, name, role: 'nao_entrada', lesson: `${L2} · ${tag}`,
    evaluate: () =>
      makeResult(def, {
        status: 'nao_avaliavel',
        reason: 'requer_candle_em_formacao',
        explanation:
          `Anotação da aula 2: ${sentence} Este filtro depende do candle em formação (preço e ritmo em tempo real); ` +
          'a fonte atual só traz candles fechados. Confira manualmente no gráfico antes de qualquer decisão.',
        rule: ruleText,
      }),
  };
  return def;
}

export const nascendoProximoRule = intrabarOnly(
  'vela_proxima_regiao', 'Vela nascendo próxima da região', 'F2',
  '"vela nascendo próximo da região" é um sinal de rompimento.',
  'Não implementado com dados fechados: não há definição numérica de "próximo" nem leitura do candle em formação.',
);

export const velaLentaRule = intrabarOnly(
  'vela_lenta_parada', 'Vela lenta ou parada', 'F4',
  '"vela lenta ou parada" na região indica chance de rompimento.',
  'Não implementado com dados fechados: "lenta/parada" depende da velocidade do preço dentro do candle.',
);

// ---------------------------------------------------- movimento contínuo (6d)

export const continuousMoveRule: RuleDefinition = {
  id: 'movimento_continuo',
  name: 'Movimento contínuo sem retrações',
  role: 'nao_entrada',
  lesson: L1,
  evaluate(ctx) {
    const from = ctx.obsStart;
    const to = ctx.lastIndex;
    const ruleText =
      'Eficiência direcional = |fechamento final − fechamento inicial| ÷ soma dos deslocamentos candle a candle, na janela de observação. ' +
      'Perto de 1 significa avanço quase sem retrações. Detectado se atinge o limite configurado. (Operacionalização provisória.)';
    if (to - from < 2) return insufficientData(continuousMoveRule, ruleText, 'Janela de observação curta demais.');
    let path = 0;
    for (let i = from + 1; i <= to; i++) path += Math.abs(ctx.candles[i]!.c - ctx.candles[i - 1]!.c);
    const net = ctx.candles[to]!.c - ctx.candles[from]!.c;
    const eff = path > 0 ? Math.abs(net) / path : 0;
    const evidence: Evidence[] = [
      { label: 'Deslocamento líquido', value: fmtPrice(net) },
      { label: 'Caminho percorrido', value: fmtPrice(path) },
      { label: 'Eficiência direcional', value: fmtPct(eff) },
    ];
    const limit = p(ctx, 'continuousMoveEfficiency');
    const technical = { from, to, net, path, efficiency: eff };
    if (limit === null) return pendingConfig(continuousMoveRule, ['continuousMoveEfficiency'], ruleText, evidence, { technical });
    const hit = eff >= limit;
    return makeResult(continuousMoveRule, {
      status: hit ? 'desfavoravel' : 'favoravel',
      reason: hit ? 'condicao_detectada' : 'condicao_ausente',
      explanation: hit
        ? `Movimento contínuo sem retrações claras: eficiência ${fmtPct(eff)} (limite ${fmtPct(limit)}).`
        : `Há retrações na janela: eficiência ${fmtPct(eff)}, abaixo do limite de ${fmtPct(limit)}.`,
      evidence, rule: ruleText, technical, supportingIndexes: range(from, to),
    });
  },
};

// --------------------------------------------- rompimento sem retração (6e)

export const breakoutRule: RuleDefinition = {
  id: 'rompimento_sem_retracao',
  name: 'Rompimento sem retração observável',
  role: 'nao_entrada',
  lesson: L1,
  evaluate(ctx) {
    const minPrior = p(ctx, 'minPriorValidTouches')!;
    const ruleText =
      'Detectado quando, na janela de observação, um candle fechou além da borda externa de uma região consolidada e o preço ainda não voltou ' +
      `a fechar do lado original. Região consolidada = zona com ao menos ${minPrior} toques válidos (com retração observável) antes do rompimento; ` +
      'zonas fracas não contam. Rompimento não é confirmação de retração.';
    const missing = missingOf(ctx, ['zoneToleranceMult', 'retractionMinMult', 'retractionWindow']);
    if (missing.length) return pendingConfig(breakoutRule, missing, ruleText);
    const hits = ctx.zones.flatMap((z) =>
      z.events
        .filter((e) => e.kind === 'rompimento' && e.startIndex >= ctx.obsStart && e.returned === false)
        .filter((e) => z.events.filter((t) => t.kind === 'toque' && t.endIndex < e.startIndex && t.retraction?.status === 'confirmada').length >= minPrior)
        .map((e) => ({ z, e })),
    );
    const evidence: Evidence[] = hits.map(({ z, e }) => ({ label: describeZone(z), value: `rompida a partir do candle ${e.startIndex} (sem retorno)` }));
    return makeResult(breakoutRule, {
      status: hits.length ? 'desfavoravel' : 'favoravel',
      reason: hits.length ? 'condicao_detectada' : 'condicao_ausente',
      explanation: hits.length
        ? `Rompimento recente sem retorno de região consolidada: ${hits.map(({ z }) => describeZone(z)).join('; ')}.`
        : `Nenhum rompimento de região consolidada sem retorno nos últimos ${fmtNum(ctx.lastIndex - ctx.obsStart + 1, 0)} candles.`,
      evidence, rule: ruleText,
      supportingIndexes: hits.flatMap(({ e }) => range(e.startIndex, e.endIndex)),
      technical: { breakouts: hits.map(({ z, e }) => ({ zone: z.id, event: e })) },
    });
  },
};
