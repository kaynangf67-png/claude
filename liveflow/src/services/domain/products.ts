import { productSchema, type ProductInput } from '@/lib/validation';
import { checkLimit, PlanLimitError } from '@/services/plans';
import type { PlanTier, Product } from '@/types/domain';
import { stripBase } from '@/lib/utils';
import { notify, type ServiceContext } from './context';

export function productsService(ctx: ServiceContext) {
  const { repo, storage } = ctx;

  async function ensureCapacity(plan: PlanTier) {
    const count = await repo.count('products');
    const { allowed, limit } = checkLimit(plan, 'products', count);
    if (!allowed && limit != null) throw new PlanLimitError('products', limit);
  }

  return {
    list: () => repo.list('products', { orderBy: { column: 'created_at', ascending: false } }),
    get: (id: string) => repo.get('products', id),

    async create(input: ProductInput, plan: PlanTier): Promise<Product> {
      const data = productSchema.parse(input);
      await ensureCapacity(plan);
      const product = await repo.insert('products', data);
      await notify(ctx, 'product_created', 'Produto cadastrado', product.name, { type: 'product', id: product.id });
      return product;
    },

    async update(id: string, input: ProductInput): Promise<Product> {
      return repo.update('products', id, productSchema.parse(input));
    },

    async setStatus(id: string, status: Product['status']) {
      return repo.update('products', id, { status });
    },

    async duplicate(id: string, plan: PlanTier): Promise<Product> {
      const source = await repo.get('products', id);
      if (!source) throw new Error('Produto não encontrado');
      await ensureCapacity(plan);
      const rest = stripBase(source);
      return repo.insert('products', { ...rest, name: `${source.name} (cópia)`.slice(0, 160), sku: null, status: 'paused' });
    },

    async remove(id: string) {
      const product = await repo.get('products', id);
      await repo.remove('products', id);
      // Em produção o FK faz "on delete set null"; no demo replicamos.
      if (repo.kind === 'demo') {
        for (const table of ['videos', 'lives', 'live_schedules'] as const) {
          const rows = await repo.list(table, { eq: { product_id: id } });
          for (const r of rows) await repo.update(table, r.id, { product_id: null });
        }
        await repo.removeWhere('analytics', { eq: { product_id: id } });
      }
      if (product?.image_url && !product.image_url.startsWith('http')) {
        await storage.remove('product-images', product.image_url).catch(() => undefined);
      }
    },

    async uploadImage(file: File): Promise<string> {
      return storage.upload('product-images', file, { name: file.name });
    },
  };
}
