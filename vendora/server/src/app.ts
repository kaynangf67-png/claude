import { existsSync } from 'node:fs';
import path from 'node:path';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { allowedOrigins, type Config } from './config';
import type { AppContext } from './context';
import { createDb } from './db';
import { AppError } from './lib/errors';
import { AnthropicGenerator } from './modules/ai/anthropic';
import { BasicGenerator } from './modules/ai/basic';
import { AnthropicPhotoReader } from './modules/ai/vision';
import { authRoutes } from './modules/auth/routes';
import { RemoveBgRemover } from './modules/images/backgroundRemoval';
import { imageRoutes } from './modules/images/routes';
import { listingRoutes } from './modules/listings/routes';
import { createAdapters } from './modules/marketplaces/adapters';
import { marketplaceRoutes } from './modules/marketplaces/routes';
import { productRoutes } from './modules/products/routes';
import { createStorage } from './modules/storage/storage';
import { runRetention } from './jobs/retention';
import { safeFetch } from './security/safeFetch';

export function createContext(config: Config, overrides: Partial<AppContext> = {}): AppContext {
  const generator =
    config.AI_PROVIDER === 'anthropic' && config.ANTHROPIC_API_KEY
      ? new AnthropicGenerator(config.ANTHROPIC_API_KEY, config.AI_MODEL, config.AI_EFFORT)
      : new BasicGenerator();
  return {
    config,
    db: overrides.db ?? createDb(config.DATABASE_URL),
    storage: overrides.storage ?? createStorage(config),
    fetcher: overrides.fetcher ?? safeFetch,
    generator: overrides.generator ?? generator,
    photoReader:
      overrides.photoReader !== undefined
        ? overrides.photoReader
        : config.AI_PROVIDER === 'anthropic' && config.ANTHROPIC_API_KEY
          ? new AnthropicPhotoReader(config.ANTHROPIC_API_KEY, config.AI_MODEL)
          : null,
    bgRemover: overrides.bgRemover !== undefined ? overrides.bgRemover : config.REMOVE_BG_API_KEY ? new RemoveBgRemover(config.REMOVE_BG_API_KEY) : null,
    adapters: overrides.adapters ?? createAdapters(config),
  };
}

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: true,
    bodyLimit: 512 * 1024,
    logger:
      ctx.config.NODE_ENV === 'test'
        ? false
        : {
            level: ctx.config.NODE_ENV === 'production' ? 'info' : 'debug',
            // Nunca registrar cookies, cabeçalhos de autenticação ou senhas.
            redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]', '*.password'],
          },
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: ctx.config.RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' });
  await app.register(multipart, {
    limits: { fileSize: ctx.config.IMAGE_MAX_BYTES, files: 1, fields: 0, parts: 1 },
  });

  // Defesa extra contra CSRF além do SameSite=Lax: requisições que alteram dados
  // precisam vir da própria origem da aplicação.
  const origins = allowedOrigins(ctx.config);
  app.addHook('onRequest', async (request) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    const origin = request.headers.origin;
    if (!origin || origins.has(origin)) return;
    // Mesma origem: o domínio que o navegador acessou (vale para todos os aliases da Vercel).
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new AppError(403, 'bad_origin', 'Origem não permitida.');
    }
    const host = String(request.headers['x-forwarded-host'] ?? request.headers.host ?? '');
    if (originHost !== host) throw new AppError(403, 'bad_origin', 'Origem não permitida.');
  });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof AppError)
      return reply.code(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    if (err instanceof ZodError)
      return reply.code(400).send({
        error: {
          code: 'validation',
          message: err.issues[0]?.message ?? 'Dados inválidos.',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.statusCode === 429)
      return reply.code(429).send({ error: { code: 'rate_limited', message: 'Muitas requisições. Aguarde um pouco.' } });
    if (e.code === 'FST_REQ_FILE_TOO_LARGE')
      return reply.code(413).send({ error: { code: 'too_large', message: 'Arquivo maior que o limite permitido.' } });
    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500)
      return reply.code(e.statusCode).send({ error: { code: 'bad_request', message: 'Requisição inválida.' } });
    request.log.error({ err: { message: e.message, code: e.code } }, 'erro interno');
    return reply.code(500).send({ error: { code: 'internal', message: 'Erro interno. Tente novamente.' } });
  });

  app.get('/api/health', async () => {
    await ctx.db.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  // Vercel Cron: a plataforma envia "Authorization: Bearer $CRON_SECRET".
  app.get('/api/cron/retention', async (request) => {
    const secret = ctx.config.CRON_SECRET;
    if (!secret || request.headers.authorization !== `Bearer ${secret}`)
      throw new AppError(401, 'unauthorized', 'Não autorizado.');
    return runRetention(ctx);
  });

  authRoutes(app, ctx);
  productRoutes(app, ctx);
  imageRoutes(app, ctx);
  listingRoutes(app, ctx);
  marketplaceRoutes(app, ctx);

  const dist = ctx.config.WEB_DIST_DIR ? path.resolve(ctx.config.WEB_DIST_DIR) : '';
  if (dist && existsSync(path.join(dist, 'index.html'))) {
    // Import dinâmico: na Vercel o front é servido pela CDN e este módulo nem é carregado
    // (ele faz require() de pacote ESM, que o runtime da Vercel não aceita).
    const { default: fastifyStatic } = await import('@fastify/static');
    await app.register(fastifyStatic, { root: dist, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/'))
        return reply.code(404).send({ error: { code: 'not_found', message: 'Rota não encontrada.' } });
      return reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_request, reply) =>
      reply.code(404).send({ error: { code: 'not_found', message: 'Rota não encontrada.' } }),
    );
  }
  return app;
}
