import { describe, expect, it } from 'vitest';
import { idadeSegundos, klines, m5FromM1, nomeArquivo, parseExport, symbolMt5Valido } from './arquivoM1';

const T0 = 1_700_000_100; // múltiplo de 300
const csv = (rows: Array<[number, number, number, number, number, number?, number?]>) =>
  'timestamp,open,high,low,close,volume,forming\n' + rows.map((r) => `${r[0]},${r[1]},${r[2]},${r[3]},${r[4]},${r[5] ?? 10},${r[6] ?? 0}`).join('\n') + '\n';

/** n minutos seguidos a partir de `start`, preço subindo 0.0001 por minuto. */
function minutos(start: number, n: number, base = 1.1): Array<[number, number, number, number, number]> {
  return Array.from({ length: n }, (_, i) => {
    const o = base + i * 0.0001;
    return [start + i * 60, o, o + 0.0002, o - 0.0001, o + 0.0001];
  });
}

describe('leitura do arquivo exportado do MT5', () => {
  it('ignora cabeçalho, ordena e remove duplicados', () => {
    const rows = minutos(T0, 3);
    const texto = csv([rows[2]!, rows[0]!, rows[1]!, rows[1]!]);
    const r = parseExport(texto);
    expect(r.candles.map((c) => c.t)).toEqual([T0, T0 + 60, T0 + 120]);
    expect(r.rejected).toBe(1);
  });

  it('rejeita linhas inválidas em vez de corrigi-las', () => {
    const texto = csv([
      [T0, 1.1, 1.0, 1.2, 1.1],           // máxima menor que a mínima
      [T0 + 61, 1.1, 1.2, 1.0, 1.1],      // instante fora do minuto cheio
      [T0 + 120, 1.1, 1.2, 1.0, 1.15],    // ok
    ]) + '1,2,3\nlixo\n';
    const r = parseExport(texto);
    expect(r.candles).toHaveLength(1);
    expect(r.rejected).toBe(3);
  });

  it('lê o marcador de candle em formação', () => {
    const r = parseExport(csv([[T0, 1.1, 1.2, 1.0, 1.1, 5, 0], [T0 + 60, 1.1, 1.2, 1.0, 1.1, 5, 1]]));
    expect(r.candles.map((c) => c.forming)).toEqual([false, true]);
  });

  it('idade: infinito sem dados, segundos desde o último candle com dados', () => {
    expect(idadeSegundos([], T0)).toBe(Infinity);
    const c = parseExport(csv(minutos(T0, 2))).candles;
    expect(idadeSegundos(c, T0 + 200)).toBe(140);
  });
});

describe('M1 → M5', () => {
  it('agrega só janelas completas: abertura do 1º, máxima/mínima do grupo, fechamento do último', () => {
    const rows = minutos(T0, 10);
    const c1 = parseExport(csv(rows)).candles;
    const m5 = m5FromM1(c1, T0 + 700);
    expect(m5).toHaveLength(2);
    expect(m5[0]).toMatchObject({ t: T0, o: rows[0]![1], c: rows[4]![4] });
    expect(m5[0]!.h).toBeCloseTo(Math.max(...rows.slice(0, 5).map((r) => r[2])), 10);
    expect(m5[0]!.l).toBeCloseTo(Math.min(...rows.slice(0, 5).map((r) => r[3])), 10);
    expect(m5[1]!.t).toBe(T0 + 300);
  });

  it('janela passada com buraco é descartada, nunca preenchida', () => {
    const rows = minutos(T0, 10).filter((_, i) => i !== 2); // falta o minuto 2 da 1ª janela
    const m5 = m5FromM1(parseExport(csv(rows)).candles, T0 + 700);
    expect(m5.map((c) => c.t)).toEqual([T0 + 300]);
  });

  it('janela atual incompleta vira o candle em formação (último da lista)', () => {
    const rows = minutos(T0, 8).map((r, i, a) => [...r, 10, i === a.length - 1 ? 1 : 0] as [number, number, number, number, number, number, number]);
    const now = T0 + 300 + 3 * 60 + 20; // 3 minutos e pouco dentro da 2ª janela
    const m5 = m5FromM1(parseExport(csv(rows)).candles, now);
    expect(m5.map((c) => c.t)).toEqual([T0, T0 + 300]);
  });

  it('janela passada incompleta, mesmo com o último minuto marcado em formação, não entra', () => {
    const rows = minutos(T0, 3).map((r, i) => [...r, 10, i === 2 ? 1 : 0] as [number, number, number, number, number, number, number]);
    expect(m5FromM1(parseExport(csv(rows)).candles, T0 + 900)).toEqual([]);
  });
});

describe('formato de klines', () => {
  const c1 = parseExport(csv(minutos(T0, 15))).candles;

  it('limita aos últimos N candles', () => {
    expect(klines(c1, '1m', 4, T0 + 900)).toHaveLength(4);
    expect(klines(c1, '5m', 2, T0 + 900).map((c) => c.t)).toEqual([T0 + 300, T0 + 600]);
  });

  it('startTime devolve o candle só se já fechou', () => {
    expect(klines(c1, '5m', 1, T0 + 700, T0 + 300).map((c) => c.t)).toEqual([T0 + 300]);
    expect(klines(c1, '5m', 1, T0 + 500, T0 + 300)).toEqual([]); // ainda em formação
    expect(klines(c1, '5m', 1, T0 + 900, T0 + 5 * 300)).toEqual([]); // não existe
  });
});

describe('nomes de arquivo e símbolos', () => {
  it('aceita símbolos reais de MT5 e recusa caminhos', () => {
    expect(nomeArquivo('EURUSD')).toBe('m5exp_EURUSD_M1.csv');
    expect(nomeArquivo('EURUSD.a')).toBe('m5exp_EURUSD.a_M1.csv');
    for (const ruim of ['../x', 'a/b', 'a\\b', '..', 'EU', 'x'.repeat(30), 'EUR USD', '']) {
      expect(symbolMt5Valido(ruim)).toBe(false);
      expect(() => nomeArquivo(ruim)).toThrow();
    }
  });
});
