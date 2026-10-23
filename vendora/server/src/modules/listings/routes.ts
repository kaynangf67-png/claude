import { ZipArchive } from 'archiver';
import type { FastifyInstance } from 'fastify';
import { PassThrough } from 'node:stream';
import { z } from 'zod';
import {
  effectiveRules,
  ListingContent,
  MARKETPLACE_PROFILES,
  MarketplaceIdSchema,
  validateListingText,
  type FieldStatusMap,
  type MarketplaceId,
  type ProductData,
  type ProfileOverrides,
} from '@vendora/shared';
import type { AppContext } from '../../context';
import { requireAuth, uid } from '../../lib/auth';
import { AppError, notFound } from '../../lib/errors';
import { generateListing, postProcess } from '../ai/generate';
import type { GenerationPart } from '../ai/types';
import { serializeAsset } from '../images/routes';
import { serializeProduct } from '../products/routes';
import { recordUsage } from '../usage/usage';

const Create = z.object({
  productId: z.string().min(1),
  marketplace: MarketplaceIdSchema,
  audience: z.string().trim().max(300).optional(),
});
const Regenerate = z.object({ part: z.enum(['all', 'title', 'description']), audience: z.string().trim().max(300).optional() });
const SaveContent = z.object({ content: ListingContent });
const ExportQuery = z.object({ format: z.enum(['json', 'txt', 'zip']).default('json') });

async function rulesFor(ctx: AppContext, userId: string, marketplace: MarketplaceId) {
  const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { settings: true } });
  const overrides = ((user.settings as Record<string, ProfileOverrides>) ?? {})[marketplace] ?? {};
  return effectiveRules(marketplace, overrides);
}

function assertUsableProduct(product: { status: string; data: unknown }) {
  const data = product.data as ProductData;
  if (product.status === 'failed' || !data.title)
    throw new AppError(
      422,
      'product_incomplete',
      'Não há dados confirmados deste produto. Complete as informações manualmente antes de gerar o anúncio.',
    );
}

export function listingText(content: ListingContent, marketplace: MarketplaceId): string {
  const lines = [
    `ANÚNCIO — ${MARKETPLACE_PROFILES[marketplace].name}`,
    '',
    'TÍTULO',
    content.title,
    '',
    'DESCRIÇÃO',
    content.description,
    '',
  ];
  if (content.specifications.length) lines.push('FICHA TÉCNICA', ...content.specifications.map((s) => `${s.name}: ${s.value}`), '');
  if (content.keywords.length) lines.push('PALAVRAS-CHAVE', content.keywords.join(', '), '');
  if (content.category) lines.push('CATEGORIA SUGERIDA', `${content.category.name} (confiança: ${content.category.confidence})`, '');
  if (content.missingInfo.length)
    lines.push('CONFIRME ANTES DE PUBLICAR', ...content.missingInfo.map((m) => `- ${m.field}: ${m.reason}`), '');
  return lines.join('\n');
}

export function listingRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: requireAuth(ctx) };
  const genLimit = { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } };

  async function loadListing(userId: string, id: string) {
    const listing = await ctx.db.listing.findFirst({
      where: { id, userId },
      include: { product: true, versions: { orderBy: { version: 'desc' } } },
    });
    if (!listing) throw notFound('Anúncio');
    return listing;
  }

  async function present(userId: string, id: string) {
    const listing = await loadListing(userId, id);
    const current = listing.versions.find((v) => v.version === listing.currentVersion) ?? listing.versions[0]!;
    const assets = await ctx.db.asset.findMany({ where: { productId: listing.productId, userId }, orderBy: { createdAt: 'asc' } });
    const rules = await rulesFor(ctx, userId, listing.marketplace);
    return {
      listing: {
        id: listing.id,
        marketplace: listing.marketplace,
        status: listing.status,
        title: listing.title,
        currentVersion: listing.currentVersion,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        content: current.content as ListingContent,
        source: current.source,
        provider: current.provider,
        model: current.model,
        warnings: current.warnings,
        versions: listing.versions.map((v) => ({ version: v.version, source: v.source, createdAt: v.createdAt })),
      },
      rules,
      product: serializeProduct(listing.product),
      assets: assets.map((a) => serializeAsset(ctx, a)),
    };
  }

  async function addVersion(
    listingId: string,
    content: ListingContent,
    meta: { source: 'ai' | 'basic' | 'user'; provider?: string | null; model?: string | null; warnings: unknown[] },
  ) {
    return ctx.db.$transaction(async (tx) => {
      const last = await tx.listingVersion.findFirst({ where: { listingId }, orderBy: { version: 'desc' } });
      const version = (last?.version ?? 0) + 1;
      await tx.listingVersion.create({
        data: {
          listingId,
          version,
          content,
          source: meta.source,
          provider: meta.provider ?? null,
          model: meta.model ?? null,
          warnings: meta.warnings as object[],
        },
      });
      await tx.listing.update({ where: { id: listingId }, data: { currentVersion: version, title: content.title } });
      return version;
    });
  }

  const generatorMeta = () => ({
    source: ctx.generator.id === 'anthropic' ? ('ai' as const) : ('basic' as const),
    provider: ctx.generator.id,
    model: ctx.generator.model,
  });

  app.post('/api/listings', { ...auth, ...genLimit }, async (request, reply) => {
    const userId = uid(request);
    const body = Create.parse(request.body);
    const product = await ctx.db.product.findFirst({ where: { id: body.productId, userId } });
    if (!product) throw notFound('Produto');
    assertUsableProduct(product);
    const rules = await rulesFor(ctx, userId, body.marketplace);
    const imageCount = await ctx.db.asset.count({ where: { productId: product.id, userId } });
    const { content, warnings } = await generateListing(ctx.generator, {
      imageCount,
      product: product.data as ProductData,
      fieldStatus: product.fieldStatus as FieldStatusMap,
      marketplace: body.marketplace,
      rules,
      part: 'all',
      audience: body.audience,
    });
    await recordUsage(ctx, userId, 'generation');
    const listing = await ctx.db.listing.create({
      data: { userId, productId: product.id, marketplace: body.marketplace, title: content.title, currentVersion: 0 },
    });
    await addVersion(listing.id, content, { ...generatorMeta(), warnings });
    return reply.code(201).send(await present(userId, listing.id));
  });

  app.get('/api/listings', auth, async (request) => {
    const userId = uid(request);
    const q = z
      .object({ cursor: z.string().optional(), marketplace: MarketplaceIdSchema.optional() })
      .parse(request.query);
    const items = await ctx.db.listing.findMany({
      where: { userId, ...(q.marketplace ? { marketplace: q.marketplace } : {}) },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: { product: { select: { sourceDomain: true, status: true } } },
    });
    const page = items.slice(0, 20);
    return {
      listings: page.map((l) => ({
        id: l.id,
        marketplace: l.marketplace,
        status: l.status,
        title: l.title,
        currentVersion: l.currentVersion,
        sourceDomain: l.product.sourceDomain,
        productStatus: l.product.status,
        updatedAt: l.updatedAt,
      })),
      nextCursor: items.length > 20 ? page[page.length - 1]!.id : null,
    };
  });

  app.get('/api/listings/:id', auth, async (request) => present(uid(request), (request.params as { id: string }).id));

  /** Edição manual do vendedor: vira uma nova versão (as anteriores ficam no histórico). */
  app.put('/api/listings/:id/content', auth, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const { content } = SaveContent.parse(request.body);
    const listing = await loadListing(userId, id);
    const rules = await rulesFor(ctx, userId, listing.marketplace);
    const warnings = validateListingText(rules, content).map((i) => ({ field: i.field, message: i.message }));
    await addVersion(id, content, { source: 'user', warnings });
    return present(userId, id);
  });

  app.post('/api/listings/:id/regenerate', { ...auth, ...genLimit }, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const { part, audience } = Regenerate.parse(request.body);
    const listing = await loadListing(userId, id);
    assertUsableProduct(listing.product);
    const current = listing.versions.find((v) => v.version === listing.currentVersion)!.content as ListingContent;
    const input = {
      product: listing.product.data as ProductData,
      fieldStatus: listing.product.fieldStatus as FieldStatusMap,
      marketplace: listing.marketplace,
      rules: await rulesFor(ctx, userId, listing.marketplace),
      part: part as GenerationPart,
      current,
      audience,
      imageCount: await ctx.db.asset.count({ where: { productId: listing.productId, userId } }),
    };
    const raw = await ctx.generator.generate(input);
    // Ao regenerar uma parte, o resto do anúncio (inclusive edições do vendedor) é preservado.
    const merged: ListingContent =
      part === 'title' ? { ...current, title: raw.title } : part === 'description' ? { ...current, description: raw.description } : raw;
    const { content, warnings } = postProcess(input, merged);
    await recordUsage(ctx, userId, 'generation');
    await addVersion(id, content, { ...generatorMeta(), warnings });
    return present(userId, id);
  });

  app.post('/api/listings/:id/versions/:version/restore', auth, async (request) => {
    const userId = uid(request);
    const { id, version } = request.params as { id: string; version: string };
    const listing = await loadListing(userId, id);
    const v = listing.versions.find((x) => x.version === Number(version));
    if (!v) throw notFound('Versão');
    await addVersion(id, v.content as ListingContent, { source: 'user', warnings: v.warnings as unknown[] });
    return present(userId, id);
  });

  app.post('/api/listings/:id/save', auth, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    await loadListing(userId, id);
    await ctx.db.listing.update({ where: { id }, data: { status: 'saved' } });
    return present(userId, id);
  });

  app.delete('/api/listings/:id', auth, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    await loadListing(userId, id);
    await ctx.db.listing.delete({ where: { id } });
    return { ok: true };
  });

  app.get('/api/listings/:id/export', auth, async (request, reply) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const { format } = ExportQuery.parse(request.query);
    const data = await present(userId, id);
    const content = data.listing.content;
    const mk = data.listing.marketplace;
    await ctx.db.listing.update({ where: { id }, data: { status: 'exported' } });
    await recordUsage(ctx, userId, 'export');
    const base = `vendora-${mk}-${id}`;

    const exportJson = {
      generatedBy: 'Vendora AI',
      exportedAt: new Date().toISOString(),
      marketplace: mk,
      notice:
        'Exportado para publicação manual. Confira os itens de "missingInfo" e os alertas antes de publicar. A publicação automática não está ativa.',
      listing: content,
      warnings: data.listing.warnings,
      rulesApplied: data.rules,
      source: { url: data.product.sourceUrl, method: data.product.method, fieldStatus: data.product.fieldStatus },
      images: data.assets.map((a) => ({
        id: a.id,
        kind: a.kind,
        isMain: a.isMain,
        promotional: a.promotional,
        width: a.width,
        height: a.height,
        file: `images/${a.isMain ? '00-principal-' : ''}${a.kind}-${a.id}.${a.mimeType === 'image/png' ? 'png' : a.mimeType === 'image/webp' ? 'webp' : 'jpg'}`,
      })),
    };

    if (format === 'json')
      return reply
        .header('content-type', 'application/json; charset=utf-8')
        .header('content-disposition', `attachment; filename="${base}.json"`)
        .send(JSON.stringify(exportJson, null, 2));
    if (format === 'txt')
      return reply
        .header('content-type', 'text/plain; charset=utf-8')
        .header('content-disposition', `attachment; filename="${base}.txt"`)
        .send(listingText(content, mk));

    const archive = new ZipArchive({ zlib: { level: 6 } });
    const stream = new PassThrough();
    archive.pipe(stream);
    archive.append(JSON.stringify(exportJson, null, 2), { name: 'anuncio.json' });
    archive.append(listingText(content, mk), { name: 'anuncio.txt' });
    const assets = await ctx.db.asset.findMany({ where: { productId: data.product.id, userId } });
    for (const meta of exportJson.images) {
      const asset = assets.find((a) => a.id === meta.id);
      if (asset) archive.append(await ctx.storage.get(asset.storageKey), { name: meta.file });
    }
    void archive.finalize();
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${base}.zip"`)
      .send(stream);
  });

  /** Publicação automática: honestamente indisponível até o adaptador ser implementado e testado. */
  app.post('/api/listings/:id/publish', auth, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const listing = await loadListing(userId, id);
    return ctx.adapters[listing.marketplace].publish();
  });
}
