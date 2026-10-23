import { afterAll, beforeAll, expect, it } from 'vitest';
import { runRetention } from '../src/jobs/retention';
import type { AppContext } from '../src/context';
import { makeApp, resetDb } from './helpers';

let ctx: AppContext;
beforeAll(async () => {
  ({ ctx } = await makeApp());
  await resetDb(ctx);
});
afterAll(() => ctx.db.$disconnect());

it('apaga imagens antigas sem anúncio e sessões expiradas; mantém o que está em uso', async () => {
  const user = await ctx.db.user.create({ data: { email: 'r@vendora.test', name: 'R', passwordHash: 'x' } });
  const mk = (status: 'manual') =>
    ctx.db.product.create({ data: { userId: user.id, method: 'manual', status, data: {}, fieldStatus: {} } });
  const orphan = await mk('manual');
  const used = await mk('manual');
  await ctx.db.listing.create({ data: { userId: user.id, productId: used.id, marketplace: 'shopee', title: 't' } });
  const old = new Date(Date.now() - 40 * 24 * 3600_000);
  const asset = (productId: string, key: string, createdAt: Date) =>
    ctx.db.asset.create({
      data: { userId: user.id, productId, kind: 'original', storageKey: key, mimeType: 'image/jpeg', width: 1, height: 1, sizeBytes: 1, createdAt },
    });
  await asset(orphan.id, 'k-old-orphan', old);
  await asset(orphan.id, 'k-new-orphan', new Date());
  await asset(used.id, 'k-old-used', old);
  await ctx.db.session.create({ data: { userId: user.id, tokenHash: 'h', expiresAt: new Date(Date.now() - 1000) } });

  const result = await runRetention({ ...ctx, storage: { ...ctx.storage, delete: async () => {} } });
  expect(result).toMatchObject({ assets: 1, sessions: 1 });
  const keys = (await ctx.db.asset.findMany()).map((a) => a.storageKey).sort();
  expect(keys).toEqual(['k-new-orphan', 'k-old-used']);
});
