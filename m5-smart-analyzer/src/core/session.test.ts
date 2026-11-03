import { describe, expect, it } from 'vitest';
import { analyze } from './engine';
import { atr } from './candle';
import { journalCsv, journalStats, type JournalEntry } from './journal';
import { SimSession, type SessionDeps } from './session';
import { fullConfig, rangeBound, testSource, touchingIntrabar } from './testing/fixtures';
import type { Candle } from './types';

const cfg = fullConfig();
const closed = rangeBound(5, 5);
const zone = analyze({ candles: closed, source: testSource(closed), config: cfg }).zones.find((z) => z.side === 'resistencia')!;
const ib = touchingIntrabar(closed, zone, atr(closed, closed.length - 1)!, { remaining: 280 });
const formingOpen = closed[closed.length - 1]!.t + 300;
const forming: Candle = { t: formingOpen, ...ib.forming! };

interface Mock extends SessionDeps { clock: { ms: number }; calls: string[]; failFor: Set<string>; finalClose: number }

function mock(): Mock {
  const m: Mock = {
    clock: { ms: (formingOpen + 20) * 1000 },
    calls: [], failFor: new Set(), finalClose: 0,
    now() { return m.clock.ms; },
    async fetchKlines(symbol, interval, limit, extra = '') {
      m.calls.push(`${symbol}:${interval}:${limit}${extra}`);
      if (m.failFor.has(symbol)) throw new Error('HTTP 429');
      if (interval === '1m') return [];
      if (extra.includes('startTime')) return [{ t: formingOpen, o: forming.o, h: forming.h, l: forming.l, c: m.finalClose }];
      // 5m: depois que o candle fecha, ele passa a vir como fechado
      return m.clock.ms / 1000 >= formingOpen + 300 ? [...closed, { ...forming, c: m.finalClose }] : [...closed, forming];
    },
  };
  return m;
}

describe('sessão de simulação (agente)', () => {
  it('o primeiro ciclo só aquece; o segundo registra o toque; o terceiro não duplica', async () => {
    const m = mock();
    const s = new SimSession(m, cfg, ['BTCUSDT', 'ETHUSDT']);
    const r1 = await s.tick();
    expect(r1.newEntries).toHaveLength(0);
    expect(r1.symbolsOk).toBe(2);
    expect(r1.analyses.get('BTCUSDT')!.entry).toMatchObject({ side: 'resistencia', armed: true });
    const r2 = await s.tick();
    expect(r2.newEntries.map((e) => e.symbol).sort()).toEqual(['BTCUSDT', 'ETHUSDT']);
    expect(r2.newEntries[0]).toMatchObject({ result: null, side: 'resistencia', triggerConfirmed: true });
    expect((await s.tick()).newEntries).toHaveLength(0);
    expect(s.journal).toHaveLength(2);
  });

  it('resolve no fechamento do M5: venda ganha se fecha abaixo da entrada', async () => {
    const m = mock();
    const s = new SimSession(m, cfg, ['BTCUSDT']);
    await s.tick();
    await s.tick();
    const entry = s.journal[0]!.entry;
    m.finalClose = entry - 0.0005;
    m.clock.ms = (formingOpen + 310) * 1000;
    const r = await s.tick();
    expect(r.resolved).toHaveLength(1);
    expect(s.journal[0]).toMatchObject({ result: 'ganhou', close: m.finalClose });
    expect(journalStats(s.journal, 80).todos).toMatchObject({ n: 1, wins: 1 });
  });

  it('antes do fechamento não resolve; fechamento acima da entrada é perda', async () => {
    const m = mock();
    const s = new SimSession(m, cfg, ['BTCUSDT']);
    await s.tick();
    await s.tick();
    m.clock.ms = (formingOpen + 200) * 1000;
    expect((await s.tick()).resolved).toHaveLength(0);
    m.finalClose = s.journal[0]!.entry + 0.0005;
    m.clock.ms = (formingOpen + 310) * 1000;
    await s.tick();
    expect(s.journal[0]!.result).toBe('perdeu');
  });

  it('erro de rede num par não derruba os outros e é reportado', async () => {
    const m = mock();
    m.failFor.add('ETHUSDT');
    const s = new SimSession(m, cfg, ['BTCUSDT', 'ETHUSDT']);
    await s.tick();
    const r = await s.tick();
    expect(r.symbolsOk).toBe(1);
    expect(r.errors).toEqual([{ symbol: 'ETHUSDT', message: 'HTTP 429' }]);
    expect(r.newEntries.map((e) => e.symbol)).toEqual(['BTCUSDT']);
  });

  it('retoma o diário anterior sem duplicar toques já registrados', async () => {
    const m = mock();
    const a = new SimSession(m, cfg, ['BTCUSDT']);
    await a.tick();
    await a.tick();
    const b = new SimSession(m, cfg, ['BTCUSDT'], a.journal);
    await b.tick();
    expect((await b.tick()).newEntries).toHaveLength(0);
    expect(b.journal).toHaveLength(1);
  });

  it('só lê dados: nenhuma chamada é de ordem, e o histórico de chamadas é só klines', async () => {
    const m = mock();
    const s = new SimSession(m, cfg, ['BTCUSDT']);
    await s.tick();
    await s.tick();
    expect(m.calls.every((c) => /^[A-Z0-9]+:(1m|5m):\d+/.test(c))).toBe(true);
  });
});

describe('CSV do diário', () => {
  const entry = (symbol: string): JournalEntry => ({
    id: symbol, symbol, side: 'resistencia', zoneId: 'R-1', t5: 1_800_000_000, detectedAt: 1_800_000_020, entry: 1.1, remainingSeconds: 280,
    state: 'FAVORAVEL', triggerConfirmed: true, criteria: {}, filters: {}, rulesVersion: 'aula-03@0.1.0', configHash: 'abc', close: 1.09, result: 'ganhou',
  });

  it('gera cabeçalho, BOM e uma linha por entrada, com fórmulas neutralizadas', () => {
    const csv = journalCsv([entry('BTCUSDT'), entry('=HYPERLINK("x")')]);
    expect(csv.startsWith('﻿candle_utc;par;lado;entrada')).toBe(true);
    const lines = csv.replace('﻿', '').trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('BTCUSDT;venda;1.1;280;FAVORAVEL;1;1.09;ganhou');
    expect(lines[2]).toContain("'=HYPERLINK");
  });
});
