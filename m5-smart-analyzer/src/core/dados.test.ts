import { describe, expect, it } from 'vitest';
import { buildIntrabar, isValidSymbol, liveSource, parseKlines, splitForming } from './binance';
import { bucketM1, looksLikeM1, parseMt5M1 } from './mt5';
import { candlesToCsv } from './csv';
import { syntheticM1 } from './testing/fixtures';

describe('importação de M1 do MT5', () => {
  const tab = [
    'Date\tTime\tOpen\tHigh\tLow\tClose\tTickVol',
    '2026.10.19\t00:00:00\t1.0850\t1.0855\t1.0848\t1.0852\t10',
    '2026.10.19\t00:01:00\t1.0852\t1.0853\t1.0849\t1.0850\t11',
  ].join('\n');

  it('lê tabulação com data e hora em colunas separadas, pulando o cabeçalho', () => {
    const r = parseMt5M1(tab);
    expect(r.candles).toHaveLength(2);
    expect(r.candles[0]).toEqual({ t: Date.UTC(2026, 9, 19) / 1000, o: 1.085, h: 1.0855, l: 1.0848, c: 1.0852 });
    expect(r.rejected).toBe(0);
  });

  it('lê vírgula com data e hora juntas e vírgula decimal em ;', () => {
    expect(parseMt5M1('2026.10.19 00:00,1.0850,1.0855,1.0848,1.0852').candles).toHaveLength(1);
    expect(parseMt5M1('2026.10.19;00:00;1,0850;1,0855;1,0848;1,0852').candles[0]!.h).toBe(1.0855);
  });

  it('rejeita linhas inválidas (high < low, high < corpo) e timestamps repetidos, e conta', () => {
    const r = parseMt5M1([
      '2026.10.19 00:00,1.0850,1.0840,1.0848,1.0852', // high < low
      '2026.10.19 00:01,1.0850,1.0849,1.0848,1.0852', // high < close
      '2026.10.19 00:02,1.0850,1.0855,1.0848,1.0852',
      '2026.10.19 00:02,1.0850,1.0855,1.0848,1.0852', // repetido
    ].join('\n'));
    expect(r.candles).toHaveLength(1);
    expect(r.rejected).toBe(3);
  });

  it('ordena e agrupa em M5 só quando os 5 minutos existem (nada é preenchido)', () => {
    const c1 = syntheticM1(60);
    const full = bucketM1(c1);
    expect(full.c5).toHaveLength(12);
    expect(full.c5[0]).toMatchObject({ o: c1[0]!.o, c: c1[4]!.c });
    expect(full.c5[0]!.h).toBe(Math.max(...c1.slice(0, 5).map((c) => c.h)));
    const holes = bucketM1(c1.filter((_, i) => i !== 7));
    expect(holes.c5).toHaveLength(11);
    expect(holes.incompleteBuckets).toBe(1);
    expect(holes.m1.has(c1[5]!.t)).toBe(false);
  });

  it('reconhece se o arquivo é de 1 minuto ou de 5', () => {
    expect(looksLikeM1(syntheticM1(500))).toBe(true);
    const m5 = bucketM1(syntheticM1(500)).c5;
    expect(looksLikeM1(m5)).toBe(false);
    expect(candlesToCsv(m5).length).toBeGreaterThan(0);
  });
});

describe('adaptador da Binance', () => {
  const k = (t: number, o: number, h: number, l: number, c: number) => [t * 1000, String(o), String(h), String(l), String(c), '12.5', 0, '0', 0, '0', '0', '0'];

  it('converte klines (ms → s) e descarta linhas malformadas', () => {
    const r = parseKlines([k(1000, 1, 2, 0.5, 1.5), [1, 2], k(1300, 1, 0.5, 2, 1), 'x']);
    expect(r).toEqual([{ t: 1000, o: 1, h: 2, l: 0.5, c: 1.5, v: 12.5 }]);
    expect(parseKlines({ code: -1 })).toEqual([]);
  });

  it('separa o candle em formação dos fechados', () => {
    const c5 = parseKlines([k(600, 1, 2, 1, 2), k(900, 2, 3, 2, 3), k(1200, 3, 3.5, 2.8, 3.2)]);
    const s = splitForming(c5, 1260)!; // 60 s dentro do candle de 1200
    expect(s.closed).toHaveLength(2);
    expect(s.formingOpenT).toBe(1200);
    expect(s.forming).toEqual({ o: 3, h: 3.5, l: 2.8, c: 3.2 });
  });

  it('se o candle novo ainda não apareceu, o em formação parte do último fechamento', () => {
    const c5 = parseKlines([k(600, 1, 2, 1, 2), k(900, 2, 3, 2, 3)]);
    const s = splitForming(c5, 1203)!;
    expect(s.closed).toHaveLength(2);
    expect(s.forming).toBeNull();
    expect(s.formingOpenT).toBe(1200);
    const ib = buildIntrabar(s, [], 1203);
    expect(ib.forming).toEqual({ o: 3, h: 3, l: 3, c: 3 });
    expect(ib.remainingSeconds).toBe(297);
  });

  it('calcula o tempo restante e usa só M1 fechados dentro do candle', () => {
    const c5 = parseKlines([k(600, 1, 2, 1, 2), k(900, 2, 3, 2, 3), k(1200, 3, 3.5, 2.8, 3.2)]);
    const s = splitForming(c5, 1385)!; // 185 s decorridos
    const m1 = parseKlines([k(1140, 3, 3, 3, 3), k(1200, 3, 3.1, 3, 3.1), k(1260, 3.1, 3.3, 3.1, 3.2), k(1380, 3.2, 3.4, 3.2, 3.3)]);
    const ib = buildIntrabar(s, m1, 1385);
    expect(ib.remainingSeconds).toBe(115);
    expect(ib.m1!.map((c) => c.t)).toEqual([1200, 1260]); // 1140 é de outro candle; 1380 ainda não fechou
    expect(buildIntrabar(s, [], 5000).remainingSeconds).toBe(0);
  });

  it('valida símbolos e monta a fonte sem se passar pela Quotex', () => {
    expect(isValidSymbol('BTCUSDT')).toBe(true);
    expect(isValidSymbol('btcusdt')).toBe(false);
    expect(isValidSymbol('BTC/USDT; DROP')).toBe(false);
    const src = liveSource('BTCUSDT', parseKlines([k(600, 1, 2, 1, 2), k(900, 2, 3, 2, 3)]), 'UTC', 0);
    expect(src).toMatchObject({ kind: 'binance_live', synthetic: false, otc: false, asset: 'BTCUSDT' });
    expect(src.origin).toMatch(/Não são os preços da Quotex/);
  });
});
