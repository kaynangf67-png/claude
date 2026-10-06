import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';

const elements = {
  elements: [
    { type: 'way', id: 1, nodes: [1, 2], geometry: [{ lat: -20.3, lon: -40.3 }, { lat: -20.3, lon: -40.299 }], tags: { highway: 'residential', name: 'Rua A' } },
  ],
};

describe('download das ruas (Overpass)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('servidor principal rápido: só 1 pedido', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(elements)));
    vi.stubGlobal('fetch', fetchMock);
    const { loadStreets } = await import('./streets');
    const d = await loadStreets([-40.3, -20.3]);
    expect(d.segments.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('principal lento: o reserva entra depois de 1,5 s e vence', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      calls.push(url);
      if (url === config.overpassUrls[0]) return new Promise((_, rej) => init.signal?.addEventListener('abort', () => rej(new Error('abort'))));
      return Promise.resolve(new Response(JSON.stringify(elements)));
    });
    const { loadStreets } = await import('./streets');
    const p = loadStreets([-40.31, -20.31]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(600);
    const d = await p;
    expect(calls.length).toBe(2);
    expect(d.segments.length).toBe(1);
  });

  it('principal com erro: tenta o próximo na hora', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      return url === config.overpassUrls[0] ? new Response('busy', { status: 429 }) : new Response(JSON.stringify(elements));
    });
    const { loadStreets } = await import('./streets');
    const d = await loadStreets([-40.32, -20.32]);
    expect(d.segments.length).toBe(1);
    expect(calls.length).toBe(2);
  });

  it('a mesma área não é baixada duas vezes (pré-carregamento + toque)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(elements)));
    vi.stubGlobal('fetch', fetchMock);
    const { loadStreets, prefetchStreets } = await import('./streets');
    prefetchStreets([-40.33, -20.33]);
    await loadStreets([-40.33, -20.33]);
    await loadStreets([-40.3301, -20.3301]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tudo fora do ar: mensagem clara (sem grade falsa)', async () => {
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }));
    const { loadStreets } = await import('./streets');
    await expect(loadStreets([-40.34, -20.34])).rejects.toThrow(/Não consegui baixar as ruas/);
  });
});
