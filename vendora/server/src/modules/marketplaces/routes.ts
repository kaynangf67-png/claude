import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { effectiveRules, MARKETPLACE_IDS, MARKETPLACE_PROFILES, MarketplaceIdSchema, type ProfileOverrides } from '@vendora/shared';
import type { AppContext } from '../../context';
import { requireAuth, uid } from '../../lib/auth';

const Overrides = z
  .object({
    titleMaxLength: z.number().int().min(10).max(500),
    descriptionMaxLength: z.number().int().min(100).max(100000),
    imageMinSize: z.number().int().min(100).max(4000),
    imageRecommendedSize: z.number().int().min(100).max(4000),
    imageMaxFileSizeMB: z.number().min(0.5).max(50),
  })
  .partial()
  .strict();

export function marketplaceRoutes(app: FastifyInstance, ctx: AppContext) {
  const auth = { preHandler: requireAuth(ctx) };

  app.get('/api/marketplaces', auth, async (request) => {
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: uid(request) }, select: { settings: true } });
    const settings = (user.settings as Record<string, ProfileOverrides>) ?? {};
    return {
      marketplaces: MARKETPLACE_IDS.map((id) => ({
        profile: MARKETPLACE_PROFILES[id],
        overrides: settings[id] ?? {},
        rules: effectiveRules(id, settings[id] ?? {}),
      })),
    };
  });

  app.put('/api/settings/marketplaces/:id', auth, async (request) => {
    const userId = uid(request);
    const id = MarketplaceIdSchema.parse((request.params as { id: string }).id);
    const overrides = Overrides.parse(request.body);
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { settings: true } });
    const settings = { ...((user.settings as Record<string, ProfileOverrides>) ?? {}), [id]: overrides };
    await ctx.db.user.update({ where: { id: userId }, data: { settings: settings as object } });
    return { overrides, rules: effectiveRules(id, overrides) };
  });

  app.get('/api/usage', auth, async (request) => {
    const userId = uid(request);
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const grouped = await ctx.db.usageEvent.groupBy({ by: ['type'], where: { userId, createdAt: { gte: since } }, _count: true });
    const [listings, saved, products] = await Promise.all([
      ctx.db.listing.count({ where: { userId } }),
      ctx.db.listing.count({ where: { userId, status: { in: ['saved', 'exported'] } } }),
      ctx.db.product.groupBy({ by: ['status'], where: { userId }, _count: true }),
    ]);
    return {
      last30Days: Object.fromEntries(grouped.map((g) => [g.type, g._count])),
      totals: {
        listings,
        savedOrExported: saved,
        analysesByStatus: Object.fromEntries(products.map((p) => [p.status, p._count])),
      },
    };
  });

  /** O que está realmente ativo neste servidor — a interface usa isto para não prometer o que não existe. */
  app.get('/api/meta', async () => ({
    ai: { provider: ctx.generator.id, model: ctx.generator.model },
    vision: Boolean(ctx.photoReader),
    imageAi: Boolean(ctx.sceneGenerator),
    backgroundRemoval: ctx.bgRemover ? { provider: ctx.bgRemover.id } : null,
    storage: ctx.storage.driver,
    respectRobotsTxt: ctx.config.RESPECT_ROBOTS_TXT,
  }));
}
