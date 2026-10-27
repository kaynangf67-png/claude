import { describe, expect, it } from 'vitest';
import { applyExploratoryPreset, defaultConfig, setParam, setRuleEnabled } from './config';
import { analyze } from './engine';
import { replay } from './replay';
import { RULES } from './rules';
import type { TriggerRule } from './rules/context';
import { atr } from './candle';
import { cfg, fullConfig, fromCloses, rangeBound, strongTrend, testSource, candles, touchingIntrabar } from './testing/fixtures';
import type { Candle } from './types';

const run = (cs: Candle[], config = fullConfig(), extra = {}) =>
  analyze({ candles: cs, source: testSource(cs), config, ...extra });

const byId = (r: ReturnType<typeof run>, id: string) => r.filters.find((f) => f.id === id)!;

describe('estados do motor', () => {
  it('FAVORÁVEL em lateral com alternância, pavios, zona e histórico válidos', () => {
    const r = run(rangeBound(5, 5));
    expect(r.state).toBe('FAVORAVEL');
    expect(r.blockingReasons).toHaveLength(0);
    for (const id of ['pavios', 'alternancia', 'topos_fundos', 'zonas', 'historico_minimo']) {
      expect(byId(r, id).status).toBe('favoravel');
    }
  });

  it('FAVORÁVEL não é entrada: há oportunidade (zona candidata), mas nenhum gatilho confirmado', () => {
    const r = run(rangeBound(5, 5));
    expect(r.opportunities).toHaveLength(1);
    expect(r.opportunities[0]).toMatchObject({ entryConfirmed: false, side: 'resistencia' });
    expect(r.opportunities[0]!.note).toMatch(/não é gatilho/i);
    expect(r.trigger.confirmed).toBe(false);
    expect(r.summary).toMatch(/NÃO é uma entrada confirmada/);
    // F1/F2/F4 exigem o candle em formação: aparecem como ressalva, não como satisfeitos
    expect(byId(r, 'vela_proxima_regiao').status).toBe('nao_avaliavel');
    expect(byId(r, 'reversao').status).toBe('nao_avaliavel');
    expect(r.caveats.length).toBe(3);
  });

  it('DESFAVORÁVEL em tendência contínua, com motivos específicos', () => {
    const r = run(strongTrend(60));
    expect(r.state).toBe('DESFAVORAVEL');
    expect(r.blockingReasons.join(' ')).toMatch(/Fluxo de \d+ candles de alta/);
    expect(byId(r, 'corpo_grande').status).toBe('desfavoravel');
    expect(byId(r, 'movimento_continuo').status).toBe('desfavoravel');
    expect(r.summary).toMatch(/^Cenário desfavorável:/);
    expect(r.summary).toMatch(/não operar/);
  });

  it('AGUARDAR com a configuração padrão: parâmetros que a aula não define ficam pendentes, nunca satisfeitos', () => {
    const cs = rangeBound(5, 5);
    const r = run(cs, defaultConfig());
    expect(r.state).toBe('AGUARDAR');
    expect(byId(r, 'pavios')).toMatchObject({ status: 'pendente', reason: 'parametro_nao_definido' });
    expect(byId(r, 'pavios').missingParams).toEqual(['wickRelevantRatio', 'minRelevantWickCandles']);
    expect(byId(r, 'historico_minimo')).toMatchObject({ status: 'pendente', reason: 'parametro_nao_definido' });
    expect(r.opportunities).toHaveLength(0);
    expect(r.counts.favoravel).toBe(1); // só "sem fluxo da mesma cor" (3 vem da aula)
  });

  it('AGUARDAR quando o preço está no meio da faixa, longe de qualquer zona', () => {
    const cs = rangeBound(5, 0).slice(0, 51); // meio de uma perna; tolerância menor deixa o centro fora das zonas
    const r = run(cs, fullConfig({ zoneToleranceMult: 0.3 }));
    expect(r.state).toBe('AGUARDAR');
    expect(byId(r, 'zonas')).toMatchObject({ status: 'pendente', reason: 'aguardando_confirmacao' });
    expect(byId(r, 'historico_minimo').status).toBe('pendente');
    expect(r.opportunities).toHaveLength(0);
  });

  it('o mesmo mercado em contato com o suporte gera zona candidata (suporte)', () => {
    const r = run(rangeBound(5, 0)); // termina no fundo da faixa
    expect(r.state).toBe('FAVORAVEL');
    expect(r.opportunities[0]).toMatchObject({ side: 'suporte', entryConfirmed: false });
  });

  it('NÃO AVALIÁVEL com poucos candles, candle inválido, duplicata, lacuna ou timeframe incompatível', () => {
    const ok = rangeBound(5, 5);
    expect(run(ok.slice(0, 10)).state).toBe('NAO_AVALIAVEL');

    const bad = ok.map((c) => ({ ...c }));
    bad[bad.length - 3] = { ...bad[bad.length - 3]!, h: bad[bad.length - 3]!.l - 0.001 };
    const rBad = run(bad);
    expect(rBad.state).toBe('NAO_AVALIAVEL');
    expect(rBad.invalidReasons[0]).toMatch(/candle inválido/);

    const dup = ok.map((c) => ({ ...c }));
    dup[dup.length - 1] = { ...dup[dup.length - 1]!, t: dup[dup.length - 2]!.t };
    expect(run(dup).invalidReasons[0]).toMatch(/duplicados|fora de ordem/);

    const gap = ok.map((c, i) => (i > 40 ? { ...c, t: c.t + 600 } : c));
    expect(run(gap).invalidReasons[0]).toMatch(/lacuna/);

    const m1 = ok.map((c, i) => ({ ...c, t: ok[0]!.t + i * 60 }));
    expect(run(m1).invalidReasons[0]).toMatch(/incompatível com M5/);
    expect(run(m1).filters).toHaveLength(0);
  });

  it('lacuna antiga fora da janela analisada não impede a análise', () => {
    const ok = rangeBound(6, 5);
    const gap = ok.map((c, i) => (i > 3 ? { ...c, t: c.t + 900 } : c)); // lacuna só entre os candles 3 e 4
    expect(run(gap).state).not.toBe('NAO_AVALIAVEL');
  });

  it('dados inválidos têm prioridade sobre qualquer filtro', () => {
    const cs = strongTrend(60);
    cs[cs.length - 1] = { ...cs[cs.length - 1]!, o: -1 };
    expect(run(cs).state).toBe('NAO_AVALIAVEL');
  });
});

describe('prioridade dos filtros de não entrada', () => {
  it('um filtro de não entrada vence critérios pendentes e vence critérios positivos', () => {
    // configuração padrão: quase tudo pendente, mas o fluxo de 3+ velas (aula) é detectável
    const r = run(strongTrend(60), defaultConfig());
    expect(r.state).toBe('DESFAVORAVEL');
    expect(byId(r, 'sequencia_direcional').status).toBe('desfavoravel');
    expect(r.counts.pendente).toBeGreaterThan(0);
  });

  it('o fluxo da mesma cor só vale se terminar no último candle', () => {
    const closes = [0, 4, 8, 12, 16, 12, 16, 12]; // 4 altas seguidas, depois zigue-zague
    const cs = fromCloses([...Array(30).fill(0).map((_, i) => (i % 2 ? 1 : -1)), ...closes], {}, 0.3, 0);
    const r = run(cs, defaultConfig());
    expect(byId(r, 'sequencia_direcional').status).toBe('favoravel');
  });

  it('exatamente 3 velas da mesma cor já bloqueiam (limite da aula 2: "três ou mais")', () => {
    const zig = Array(31).fill(0).map((_, i) => (i % 2 ? 1 : -1)); // termina em candle de baixa
    const three = fromCloses([...zig, 5, 9, 13], {}, 0.3, 0);
    expect(byId(run(three, defaultConfig()), 'sequencia_direcional').status).toBe('desfavoravel');
    const two = fromCloses([...zig, 5, 9], {}, 0.3, 0);
    expect(byId(run(two, defaultConfig()), 'sequencia_direcional').status).toBe('favoravel');
  });

  it('desabilitar um filtro o remove da análise', () => {
    const config = setRuleEnabled(defaultConfig(), 'sequencia_direcional', false);
    const r = run(strongTrend(60), config);
    expect(r.filters.some((f) => f.id === 'sequencia_direcional')).toBe(false);
    expect(r.state).not.toBe('DESFAVORAVEL');
  });

  it('rompimento de zona sem retorno é motivo de não entrada', () => {
    const cs = rangeBound(5, 0);
    const lastClose = cs[cs.length - 1]!.c;
    const extra: Array<[number, number, number, number]> = [
      [lastClose, lastClose + 0.0030, lastClose, lastClose + 0.0028],
      [lastClose + 0.0028, lastClose + 0.0040, lastClose + 0.0027, lastClose + 0.0036],
    ];
    const withBreak: Candle[] = [...cs, ...candles(extra, cs[cs.length - 1]!.t + 300)];
    const r = run(withBreak);
    expect(byId(r, 'rompimento_sem_retracao').status).toBe('desfavoravel');
    expect(r.state).toBe('DESFAVORAVEL');
  });
});

describe('rompimento só vale para regiões consolidadas', () => {
  it('zona com menos toques válidos que o mínimo não gera bloqueio ao ser rompida', () => {
    const cs = rangeBound(5, 0);
    const lc = cs[cs.length - 1]!.c;
    const spec: Array<[number, number, number, number]> = [
      [lc, lc + 0.0030, lc, lc + 0.0028], [lc + 0.0028, lc + 0.0040, lc + 0.0027, lc + 0.0036],
    ];
    const withBreak: Candle[] = [...cs, ...candles(spec, cs[cs.length - 1]!.t + 300)];
    // o fixture tem 5 toques por zona; exigir 10 torna as zonas "fracas"
    const r = run(withBreak, fullConfig({ minPriorValidTouches: 10 }));
    expect(byId(r, 'rompimento_sem_retracao').status).toBe('favoravel');
    expect(run(withBreak).filters.find((f) => f.id === 'rompimento_sem_retracao')!.status).toBe('desfavoravel');
  });
});

describe('gatilho', () => {
  it('sem regras de gatilho registradas: "Gatilho não definido nas aulas analisadas"', () => {
    const r = run(rangeBound(5, 5), fullConfig(), { triggers: [] });
    expect(r.trigger).toMatchObject({ status: 'nao_definido', confirmed: false, message: 'Gatilho não definido nas aulas analisadas.' });
  });

  it('com candles fechados o gatilho NUNCA é confirmado (pico de vela e F1/F2/F4 exigem o candle em formação)', () => {
    const r = run(rangeBound(5, 5));
    expect(r.trigger.confirmed).toBe(false);
    expect(r.trigger.criteria.find((c) => c.id === 'gatilho_tempo_restante')!.status).toBe('nao_avaliavel');
    expect(r.trigger.criteria.find((c) => c.id === 'gatilho_pico_de_vela')!.status).toBe('nao_avaliavel');
  });

  it('só o tempo restante manual: avalia o tempo, mas não confirma (sem candle em formação)', () => {
    const cs = rangeBound(5, 5);
    const ok = run(cs, fullConfig(), { intrabar: { remainingSeconds: 200 } });
    expect(ok.trigger.criteria.find((c) => c.id === 'gatilho_tempo_restante')!.status).toBe('atendido');
    expect(ok.trigger.confirmed).toBe(false);
    expect(ok.caveats.length).toBe(3);
  });

  it('o tempo restante precisa ser de pelo menos 2:30; com menos, não entra (exatamente 150 s vale)', () => {
    const cs = rangeBound(5, 5);
    const t = (s: number) => run(cs, fullConfig(), { intrabar: { remainingSeconds: s } }).trigger.criteria.find((c) => c.id === 'gatilho_tempo_restante')!.status;
    expect(t(200)).toBe('atendido');
    expect(t(150)).toBe('atendido');
    expect(t(149)).toBe('nao_atendido');
    expect(t(30)).toBe('nao_atendido');
  });

  const always: TriggerRule = { id: 't', name: 't', evaluate: () => ({ id: 't', name: 't', status: 'atendido', explanation: '' }) };

  it('a arquitetura aceita novos gatilhos sem mexer no motor', () => {
    const r = run(rangeBound(5, 5), fullConfig(), { triggers: [always] });
    expect(r.trigger).toMatchObject({ status: 'confirmado', confirmed: true });
  });

  it('um cenário desfavorável nunca confirma gatilho, mesmo com todos os critérios atendidos', () => {
    const r = run(strongTrend(60), fullConfig(), { triggers: [always] });
    expect(r.state).toBe('DESFAVORAVEL');
    expect(r.trigger.confirmed).toBe(false);
  });
});

describe('regras extensíveis', () => {
  it('aceita uma regra nova no registro', () => {
    const extra = {
      id: 'horario_otc' as const, name: 'Regra de teste', role: 'nao_entrada' as const, lesson: 'teste',
      evaluate: () => ({
        id: 'horario_otc' as const, name: 'Regra de teste', role: 'nao_entrada' as const, lesson: 'teste',
        status: 'desfavoravel' as const, reason: 'condicao_detectada' as const, explanation: 'bloqueio de teste',
        evidence: [], rule: '', missingParams: [], supportingIndexes: [], technical: {},
      }),
    };
    const r = run(rangeBound(5, 5), fullConfig(), { rules: [...RULES.filter((x) => x.id !== 'horario_otc'), extra] });
    expect(r.state).toBe('DESFAVORAVEL');
    expect(r.blockingReasons).toContain('bloqueio de teste');
  });
});

describe('prevenção de look-ahead', () => {
  const cs = rangeBound(6, 5);

  it('um topo só entra na análise quando o candle de confirmação existe', () => {
    const topIdx = 41; // topos do fixture: 5, 17, 29, 41, 53...
    const before = run(cs.slice(0, topIdx + 2)); // 1 candle depois do topo (lookback = 2)
    const after = run(cs.slice(0, topIdx + 3)); // 2 candles depois: confirmado
    const hasTop = (r: ReturnType<typeof run>) => r.swings.some((s) => s.kind === 'topo' && s.index === topIdx);
    expect(before.state).not.toBe('NAO_AVALIAVEL');
    expect(hasTop(before)).toBe(false);
    expect(hasTop(after)).toBe(true);
    expect(after.swings.find((s) => s.index === topIdx)!.confirmedAtIndex).toBe(topIdx + 2);
  });

  it('alterar candles futuros não muda a análise de um instante passado (reprodução histórica)', () => {
    const mutated = cs.map((c, i) => (i > 45 ? { ...c, h: c.h + 0.01, c: c.o - 0.002, l: c.l - 0.01 } : c));
    const a = replay(cs, fullConfig(), null, { from: 35, to: 45, step: 2 });
    const b = replay(mutated, fullConfig(), null, { from: 35, to: 45, step: 2 });
    expect(a.length).toBeGreaterThan(3);
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.state).toBe(a[i]!.state);
      expect(b[i]!.result.filters.map((f) => f.status)).toEqual(a[i]!.result.filters.map((f) => f.status));
      expect(b[i]!.result.summary).toBe(a[i]!.result.summary);
    }
  });

  it('marcos de confirmação nunca são posteriores ao candle analisado', () => {
    for (const p of replay(cs, fullConfig(), null, { from: 30, step: 3 })) {
      for (const s of p.result.swings) {
        expect(s.confirmedAtIndex).toBeLessThanOrEqual(p.index);
        if (s.validatedAtIndex !== null) expect(s.validatedAtIndex).toBeLessThanOrEqual(p.index);
      }
      for (const z of p.result.zones) {
        for (const e of z.events) {
          expect(e.endIndex).toBeLessThanOrEqual(p.index);
          if (e.retraction?.confirmedAtIndex != null) expect(e.retraction.confirmedAtIndex).toBeLessThanOrEqual(p.index);
        }
      }
      expect(p.result.cutoffT).toBe(cs[p.index]!.t);
    }
  });
});

describe('versão e configuração registradas', () => {
  it('o hash muda quando um parâmetro muda e carrega a versão das regras', () => {
    const cs = rangeBound(5, 5);
    const a = run(cs, fullConfig());
    const b = run(cs, setParam(fullConfig(), 'wickRelevantRatio', 0.5));
    expect(a.configHash).not.toBe(b.configHash);
    expect(a.rulesVersion).toBe(defaultConfig().rulesVersion);
  });

  it('o preset exploratório marca a origem como exploratória e não sobrescreve valores do usuário', () => {
    const user = setParam(defaultConfig(), 'bigBodyRatio', 0.9);
    const p = applyExploratoryPreset(user);
    expect(p.params.bigBodyRatio).toEqual({ value: 0.9, origin: 'usuario' });
    expect(p.params.wickRelevantRatio.origin).toBe('preset_exploratorio');
    expect(p.params.minPriorValidTouches.origin).toBe('aula');
  });

  it('configuração com valores customizados via cfg()', () => {
    expect(cfg({ wickRelevantRatio: 0.4 }).params.wickRelevantRatio.value).toBe(0.4);
  });
});


describe('candle em formação (feed ao vivo)', () => {
  const cs = rangeBound(5, 5);
  const base = analyze({ candles: cs, source: testSource(cs), config: fullConfig() });
  const zone = (side: 'resistencia' | 'suporte') => base.zones.find((z) => z.side === side)!;
  const atrNow = atr(cs, cs.length - 1)!;
  const live = (ib: ReturnType<typeof touchingIntrabar>, config = fullConfig()) =>
    analyze({ candles: cs, source: testSource(cs), config, intrabar: ib });
  const crit = (r: ReturnType<typeof live>, id: string) => r.trigger.criteria.find((c) => c.id === id)!.status;

  it('toque na resistência com todos os critérios: cenário favorável e gatilho confirmado', () => {
    const r = live(touchingIntrabar(cs, zone('resistencia'), atrNow, { remaining: 200 }));
    expect(r.state).toBe('FAVORAVEL');
    expect(r.entry).toMatchObject({ side: 'resistencia', armed: true });
    expect(r.entry!.entry).toBeGreaterThanOrEqual(r.entry!.edge);
    expect(r.trigger).toMatchObject({ status: 'confirmado', confirmed: true });
    expect(r.caveats).toHaveLength(0);
  });

  it('o mesmo toque no suporte compra no limite superior da zona', () => {
    const r = live(touchingIntrabar(cs, zone('suporte'), atrNow, { remaining: 200 }));
    expect(r.entry).toMatchObject({ side: 'suporte' });
    expect(r.entry!.entry).toBeLessThanOrEqual(r.entry!.edge);
    expect(r.state).toBe('FAVORAVEL');
  });

  it('com menos de 2:30 restantes o cenário segue favorável, mas o gatilho não confirma', () => {
    const r = live(touchingIntrabar(cs, zone('resistencia'), atrNow, { remaining: 120 }));
    expect(r.state).toBe('FAVORAVEL');
    expect(crit(r, 'gatilho_tempo_restante')).toBe('nao_atendido');
    expect(r.trigger.confirmed).toBe(false);
    expect(r.trigger.message).toMatch(/3 de 4/);
  });

  it('F1 reversão: já andou contra a operação no candle → desfavorável e sem gatilho', () => {
    const r = live(touchingIntrabar(cs, zone('resistencia'), atrNow, { counterATR: 0.5 }));
    expect(byId(r, 'reversao').status).toBe('desfavoravel');
    expect(r.state).toBe('DESFAVORAVEL');
    expect(r.trigger.confirmed).toBe(false);
  });

  it('F2 vela nascendo perto da região → desfavorável', () => {
    const r = live(touchingIntrabar(cs, zone('resistencia'), atrNow, { openOffsetATR: 0.1 }));
    expect(byId(r, 'vela_proxima_regiao').status).toBe('desfavoravel');
    expect(r.state).toBe('DESFAVORAVEL');
  });

  it('F4 vela parada: pouca amplitude depois de 1 minuto', () => {
    const r = live(touchingIntrabar(cs, zone('resistencia'), atrNow, { openOffsetATR: 0.35, remaining: 200 }), fullConfig({ stoppedRangeATR: 0.5 }));
    expect(byId(r, 'vela_lenta_parada').status).toBe('desfavoravel');
    expect(byId(r, 'vela_lenta_parada').explanation).toMatch(/parada/);
  });

  it('F4 vela lenta: só avança, sem oscilar nos fechamentos de 1 minuto', () => {
    const z = zone('resistencia');
    const ib = touchingIntrabar(cs, z, atrNow, { remaining: 200 });
    const o = ib.forming!.o;
    const step = (z.lower - o) / 3;
    const m1 = [1, 2].map((k) => ({ t: 0, o: o + (k - 1) * step, h: o + k * step, l: o + (k - 1) * step, c: o + k * step }));
    const r = live({ ...ib, m1 });
    expect(byId(r, 'vela_lenta_parada').status).toBe('desfavoravel');
    expect(byId(r, 'vela_lenta_parada').explanation).toMatch(/lenta/);
    // com oscilação, não
    const wobble = [{ ...m1[0]!, c: o + step * 2 }, { ...m1[1]!, c: o + step * 0.5 }];
    expect(byId(live({ ...ib, m1: wobble }), 'vela_lenta_parada').status).toBe('favoravel');
  });

  it('sem zona em contato os filtros do candle em formação aguardam o toque', () => {
    const far = { remainingSeconds: 200, forming: { o: 1.1008, h: 1.1011, l: 1.1007, c: 1.101 }, m1: [] };
    const r = live(far);
    expect(r.entry).toBeNull();
    expect(byId(r, 'reversao')).toMatchObject({ status: 'nao_avaliavel', reason: 'aguardando_confirmacao' });
    expect(r.state).toBe('AGUARDAR');
    expect(r.trigger.confirmed).toBe(false);
  });

  it('F1/F2/F4 sem parâmetros definidos ficam pendentes de configuração (nunca satisfeitos)', () => {
    const r = live(touchingIntrabar(cs, zone('resistencia'), atrNow), fullConfig({ reversalATR: null, approachATR: null }));
    expect(byId(r, 'reversao')).toMatchObject({ status: 'pendente', reason: 'parametro_nao_definido' });
    expect(byId(r, 'vela_proxima_regiao').status).toBe('pendente');
    expect(r.state).toBe('AGUARDAR');
  });

  it('velas anteriores: exigir as duas é mais restritivo que exigir uma', () => {
    const ib = touchingIntrabar(cs, zone('resistencia'), atrNow);
    expect(crit(live(ib, fullConfig({ prevCandlesRequired: 1 })), 'gatilho_velas_com_pavio')).toBe('atendido');
    expect(crit(live(ib, fullConfig({ prevCandlesRequired: 2 })), 'gatilho_velas_com_pavio')).toBe('nao_atendido');
    expect(crit(live(ib, fullConfig({ prevCandlesRequired: null })), 'gatilho_velas_com_pavio')).toBe('nao_avaliavel');
  });

  it('o ponto de equilíbrio e a zona de foco respeitam focusZoneId', () => {
    const ib = touchingIntrabar(cs, zone('resistencia'), atrNow);
    expect(live({ ...ib, focusZoneId: 'nao-existe' }).entry).toBeNull();
    expect(live({ ...ib, focusZoneId: zone('resistencia').id }).entry?.zoneId).toBe(zone('resistencia').id);
  });
});
