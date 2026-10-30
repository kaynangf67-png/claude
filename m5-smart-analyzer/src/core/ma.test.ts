import { describe, expect, it } from 'vitest';
import { splitMa, summarizeBacktest, type BacktestRow } from './backtest';
import { defaultConfig, sanitizeConfig, setRuleEnabled } from './config';
import { analyze } from './engine';
import { ema, maReading, MA_WINDOW } from './ma';
import { compareGroups, tally } from './stats';
import { fullConfig, rangeBound, testSource, touchingIntrabar } from './testing/fixtures';
import { atr } from './candle';
import type { Candle } from './types';

const series = (closes: number[]): Candle[] => closes.map((c, i) => ({ t: 1_700_000_100 + i * 300, o: c, h: c + 0.1, l: c - 0.1, c }));

describe('EMA', () => {
  it('semente na média simples e fórmula recursiva', () => {
    // período 3: k = 0,5; semente = (1+2+3)/3 = 2; depois 4*0,5 + 2*0,5 = 3
    expect(ema([1, 2, 3, 4], 3)).toEqual([2, 3]);
  });
  it('sem dados suficientes devolve vazio, nunca inventa', () => {
    expect(ema([1, 2], 3)).toEqual([]);
    expect(ema([1, 2, 3], 0)).toEqual([]);
  });
});

describe('alinhamento com o lado da zona', () => {
  const up = series(Array.from({ length: 120 }, (_, i) => 100 + i * 0.2));
  const down = series(Array.from({ length: 120 }, (_, i) => 100 - i * 0.2));

  it('alta favorece suporte (compra) e não resistência (venda); baixa é o inverso', () => {
    expect(maReading(up, 'suporte', 9, 21)).toMatchObject({ trend: 'alta', aligned: true });
    expect(maReading(up, 'resistencia', 9, 21)).toMatchObject({ trend: 'alta', aligned: false });
    expect(maReading(down, 'resistencia', 9, 21)).toMatchObject({ trend: 'baixa', aligned: true });
    expect(maReading(down, 'suporte', 9, 21)).toMatchObject({ trend: 'baixa', aligned: false });
  });
  it('sem candles suficientes ou períodos inválidos, devolve null (não avaliável)', () => {
    expect(maReading(up.slice(0, 50), 'suporte', 9, 21)).toBeNull(); // 21*3 = 63
    expect(maReading(up, 'suporte', 21, 9)).toBeNull();
    expect(maReading(up, 'suporte', 9, 9)).toBeNull();
  });
  it('usa só a janela recente: candles antigos não mudam o resultado', () => {
    const old = series(Array.from({ length: 300 }, (_, i) => 500 - i * 3)); // queda forte, muito antiga
    const joined = [...old, ...up.map((c, i) => ({ ...c, t: old[old.length - 1]!.t + (i + 1) * 300 }))];
    expect(joined.length).toBeGreaterThan(MA_WINDOW);
    expect(maReading(joined, 'suporte', 9, 21)!.trend).toBe('alta');
  });
});

describe('regra no motor', () => {
  it('nasce desligada, com períodos de padrão técnico (não da aula)', () => {
    const c = defaultConfig();
    expect(c.enabled.filtro_media_movel).toBe(false);
    expect(c.params.maFastPeriod).toEqual({ value: 9, origin: 'padrao_tecnico' });
    expect(c.params.maSlowPeriod).toEqual({ value: 21, origin: 'padrao_tecnico' });
  });
  it('desligada, não aparece entre os filtros; ligada, avalia a zona em contato e nunca confirma gatilho', () => {
    const closed = rangeBound(5, 5);
    const base = fullConfig();
    const z = analyze({ candles: closed, source: testSource(closed), config: base }).zones.find((x) => x.side === 'resistencia')!;
    const ib = touchingIntrabar(closed, z, atr(closed, closed.length - 1)!, { remaining: 280 });
    const off = analyze({ candles: closed, source: testSource(closed), config: base, intrabar: ib });
    expect(off.filters.find((f) => f.id === 'filtro_media_movel')).toBeUndefined();
    const on = analyze({ candles: closed, source: testSource(closed), config: setRuleEnabled(base, 'filtro_media_movel', true), intrabar: ib });
    const f = on.filters.find((x) => x.id === 'filtro_media_movel')!;
    expect(['favoravel', 'desfavoravel', 'nao_avaliavel']).toContain(f.status);
    expect(f.role).toBe('contexto_positivo');
    expect(f.lesson).toMatch(/Hipótese/);
    // ligar o filtro não altera o gatilho
    expect(on.trigger.criteria.map((c) => c.status)).toEqual(off.trigger.criteria.map((c) => c.status));
  });
  it('período lento <= rápido vira pendência de configuração, não resultado', () => {
    const closed = rangeBound(5, 5);
    const cfg = setRuleEnabled(fullConfig({ maFastPeriod: 21, maSlowPeriod: 9 }), 'filtro_media_movel', true);
    const z = analyze({ candles: closed, source: testSource(closed), config: cfg }).zones.find((x) => x.side === 'resistencia')!;
    const ib = touchingIntrabar(closed, z, atr(closed, closed.length - 1)!, { remaining: 280 });
    const f = analyze({ candles: closed, source: testSource(closed), config: cfg, intrabar: ib }).filters.find((x) => x.id === 'filtro_media_movel')!;
    expect(f.status).toBe('pendente');
  });
  it('configuração antiga salva sem os novos campos volta ao padrão', () => {
    const c = sanitizeConfig({ enabled: {}, params: {} });
    expect(c.params.maFastPeriod.value).toBe(9);
    expect(c.enabled.filtro_media_movel).toBe(false);
  });
});

describe('comparação com dados separados', () => {
  const rowsOf = (t0: number, ma: boolean, wins: number, losses: number): BacktestRow[] =>
    Array.from({ length: wins + losses }, (_, i) => ({ t: t0 + i, win: i < wins, tie: false, ma, criteria: {}, filters: {}, htf: { M15: null, H1: null } } as unknown as BacktestRow));

  it('compareGroups só diz melhor/pior quando os intervalos não se sobrepõem', () => {
    expect(compareGroups(tally(rowsOf(0, true, 6, 4)), tally(rowsOf(0, false, 4, 6)))).toBe('inconclusivo'); // 10 casos: ruído
    expect(compareGroups(tally(rowsOf(0, true, 90, 10)), tally(rowsOf(0, false, 30, 70)))).toBe('melhor');
    expect(compareGroups(tally(rowsOf(0, true, 30, 70)), tally(rowsOf(0, false, 90, 10)))).toBe('pior');
    expect(compareGroups(tally([]), tally(rowsOf(0, false, 5, 5)))).toBe('sem_casos');
  });

  it('confirma só quando a parte que o filtro não viu repete a direção do treino', () => {
    const treino = [...rowsOf(0, true, 60, 40), ...rowsOf(1000, false, 40, 60)];
    const boaConf = [...rowsOf(10_000, true, 90, 10), ...rowsOf(11_000, false, 30, 70)];
    expect(splitMa([...treino, ...boaConf]).veredito).toBe('confirmado_melhor'); // cortes por tempo: treino = 60% mais antigo
    // treino bom, confirmação sem diferença: não confirma
    const fracaConf = [...rowsOf(10_000, true, 50, 50), ...rowsOf(11_000, false, 50, 50)];
    expect(splitMa([...treino, ...fracaConf]).veredito).toBe('inconclusivo');
  });

  it('toques sem dados de média (null) ficam fora dos dois lados', () => {
    const rows = [...rowsOf(0, true, 5, 5), { t: 5000, win: true, tie: false, ma: null, criteria: {}, filters: {}, htf: { M15: null, H1: null } } as unknown as BacktestRow];
    const s = splitMa(rows);
    expect(s.treino.pass.n + s.treino.fail.n + s.confirmacao.pass.n + s.confirmacao.fail.n).toBe(10);
  });

  it('o resumo do teste inclui a linha de média móvel e o bloco separado', () => {
    const s = summarizeBacktest([...rowsOf(0, true, 5, 5)], 80);
    expect(s.ablation.some((a) => a.id === 'media_movel')).toBe(true);
    expect(s.ma).toBeDefined();
  });
});
