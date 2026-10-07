import { format, subDays } from 'date-fns';
import { env, isSupabaseConfigured } from '@/lib/env';
import { checkLimit, PlanLimitError } from '@/services/plans';
import { computeTotals } from '@/services/analytics';
import { LocalAIProvider } from '@/services/ai/local';
import { RemoteAIProvider } from '@/services/ai/remote';
import type { AIProvider, ChatMessage, CopilotContext, Script, ScriptInput } from '@/services/ai/types';
import type { PlanTier } from '@/types/domain';
import { groupBy } from '@/lib/utils';
import type { ServiceContext } from './context';

export function createAIProvider(): AIProvider {
  return env.aiMode === 'remote' && isSupabaseConfigured ? new RemoteAIProvider() : new LocalAIProvider();
}

export function aiService(ctx: ServiceContext, provider: AIProvider = createAIProvider()) {
  const { repo } = ctx;

  async function ensureQuota(plan: PlanTier) {
    const count = await repo.count('ai_generations', { gte: { created_at: format(new Date(), 'yyyy-MM-01') } });
    const { allowed, limit } = checkLimit(plan, 'aiGenerationsPerMonth', count);
    if (!allowed && limit != null) throw new PlanLimitError('aiGenerationsPerMonth', limit);
  }

  async function buildContext(): Promise<CopilotContext> {
    const since = format(subDays(new Date(), 29), 'yyyy-MM-dd');
    const [products, videos, lives, rows] = await Promise.all([
      repo.list('products'),
      repo.list('videos'),
      repo.list('lives', { gte: { starts_at: new Date().toISOString() }, orderBy: { column: 'starts_at' }, limit: 10 }),
      repo.list('analytics', { gte: { date: since } }),
    ]);
    const byProduct = groupBy(rows, (r) => r.product_id);
    const byVideo = groupBy(rows, (r) => r.video_id);
    const productName = new Map(products.map((p) => [p.id, p.name]));
    const t = computeTotals(rows);
    return {
      today: format(new Date(), 'yyyy-MM-dd'),
      products: products.map((p) => {
        const pt = computeTotals(byProduct.get(p.id) ?? []);
        return {
          id: p.id,
          name: p.name,
          price: Number(p.price),
          promoPrice: p.promo_price == null ? null : Number(p.promo_price),
          commissionRate: Number(p.commission_rate),
          category: p.category,
          status: p.status,
          last30d: { views: pt.views, clicks: pt.clicks, orders: pt.conversions, revenue: pt.revenue, commission: pt.commission, ctr: pt.ctr, conversionRate: pt.conversionRate },
        };
      }),
      videos: videos.map((v) => {
        const vt = computeTotals(byVideo.get(v.id) ?? []);
        return {
          id: v.id,
          name: v.name,
          productName: v.product_id ? productName.get(v.product_id) ?? null : null,
          durationSeconds: v.duration_seconds,
          usageCount: v.usage_count,
          revenue30d: vt.revenue,
          ctr30d: vt.ctr,
        };
      }),
      upcomingLives: lives
        .filter((l) => l.status === 'scheduled')
        .map((l) => ({ title: l.title, productName: l.product_id ? productName.get(l.product_id) ?? null : null, startsAt: l.starts_at, status: l.status })),
      totals30d: { views: t.views, clicks: t.clicks, orders: t.conversions, revenue: t.revenue, commission: t.commission },
    };
  }

  return {
    providerId: provider.id,

    async generateScript(input: ScriptInput, plan: PlanTier, opts: { productId?: string | null; variant?: number } = {}): Promise<Script> {
      await ensureQuota(plan);
      const script = await provider.generateScript(input, opts.variant ?? Math.floor(Math.random() * 1000));
      await repo.insert('ai_generations', {
        kind: 'script',
        product_id: opts.productId ?? null,
        input: { ...input },
        output: { ...script },
        provider: provider.id,
      });
      return script;
    },

    async generateVariations(input: ScriptInput, plan: PlanTier, opts: { productId?: string | null; count?: number } = {}): Promise<Script[]> {
      await ensureQuota(plan);
      const scripts = await provider.generateVariations(input, opts.count ?? 5);
      await repo.insert('ai_generations', {
        kind: 'variations',
        product_id: opts.productId ?? null,
        input: { ...input },
        output: { scripts },
        provider: provider.id,
      });
      return scripts;
    },

    async chat(messages: ChatMessage[], plan: PlanTier): Promise<string> {
      await ensureQuota(plan);
      const context = await buildContext();
      const reply = await provider.chat(messages, context);
      await repo.insert('ai_generations', {
        kind: 'copilot',
        product_id: null,
        input: { question: messages[messages.length - 1]?.content ?? '' },
        output: { reply },
        provider: provider.id,
      });
      return reply;
    },

    history: () => repo.list('ai_generations', { orderBy: { column: 'created_at', ascending: false }, limit: 30 }),
    buildContext,
  };
}
