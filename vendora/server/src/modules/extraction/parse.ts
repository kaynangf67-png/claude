import * as cheerio from 'cheerio';
import {
  emptyProduct,
  type ExtractionMethod,
  type FieldStatus,
  type FieldStatusMap,
  type ProductData,
  type ProductField,
  type Spec,
} from '@vendora/shared';

type Json = unknown;
type Obj = Record<string, Json>;

const isObj = (v: Json): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function clean(text: unknown, max = 20000): string | null {
  if (typeof text !== 'string' && typeof text !== 'number') return null;
  // Remove tags e entidades HTML que algumas lojas colocam dentro do JSON-LD.
  const stripped = cheerio.load(`<div>${String(text)}</div>`)('div').text();
  const out = stripped.replace(/\s+/g, ' ').trim();
  return out ? out.slice(0, max) : null;
}

/** Descrição preservando quebras de linha (parágrafos e listas). */
function cleanMultiline(text: unknown, max = 20000): string | null {
  if (typeof text !== 'string') return null;
  const withBreaks = text.replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n');
  const stripped = cheerio.load(`<div>${withBreaks}</div>`)('div').text();
  const out = stripped
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return out ? out.slice(0, max) : null;
}

function absoluteUrl(src: unknown, base: string): string | null {
  if (typeof src !== 'string' || !src.trim()) return null;
  try {
    const u = new URL(src.trim(), base);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString().slice(0, 2000);
  } catch {
    return null;
  }
}

function typeIncludes(node: Obj, type: string): boolean {
  return asArray(node['@type'] as string | string[]).some((t) => typeof t === 'string' && t.toLowerCase() === type);
}

function collectNodes(value: Json, out: Obj[] = [], depth = 0): Obj[] {
  if (depth > 6) return out;
  for (const item of asArray(value)) {
    if (!isObj(item)) continue;
    out.push(item);
    if (item['@graph']) collectNodes(item['@graph'], out, depth + 1);
    if (isObj(item.mainEntity)) collectNodes(item.mainEntity, out, depth + 1);
  }
  return out;
}

interface Partial {
  method: ExtractionMethod;
  status: FieldStatus;
  data: ProductData;
}

function fromJsonLd($: cheerio.CheerioAPI, pageUrl: string): Partial | null {
  const nodes: Obj[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      collectNodes(JSON.parse(raw), nodes);
    } catch {
      // JSON-LD malformado é comum; ignoramos o bloco em vez de "adivinhar".
    }
  });
  let product = nodes.find((n) => typeIncludes(n, 'product'));
  const group = nodes.find((n) => typeIncludes(n, 'productgroup'));
  if (!product && group) product = asArray(group.hasVariant as Obj[]).find(isObj) ?? group;
  if (!product) return null;

  const data = emptyProduct();
  data.title = clean(product.name, 500);
  const brand = isObj(product.brand) ? product.brand.name : asArray(product.brand as string[])[0];
  data.brand = clean(brand, 120);
  data.model = clean(isObj(product.model) ? product.model.name : product.model, 120);
  data.gtin = clean(product.gtin13 ?? product.gtin ?? product.gtin12 ?? product.gtin14 ?? product.gtin8, 20);
  data.sku = clean(product.sku ?? product.mpn, 80);
  data.description = cleanMultiline(product.description);

  const offers = asArray(product.offers as Obj | Obj[]).flatMap((o) => (isObj(o) && o.offers ? asArray(o.offers as Obj[]) : [o]));
  for (const offer of offers) {
    if (!isObj(offer)) continue;
    const amount = Number(String(offer.price ?? offer.lowPrice ?? '').replace(',', '.'));
    const currency = typeof offer.priceCurrency === 'string' ? offer.priceCurrency.toUpperCase() : null;
    if (Number.isFinite(amount) && amount > 0 && currency?.length === 3) {
      data.price = { amount, currency };
      break;
    }
  }

  for (const img of asArray(product.image as Json[])) {
    const src = isObj(img) ? (img.url ?? img.contentUrl) : img;
    const abs = absoluteUrl(src, pageUrl);
    if (abs && !data.images.includes(abs)) data.images.push(abs);
  }

  const specs: Spec[] = [];
  for (const prop of asArray(product.additionalProperty as Obj[])) {
    if (!isObj(prop)) continue;
    const name = clean(prop.name, 120);
    const value = clean(prop.value ?? prop.description, 500);
    if (name && value) specs.push({ name, value });
  }
  const simple: Array<[string, string]> = [
    ['color', 'Cor'],
    ['material', 'Material'],
    ['size', 'Tamanho'],
    ['pattern', 'Estampa'],
  ];
  for (const [key, label] of simple) {
    const v = clean(isObj(product[key]) ? (product[key] as Obj).name : product[key], 500);
    if (v) specs.push({ name: label, value: v });
  }
  const dims: Array<[string, string]> = [
    ['weight', 'Peso'],
    ['width', 'Largura'],
    ['height', 'Altura'],
    ['depth', 'Profundidade'],
  ];
  for (const [key, label] of dims) {
    const q = product[key];
    if (isObj(q) && q.value != null) {
      const unit = clean(q.unitText ?? q.unitCode, 20);
      specs.push({ name: label, value: `${q.value}${unit ? ` ${unit}` : ''}` });
    } else {
      const v = clean(q, 100);
      if (v) specs.push({ name: label, value: v });
    }
  }
  data.specifications = dedupeSpecs(specs);
  return { method: 'json-ld', status: 'confirmed', data };
}

function fromMicrodata($: cheerio.CheerioAPI, pageUrl: string): Partial | null {
  const scope = $('[itemtype*="schema.org/Product" i]').first();
  if (!scope.length) return null;
  const prop = (name: string) => {
    const el = scope.find(`[itemprop="${name}"]`).first();
    if (!el.length) return null;
    return el.attr('content') ?? el.attr('src') ?? el.attr('href') ?? el.text();
  };
  const data = emptyProduct();
  data.title = clean(prop('name'), 500);
  const brandEl = scope.find('[itemprop="brand"]').first();
  data.brand = clean(brandEl.find('[itemprop="name"]').attr('content') ?? brandEl.attr('content') ?? brandEl.text(), 120);
  data.model = clean(prop('model'), 120);
  data.sku = clean(prop('sku'), 80);
  data.gtin = clean(prop('gtin13') ?? prop('gtin'), 20);
  data.description = cleanMultiline(prop('description'));
  const amount = Number(String(prop('price') ?? '').replace(',', '.'));
  const currency = clean(prop('priceCurrency'), 3);
  if (Number.isFinite(amount) && amount > 0 && currency?.length === 3) data.price = { amount, currency: currency.toUpperCase() };
  scope.find('[itemprop="image"]').each((_, el) => {
    const abs = absoluteUrl($(el).attr('src') ?? $(el).attr('content') ?? $(el).attr('href'), pageUrl);
    if (abs && !data.images.includes(abs)) data.images.push(abs);
  });
  if (!data.title) return null;
  return { method: 'microdata', status: 'confirmed', data };
}

function fromOpenGraph($: cheerio.CheerioAPI, pageUrl: string): Partial | null {
  const meta = (p: string) => $(`meta[property="${p}"], meta[name="${p}"]`).first().attr('content');
  const data = emptyProduct();
  data.title = clean(meta('og:title'), 500);
  data.description = cleanMultiline(meta('og:description'));
  data.brand = clean(meta('product:brand') ?? meta('og:brand'), 120);
  const amount = Number(String(meta('product:price:amount') ?? meta('og:price:amount') ?? '').replace(',', '.'));
  const currency = clean(meta('product:price:currency') ?? meta('og:price:currency'), 3);
  if (Number.isFinite(amount) && amount > 0 && currency?.length === 3) data.price = { amount, currency: currency.toUpperCase() };
  $('meta[property="og:image"], meta[property="og:image:secure_url"]').each((_, el) => {
    const abs = absoluteUrl($(el).attr('content'), pageUrl);
    if (abs && !data.images.includes(abs)) data.images.push(abs);
  });
  if (!data.title && data.images.length === 0) return null;
  return { method: 'opengraph', status: 'inferred', data };
}

function fromHtmlMeta($: cheerio.CheerioAPI): Partial | null {
  const data = emptyProduct();
  data.title = clean($('title').first().text(), 500);
  data.description = cleanMultiline($('meta[name="description"]').attr('content'));
  if (!data.title) return null;
  return { method: 'html-meta', status: 'inferred', data };
}

function dedupeSpecs(specs: Spec[]): Spec[] {
  const seen = new Set<string>();
  return specs.filter((s) => {
    const k = s.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const BLOCK_MARKERS = [
  /captcha/i,
  /cf-challenge|challenge-platform|__cf_chl/i,
  /access denied/i,
  /are you a robot|você é um robô|verifique que você é humano/i,
  /perimeterx|px-captcha|datadome/i,
];

export function looksBlocked(html: string): boolean {
  const head = html.slice(0, 60000);
  return BLOCK_MARKERS.some((re) => re.test(head)) && !/application\/ld\+json/i.test(head);
}

export interface ParseResult {
  method: ExtractionMethod;
  data: ProductData;
  fieldStatus: FieldStatusMap;
}

/**
 * Junta as fontes em ordem de confiabilidade. Cada campo guarda de onde veio:
 * dado estruturado → confirmed; metadado genérico → inferred.
 * Nada é preenchido com valor padrão: o que não existe na página fica "missing".
 */
export function parseProductPage(html: string, pageUrl: string): ParseResult | null {
  const $ = cheerio.load(html);
  const sources = [fromJsonLd($, pageUrl), fromMicrodata($, pageUrl), fromOpenGraph($, pageUrl), fromHtmlMeta($)].filter(
    (s): s is Partial => s !== null,
  );
  if (sources.length === 0) return null;

  const data = emptyProduct();
  const fieldStatus: FieldStatusMap = {};
  const set = <K extends ProductField>(field: K, value: ProductData[K], status: FieldStatus) => {
    data[field] = value;
    fieldStatus[field] = status;
  };

  for (const src of sources) {
    const d = src.data;
    if (!data.title && d.title) set('title', d.title, src.status);
    if (!data.brand && d.brand) set('brand', d.brand, src.status);
    if (!data.model && d.model) set('model', d.model, src.status);
    if (!data.gtin && d.gtin) set('gtin', d.gtin, src.status);
    if (!data.sku && d.sku) set('sku', d.sku, src.status);
    if (!data.description && d.description) set('description', d.description, src.status);
    if (!data.price && d.price) set('price', d.price, src.status);
    if (data.features.length === 0 && d.features.length) set('features', d.features, src.status);
    if (data.specifications.length === 0 && d.specifications.length) set('specifications', d.specifications, src.status);
    if (data.images.length === 0 && d.images.length) set('images', d.images.slice(0, 30), src.status);
  }
  for (const f of ['title', 'brand', 'model', 'gtin', 'sku', 'description', 'price', 'features', 'specifications', 'images'] as const)
    fieldStatus[f] ??= 'missing';

  return { method: sources[0]!.method, data, fieldStatus };
}
