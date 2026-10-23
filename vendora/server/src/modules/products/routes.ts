import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  emptyProduct,
  ManualProductInput,
  PRODUCT_FIELDS,
  ProductData,
  type FieldStatusMap,
} from '@vendora/shared';
import type { AppContext } from '../../context';
import { requireAuth, uid } from '../../lib/auth';
import { AppError, notFound } from '../../lib/errors';
import { extractProduct } from '../extraction/service';
import { mercadoLivreAccessToken } from '../marketplaces/tokens';
import { enforceHourlyLimit, recordUsage } from '../usage/usage';

const Analyze = z.object({ url: z.string().min(1).max(2000) });
const Patch = z.object({ data: ProductData.partial() });

export function serializeProduct(p: {
  id: string;
  sourceUrl: string | null;
  sourceDomain: string | null;
  method: string;
  status: string;
  data: unknown;
  fieldStatus: unknown;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    sourceUrl: p.sourceUrl,
    sourceDomain: p.sourceDomain,
    method: p.method,
    status: p.status,
    data: p.data as ProductData,
    fieldStatus: p.fieldStatus as FieldStatusMap,
    failureReason: p.failureReason,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function productRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: requireAuth(ctx) };

  app.post('/api/products/analyze', { ...auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = uid(request);
    const { url } = Analyze.parse(request.body);
    await enforceHourlyLimit(ctx, userId, 'analysis', ctx.config.ANALYZE_LIMIT_PER_HOUR);

    const outcome = await extractProduct(url, {
      fetcher: ctx.fetcher,
      userAgent: ctx.config.FETCH_USER_AGENT,
      timeoutMs: ctx.config.FETCH_TIMEOUT_MS,
      maxBytes: ctx.config.FETCH_MAX_BYTES,
      respectRobots: ctx.config.RESPECT_ROBOTS_TXT,
      mlApiUrl: ctx.config.ML_API_URL,
      getMercadoLivreToken: () => mercadoLivreAccessToken(ctx, userId),
    });
    await recordUsage(ctx, userId, 'analysis');

    // Falhas também ficam no histórico — com o motivo, e sem nenhum dado inventado.
    const product = await ctx.db.product.create({
      data: outcome.ok
        ? {
            userId,
            sourceUrl: outcome.url,
            sourceDomain: outcome.domain,
            method: outcome.method,
            status: outcome.quality === 'extracted' ? 'extracted' : 'partial',
            data: outcome.data,
            fieldStatus: outcome.fieldStatus,
          }
        : {
            userId,
            sourceUrl: outcome.url,
            sourceDomain: outcome.domain,
            method: 'none',
            status: 'failed',
            data: emptyProduct(),
            fieldStatus: Object.fromEntries(PRODUCT_FIELDS.map((f) => [f, 'missing'])),
            failureReason: outcome.reason,
          },
    });
    return reply.code(201).send({
      product: serializeProduct(product),
      extraction: outcome.ok ? { ok: true, notes: outcome.notes } : { ok: false, code: outcome.code, reason: outcome.reason },
    });
  });

  app.post('/api/products/manual', auth, async (request, reply) => {
    const userId = uid(request);
    const input = ManualProductInput.parse(request.body);
    const data = {
      ...emptyProduct(),
      title: input.title,
      brand: input.brand || null,
      model: input.model || null,
      gtin: input.gtin || null,
      description: input.description || null,
      price: input.price != null ? { amount: input.price, currency: 'BRL' } : null,
      features: input.features,
      specifications: input.specifications,
    };
    const fieldStatus: FieldStatusMap = {};
    for (const f of PRODUCT_FIELDS) {
      const v = data[f];
      fieldStatus[f] = (Array.isArray(v) ? v.length > 0 : v !== null) ? 'user' : 'missing';
    }
    let domain: string | null = null;
    if (input.sourceUrl) domain = new URL(input.sourceUrl).hostname;
    const product = await ctx.db.product.create({
      data: { userId, sourceUrl: input.sourceUrl ?? null, sourceDomain: domain, method: 'manual', status: 'manual', data, fieldStatus },
    });
    return reply.code(201).send({ product: serializeProduct(product) });
  });

  /** O vendedor corrige ou completa campos. Campos alterados passam a ter status "user". */
  app.patch('/api/products/:id', auth, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const { data: patch } = Patch.parse(request.body);
    const product = await ctx.db.product.findFirst({ where: { id, userId } });
    if (!product) throw notFound('Produto');
    const data = { ...(product.data as ProductData), ...patch };
    const parsed = ProductData.safeParse(data);
    if (!parsed.success) throw new AppError(400, 'invalid_product', 'Dados do produto inválidos.');
    const fieldStatus = { ...(product.fieldStatus as FieldStatusMap) };
    for (const key of Object.keys(patch) as Array<keyof ProductData>) {
      const v = parsed.data[key];
      fieldStatus[key] = (Array.isArray(v) ? v.length > 0 : v !== null) ? 'user' : 'missing';
    }
    const updated = await ctx.db.product.update({
      where: { id },
      data: {
        data: parsed.data,
        fieldStatus,
        status: product.status === 'failed' && parsed.data.title ? 'manual' : product.status,
      },
    });
    return { product: serializeProduct(updated) };
  });

  app.get('/api/products/:id', auth, async (request) => {
    const { id } = request.params as { id: string };
    const product = await ctx.db.product.findFirst({ where: { id, userId: uid(request) } });
    if (!product) throw notFound('Produto');
    return { product: serializeProduct(product) };
  });

  app.get('/api/products', auth, async (request) => {
    const products = await ctx.db.product.findMany({
      where: { userId: uid(request) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { products: products.map(serializeProduct) };
  });
}
