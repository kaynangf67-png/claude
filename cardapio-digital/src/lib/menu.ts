import type { Category, MenuConfig, PriceOption, Product } from '../types/menu.ts';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 32.9 → "R$ 32,90" */
export function formatPrice(value: number): string {
  return brl.format(value);
}

/** Produto pode ir ao ar: verificado e com todos os preços preenchidos. */
export function isPublishable(product: Product): boolean {
  return (
    product.verified &&
    product.prices.length > 0 &&
    product.prices.every((p: PriceOption) => typeof p.value === 'number' && Number.isFinite(p.value))
  );
}

export interface MenuSection {
  category: Category;
  products: Product[];
}

/**
 * Agrupa produtos por categoria, na ordem das categorias.
 * Categorias sem produtos visíveis somem.
 */
export function buildSections(config: MenuConfig, includePending: boolean): MenuSection[] {
  return config.categories
    .map((category) => ({
      category,
      products: config.products.filter(
        (p) => p.categoryId === category.id && (includePending || isPublishable(p)),
      ),
    }))
    .filter((s) => s.products.length > 0);
}

/** Minúsculas e sem acentos, para busca. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function formatAddress(config: MenuConfig): string[] {
  const a = config.restaurant.address;
  if (!a) return [];
  const first = [a.line1, a.line2].filter(Boolean).join(', ');
  const second = [a.neighborhood, `${a.city} - ${a.state}`].filter(Boolean).join(', ');
  return [first, a.postalCode ? `${second} · CEP ${a.postalCode}` : second];
}
