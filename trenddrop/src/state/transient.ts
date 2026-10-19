// Resultados de busca ao vivo ainda não salvos: guardados em memória para
// que a página de detalhes abra sem nova chamada à API.
import type { Product } from '@shared/types';

const cache = new Map<string, Product>();

export function rememberProducts(products: Product[]) {
  for (const p of products) cache.set(p.id, { ...p, transient: true });
}
export function transientProduct(id: string) {
  return cache.get(id) ?? null;
}
