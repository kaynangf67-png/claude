import { BINANCE_BASES, parseKlines } from '../core/binance';
import type { Candle } from '../core/types';

/** Rede da API pública da Binance (sem chave, sem login). Tenta o host alternativo se o primeiro falhar. */
let baseIdx = 0;

export async function api(path: string): Promise<unknown> {
  let last: unknown = new Error('sem resposta');
  for (let i = 0; i < BINANCE_BASES.length; i++) {
    const idx = (baseIdx + i) % BINANCE_BASES.length;
    try {
      const r = await fetch(BINANCE_BASES[idx] + path, { signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: unknown = await r.json();
      baseIdx = idx;
      return j;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error('falha de rede');
}

/** Diferença (ms) entre o relógio da Binance e o do computador. */
export async function serverOffsetMs(): Promise<number> {
  const r = (await api('/api/v3/time')) as { serverTime?: number };
  return typeof r.serverTime === 'number' ? r.serverTime - Date.now() : 0;
}

export async function fetchKlines(symbol: string, interval: '1m' | '5m', limit: number, extra = ''): Promise<Candle[]> {
  return parseKlines(await api(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}${extra}`));
}

/** Baixa um intervalo longo em lotes de 1000 candles. */
export async function fetchRange(
  symbol: string, interval: '1m' | '5m', startSec: number, endSec: number, onProgress?: (n: number) => void,
): Promise<Candle[]> {
  const step = interval === '1m' ? 60 : 300;
  let out: Candle[] = [];
  let cur = startSec;
  while (cur < endSec) {
    const k = await fetchKlines(symbol, interval, 1000, `&startTime=${cur * 1000}&endTime=${endSec * 1000 - 1}`);
    if (!k.length) break;
    out = out.concat(k);
    cur = k[k.length - 1]!.t + step;
    onProgress?.(out.length);
    if (k.length < 1000) break;
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}
