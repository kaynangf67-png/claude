import { emptyProduct, type FieldStatusMap, type ProductData, type Spec } from '@vendora/shared';
import type { Fetcher } from '../../security/safeFetch';

/** Extrai o ID de um anúncio do Mercado Livre (ex.: MLB-1234567890 ou MLB1234567890). */
export function mercadoLivreItemId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!/(^|\.)mercadoli(vre|bre)\.com(\.[a-z]{2})?$/.test(host)) return null;
  // /p/MLB123 é página de catálogo (produto), não anúncio — tratada como HTML.
  if (/\/p\/MLB\d+/i.test(url.pathname)) return null;
  const m = `${url.pathname}${url.search}`.match(/\b(ML[A-Z])-?(\d{6,})\b/);
  return m ? `${m[1]}${m[2]}` : null;
}

interface MlAttribute {
  id: string;
  name: string;
  value_name: string | null;
}
interface MlItem {
  id: string;
  title: string;
  price?: number;
  currency_id?: string;
  category_id?: string;
  attributes?: MlAttribute[];
  pictures?: Array<{ secure_url?: string; url?: string }>;
}

/**
 * Lê o anúncio pela API oficial (GET /items/{id}) com o token OAuth do vendedor.
 * Implementado segundo a documentação pública; não testado contra a API real
 * neste ambiente (rede sem acesso ao Mercado Livre).
 */
export async function fetchMercadoLivreItem(
  itemId: string,
  accessToken: string,
  apiUrl: string,
  fetcher: Fetcher,
  common: { timeoutMs: number; userAgent: string },
): Promise<{ data: ProductData; fieldStatus: FieldStatusMap; categoryId: string | null } | null> {
  const headers = { authorization: `Bearer ${accessToken}` };
  const res = await fetcher(`${apiUrl}/items/${itemId}`, {
    accept: 'application/json',
    maxBytes: 2 * 1024 * 1024,
    ...common,
    headers,
  });
  if (res.status !== 200) return null;
  const item = JSON.parse(res.body.toString('utf8')) as MlItem;

  let description: string | null = null;
  try {
    const d = await fetcher(`${apiUrl}/items/${itemId}/description`, {
      accept: 'application/json',
      maxBytes: 1024 * 1024,
      ...common,
      headers,
    });
    if (d.status === 200) description = (JSON.parse(d.body.toString('utf8')) as { plain_text?: string }).plain_text?.trim() || null;
  } catch {
    description = null;
  }

  const attr = (id: string) => item.attributes?.find((a) => a.id === id)?.value_name ?? null;
  const data = emptyProduct();
  data.title = item.title?.slice(0, 500) ?? null;
  data.brand = attr('BRAND');
  data.model = attr('MODEL');
  data.gtin = attr('GTIN');
  data.sku = attr('SELLER_SKU');
  data.description = description;
  if (typeof item.price === 'number' && item.currency_id) data.price = { amount: item.price, currency: item.currency_id };
  data.images = (item.pictures ?? [])
    .map((p) => p.secure_url ?? p.url)
    .filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
    .slice(0, 30);
  data.specifications = (item.attributes ?? [])
    .filter((a) => a.value_name && !['BRAND', 'MODEL', 'GTIN', 'SELLER_SKU'].includes(a.id))
    .slice(0, 100)
    .map((a): Spec => ({ name: a.name.slice(0, 120), value: String(a.value_name).slice(0, 500) }));

  const fieldStatus: FieldStatusMap = {};
  for (const [k, v] of Object.entries(data)) {
    const present = Array.isArray(v) ? v.length > 0 : v !== null;
    fieldStatus[k as keyof ProductData] = present ? 'confirmed' : 'missing';
  }
  return { data, fieldStatus, categoryId: item.category_id ?? null };
}
