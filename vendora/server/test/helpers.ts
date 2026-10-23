import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { buildApp, createContext } from '../src/app';
import { loadConfig } from '../src/config';
import type { AppContext } from '../src/context';
import type { FetchResult, Fetcher } from '../src/security/safeFetch';
import { validatePublicUrl } from '../src/security/url';

loadEnv({ path: '../.env', quiet: true });

export function testConfig(extra: Record<string, string> = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL!,
    TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
    AI_PROVIDER: 'none',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: mkdtempSync(path.join(tmpdir(), 'vendora-test-')),
    APP_URL: 'http://localhost:5173',
    ...extra,
  });
}

type Route = Partial<Omit<FetchResult, 'body'>> & { body: Buffer | string };

/**
 * Fetcher falso: responde URLs conhecidas sem rede. Aplica a mesma validação de
 * URL do fetcher real, para que os testes não passem por cima da proteção.
 */
export function fakeFetcher(routes: Record<string, Route>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    validatePublicUrl(url);
    calls.push(url);
    const r = routes[url];
    if (!r) return { url, status: 404, contentType: 'text/plain', body: Buffer.from('not found') };
    return {
      url: r.url ?? url,
      status: r.status ?? 200,
      contentType: r.contentType ?? 'text/html; charset=utf-8',
      body: Buffer.isBuffer(r.body) ? r.body : Buffer.from(r.body),
    };
  }) as unknown as Fetcher & { calls: string[] };
  fn.calls = calls;
  return fn;
}

export async function resetDb(ctx: AppContext) {
  await ctx.db.$executeRawUnsafe(
    'TRUNCATE "UsageEvent","OAuthState","MarketplaceConnection","Asset","ListingVersion","Listing","Product","Session","User" CASCADE',
  );
}

export async function makeApp(overrides: Partial<AppContext> = {}, extraEnv: Record<string, string> = {}) {
  const ctx = createContext(testConfig(extraEnv), overrides);
  const app = await buildApp(ctx);
  return { app, ctx };
}

/** Extrai o cookie de sessão de uma resposta do inject. */
export function sessionCookie(res: { cookies: Array<{ name: string; value: string }> }) {
  const c = res.cookies.find((x) => x.name === 'vendora_session');
  if (!c) throw new Error('Sem cookie de sessão');
  return `vendora_session=${c.value}`;
}
