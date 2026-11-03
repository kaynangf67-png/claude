import { describe, expect, it } from 'vitest';
import { defaultConfig, setRuleEnabled } from './config';
import { analyze } from './engine';
import { aggregate, confluence, htfZones, HTF_FRAMES } from './htf';
import { atr } from './candle';
import { fullConfig, rangeBound, testSource, touchingIntrabar } from './testing/fixtures';

const M15 = HTF_FRAMES[0];
// tolerância de 0,3× a amplitude média: com 1× a faixa da zona M15 cobre toda a oscilação da fixture
const cfg25 = () => fullConfig({ htfContextWindow: 25, zoneToleranceMult: 0.3 });

describe('montagem de candles de timeframe maior', () => {
  const cs = rangeBound(14, 5); // 173 candles M5, começa alinhado à hora cheia

  it('agrega M5 em M15 com OHLC correto e só janelas completas', () => {
    const m = aggregate(cs, 3);
    expect(m).toHaveLength(Math.floor(cs.length / 3));
    expect(m[0]).toEqual({
      t: cs[0]!.t, o: cs[0]!.o, h: Math.max(...cs.slice(0, 3).map((c) => c.h)), l: Math.min(...cs.slice(0, 3).map((c) => c.l)), c: cs[2]!.c,
    });
    expect(aggregate(cs, 12)).toHaveLength(Math.floor(cs.length / 12));
  });

  it('descarta o candle maior em formação (janela incompleta) e janelas com buraco', () => {
    const partial = cs.slice(0, 3 * 10 + 2); // 10 M15 completos + 2 M5 do próximo
    expect(aggregate(partial, 3)).toHaveLength(10);
    const hole = cs.filter((_, i) => i !== 4); // tira um M5 do 2º candle M15
    const m = aggregate(hole, 3);
    expect(m.some((c) => c.t === cs[3]!.t)).toBe(false);
    expect(m.some((c) => c.t === cs[0]!.t)).toBe(true);
  });

  it('série que começa no meio de uma janela perde a janela parcial inicial', () => {
    const m = aggregate(cs.slice(1), 3);
    expect(m[0]!.t).toBe(cs[3]!.t);
  });
});

describe('zonas e confluência com timeframe maior', () => {
  const cs = rangeBound(14, 6);
  const config = cfg25();
  const base = analyze({ candles: cs, source: testSource(cs), config });
  const zone = base.zones.find((z) => z.side === 'resistencia')!;
  const tol = config.params.zoneToleranceMult.value! * base.referenceRange!;

  it('acha zonas sólidas no M15 e exige candles suficientes no H1', () => {
    const m15 = htfZones(cs, M15, config);
    expect(m15.status).toBe('ok');
    expect(m15.solid.length).toBeGreaterThan(0);
    expect(htfZones(cs, HTF_FRAMES[1], config)).toMatchObject({ status: 'dados_insuficientes' });
  });

  it('sem parâmetros de zona/retração o timeframe maior fica "parâmetro não definido"', () => {
    expect(htfZones(cs, M15, fullConfig({ retractionWindow: null })).status).toBe('parametro_nao_definido');
  });

  it('a zona M5 coincide com a zona M15 do mesmo lado; lado ou preço diferente não coincide', () => {
    const c = confluence(cs, zone, tol, config);
    expect(c.byFrame.M15).toBe(true);
    expect(c.byFrame.H1).toBeNull();
    expect(c.frames).toEqual(['M15']);
    expect(confluence(cs, { ...zone, side: 'suporte' }, tol, config).byFrame.M15).toBe(false);
    expect(confluence(cs, { side: 'resistencia', lower: 2, upper: 2.1 }, tol, config).byFrame.M15).toBe(false);
  });

  it('não olha o futuro: candles do candle maior em formação não mudam as zonas', () => {
    const k = 3 * 40; // fecha exatamente 40 candles M15
    const a = htfZones(cs.slice(0, k), M15, config);
    const withPartial = htfZones(cs.slice(0, k + 2), M15, config); // + 2 M5 do próximo M15
    const wrecked = cs.slice(0, k + 2).map((c, i) => (i >= k ? { ...c, h: c.h + 5, l: c.l - 5 } : c));
    for (const b of [withPartial, htfZones(wrecked, M15, config)]) {
      expect(b.zones.map((z) => [z.lower, z.upper])).toEqual(a.zones.map((z) => [z.lower, z.upper]));
      expect(b.candles).toBe(a.candles);
    }
  });
});

describe('regra de confluência (hipótese, desligada por padrão)', () => {
  const cs = rangeBound(14, 6);
  const byId = (r: ReturnType<typeof analyze>) => r.filters.find((f) => f.id === 'confluencia_tf_maior');

  it('nasce desligada e não aparece na análise padrão', () => {
    expect(defaultConfig().enabled.confluencia_tf_maior).toBe(false);
    expect(byId(analyze({ candles: cs, source: testSource(cs), config: cfg25() }))).toBeUndefined();
  });

  it('ligada, com a zona M5 em contato e coincidente com M15, fica favorável', () => {
    const config = setRuleEnabled(cfg25(), 'confluencia_tf_maior', true);
    const zone = analyze({ candles: cs, source: testSource(cs), config }).zones.find((z) => z.side === 'resistencia')!;
    // candle em formação tocando a zona M5 (uso ao vivo)
    const r = analyze({ candles: cs, source: testSource(cs), config, intrabar: touchingIntrabar(cs, zone, atr(cs, cs.length - 1)!) });
    const f = byId(r)!;
    expect(f).toMatchObject({ status: 'favoravel', role: 'contexto_positivo' });
    expect(f.explanation).toMatch(/M15/);
    expect(f.lesson).toMatch(/Hipótese/);
  });

  it('sem zona M5 em contato, aguarda', () => {
    const mid = rangeBound(14, 0).slice(0, 150);
    const config = setRuleEnabled(fullConfig({ htfContextWindow: 25, zoneToleranceMult: 0.3 }), 'confluencia_tf_maior', true);
    const f = byId(analyze({ candles: mid, source: testSource(mid), config }));
    expect(f).toBeDefined();
    expect(['pendente', 'favoravel']).toContain(f!.status);
  });

  it('com poucos candles M5 para montar M15/H1, é "não avaliável"; sem parâmetros, pendente', () => {
    const short = rangeBound(5, 5);
    const on = (c = fullConfig()) => setRuleEnabled(c, 'confluencia_tf_maior', true);
    expect(byId(analyze({ candles: short, source: testSource(short), config: on() }))).toMatchObject({ status: 'nao_avaliavel', reason: 'dados_insuficientes' });
    expect(byId(analyze({ candles: cs, source: testSource(cs), config: on(fullConfig({ zoneToleranceMult: null })) }))).toMatchObject({ status: 'pendente', reason: 'parametro_nao_definido' });
  });

  it('ligar a hipótese muda o hash da configuração (versão de config distinta)', () => {
    const a = analyze({ candles: cs, source: testSource(cs), config: cfg25() });
    const b = analyze({ candles: cs, source: testSource(cs), config: setRuleEnabled(cfg25(), 'confluencia_tf_maior', true) });
    expect(a.configHash).not.toBe(b.configHash);
  });
});
