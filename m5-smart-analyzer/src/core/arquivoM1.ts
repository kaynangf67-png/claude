import { candleIssue } from './candle';
import type { Candle } from './types';

/**
 * Leitor do arquivo exportado pelo script `mql5/M5Exportador.mq5` (candles M1).
 * Devolve os dados no MESMO formato da API da Binance (klines), para o resto do
 * app não precisar saber de onde vêm. Só lê; nada é preenchido ou inventado.
 */
export interface M1Row extends Candle {
  forming: boolean;
}

export interface ParseResult {
  candles: M1Row[];
  rejected: number;
}

/** CSV: timestamp,open,high,low,close,volume,forming (timestamp Unix em segundos, UTC). */
export function parseExport(text: string): ParseResult {
  const out: M1Row[] = [];
  let rejected = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !/^\d/.test(line)) continue;
    const p = line.split(',');
    if (p.length < 6) { rejected++; continue; }
    const [t, o, h, l, c, v, f] = p;
    const row: M1Row = { t: Number(t), o: Number(o), h: Number(h), l: Number(l), c: Number(c), v: Number(v), forming: f?.trim() === '1' };
    if (candleIssue(row) !== null || row.t % 60 !== 0) { rejected++; continue; }
    out.push(row);
  }
  out.sort((a, b) => a.t - b.t);
  const dedup: M1Row[] = [];
  for (const r of out) {
    if (dedup.length && dedup[dedup.length - 1]!.t === r.t) { rejected++; continue; }
    dedup.push(r);
  }
  return { candles: dedup, rejected };
}

/** Segundos desde o início do último candle exportado. Alto = script parado ou mercado fechado. */
export function idadeSegundos(c1: M1Row[], nowSec: number): number {
  if (c1.length === 0) return Infinity;
  return nowSec - c1[c1.length - 1]!.t;
}

/**
 * Monta candles M5 a partir de M1: só janelas COMPLETAS (5 minutos presentes);
 * a janela atual, se incompleta, vira o candle em formação (último da lista).
 */
export function m5FromM1(c1: M1Row[], nowSec: number): Candle[] {
  const groups = new Map<number, M1Row[]>();
  for (const m of c1) {
    const k = Math.floor(m.t / 300) * 300;
    const g = groups.get(k);
    if (g) g.push(m);
    else groups.set(k, [m]);
  }
  const currentBucket = Math.floor(nowSec / 300) * 300;
  const out: Candle[] = [];
  for (const k of [...groups.keys()].sort((a, b) => a - b)) {
    const g = groups.get(k)!;
    const completa = g.length === 5 && g.every((c, i) => c.t === k + i * 60 && !c.forming);
    const emFormacao = k === currentBucket && g.length >= 1 && g.every((c, i) => c.t === k + i * 60);
    if (!completa && !emFormacao) continue; // buraco: não inventa
    out.push({ t: k, o: g[0]!.o, h: Math.max(...g.map((x) => x.h)), l: Math.min(...g.map((x) => x.l)), c: g[g.length - 1]!.c });
  }
  return out;
}

/**
 * Responde como a API de klines da Binance: `interval` 1m ou 5m, últimos `limit`
 * candles (o último pode estar em formação) ou, com `startTime` (segundos), só o
 * candle daquele início, se já estiver fechado.
 */
export function klines(c1: M1Row[], interval: '1m' | '5m', limit: number, nowSec: number, startTime?: number): Candle[] {
  const base = interval === '1m' ? c1.map(({ forming: _f, ...c }) => c) : m5FromM1(c1, nowSec);
  const span = interval === '1m' ? 60 : 300;
  if (startTime !== undefined) {
    const c = base.find((x) => x.t === startTime);
    return c && c.t + span <= nowSec ? [c] : [];
  }
  return base.slice(-limit);
}

/** Nome do arquivo de um símbolo; recusa nomes que escapariam da pasta. */
export function nomeArquivo(symbol: string): string {
  if (!/^[A-Za-z0-9._#-]{3,20}$/.test(symbol) || symbol.includes('..')) throw new Error(`símbolo inválido: ${symbol}`);
  return `m5exp_${symbol}_M1.csv`;
}

export function symbolMt5Valido(s: string): boolean {
  return /^[A-Za-z0-9._#-]{3,20}$/.test(s) && !s.includes('..');
}
