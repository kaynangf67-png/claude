import { describe, expect, it } from 'vitest';
import { candlesToCsv, importCandlesCsv, parseTimestamp, tokenizeCsv } from './csv';
import { generateDemoCandles } from './demo';
import { zonedWallTimeToUnix } from './time';

const opts = { timeframeSeconds: 300 };
const iso = (t: number) => new Date(t * 1000).toISOString();

describe('importação de CSV', () => {
  it('importa um arquivo válido com volume opcional', () => {
    const csv = [
      'timestamp,open,high,low,close,volume',
      '2026-01-05T09:00:00Z,1.10,1.12,1.09,1.11,100',
      '2026-01-05T09:05:00Z,1.11,1.13,1.10,1.12,120',
    ].join('\n');
    const r = importCandlesCsv(csv, opts);
    expect(r.ok).toBe(true);
    expect(r.candles).toHaveLength(2);
    expect(r.candles[0]).toEqual({ t: Date.UTC(2026, 0, 5, 9) / 1000, o: 1.1, h: 1.12, l: 1.09, c: 1.11, v: 100 });
    expect(r.stats.hasVolume).toBe(true);
    expect(r.stats.medianStepSeconds).toBe(300);
  });

  it('funciona sem coluna de volume, com BOM e CRLF', () => {
    const csv = '﻿timestamp,open,high,low,close\r\n2026-01-05T09:00:00Z,1,2,0.5,1.5\r\n';
    const r = importCandlesCsv(csv, opts);
    expect(r.ok).toBe(true);
    expect(r.candles[0]!.v).toBeUndefined();
  });

  it('aceita ponto e vírgula com vírgula decimal e data brasileira', () => {
    const csv = 'timestamp;open;high;low;close\n05/01/2026 09:00;1,10;1,12;1,09;1,11\n';
    const r = importCandlesCsv(csv, { ...opts, timezone: 'UTC' });
    expect(r.ok).toBe(true);
    expect(r.candles[0]!.h).toBe(1.12);
  });

  it('reconhece Unix em segundos e milissegundos', () => {
    expect(parseTimestamp('1767603600')).toEqual({ kind: 'ok', t: 1767603600 });
    expect(parseTimestamp('1767603600000')).toEqual({ kind: 'ok', t: 1767603600 });
  });

  it('respeita o offset explícito do timestamp', () => {
    const r = parseTimestamp('2026-01-05T09:00:00-03:00');
    expect(r).toEqual({ kind: 'ok', t: Date.UTC(2026, 0, 5, 12) / 1000 });
  });

  it('rejeita arquivo vazio e arquivo só com cabeçalho', () => {
    expect(importCandlesCsv('', opts).errors[0]!.code).toBe('ARQUIVO_VAZIO');
    expect(importCandlesCsv('timestamp,open,high,low,close\n', opts).errors[0]!.code).toBe('SEM_CANDLES');
  });

  it('explica quais colunas obrigatórias estão ausentes', () => {
    const r = importCandlesCsv('timestamp,open,high,close\n2026-01-05T09:00:00Z,1,2,1.5', opts);
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.code).toBe('COLUNA_AUSENTE');
    expect(r.errors[0]!.message).toContain('low');
  });

  it('rejeita valores não numéricos com o número da linha', () => {
    const csv = 'timestamp,open,high,low,close\n2026-01-05T09:00:00Z,1,2,0.5,abc\n';
    const r = importCandlesCsv(csv, opts);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({ code: 'NUMERO_INVALIDO', line: 2 });
    expect(r.candles).toHaveLength(0);
  });

  it('rejeita high menor que open/close e low maior que open/close', () => {
    const csv = [
      'timestamp,open,high,low,close',
      '2026-01-05T09:00:00Z,1.10,1.09,1.08,1.11',
      '2026-01-05T09:05:00Z,1.10,1.12,1.105,1.11',
    ].join('\n');
    const r = importCandlesCsv(csv, opts);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toEqual(['HIGH_MENOR_QUE_CORPO', 'LOW_MAIOR_QUE_CORPO']);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it('identifica timestamps duplicados', () => {
    const csv = [
      'timestamp,open,high,low,close',
      '2026-01-05T09:00:00Z,1,2,0.5,1.5',
      '2026-01-05T09:00:00Z,1,2,0.5,1.5',
    ].join('\n');
    const r = importCandlesCsv(csv, opts);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({ code: 'TIMESTAMP_DUPLICADO', line: 3 });
    expect(r.stats.duplicates).toBe(1);
  });

  it('ordena cronologicamente e avisa', () => {
    const csv = [
      'timestamp,open,high,low,close',
      '2026-01-05T09:05:00Z,1,2,0.5,1.5',
      '2026-01-05T09:00:00Z,1,2,0.5,1.5',
    ].join('\n');
    const r = importCandlesCsv(csv, opts);
    expect(r.ok).toBe(true);
    expect(r.candles.map((c) => iso(c.t))).toEqual(['2026-01-05T09:00:00.000Z', '2026-01-05T09:05:00.000Z']);
    expect(r.warnings.map((w) => w.code)).toContain('ORDENADO_AUTOMATICAMENTE');
  });

  it('informa lacunas sem inventar candles', () => {
    const csv = [
      'timestamp,open,high,low,close',
      '2026-01-05T09:00:00Z,1,2,0.5,1.5',
      '2026-01-05T09:05:00Z,1,2,0.5,1.5',
      '2026-01-05T09:25:00Z,1,2,0.5,1.5',
    ].join('\n');
    const r = importCandlesCsv(csv, opts);
    expect(r.ok).toBe(true);
    expect(r.candles).toHaveLength(3); // nada foi preenchido
    expect(r.gaps).toEqual([{ fromT: r.candles[1]!.t, toT: r.candles[2]!.t, missingCandles: 3 }]);
    expect(r.warnings.map((w) => w.code)).toContain('LACUNA');
  });

  it('exige o fuso quando o timestamp não traz offset', () => {
    const csv = 'timestamp,open,high,low,close\n2026-01-05 09:00:00,1,2,0.5,1.5\n';
    const r = importCandlesCsv(csv, opts);
    expect(r.ok).toBe(false);
    expect(r.needsTimezone).toBe(true);
    expect(r.errors.map((e) => e.code)).toContain('FUSO_NECESSARIO');
  });

  it('converte o horário do fuso escolhido para UTC', () => {
    const csv = 'timestamp,open,high,low,close\n2026-01-05 09:00:00,1,2,0.5,1.5\n';
    const r = importCandlesCsv(csv, { ...opts, timezone: 'America/Sao_Paulo' });
    expect(r.ok).toBe(true);
    expect(iso(r.candles[0]!.t)).toBe('2026-01-05T12:00:00.000Z');
  });

  it('rejeita fuso desconhecido e timestamp ilegível', () => {
    const csv = 'timestamp,open,high,low,close\n2026-01-05 09:00:00,1,2,0.5,1.5\n';
    expect(importCandlesCsv(csv, { ...opts, timezone: 'Marte/Olympus' }).errors[0]!.code).toBe('FUSO_INVALIDO');
    const bad = importCandlesCsv('timestamp,open,high,low,close\nontem,1,2,0.5,1.5\n', opts);
    expect(bad.errors[0]!.code).toBe('TIMESTAMP_INVALIDO');
  });

  it('limita a quantidade de erros detalhados mas conta todos', () => {
    const rows = Array.from({ length: 80 }, (_, i) => `2026-01-05T${String(Math.floor(i / 12) + 1).padStart(2, '0')}:${String((i % 12) * 5).padStart(2, '0')}:00Z,x,2,1,1.5`);
    const r = importCandlesCsv(['timestamp,open,high,low,close', ...rows].join('\n'), { ...opts, maxIssues: 10 });
    expect(r.errors).toHaveLength(10);
    expect(r.errorsTotal).toBe(80);
  });

  it('é possível ida e volta com o CSV exportado', () => {
    const cs = generateDemoCandles('lateral', 50);
    const r = importCandlesCsv(candlesToCsv(cs), opts);
    expect(r.ok).toBe(true);
    expect(r.candles).toEqual(cs);
    expect(r.gaps).toHaveLength(0);
  });

  it('tokeniza campos entre aspas', () => {
    expect(tokenizeCsv('a,"b,c",d\n1,2,3', ',')).toEqual([['a', 'b,c', 'd'], ['1', '2', '3']]);
  });
});

describe('fuso horário', () => {
  it('converte São Paulo (UTC−3) e UTC corretamente', () => {
    expect(zonedWallTimeToUnix(2026, 1, 5, 9, 0, 0, 'America/Sao_Paulo')).toBe(Date.UTC(2026, 0, 5, 12) / 1000);
    expect(zonedWallTimeToUnix(2026, 1, 5, 9, 0, 0, 'UTC')).toBe(Date.UTC(2026, 0, 5, 9) / 1000);
  });
  it('considera o horário de verão de Nova York', () => {
    expect(zonedWallTimeToUnix(2026, 7, 1, 9, 0, 0, 'America/New_York')).toBe(Date.UTC(2026, 6, 1, 13) / 1000);
    expect(zonedWallTimeToUnix(2026, 1, 5, 9, 0, 0, 'America/New_York')).toBe(Date.UTC(2026, 0, 5, 14) / 1000);
  });
});
