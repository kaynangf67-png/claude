import type { MarketplaceId } from '@vendora/shared';

export const MARKETPLACE_STYLE: Record<MarketplaceId, { label: string; dot: string; chip: string }> = {
  mercado_livre: { label: 'Mercado Livre', dot: 'bg-yellow-400', chip: 'bg-yellow-50 text-yellow-900 border-yellow-200' },
  shopee: { label: 'Shopee', dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-900 border-orange-200' },
  tiktok_shop: { label: 'TikTok Shop', dot: 'bg-ink-950', chip: 'bg-ink-100 text-ink-900 border-ink-200' },
};

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

export const formatPrice = (p: { amount: number; currency: string } | null) =>
  p ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: p.currency }).format(p.amount) : null;

export const formatBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export const FIELD_LABELS: Record<string, string> = {
  title: 'Título original',
  brand: 'Marca',
  model: 'Modelo',
  gtin: 'EAN/GTIN',
  sku: 'SKU',
  description: 'Descrição',
  price: 'Preço',
  features: 'Características',
  specifications: 'Especificações',
  images: 'Imagens',
};

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
