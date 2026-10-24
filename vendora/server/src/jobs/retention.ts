import type { AppContext } from '../context';

/**
 * Política de retenção:
 * - sessões expiradas são apagadas;
 * - imagens de análises sem nenhum anúncio são apagadas após ASSET_RETENTION_DAYS;
 * - imagens ligadas a anúncios ficam enquanto o anúncio existir (o usuário pode excluir a qualquer momento);
 * - eventos de uso com mais de 13 meses são apagados.
 */
export async function runRetention(ctx: AppContext, now = new Date()) {
  const cutoff = new Date(now.getTime() - ctx.config.ASSET_RETENTION_DAYS * 24 * 3600_000);
  const sessions = await ctx.db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const stale = await ctx.db.asset.findMany({
    where: { createdAt: { lt: cutoff }, OR: [{ productId: null }, { product: { listings: { none: {} } } }] },
    select: { id: true, storageKey: true },
    take: 1000,
  });
  for (const asset of stale) {
    await ctx.storage.delete(asset.storageKey).catch(() => {});
    await ctx.db.asset.delete({ where: { id: asset.id } }).catch(() => {});
  }
  const usage = await ctx.db.usageEvent.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 395 * 24 * 3600_000) } },
  });
  return { sessions: sessions.count, assets: stale.length, usageEvents: usage.count };
}
