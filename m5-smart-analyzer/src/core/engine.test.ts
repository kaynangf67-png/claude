import { describe, expect, it } from 'vitest';
import { applyExploratoryPreset, defaultConfig, setParam, setRuleEnabled } from './config';
import { analyze } from './engine';
import { replay } from './replay';
import { RULES } from './rules';
import type { TriggerRule } from './rules/context';
import { cfg, fullConfig, fromCloses, rangeBound, strongTrend, testSource, candles } from './testing/fixtures';
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
    // F2/F4 exigem o candle em formação: aparecem como ressalva, não como satisfeitos
    expect(byId(r, 'vela_proxima_regiao').status).toBe('nao_avaliavel');
    expect(r.caveats.length).toBe(2);
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

  it('com candles fechados o gatilho da aula 2 NUNCA é confirmado (cronômetro e pico exigem o candle em formação)', () => {
    const r = run(rangeBound(5, 5), fullConfig(), { intrabar: { elapsedSeconds: 200 } });
    expect(r.state).toBe('FAVORAVEL');
    const timer = r.trigger.criteria.find((c) => c.id === 'gatilho_cronometro')!;
    expect(timer.status).toBe('atendido');
    expect(r.trigger.criteria.find((c) => c.id === 'gatilho_pico_de_vela')!.status).toBe('nao_avaliavel');
    expect(r.trigger.confirmed).toBe(false);
  });

  it('cronômetro abaixo de 2m30s não atende o critério', () => {
    const r = run(rangeBound(5, 5), fullConfig(), { intrabar: { elapsedSeconds: 149 } });
    expect(r.trigger.criteria.find((c) => c.id === 'gatilho_cronometro')!.status).toBe('nao_atendido');
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
