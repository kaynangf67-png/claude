import type { AppContext } from '../../context';
import type { UsageType } from '../../generated/prisma/client';
import { AppError } from '../../lib/errors';

export async function recordUsage(ctx: AppContext, userId: string, type: UsageType) {
  await ctx.db.usageEvent.create({ data: { userId, type } });
}

/** Limite por usuário (além do limite por IP do rate-limit global). */
export async function enforceHourlyLimit(ctx: AppContext, userId: string, type: UsageType, max: number) {
  const count = await ctx.db.usageEvent.count({
    where: { userId, type, createdAt: { gte: new Date(Date.now() - 3600_000) } },
  });
  if (count >= max) throw new AppError(429, 'usage_limit', 'Você atingiu o limite de análises por hora. Tente mais tarde.');
}
