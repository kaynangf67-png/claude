import { z } from 'zod';
import { MARKETPLACE_IDS } from './marketplaces';

/**
 * confirmed: veio de dado estruturado da página (JSON-LD, API oficial).
 * inferred:  veio de metadados genéricos (Open Graph, <title>, meta description) — pode estar incompleto.
 * user:      informado ou corrigido pelo vendedor.
 * missing:   não encontrado.
 */
export const FieldStatus = z.enum(['confirmed', 'inferred', 'user', 'missing']);
export type FieldStatus = z.infer<typeof FieldStatus>;

export const ExtractionMethod = z.enum(['json-ld', 'microdata', 'opengraph', 'html-meta', 'mercadolivre-api', 'manual']);
export type ExtractionMethod = z.infer<typeof ExtractionMethod>;

export const Spec = z.object({ name: z.string().min(1).max(120), value: z.string().min(1).max(500) });
export type Spec = z.infer<typeof Spec>;

export const Price = z.object({ amount: z.number().nonnegative(), currency: z.string().length(3) });

export const PRODUCT_FIELDS = [
  'title',
  'brand',
  'model',
  'gtin',
  'sku',
  'description',
  'price',
  'features',
  'specifications',
  'images',
] as const;
export type ProductField = (typeof PRODUCT_FIELDS)[number];

export const ProductData = z.object({
  title: z.string().max(500).nullable(),
  brand: z.string().max(120).nullable(),
  model: z.string().max(120).nullable(),
  gtin: z.string().max(20).nullable(),
  sku: z.string().max(80).nullable(),
  description: z.string().max(20000).nullable(),
  price: Price.nullable(),
  features: z.array(z.string().max(500)).max(50),
  specifications: z.array(Spec).max(100),
  images: z.array(z.string().url().max(2000)).max(30),
});
export type ProductData = z.infer<typeof ProductData>;

export const FieldStatusMap = z.record(z.enum(PRODUCT_FIELDS), FieldStatus);
export type FieldStatusMap = Partial<Record<ProductField, FieldStatus>>;

export const emptyProduct = (): ProductData => ({
  title: null,
  brand: null,
  model: null,
  gtin: null,
  sku: null,
  description: null,
  price: null,
  features: [],
  specifications: [],
  images: [],
});

/** Entrada manual (quando a extração falha ou o vendedor prefere digitar). */
export const ManualProductInput = z.object({
  sourceUrl: z.string().url().max(2000).optional(),
  title: z.string().trim().min(3).max(500),
  brand: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  gtin: z.string().trim().max(20).optional(),
  description: z.string().trim().max(20000).optional(),
  price: z.number().nonnegative().optional(),
  features: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
  specifications: z.array(Spec).max(100).default([]),
});
export type ManualProductInput = z.infer<typeof ManualProductInput>;

export const MarketplaceIdSchema = z.enum(MARKETPLACE_IDS);

export const Highlight = z.object({
  text: z.string(),
  /** fact = sustentado por um dado extraído; marketing = sugestão de linguagem comercial. */
  kind: z.enum(['fact', 'marketing']),
  basis: z.string().describe('Campo ou trecho dos dados de origem que sustenta o texto.'),
});

export const MissingInfo = z.object({ field: z.string(), reason: z.string() });

/** Conteúdo gerado para um canal. É o formato pedido à IA e também o formato editável. */
export const ListingContent = z.object({
  title: z.string(),
  description: z.string(),
  highlights: z.array(Highlight),
  specifications: z.array(Spec),
  keywords: z.array(z.string()),
  category: z
    .object({ name: z.string(), confidence: z.enum(['low', 'medium', 'high']), basis: z.string() })
    .nullable(),
  missingInfo: z.array(MissingInfo),
});
export type ListingContent = z.infer<typeof ListingContent>;

export const GenerationWarning = z.object({ field: z.string(), message: z.string() });
export type GenerationWarning = z.infer<typeof GenerationWarning>;
