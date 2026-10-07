import { parseDate, parseNumber } from '@/lib/csv';
import type { Post, Product } from '@/types/domain';

export type FieldKey = 'date' | 'product' | 'sku' | 'videoUrl' | 'views' | 'clicks' | 'orders' | 'units' | 'revenue' | 'commission';

export interface FieldDef {
  key: FieldKey;
  label: string;
  required?: boolean;
  /** palavras que, no cabeçalho, sugerem esta coluna (sem acento, minúsculas) */
  hints: string[];
}

export const FIELDS: FieldDef[] = [
  { key: 'date', label: 'Data', required: true, hints: ['data', 'date', 'dia', 'criado', 'created', 'hora do pedido', 'order time', 'time'] },
  { key: 'product', label: 'Produto (nome)', hints: ['produto', 'product', 'item', 'nome do produto', 'product name', 'titulo'] },
  { key: 'sku', label: 'SKU', hints: ['sku', 'seller sku', 'codigo'] },
  { key: 'videoUrl', label: 'Link do vídeo', hints: ['link', 'url', 'video id', 'id do video'] },
  { key: 'views', label: 'Visualizações', hints: ['visualiza', 'views', 'impress', 'exibic'] },
  { key: 'clicks', label: 'Cliques', hints: ['clique', 'click'] },
  { key: 'orders', label: 'Pedidos', hints: ['pedido', 'orders', 'order count'] },
  { key: 'units', label: 'Itens vendidos', hints: ['quantidade', 'qtd', 'qty', 'quantity', 'itens', 'units', 'unidades'] },
  { key: 'revenue', label: 'Faturamento (R$)', hints: ['faturamento', 'receita', 'gmv', 'revenue', 'valor', 'vendas r', 'total', 'subtotal', 'amount'] },
  { key: 'commission', label: 'Comissão (R$)', hints: ['comiss', 'commission', 'ganho', 'earning'] },
];

export type Mapping = Partial<Record<FieldKey, number>>;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Sugere colunas pelos nomes do cabeçalho. Cada coluna é usada no máximo uma vez. */
export function guessMapping(headers: string[]): Mapping {
  const used = new Set<number>();
  const mapping: Mapping = {};
  // ordem importa: campos mais específicos primeiro (comissão antes de "valor", sku antes de "produto")
  const order: FieldKey[] = ['commission', 'sku', 'date', 'clicks', 'views', 'videoUrl', 'units', 'orders', 'revenue', 'product'];
  for (const key of order) {
    const def = FIELDS.find((f) => f.key === key)!;
    const idx = headers.findIndex((h, i) => !used.has(i) && def.hints.some((hint) => norm(h).includes(hint)));
    if (idx >= 0) {
      mapping[key] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

/** Extrai o ID numérico do vídeo de um link do TikTok. */
export function tiktokVideoId(url: string | null | undefined): string | null {
  return url?.match(/\/video\/(\d{6,})/)?.[1] ?? null;
}

export interface NormalizedRow {
  line: number;
  date: string;
  productKey: string;
  productName: string;
  sku: string | null;
  videoId: string | null;
  views: number;
  clicks: number;
  orders: number;
  units: number;
  revenue: number;
  commission: number | null;
}

export interface ProductMatch {
  key: string;
  name: string;
  sku: string | null;
  productId: string | null;
  rows: number;
  revenue: number;
}

export interface ImportPlan {
  rows: NormalizedRow[];
  errors: { line: number; message: string }[];
  range: { from: string; to: string } | null;
  products: ProductMatch[];
  /** linhas casadas com uma publicação registrada (pelo link do vídeo) */
  matchedPosts: number;
  totals: { orders: number; units: number; revenue: number; commission: number };
  commissionEstimated: boolean;
}

export function matchProduct(products: Pick<Product, 'id' | 'name' | 'sku'>[], name: string, sku: string | null): string | null {
  if (sku) {
    const bySku = products.find((p) => p.sku && p.sku.toLowerCase() === sku.toLowerCase());
    if (bySku) return bySku.id;
  }
  if (!name) return null;
  const n = norm(name);
  const exact = products.find((p) => norm(p.name) === n);
  if (exact) return exact.id;
  // nome do export costuma ser mais longo (variações); aceita "contém" só se for inequívoco
  const partial = products.filter((p) => {
    const pn = norm(p.name);
    return pn.length >= 4 && (n.includes(pn) || pn.includes(n));
  });
  return partial.length === 1 ? partial[0].id : null;
}

export function buildImportPlan(
  table: string[][],
  mapping: Mapping,
  ctx: { products: Pick<Product, 'id' | 'name' | 'sku' | 'commission_rate'>[]; posts: Pick<Post, 'id' | 'published_url'>[] },
): ImportPlan {
  const [, ...body] = table;
  const errors: ImportPlan['errors'] = [];
  const rows: NormalizedRow[] = [];
  const cell = (r: string[], k: FieldKey) => (mapping[k] != null ? r[mapping[k]!] ?? '' : '');
  const postIds = new Set(ctx.posts.map((p) => tiktokVideoId(p.published_url)).filter(Boolean));

  if (mapping.date == null) errors.push({ line: 1, message: 'Escolha a coluna de data.' });
  if (mapping.product == null && mapping.sku == null) errors.push({ line: 1, message: 'Escolha a coluna de produto ou de SKU.' });
  if (mapping.revenue == null && mapping.orders == null && mapping.units == null) errors.push({ line: 1, message: 'Escolha ao menos pedidos, itens ou faturamento.' });
  if (errors.length) return { rows, errors, range: null, products: [], matchedPosts: 0, totals: { orders: 0, units: 0, revenue: 0, commission: 0 }, commissionEstimated: false };

  body.forEach((r, i) => {
    const line = i + 2;
    const date = parseDate(cell(r, 'date'));
    if (!date) return errors.push({ line, message: `Data inválida: "${cell(r, 'date')}"` });
    const productName = cell(r, 'product').slice(0, 160);
    const sku = cell(r, 'sku') || null;
    if (!productName && !sku) return errors.push({ line, message: 'Sem produto/SKU' });
    const orders = parseNumber(cell(r, 'orders'));
    const units = parseNumber(cell(r, 'units'));
    const revenue = parseNumber(cell(r, 'revenue')) ?? 0;
    if (revenue < 0) return errors.push({ line, message: 'Faturamento negativo (estorno?) — linha ignorada' });
    const o = Math.max(0, Math.round(orders ?? units ?? (revenue > 0 ? 1 : 0)));
    rows.push({
      line,
      date,
      productKey: sku ? `sku:${sku.toLowerCase()}` : `name:${norm(productName)}`,
      productName: productName || sku!,
      sku,
      videoId: tiktokVideoId(cell(r, 'videoUrl')),
      views: Math.max(0, Math.round(parseNumber(cell(r, 'views')) ?? 0)),
      clicks: Math.max(0, Math.round(parseNumber(cell(r, 'clicks')) ?? 0)),
      orders: o,
      units: Math.max(0, Math.round(units ?? o)),
      revenue,
      commission: mapping.commission != null ? parseNumber(cell(r, 'commission')) ?? 0 : null,
    });
  });

  const byKey = new Map<string, ProductMatch>();
  for (const r of rows) {
    const m = byKey.get(r.productKey) ?? { key: r.productKey, name: r.productName, sku: r.sku, productId: matchProduct(ctx.products, r.productName, r.sku), rows: 0, revenue: 0 };
    m.rows++;
    m.revenue += r.revenue;
    byKey.set(r.productKey, m);
  }

  const rate = new Map(ctx.products.map((p) => [p.id, Number(p.commission_rate) / 100]));
  const commissionEstimated = mapping.commission == null;
  let commission = 0;
  for (const r of rows) {
    const pid = byKey.get(r.productKey)!.productId;
    commission += r.commission ?? (pid ? r.revenue * (rate.get(pid) ?? 0) : 0);
  }

  const dates = rows.map((r) => r.date).sort();
  return {
    rows,
    errors,
    range: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    products: [...byKey.values()].sort((a, b) => b.revenue - a.revenue),
    matchedPosts: rows.filter((r) => r.videoId && postIds.has(r.videoId)).length,
    totals: {
      orders: rows.reduce((s, r) => s + r.orders, 0),
      units: rows.reduce((s, r) => s + r.units, 0),
      revenue: +rows.reduce((s, r) => s + r.revenue, 0).toFixed(2),
      commission: +commission.toFixed(2),
    },
    commissionEstimated,
  };
}
