import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { effectiveRules, MARKETPLACE_IDS, MARKETPLACE_PROFILES, MarketplaceIdSchema, type ProfileOverrides } from '@vendora/shared';
import type { AppContext } from '../../context';
import { requireAuth, uid } from '../../lib/auth';
import { encrypt, randomToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';

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

  app.get('/api/integrations', auth, async (request) => {
    const connections = await ctx.db.marketplaceConnection.findMany({ where: { userId: uid(request) } });
    return {
      integrations: MARKETPLACE_IDS.map((id) => {
        const conn = connections.find((c) => c.marketplace === id);
        return {
          id,
          name: MARKETPLACE_PROFILES[id].name,
          capabilities: ctx.adapters[id].capabilities(),
          connection: conn
            ? { status: conn.status, externalUserId: conn.externalUserId, expiresAt: conn.expiresAt, connectedAt: conn.createdAt }
            : null,
        };
      }),
    };
  });

  app.post('/api/integrations/:id/connect', auth, async (request) => {
    const userId = uid(request);
    const id = MarketplaceIdSchema.parse((request.params as { id: string }).id);
    const adapter = ctx.adapters[id];
    if (!adapter.authorizationUrl)
      throw new AppError(501, 'not_implemented', `A conexão com ${adapter.name} ainda não está disponível.`);
    const state = randomToken(24);
    const codeVerifier = randomToken(48);
    const url = adapter.authorizationUrl(state, codeVerifier);
    await ctx.db.oAuthState.create({
      data: { state, userId, marketplace: id, codeVerifier, expiresAt: new Date(Date.now() + 10 * 60_000) },
    });
    return { url };
  });

  /** Retorno do OAuth. Valida o state (anti-CSRF) e o vínculo com o usuário logado. */
  app.get('/api/integrations/:id/callback', auth, async (request, reply) => {
    const userId = uid(request);
    const id = MarketplaceIdSchema.parse((request.params as { id: string }).id);
    const q = z.object({ code: z.string().max(500).optional(), state: z.string().max(200), error: z.string().optional() }).parse(request.query);
    const back = (status: string) => reply.redirect(`${ctx.config.APP_URL}/app/integracoes?${new URLSearchParams({ marketplace: id, status })}`);

    const saved = await ctx.db.oAuthState.findUnique({ where: { state: q.state } });
    if (saved) await ctx.db.oAuthState.delete({ where: { state: q.state } });
    if (!saved || saved.userId !== userId || saved.marketplace !== id || saved.expiresAt < new Date()) return back('invalid_state');
    if (q.error || !q.code) return back('denied');

    const adapter = ctx.adapters[id];
    try {
      const t = await adapter.exchangeCode!(q.code, saved.codeVerifier);
      const key = ctx.config.TOKEN_ENCRYPTION_KEY;
      const data = {
        externalUserId: t.externalUserId,
        accessTokenEnc: encrypt(t.accessToken, key),
        refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken, key) : null,
        expiresAt: t.expiresAt,
        scopes: t.scopes,
        status: 'connected' as const,
      };
      await ctx.db.marketplaceConnection.upsert({
        where: { userId_marketplace: { userId, marketplace: id } },
        create: { userId, marketplace: id, ...data },
        update: data,
      });
      return back('connected');
    } catch {
      return back('failed');
    }
  });

  app.delete('/api/integrations/:id', auth, async (request) => {
    const id = MarketplaceIdSchema.parse((request.params as { id: string }).id);
    await ctx.db.marketplaceConnection.deleteMany({ where: { userId: uid(request), marketplace: id } });
    return { ok: true };
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
    backgroundRemoval: ctx.bgRemover ? { provider: ctx.bgRemover.id } : null,
    storage: ctx.storage.driver,
    respectRobotsTxt: ctx.config.RESPECT_ROBOTS_TXT,
    integrations: Object.fromEntries(MARKETPLACE_IDS.map((id) => [id, ctx.adapters[id].capabilities()])),
  }));
}
