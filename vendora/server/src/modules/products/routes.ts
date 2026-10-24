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
import { enforceHourlyLimit, recordUsage } from '../usage/usage';
import { photoToProduct } from '../ai/vision';
import { serializeAsset, storeAsset } from '../images/routes';
import { makeSalePhoto } from '../images/processing';
import { effectiveRules, MarketplaceIdSchema, type ProfileOverrides } from '@vendora/shared';

const Analyze = z.object({ url: z.string().min(1).max(2000) });
const Patch = z.object({ data: ProductData.partial() });
const PhotoDraft = z.object({ hint: z.string().trim().max(300).optional() });
const ReadPhotos = z.object({
  hint: z.string().trim().max(300).optional(),
  marketplace: MarketplaceIdSchema.default('mercado_livre'),
  /** false quando o vendedor já gerou as 5 versões para o anúncio. */
  salePhotos: z.boolean().default(true),
});

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

  /** Rascunho vazio: as fotos são enviadas depois, uma por requisição (limite de corpo da Vercel). */
  app.post('/api/products/photo-draft', auth, async (request, reply) => {
    const userId = uid(request);
    PhotoDraft.parse(request.body ?? {});
    const product = await ctx.db.product.create({
      data: {
        userId,
        method: 'photo',
        status: 'manual',
        data: emptyProduct(),
        fieldStatus: Object.fromEntries(PRODUCT_FIELDS.map((f) => [f, 'missing'])),
      },
    });
    return reply.code(201).send({ product: serializeProduct(product) });
  });

  /**
   * A IA lê as fotos enviadas e preenche os dados (como "a confirmar").
   * Em seguida gera as fotos prontas para venda no tamanho do canal escolhido,
   * sempre como cópias: as originais ficam preservadas.
   */
  app.post('/api/products/:id/read-photos', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const { hint, marketplace, salePhotos } = ReadPhotos.parse(request.body ?? {});
    const product = await ctx.db.product.findFirst({ where: { id, userId } });
    if (!product) throw notFound('Produto');
    const originals = await ctx.db.asset.findMany({
      where: { productId: id, userId, kind: 'original' },
      orderBy: { createdAt: 'asc' },
      take: 6,
    });
    if (originals.length === 0) throw new AppError(400, 'no_photos', 'Envie pelo menos uma foto do produto.');
    if (!ctx.photoReader)
      throw new AppError(
        503,
        'vision_not_configured',
        'A leitura de fotos usa IA, que ainda não está configurada neste servidor (ANTHROPIC_API_KEY). Preencha os dados manualmente por enquanto.',
      );
    await enforceHourlyLimit(ctx, userId, 'analysis', ctx.config.ANALYZE_LIMIT_PER_HOUR);

    const buffers = await Promise.all(originals.map((a) => ctx.storage.get(a.storageKey)));
    const analysis = await ctx.photoReader.read(
      buffers.map((data, i) => ({ data, mimeType: originals[i]!.mimeType })),
      hint,
    );
    await recordUsage(ctx, userId, 'analysis');
    if (!analysis.isProduct)
      throw new AppError(422, 'not_a_product', 'Não identificamos um produto nessas fotos. Envie fotos do produto que você vai vender.');

    const { data, fieldStatus } = photoToProduct(analysis, hint);
    fieldStatus.images = 'user';
    const updated = await ctx.db.product.update({
      where: { id },
      data: { data, fieldStatus, status: 'partial', method: 'photo' },
    });

    if (salePhotos) {
      // Fotos de venda: refaz a partir das originais (descarta versões automáticas anteriores).
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { settings: true } });
      const rules = effectiveRules(marketplace, ((user.settings as Record<string, ProfileOverrides>) ?? {})[marketplace] ?? {});
      const oldAuto = await ctx.db.asset.findMany({ where: { productId: id, userId, kind: 'edited', edits: { path: ['auto'], equals: true } } });
      for (const a of oldAuto) {
        await ctx.storage.delete(a.storageKey).catch(() => {});
        await ctx.db.asset.delete({ where: { id: a.id } });
      }
      const sale = [];
      for (const [i, original] of originals.entries()) {
        const out = await makeSalePhoto(buffers[i]!, rules.imageRecommendedSize);
        sale.push(
          await storeAsset(ctx, {
            userId,
            productId: id,
            buffer: out.buffer,
            format: out.format,
            width: out.width,
            height: out.height,
            kind: 'edited',
            parentId: original.id,
            edits: { auto: true, salePhoto: true, marketplace, size: rules.imageRecommendedSize },
          }),
        );
        await recordUsage(ctx, userId, 'image_process');
      }
      await ctx.db.$transaction([
        ctx.db.asset.updateMany({ where: { userId, productId: id }, data: { isMain: false } }),
        ctx.db.asset.update({ where: { id: sale[0]!.id }, data: { isMain: true } }),
      ]);
    }
    const assets = await ctx.db.asset.findMany({ where: { productId: id, userId }, orderBy: { createdAt: 'asc' } });
    return { product: serializeProduct(updated), analysis: { uncertain: analysis.uncertain }, assets: assets.map((a) => serializeAsset(ctx, a)) };
  });

  /** A IA olha as fotos já enviadas e sugere um nome de produto (não salva nada). */
  app.post('/api/products/:id/suggest-title', { ...auth, config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const product = await ctx.db.product.findFirst({ where: { id, userId } });
    if (!product) throw notFound('Produto');
    const originals = await ctx.db.asset.findMany({ where: { productId: id, userId, kind: 'original' }, orderBy: { createdAt: 'asc' }, take: 3 });
    if (originals.length === 0) throw new AppError(400, 'no_photos', 'Envie pelo menos uma foto do produto.');
    if (!ctx.photoReader)
      throw new AppError(503, 'vision_not_configured', 'A sugestão de título usa IA, que ainda não está configurada (ANTHROPIC_API_KEY). Digite o nome por enquanto.');
    await enforceHourlyLimit(ctx, userId, 'analysis', ctx.config.ANALYZE_LIMIT_PER_HOUR);
    const buffers = await Promise.all(originals.map((a) => ctx.storage.get(a.storageKey)));
    const a = await ctx.photoReader.read(buffers.map((data, i) => ({ data, mimeType: originals[i]!.mimeType })));
    await recordUsage(ctx, userId, 'analysis');
    if (!a.isProduct) throw new AppError(422, 'not_a_product', 'Não identificamos um produto nessa foto.');
    const parts = [a.productName.trim()];
    if (a.brand && !a.productName.toLowerCase().includes(a.brand.toLowerCase())) parts.push(a.brand.trim());
    if (a.model && !a.productName.toLowerCase().includes(a.model.toLowerCase())) parts.push(a.model.trim());
    if (a.color && !a.productName.toLowerCase().includes(a.color.toLowerCase())) parts.push(a.color.trim().toLowerCase());
    return { title: parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 300) };
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
