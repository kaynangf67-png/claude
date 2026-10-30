import { directionRuns } from '../candle';
import { fmtNum, fmtPct, fmtPrice, plural } from '../format';
import type { Evidence, FilterResult } from '../types';
import { describeZone } from './aula01';
import {
  insufficientData, makeResult, missingOf, p, pendingConfig, type AnalysisContext, type RuleDefinition,
} from './context';

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

// ---------------------- filtros que usam o candle em formação (aulas 2 e 3)

/**
 * Resultado comum quando o filtro não pode ser avaliado: sem candle em
 * formação (fonte só com candles fechados) ou sem zona em contato.
 */
function intrabarGate(def: RuleDefinition, ctx: AnalysisContext, ruleText: string, sentence: string): FilterResult | null {
  if (!ctx.intrabar?.forming) {
    return makeResult(def, {
      status: 'nao_avaliavel', reason: 'requer_candle_em_formacao',
      explanation:
        `Anotação da aula 2: ${sentence} Depende do candle em formação (preço e ritmo em tempo real); a fonte atual só traz candles fechados. ` +
        'Conecte o feed ao vivo (aba "Ao vivo") ou confira manualmente no gráfico.',
      rule: ruleText,
    });
  }
  if (!ctx.entry || ctx.atr === null) {
    return makeResult(def, {
      status: 'nao_avaliavel', reason: 'aguardando_confirmacao',
      explanation: 'O candle em formação ainda não está em contato com nenhuma zona; o filtro é avaliado quando o preço tocar uma zona.',
      rule: ruleText,
    });
  }
  return null;
}

const evid = (label: string, value: string): Evidence => ({ label, value });

export const reversalRule: RuleDefinition = {
  id: 'reversao',
  name: 'Reversão contra a operação no candle',
  role: 'nao_entrada',
  lesson: `${L2} · F1 (leitura "Reversão", inferida do arquivo analisador-m5.html)`,
  evaluate(ctx) {
    const ruleText =
      'Aula 2, F1 (leitura a confirmar). Detectado quando, no candle em formação, o preço já andou contra a operação desde a abertura mais que o limite (× ATR): ' +
      'para venda na resistência, queda abaixo da abertura; para compra no suporte, alta acima da abertura. Só o M5 atual é verificado (não "timeframes maiores").';
    const gate = intrabarGate(reversalRule, ctx, ruleText, '"Reversão em M5 ou timeframes maiores" é filtro de não entrada.');
    if (gate) return gate;
    const limit = p(ctx, 'reversalATR');
    if (limit === null) return pendingConfig(reversalRule, ['reversalATR'], ruleText);
    const f = ctx.intrabar!.forming!;
    const res = ctx.entry!.side === 'resistencia';
    const counter = res ? Math.max(0, f.o - f.l) : Math.max(0, f.h - f.o);
    const inAtr = counter / ctx.atr!;
    const hit = inAtr > limit;
    return makeResult(reversalRule, {
      status: hit ? 'desfavoravel' : 'favoravel', reason: hit ? 'condicao_detectada' : 'condicao_ausente',
      explanation: hit
        ? `Reversão: o preço já andou ${fmtNum(inAtr, 2)} ATR contra a operação neste candle (máximo ${limit}).`
        : `Movimento contra de ${fmtNum(inAtr, 2)} ATR neste candle, dentro do máximo de ${limit}.`,
      evidence: [evid('Movimento contra', `${fmtNum(inAtr, 2)} ATR`), evid('ATR', fmtPrice(ctx.atr!))],
      rule: ruleText, technical: { counter, atr: ctx.atr, side: ctx.entry!.side },
    });
  },
};

export const nascendoProximoRule: RuleDefinition = {
  id: 'vela_proxima_regiao',
  name: 'Vela nascendo próxima da região',
  role: 'nao_entrada',
  lesson: `${L2} · F2`,
  evaluate(ctx) {
    const ruleText =
      'Aula 2, F2: vela que nasce perto da região é sinal de rompimento. Detectado quando a distância entre a abertura do candle e a borda de entrada da zona ' +
      'é menor que o mínimo (× ATR). Abertura já dentro da zona conta como detectado.';
    const gate = intrabarGate(nascendoProximoRule, ctx, ruleText, '"vela nascendo próximo da região" é um sinal de rompimento.');
    if (gate) return gate;
    const limit = p(ctx, 'approachATR');
    if (limit === null) return pendingConfig(nascendoProximoRule, ['approachATR'], ruleText);
    const f = ctx.intrabar!.forming!;
    const res = ctx.entry!.side === 'resistencia';
    const dist = (res ? ctx.entry!.entry - f.o : f.o - ctx.entry!.entry) / ctx.atr!;
    const hit = dist < limit;
    return makeResult(nascendoProximoRule, {
      status: hit ? 'desfavoravel' : 'favoravel', reason: hit ? 'condicao_detectada' : 'condicao_ausente',
      explanation: hit
        ? `A vela abriu a ${fmtNum(dist, 2)} ATR da zona (mínimo ${limit}): nasceu perto da região, sinal de rompimento.`
        : `A vela abriu a ${fmtNum(dist, 2)} ATR da zona (mínimo ${limit}).`,
      evidence: [evid('Distância abertura → zona', `${fmtNum(dist, 2)} ATR`)],
      rule: ruleText, technical: { dist, atr: ctx.atr },
    });
  },
};

export const velaLentaRule: RuleDefinition = {
  id: 'vela_lenta_parada',
  name: 'Vela lenta ou parada',
  role: 'nao_entrada',
  lesson: `${L2} · F4`,
  evaluate(ctx) {
    const ruleText =
      'Aula 2, F4: vela lenta ou parada na região indica chance de rompimento. Aproximação provisória: "lenta" = com ao menos 1 minuto fechado, ' +
      'deslocamento ÷ caminho percorrido (fechamentos de 1 min) acima do limite; "parada" = após 1 minuto, amplitude do candle abaixo do mínimo (× ATR).';
    const gate = intrabarGate(velaLentaRule, ctx, ruleText, '"vela lenta ou parada" na região indica chance de rompimento.');
    if (gate) return gate;
    const missing = missingOf(ctx, ['slowEfficiencyMax', 'stoppedRangeATR']);
    if (missing.length) return pendingConfig(velaLentaRule, missing, ruleText);
    const f = ctx.intrabar!.forming!;
    const m1 = ctx.intrabar!.m1 ?? [];
    const pts = [f.o, ...m1.map((c) => c.c), ctx.entry!.entry];
    let steps = 0;
    for (let i = 1; i < pts.length; i++) steps += Math.abs(pts[i]! - pts[i - 1]!);
    const eff = steps > 0 ? Math.abs(ctx.entry!.entry - f.o) / steps : 0;
    const elapsed = 300 - ctx.intrabar!.remainingSeconds;
    const slow = m1.length >= 1 && eff > p(ctx, 'slowEfficiencyMax')!;
    const stopped = elapsed >= 60 && f.h - f.l < p(ctx, 'stoppedRangeATR')! * ctx.atr!;
    const hit = slow || stopped;
    return makeResult(velaLentaRule, {
      status: hit ? 'desfavoravel' : 'favoravel', reason: hit ? 'condicao_detectada' : 'condicao_ausente',
      explanation: hit
        ? stopped ? 'Vela parada: amplitude pequena após 1 minuto.' : `Vela lenta: só avança (eficiência ${fmtPct(eff)}).`
        : m1.length === 0 ? 'Ainda sem minuto fechado neste candle.' : `A vela oscila (eficiência ${fmtPct(eff)}).`,
      evidence: [evid('Eficiência', fmtPct(eff)), evid('Minutos fechados', String(m1.length)), evid('Amplitude do candle', `${fmtNum((f.h - f.l) / ctx.atr!, 2)} ATR`)],
      rule: ruleText, technical: { eff, elapsed, slow, stopped },
    });
  },
};

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
