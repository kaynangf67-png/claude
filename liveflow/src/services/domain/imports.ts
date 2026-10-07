import type { Insert } from '@/services/data/types';
import { tiktokVideoId, type ImportPlan } from '@/services/importer';
import { checkLimit, PlanLimitError } from '@/services/plans';
import type { PlanTier } from '@/types/domain';
import { notify, type ServiceContext } from './context';

export interface ImportOptions {
  /** cria produtos que não existem no catálogo (senão, ignora as linhas) */
  createMissing: boolean;
  /** apaga dados importados antes (source=manual) do mesmo período/produtos — evita contar duas vezes */
  replace: boolean;
  plan: PlanTier;
}

export interface ImportResult {
  inserted: number;
  createdProducts: number;
  skippedRows: number;
}

export function importsService(ctx: ServiceContext) {
  const { repo } = ctx;

  return {
    async apply(plan: ImportPlan, opts: ImportOptions): Promise<ImportResult> {
      if (!plan.range || plan.rows.length === 0) throw new Error('Nada para importar.');

      // 1) Produtos: casados, criados ou ignorados.
      const productIdByKey = new Map<string, string | null>();
      let createdProducts = 0;
      const missing = plan.products.filter((p) => !p.productId);
      if (opts.createMissing && missing.length) {
        const current = await repo.count('products', { eq: { status: 'active' } });
        const { limit } = checkLimit(opts.plan, 'products', 0);
        if (limit != null && current + missing.length > limit) throw new PlanLimitError('products', limit);
      }
      for (const p of plan.products) {
        if (p.productId) productIdByKey.set(p.key, p.productId);
        else if (opts.createMissing) {
          const unitRows = plan.rows.filter((r) => r.productKey === p.key);
          const units = unitRows.reduce((s, r) => s + r.units, 0);
          const created = await repo.insert('products', {
            name: p.name.slice(0, 160),
            description: '',
            image_url: null,
            price: units > 0 ? +(p.revenue / units).toFixed(2) : 0,
            promo_price: null,
            commission_rate: 0,
            category: '',
            product_url: null,
            sku: p.sku,
            status: 'active',
          });
          productIdByKey.set(p.key, created.id);
          createdProducts++;
        } else productIdByKey.set(p.key, null);
      }

      // 2) Publicações casadas pelo ID do vídeo.
      const posts = await repo.list('posts', { eq: { status: 'published' } });
      const postByVideoId = new Map(posts.map((p) => [tiktokVideoId(p.published_url), p]));
      const products = await repo.list('products');
      const rate = new Map(products.map((p) => [p.id, Number(p.commission_rate) / 100]));

      // 3) Agrega por (data, produto, publicação).
      const agg = new Map<string, Insert<'analytics'>>();
      let skippedRows = 0;
      for (const r of plan.rows) {
        const productId = productIdByKey.get(r.productKey) ?? null;
        if (!productId) {
          skippedRows++;
          continue;
        }
        const post = r.videoId ? postByVideoId.get(r.videoId) : undefined;
        const key = `${r.date}|${productId}|${post?.id ?? ''}`;
        const row = agg.get(key) ?? {
          date: r.date,
          product_id: productId,
          video_id: post?.video_id ?? null,
          live_id: null,
          post_id: post?.id ?? null,
          views: 0,
          clicks: 0,
          conversions: 0,
          units_sold: 0,
          revenue: 0,
          commission: 0,
          cost: 0,
          source: 'manual' as const,
        };
        row.views += r.views;
        row.clicks += r.clicks;
        row.conversions += r.orders;
        row.units_sold += r.units;
        row.revenue = +(Number(row.revenue) + r.revenue).toFixed(2);
        row.commission = +(Number(row.commission) + (r.commission ?? r.revenue * (rate.get(productId) ?? 0))).toFixed(2);
        agg.set(key, row);
      }

      // 4) Reimportação: substitui o que já foi importado no período para esses produtos.
      const productIds = [...new Set([...agg.values()].map((r) => r.product_id!))];
      if (opts.replace && productIds.length) {
        await repo.removeWhere('analytics', {
          eq: { source: 'manual' },
          in: { column: 'product_id', values: productIds },
          gte: { date: plan.range.from },
          lte: { date: plan.range.to },
        });
      }

      const inserted = await repo.insertMany('analytics', [...agg.values()]);
      await notify(ctx, 'system', 'Vendas importadas', `${plan.rows.length - skippedRows} linhas · ${plan.range.from} a ${plan.range.to}`);
      return { inserted: inserted.length, createdProducts, skippedRows };
    },
  };
}
