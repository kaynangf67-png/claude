import type { ApiErrorBody, IntegrationId } from '../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorBody['code'],
    message: string,
    public integration?: IntegrationId,
  ) {
    super(message);
  }
}

export const notConfigured = (integration: IntegrationId, message: string) =>
  new ApiError(503, 'not_configured', message, integration);

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = { error: err.message, code: err.code, integration: err.integration };
    return json(body, err.status);
  }
  console.error('[api] erro inesperado', err);
  return json({ error: 'Erro inesperado no servidor.', code: 'upstream_error' } satisfies ApiErrorBody, 500);
}

/** fetch com timeout e erro tratado (nunca vaza segredos na mensagem). */
export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}, label = 'serviço externo'): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    if (res.status === 429) throw new ApiError(429, 'rate_limited', `Limite de uso atingido em ${label}. Tente novamente mais tarde.`);
    if (res.status === 401 || res.status === 403)
      throw new ApiError(502, 'unauthorized', `${label} recusou a autenticação (HTTP ${res.status}). Verifique as credenciais e permissões do app.`);
    if (!res.ok) throw new ApiError(502, 'upstream_error', `${label} respondeu HTTP ${res.status}.`);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(502, 'upstream_error', `${label} retornou uma resposta inválida.`);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError(504, 'upstream_error', `${label} demorou demais para responder.`);
    throw new ApiError(502, 'upstream_error', `Falha de rede ao acessar ${label}.`);
  } finally {
    clearTimeout(timer);
  }
}

/** Cache em memória por instância de função (reduz custo e limites de uso). */
const cache = new Map<string, { expires: number; value: unknown }>();
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}

export function requiredParam(url: URL, name: string, max = 120) {
  const v = url.searchParams.get(name)?.trim();
  if (!v) throw new ApiError(400, 'bad_request', `Parâmetro "${name}" é obrigatório.`);
  if (v.length > max) throw new ApiError(400, 'bad_request', `Parâmetro "${name}" muito longo.`);
  return v;
}
