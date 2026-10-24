import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { effectiveRules, MARKETPLACE_IDS, validateImage, type ProfileOverrides } from '@vendora/shared';
import type { AppContext } from '../../context';
import type { Asset } from '../../generated/prisma/client';
import { requireAuth, uid } from '../../lib/auth';
import { AppError, notFound } from '../../lib/errors';
import { newStorageKey, signAssetUrl, verifyAssetSignature } from '../storage/storage';
import { recordUsage } from '../usage/usage';
import { applyEdits, EditOperations, EXT, makeListingVariants, MIME, normalizeOriginal, probeImage, type ImageFormat } from './processing';

const EditBody = z.object({ operations: EditOperations, promotional: z.boolean().default(false) });
const ValidateQuery = z.object({ marketplace: z.enum(MARKETPLACE_IDS) });
const VariantsBody = z.object({ marketplace: z.enum(MARKETPLACE_IDS).default('mercado_livre') });

export function serializeAsset(ctx: AppContext, a: Asset) {
  return {
    id: a.id,
    kind: a.kind,
    parentId: a.parentId,
    mimeType: a.mimeType,
    width: a.width,
    height: a.height,
    sizeBytes: a.sizeBytes,
    sourceUrl: a.sourceUrl,
    edits: a.edits,
    promotional: a.promotional,
    isMain: a.isMain,
    createdAt: a.createdAt,
    url: signAssetUrl(ctx.config.TOKEN_ENCRYPTION_KEY, a.id),
  };
}

export async function storeAsset(
  ctx: AppContext,
  args: {
    userId: string;
    productId: string | null;
    buffer: Buffer;
    format: ImageFormat;
    width: number;
    height: number;
    kind: 'original' | 'edited';
    parentId?: string;
    sourceUrl?: string | null;
    edits?: unknown;
    promotional?: boolean;
  },
) {
  const key = newStorageKey(args.userId, EXT[args.format]);
  await ctx.storage.put(key, args.buffer, MIME[args.format]);
  return ctx.db.asset.create({
    data: {
      userId: args.userId,
      productId: args.productId,
      parentId: args.parentId ?? null,
      kind: args.kind,
      storageKey: key,
      mimeType: MIME[args.format],
      width: args.width,
      height: args.height,
      sizeBytes: args.buffer.length,
      sourceUrl: args.sourceUrl ?? null,
      edits: (args.edits as object) ?? undefined,
      promotional: args.promotional ?? false,
    },
  });
}

async function ownedAsset(ctx: AppContext, userId: string, id: string) {
  const asset = await ctx.db.asset.findFirst({ where: { id, userId } });
  if (!asset) throw notFound('Imagem');
  return asset;
}

export function imageRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: requireAuth(ctx) };
  const imageLimit = { max: 30, timeWindow: '1 minute' };

  /** Baixa as imagens encontradas na página do produto e guarda como ORIGINAIS. */
  app.post('/api/products/:id/images/import', { ...auth, config: { rateLimit: imageLimit } }, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const product = await ctx.db.product.findFirst({ where: { id, userId } });
    if (!product) throw notFound('Produto');
    const urls = ((product.data as { images?: string[] }).images ?? []).slice(0, 12);
    const already = new Set(
      (await ctx.db.asset.findMany({ where: { productId: id, kind: 'original' }, select: { sourceUrl: true } })).map((a) => a.sourceUrl),
    );

    const results: Array<{ url: string; ok: boolean; error?: string }> = [];
    for (const url of urls) {
      if (already.has(url)) {
        results.push({ url, ok: true });
        continue;
      }
      try {
        const res = await ctx.fetcher(url, {
          accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5',
          maxBytes: ctx.config.IMAGE_MAX_BYTES,
          timeoutMs: ctx.config.FETCH_TIMEOUT_MS,
          userAgent: ctx.config.FETCH_USER_AGENT,
        });
        if (res.status !== 200) throw new AppError(502, 'image_http', `HTTP ${res.status}`);
        const probe = await probeImage(res.body);
        const buffer = await normalizeOriginal(res.body, probe.format);
        await storeAsset(ctx, { userId, productId: id, buffer, ...probe, kind: 'original', sourceUrl: url });
        results.push({ url, ok: true });
      } catch (err) {
        results.push({ url, ok: false, error: err instanceof AppError ? err.message : 'Falha ao baixar a imagem.' });
      }
    }
    const assets = await ctx.db.asset.findMany({ where: { productId: id, userId }, orderBy: { createdAt: 'asc' } });
    return { results, assets: assets.map((a) => serializeAsset(ctx, a)) };
  });

  app.post('/api/products/:id/images/upload', { ...auth, config: { rateLimit: imageLimit } }, async (request, reply) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const product = await ctx.db.product.findFirst({ where: { id, userId } });
    if (!product) throw notFound('Produto');
    const file = await request.file();
    if (!file) throw new AppError(400, 'no_file', 'Envie um arquivo de imagem.');
    const raw = await file.toBuffer(); // limite de tamanho aplicado pelo @fastify/multipart
    const probe = await probeImage(raw);
    const buffer = await normalizeOriginal(raw, probe.format);
    const asset = await storeAsset(ctx, { userId, productId: id, buffer, ...probe, kind: 'original' });
    return reply.code(201).send({ asset: serializeAsset(ctx, asset) });
  });

  app.get('/api/products/:id/assets', auth, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const assets = await ctx.db.asset.findMany({ where: { productId: id, userId }, orderBy: { createdAt: 'asc' } });
    return { assets: assets.map((a) => serializeAsset(ctx, a)) };
  });

  /** Serve o arquivo por URL assinada e temporária. */
  app.get('/api/assets/:id/file', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { exp, sig, download } = request.query as { exp?: string; sig?: string; download?: string };
    if (!exp || !sig || !verifyAssetSignature(ctx.config.TOKEN_ENCRYPTION_KEY, id, exp, sig))
      throw new AppError(403, 'invalid_signature', 'Link da imagem expirado ou inválido.');
    const asset = await ctx.db.asset.findUnique({ where: { id } });
    if (!asset) throw notFound('Imagem');
    const body = await ctx.storage.get(asset.storageKey);
    reply
      .header('content-type', asset.mimeType)
      .header('cache-control', 'private, max-age=3600')
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "default-src 'none'");
    if (download) {
      const ext = asset.mimeType.split('/')[1] === 'jpeg' ? 'jpg' : asset.mimeType.split('/')[1];
      reply.header('content-disposition', `attachment; filename="vendora-${asset.kind}-${asset.id}.${ext}"`);
    }
    return reply.send(body);
  });

  /** Gera uma NOVA imagem editada. A original nunca é modificada. */
  app.post('/api/assets/:id/edit', { ...auth, config: { rateLimit: imageLimit } }, async (request, reply) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const { operations, promotional } = EditBody.parse(request.body);
    const source = await ownedAsset(ctx, userId, id);
    const input = await ctx.storage.get(source.storageKey);
    const out = await applyEdits(input, operations);
    const asset = await storeAsset(ctx, {
      userId,
      productId: source.productId,
      buffer: out.buffer,
      format: out.format,
      width: out.width,
      height: out.height,
      kind: 'edited',
      // Sempre aponta para a original raiz, mesmo editando uma cópia já editada.
      parentId: source.kind === 'original' ? source.id : (source.parentId ?? source.id),
      edits: { from: source.id, ...operations },
      promotional: promotional || source.promotional,
    });
    await recordUsage(ctx, userId, 'image_process');
    return reply.code(201).send({ asset: serializeAsset(ctx, asset) });
  });

  /**
   * Cinco imagens para o anúncio a partir de uma foto ORIGINAL do vendedor.
   * Gerar de novo substitui as anteriores dessa mesma foto. A "principal"
   * (fundo branco) vira a foto principal do produto.
   */
  app.post('/api/assets/:id/variants', { ...auth, config: { rateLimit: imageLimit } }, async (request, reply) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const { marketplace } = VariantsBody.parse(request.body ?? {});
    const source = await ownedAsset(ctx, userId, id);
    if (source.kind !== 'original') throw new AppError(400, 'not_original', 'Gere as versões a partir de uma foto original.');
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { settings: true } });
    const rules = effectiveRules(marketplace, ((user.settings as Record<string, ProfileOverrides>) ?? {})[marketplace] ?? {});

    const old = await ctx.db.asset.findMany({ where: { userId, parentId: id, edits: { path: ['variant'], not: 'null' } } });
    const { variants, cutout } = await makeListingVariants(await ctx.storage.get(source.storageKey), rules.imageRecommendedSize);
    for (const a of old) {
      await ctx.storage.delete(a.storageKey).catch(() => {});
      await ctx.db.asset.delete({ where: { id: a.id } });
    }
    const created = [];
    for (const v of variants)
      created.push(
        await storeAsset(ctx, {
          userId,
          productId: source.productId,
          buffer: v.buffer,
          format: v.format,
          width: v.width,
          height: v.height,
          kind: 'edited',
          parentId: id,
          edits: { variant: v.key, label: v.label, marketplace },
        }),
      );
    await recordUsage(ctx, userId, 'image_process');
    const main = created[0]!;
    await ctx.db.$transaction([
      ctx.db.asset.updateMany({ where: { userId, productId: source.productId }, data: { isMain: false } }),
      ctx.db.asset.update({ where: { id: main.id }, data: { isMain: true } }),
    ]);
    const fresh = await ctx.db.asset.findMany({ where: { id: { in: created.map((c) => c.id) } }, orderBy: { createdAt: 'asc' } });
    return reply.code(201).send({
      assets: fresh.map((a) => serializeAsset(ctx, a)),
      note: !cutout
        ? 'O fundo da foto não é liso, então não geramos as versões de estúdio. Para as 5 versões, fotografe o produto num fundo de cor única.'
        : variants.length < 5
          ? 'O produto aparece pequeno na foto, então não geramos o close (ficaria borrado). Fotografe mais de perto para ter as 5 versões.'
          : null,
    });
  });

  app.post('/api/assets/:id/remove-background', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = uid(request);
    if (!ctx.bgRemover)
      throw new AppError(
        503,
        'bg_not_configured',
        'A remoção de fundo depende de um serviço externo que não está configurado (REMOVE_BG_API_KEY).',
      );
    const { id } = request.params as { id: string };
    const source = await ownedAsset(ctx, userId, id);
    const png = await ctx.bgRemover.remove(await ctx.storage.get(source.storageKey), source.mimeType);
    const probe = await probeImage(png);
    const asset = await storeAsset(ctx, {
      userId,
      productId: source.productId,
      buffer: png,
      ...probe,
      kind: 'edited',
      parentId: source.kind === 'original' ? source.id : (source.parentId ?? source.id),
      edits: { from: source.id, backgroundRemoved: ctx.bgRemover.id },
    });
    await recordUsage(ctx, userId, 'image_process');
    return reply.code(201).send({ asset: serializeAsset(ctx, asset) });
  });

  app.post('/api/assets/:id/main', auth, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const asset = await ownedAsset(ctx, userId, id);
    if (asset.promotional)
      throw new AppError(400, 'promotional_main', 'Imagens promocionais não devem ser a foto principal. Use uma foto real do produto.');
    await ctx.db.$transaction([
      ctx.db.asset.updateMany({ where: { userId, productId: asset.productId }, data: { isMain: false } }),
      ctx.db.asset.update({ where: { id }, data: { isMain: true } }),
    ]);
    return { ok: true };
  });

  app.delete('/api/assets/:id', auth, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const asset = await ownedAsset(ctx, userId, id);
    // Versões feitas a partir desta foto saem junto: não faz sentido anunciar a foto que o vendedor removeu.
    const derived = await ctx.db.asset.findMany({ where: { userId, parentId: id } });
    for (const a of [...derived, asset]) {
      await ctx.storage.delete(a.storageKey).catch(() => {});
      await ctx.db.asset.delete({ where: { id: a.id } });
    }
    return { ok: true };
  });

  /** Confere a imagem contra as regras do canal (com os ajustes do usuário). */
  app.get('/api/assets/:id/validate', auth, async (request) => {
    const userId = uid(request);
    const { id } = request.params as { id: string };
    const { marketplace } = ValidateQuery.parse(request.query);
    const asset = await ownedAsset(ctx, userId, id);
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { settings: true } });
    const overrides = ((user.settings as Record<string, ProfileOverrides>) ?? {})[marketplace] ?? {};
    const rules = effectiveRules(marketplace, overrides);
    const issues = validateImage(rules, {
      width: asset.width,
      height: asset.height,
      format: asset.mimeType.split('/')[1] ?? '',
      sizeBytes: asset.sizeBytes,
    });
    if (asset.promotional)
      issues.push({ field: 'image', level: 'warning', message: 'Imagem promocional editada: não use como foto principal.' });
    return { issues, publishable: !issues.some((i) => i.level === 'error') };
  });
}
