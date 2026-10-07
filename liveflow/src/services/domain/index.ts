import type { AuthUser } from '@/services/data/types';
import { accountService } from './account';
import { aiService } from './ai';
import type { ServiceContext } from './context';
import { livesService } from './lives';
import { postsService } from './posts';
import { importsService } from './imports';
import { productsService } from './products';
import { videosService } from './videos';

export type { ServiceContext } from './context';

export function createServices(ctx: ServiceContext, user: AuthUser) {
  return {
    ctx,
    products: productsService(ctx),
    videos: videosService(ctx),
    lives: livesService(ctx),
    posts: postsService(ctx),
    imports: importsService(ctx),
    ai: aiService(ctx),
    account: accountService(ctx, { email: user.email, fullName: user.fullName }),
    analytics: {
      list: (range: { from: string; to: string }) =>
        ctx.repo.list('analytics', { gte: { date: range.from }, lte: { date: range.to } }),
    },
  };
}

export type AppServices = ReturnType<typeof createServices>;
