import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { symbolMt5Valido } from '../src/core/arquivoM1';
import { criarFetchMt5 } from './mt5Fonte';

/** Origens que podem ler: o app publicado, o servidor de desenvolvimento e arquivos locais. */
export function origemPermitida(origin: string | undefined): boolean {
  if (!origin) return true;
  return /^https:\/\/m5-smart-analyzer[a-z0-9-]*\.vercel\.app$/.test(origin)
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export interface PonteDeps { pasta: string; now: () => number }

export async function responder(deps: PonteDeps, req: Pick<IncomingMessage, 'url' | 'method' | 'headers'>): Promise<{ status: number; body: unknown }> {
  if (req.method !== 'GET') return { status: 405, body: { erro: 'somente GET' } };
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/api/v3/time') return { status: 200, body: { serverTime: deps.now() } };
  if (url.pathname !== '/api/v3/klines') return { status: 404, body: { erro: 'rota inexistente' } };
  const symbol = url.searchParams.get('symbol') ?? '';
  const interval = url.searchParams.get('interval');
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') ?? 500) || 500));
  const start = url.searchParams.get('startTime');
  if (!symbolMt5Valido(symbol)) return { status: 400, body: { erro: 'símbolo inválido' } };
  if (interval !== '1m' && interval !== '5m') return { status: 400, body: { erro: 'interval precisa ser 1m ou 5m' } };
  if (start !== null && !/^\d+$/.test(start)) return { status: 400, body: { erro: 'startTime inválido' } };
  try {
    const c = await criarFetchMt5(deps.pasta, deps.now)(symbol, interval, limit, start === null ? '' : `&startTime=${start}`);
    return { status: 200, body: c.map((k) => [k.t * 1000, String(k.o), String(k.h), String(k.l), String(k.c), String(k.v ?? 0)]) };
  } catch (e) {
    return { status: 503, body: { erro: e instanceof Error ? e.message : String(e) } };
  }
}

export function criarServidor(deps: PonteDeps) {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    if (origin && origemPermitida(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Private-Network'] = 'true';
      headers['Access-Control-Allow-Methods'] = 'GET';
      headers['Vary'] = 'Origin';
    }
    if (origin && !origemPermitida(origin)) { res.writeHead(403, headers).end(JSON.stringify({ erro: 'origem não permitida' })); return; }
    if (req.method === 'OPTIONS') { res.writeHead(204, headers).end(); return; }
    void responder(deps, req).then((r) => res.writeHead(r.status, headers).end(JSON.stringify(r.body)));
  });
}
