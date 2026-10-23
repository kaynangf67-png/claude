import dns from 'node:dns';
import type { LookupAddress } from 'node:dns';
import { Agent, request } from 'undici';
import { AppError } from '../lib/errors';
import { isPublicAddress, validatePublicUrl } from './url';

export interface FetchOptions {
  accept: string;
  maxBytes: number;
  timeoutMs: number;
  userAgent: string;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

export interface FetchResult {
  url: string;
  status: number;
  contentType: string;
  body: Buffer;
}

export type Fetcher = (url: string, options: FetchOptions) => Promise<FetchResult>;

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * Resolve o DNS e recusa a conexão se QUALQUER endereço não for público.
 * Como a validação acontece no mesmo lookup usado para conectar, um domínio
 * não consegue "trocar" para um IP interno entre a checagem e a conexão.
 */
export function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = addresses as LookupAddress[];
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
      const e = new Error(`Destino bloqueado: ${hostname}`) as NodeJS.ErrnoException;
      e.code = 'EBLOCKED';
      return callback(e, '');
    }
    if (options.all) return callback(null, list);
    const first = list[0]!;
    return callback(null, first.address, first.family);
  });
}

const agent = new Agent({
  connect: { lookup: guardedLookup as never, timeout: 5000 },
  headersTimeout: 10000,
  bodyTimeout: 10000,
});

async function readLimited(body: AsyncIterable<Buffer> & { destroy: (e?: Error) => void }, maxBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.length;
    if (total > maxBytes) {
      body.destroy();
      throw new AppError(413, 'too_large', 'O conteúdo do link é maior que o limite permitido.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** fetch com proteção contra SSRF, limite de tamanho, timeout e redirects revalidados. */
export const safeFetch: Fetcher = async (input, options) => {
  let current = validatePublicUrl(input);
  const maxRedirects = options.maxRedirects ?? 5;
  const signal = AbortSignal.timeout(options.timeoutMs);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let res;
    try {
      res = await request(current, {
        method: 'GET',
        dispatcher: agent,
        signal,
        headers: {
          'user-agent': options.userAgent,
          accept: options.accept,
          'accept-language': 'pt-BR,pt;q=0.9,en;q=0.5',
          ...options.headers,
        },
      });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? (err as { cause?: { code?: string } }).cause?.code;
      if (code === 'EBLOCKED') throw new AppError(400, 'blocked_url', 'Este endereço não é permitido.');
      if ((err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError')
        throw new AppError(504, 'fetch_timeout', 'O site demorou demais para responder.');
      if (code === 'ENOTFOUND') throw new AppError(422, 'fetch_dns', 'Não encontramos esse domínio. Confira o link.');
      throw new AppError(502, 'fetch_failed', 'Não conseguimos acessar o site.');
    }

    if (res.statusCode >= 300 && res.statusCode < 400) {
      await res.body.dump();
      const location = res.headers.location;
      if (typeof location !== 'string') throw new AppError(502, 'fetch_failed', 'Redirecionamento inválido.');
      current = validatePublicUrl(new URL(location, current).toString());
      continue;
    }

    const contentType = String(res.headers['content-type'] ?? '').toLowerCase();
    const declared = Number(res.headers['content-length'] ?? 0);
    if (declared > options.maxBytes) {
      await res.body.dump();
      throw new AppError(413, 'too_large', 'O conteúdo do link é maior que o limite permitido.');
    }
    const body = await readLimited(res.body as never, options.maxBytes);
    return { url: current.toString(), status: res.statusCode, contentType, body };
  }
  throw new AppError(502, 'too_many_redirects', 'O link redireciona vezes demais.');
};
