import { describe, expect, it } from 'vitest';
import { runBacktest, summarizeBacktest } from './backtest';
import { analyze } from './engine';
import { bucketM1 } from './mt5';
import { defaultConfig } from './config';
import { detectEntry, entryId, isResolvable, journalStats, loadJournal, resolveEntry, saveJournal, type JournalEntry } from './journal';
import { atr } from './candle';
import { fullConfig, memoryStore, rangeBound, syntheticM1, testSource, touchingIntrabar } from './testing/fixtures';

const b = bucketM1(syntheticM1(60 * 24 * 2));
const cfg = fullConfig();
const full = runBacktest(b.c5, b.m1, cfg, testSource(b.c5));

describe('teste histórico com resultado', () => {
  it('gera linhas, cada uma coerente com o fechamento do candle M5', () => {
    expect(full.rows.length).toBeGreaterThan(20);
    const byT = new Map(b.c5.map((c) => [c.t, c]));
    for (const r of full.rows) {
      expect(byT.get(r.t)!.c).toBe(r.close);
      const expectedWin = r.side === 'resistencia' ? r.close < r.entry : r.close > r.entry;
      expect(r.win).toBe(r.tie ? false : expectedWin);
      expect(r.remainingSeconds).toBeGreaterThanOrEqual(30);
      expect(r.remainingSeconds).toBeLessThanOrEqual(270);
    }
  });

  it('só testa zonas armadas e usa os mesmos critérios do uso ao vivo', () => {
    for (const r of full.rows.slice(0, 40)) {
      expect(r.filters.historico_minimo).toBe('favoravel');
      expect(Object.keys(r.criteria)).toContain('gatilho_tempo_restante');
    }
  });

  it('não olha o futuro: cortar os dados no meio dá exatamente as mesmas linhas até ali', () => {
    const cut = b.c5.length >> 1;
    const part = runBacktest(b.c5, b.m1, cfg, testSource(b.c5), { to: cut });
    const upTo = full.rows.filter((r) => r.t <= b.c5[cut]!.t);
    expect(part.rows).toEqual(upTo);
    // alterar os candles depois do corte não muda nada antes dele
    const futureWrecked = b.c5.map((c, i) => (i > cut ? { ...c, h: c.h + 50, c: c.o - 20, l: c.l - 50 } : c));
    const again = runBacktest(futureWrecked, b.m1, cfg, testSource(b.c5), { to: cut });
    expect(again.rows).toEqual(upTo);
  });

  it('descarta candles sem os 5 minutos de M1 e M1 que não batem com o M5', () => {
    const noM1 = new Map(b.m1);
    for (const k of [...noM1.keys()].slice(100, 140)) noM1.delete(k);
    expect(runBacktest(b.c5, noM1, cfg, testSource(b.c5)).skipped.semM1).toBe(40);
    const bad = new Map(b.m1);
    const k = [...bad.keys()][200]!;
    bad.set(k, bad.get(k)!.map((c) => ({ ...c, o: c.o + 5, h: c.h + 5, l: c.l + 5, c: c.c + 5 })));
    expect(runBacktest(b.c5, bad, cfg, testSource(b.c5)).skipped.m1Divergente).toBe(1);
  });

  it('sem os parâmetros da zona e da retração (padrão da aula) não há zona armada, logo nenhuma linha', () => {
    expect(runBacktest(b.c5, b.m1, defaultConfig(), testSource(b.c5)).rows).toHaveLength(0);
  });

  it('resumo: equilíbrio pelo payout, três recortes e uma linha de ablação por critério', () => {
    const s = summarizeBacktest(full.rows, 80);
    expect(s.breakeven).toBeCloseTo(0.5556, 4);
    expect(s.todos.n + s.todos.ties).toBe(full.rows.length);
    expect(s.favoravel.n).toBeLessThanOrEqual(s.todos.n);
    expect(s.gatilho.n).toBeLessThanOrEqual(s.favoravel.n);
    expect(s.ablation).toHaveLength(10);
    for (const a of s.ablation.slice(0, 7)) expect(a.pass.n + a.fail.n + a.pass.ties + a.fail.ties).toBe(full.rows.length);
    // as linhas de confluência deixam de fora os toques sem dados do timeframe maior
    for (const a of s.ablation.slice(7)) expect(a.pass.n + a.fail.n + a.pass.ties + a.fail.ties).toBeLessThanOrEqual(full.rows.length);
  });

  it('cada linha traz a confluência M15/H1 (null até haver candles suficientes) e dá para desligá-la', () => {
    expect(full.rows.every((r) => 'M15' in r.htf && 'H1' in r.htf)).toBe(true);
    expect(full.rows.some((r) => r.htf.M15 !== null)).toBe(true);
    expect(full.rows.some((r) => r.htf.H1 === null)).toBe(true); // início da série: sem 480+ candles M5
    const off = runBacktest(b.c5, b.m1, cfg, testSource(b.c5), { htf: false });
    expect(off.rows.length).toBe(full.rows.length);
    expect(off.rows.every((r) => r.htf.M15 === null && r.htf.H1 === null)).toBe(true);
  });

  it('cada linha traz o alinhamento das médias móveis (null sem candles suficientes), com bloco de treino e confirmação', () => {
    expect(full.rows.every((r) => r.ma === null || typeof r.ma === 'boolean')).toBe(true);
    expect(full.rows.some((r) => r.ma !== null)).toBe(true);
    const m = summarizeBacktest(full.rows, 80).ma;
    const usados = m.treino.pass.n + m.treino.fail.n + m.confirmacao.pass.n + m.confirmacao.fail.n;
    expect(usados).toBeLessThanOrEqual(full.rows.length);
    expect(m.treino.pass.n + m.treino.fail.n).toBeGreaterThan(0);
    // sem vantagem real nos dados sintéticos, o filtro não pode sair "confirmado melhor" por acaso
    expect(m.veredito).not.toBe('confirmado_melhor');
  });

  it('em dados sem vantagem, "todo toque" não aparece como acima do equilíbrio', () => {
    expect(summarizeBacktest(full.rows, 80).verdicts.todos).not.toBe('acima');
  });
});

describe('diário ao vivo', () => {
  const cs = rangeBound(5, 5);
  const base = analyze({ candles: cs, source: testSource(cs), config: cfg });
  const z = base.zones.find((x) => x.side === 'resistencia')!;
  const at = atr(cs, cs.length - 1)!;
  const analysisAt = (config = cfg) =>
    analyze({ candles: cs, source: testSource(cs), config, intrabar: touchingIntrabar(cs, z, at, { remaining: 200 }) });
  const T5 = 1_800_000_000;

  it('registra o toque em zona armada com o estado e o gatilho do momento', () => {
    const e = detectEntry('BTCUSDT', analysisAt(), cfg, T5, 200, T5 + 100)!;
    expect(e).toMatchObject({
      id: entryId('BTCUSDT', T5, z.id), side: 'resistencia', state: 'FAVORAVEL', triggerConfirmed: true, result: null, close: null,
    });
    expect(e.criteria.gatilho_tempo_restante).toBe('atendido');
  });

  it('não registra se a zona não está armada ou se não há contato', () => {
    expect(detectEntry('BTCUSDT', analysisAt(fullConfig({ minPriorValidTouches: 10 })), fullConfig({ minPriorValidTouches: 10 }), T5, 200, T5)).toBeNull();
    expect(detectEntry('BTCUSDT', analyze({ candles: cs, source: testSource(cs), config: cfg }), cfg, T5, 200, T5)).toBeNull();
  });

  const entry = (side: 'resistencia' | 'suporte'): JournalEntry => ({
    ...detectEntry('BTCUSDT', analysisAt(), cfg, T5, 200, T5)!, side, entry: 100,
  });
  const closedAt = (c: number) => ({ t: T5, o: 100, h: 101, l: 99, c });

  it('resolve no fechamento: venda ganha se fecha abaixo, compra se fecha acima, igual é empate', () => {
    const now = T5 + 400;
    expect(resolveEntry(entry('resistencia'), closedAt(99), now).result).toBe('ganhou');
    expect(resolveEntry(entry('resistencia'), closedAt(101), now).result).toBe('perdeu');
    expect(resolveEntry(entry('suporte'), closedAt(101), now).result).toBe('ganhou');
    expect(resolveEntry(entry('suporte'), closedAt(99), now).result).toBe('perdeu');
    expect(resolveEntry(entry('suporte'), closedAt(100), now).result).toBe('empate');
  });

  it('não resolve com candle ainda aberto, candle de outro horário ou sem candle; resultado final não muda', () => {
    const e = entry('resistencia');
    expect(resolveEntry(e, closedAt(99), T5 + 200).result).toBeNull();
    expect(resolveEntry(e, { ...closedAt(99), t: T5 - 300 }, T5 + 400).result).toBeNull();
    expect(resolveEntry(e, undefined, T5 + 400).result).toBeNull();
    const done = resolveEntry(e, closedAt(99), T5 + 400);
    expect(resolveEntry(done, closedAt(101), T5 + 500).result).toBe('ganhou');
    expect(isResolvable(e, T5 + 302)).toBe(false);
    expect(isResolvable(e, T5 + 303)).toBe(true);
    expect(isResolvable(done, T5 + 500)).toBe(false);
  });

  it('estatísticas só com resultados; pendentes ficam de fora; mesmos vereditos do teste', () => {
    const mk = (res: JournalEntry['result'], state: JournalEntry['state'], trig: boolean): JournalEntry => ({ ...entry('resistencia'), result: res, state, triggerConfirmed: trig, id: Math.random().toString() });
    const list = [mk('ganhou', 'FAVORAVEL', true), mk('perdeu', 'DESFAVORAVEL', false), mk(null, 'FAVORAVEL', false), mk('empate', 'AGUARDAR', false)];
    const s = journalStats(list, 80);
    expect(s.pending).toBe(1);
    expect(s.todos).toMatchObject({ n: 2, wins: 1, losses: 1, ties: 1 });
    expect(s.favoravel.n).toBe(1);
    expect(s.gatilho.n).toBe(1);
    expect(s.verdicts.todos).toBe('inconclusivo');
  });

  it('persiste o diário e ignora registros malformados', () => {
    const store = memoryStore();
    const e = entry('suporte');
    expect(saveJournal(store, [e])).toBe(true);
    store.setItem('m5sa.journal.v1', JSON.stringify([e, { id: 1 }, null, 'x']));
    expect(loadJournal(store)).toEqual([e]);
    store.setItem('m5sa.journal.v1', '{ruim');
    expect(loadJournal(store)).toEqual([]);
  });
});
