import robotsParser from 'robots-parser';
import type { Fetcher } from '../../security/safeFetch';

const cache = new Map<string, { at: number; robots: ReturnType<typeof robotsParser> | null }>();
const TTL_MS = 60 * 60 * 1000;

/**
 * Consulta o robots.txt da loja. Se o site proíbe acesso automatizado à página,
 * não lemos — o usuário importa os dados manualmente.
 * Sem robots.txt (404) ou com erro de rede ao buscá-lo, seguimos a convenção: permitido.
 */
export async function robotsAllows(url: URL, userAgent: string, fetcher: Fetcher, timeoutMs: number): Promise<boolean> {
  const origin = url.origin;
  const hit = cache.get(origin);
  let robots = hit && Date.now() - hit.at < TTL_MS ? hit.robots : undefined;
  if (robots === undefined) {
    robots = null;
    try {
      const res = await fetcher(`${origin}/robots.txt`, {
        accept: 'text/plain,*/*;q=0.5',
        maxBytes: 512 * 1024,
        timeoutMs: Math.min(timeoutMs, 5000),
        userAgent,
      });
      if (res.status >= 200 && res.status < 300) robots = robotsParser(`${origin}/robots.txt`, res.body.toString('utf8'));
    } catch {
      robots = null;
    }
    cache.set(origin, { at: Date.now(), robots });
  }
  if (!robots) return true;
  const token = userAgent.split('/')[0] ?? userAgent;
  return robots.isAllowed(url.toString(), token) !== false;
}

export function clearRobotsCache() {
  cache.clear();
}
