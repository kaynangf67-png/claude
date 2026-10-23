import {
  findUnsupportedClaims,
  identityPreserved,
  MARKETPLACE_PROFILES,
  validateListingText,
  type GenerationWarning,
  type ListingContent,
  type ProductData,
} from '@vendora/shared';
import { truncateAtWord } from './basic';
import type { GenerationInput, ListingGenerator } from './types';

/** Tudo que a origem diz sobre o produto, em um texto só, para conferir afirmações. */
export function sourceCorpus(p: ProductData): string {
  return [
    p.title,
    p.brand,
    p.model,
    p.gtin,
    p.sku,
    p.description,
    ...p.features,
    ...p.specifications.map((s) => `${s.name}: ${s.value}`),
  ]
    .filter(Boolean)
    .join('\n');
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');

/** Lacunas que o vendedor precisa preencher, calculadas sem depender da IA. */
export function deterministicMissing(input: GenerationInput): Array<{ field: string; reason: string }> {
  const p = input.product;
  const st = input.fieldStatus;
  const out: Array<{ field: string; reason: string }> = [];
  if (!p.brand) out.push({ field: 'Marca', reason: 'Não encontrada na origem.' });
  if (!p.model) out.push({ field: 'Modelo', reason: 'Não encontrado na origem.' });
  if (!p.gtin) out.push({ field: 'Código universal (EAN/GTIN)', reason: 'Vários canais pedem o código de barras.' });
  if (!p.price) out.push({ field: 'Preço', reason: 'Não encontrado na origem.' });
  if (p.images.length === 0 && !input.imageCount) out.push({ field: 'Fotos', reason: 'Nenhuma imagem encontrada nem enviada.' });
  const corpus = norm(sourceCorpus(p));
  if (!/peso|weight/.test(corpus)) out.push({ field: 'Peso', reason: 'Necessário para calcular o frete.' });
  if (!/dimens|largura|altura|comprimento|profundidade/.test(corpus))
    out.push({ field: 'Dimensões', reason: 'Necessárias para calcular o frete.' });
  for (const [field, status] of Object.entries(st))
    if (status === 'inferred') out.push({ field, reason: 'Veio de metadados genéricos da página; confirme.' });
  const where = { mercado_livre: 'no Mercado Livre', shopee: 'na Shopee', tiktok_shop: 'no TikTok Shop' }[input.marketplace];
  for (const field of MARKETPLACE_PROFILES[input.marketplace].sellerMustConfirm)
    out.push({ field, reason: `Obrigatório ${where}; confirme antes de publicar.` });
  return out;
}

export interface GenerationResult {
  content: ListingContent;
  warnings: GenerationWarning[];
}

/**
 * Pós-processamento comum a qualquer gerador:
 * - aplica limites rígidos do canal;
 * - remove especificações que não existem na origem;
 * - procura medidas, garantias e certificações sem fonte;
 * - confere se marca e modelo foram preservados.
 */
export function postProcess(input: GenerationInput, raw: ListingContent): GenerationResult {
  const warnings: GenerationWarning[] = [];
  const content: ListingContent = structuredClone(raw);
  const corpus = sourceCorpus(input.product);
  const corpusNorm = norm(corpus);

  content.title = content.title.replace(/\s+/g, ' ').trim();
  if (content.title.length > input.rules.titleMax) {
    content.title = truncateAtWord(content.title, input.rules.titleMax);
    warnings.push({ field: 'title', message: `O título foi encurtado para caber em ${input.rules.titleMax} caracteres.` });
  }
  if (content.description.length > input.rules.descriptionMax) {
    content.description = truncateAtWord(content.description, input.rules.descriptionMax);
    warnings.push({ field: 'description', message: 'A descrição foi encurtada para caber no limite do canal.' });
  }
  content.keywords = [...new Set(content.keywords.map((k) => k.trim()).filter(Boolean))].slice(0, input.rules.keywordsMax);

  const kept = content.specifications.filter((s) => corpusNorm.includes(norm(s.value)));
  if (kept.length < content.specifications.length)
    warnings.push({
      field: 'specifications',
      message: `${content.specifications.length - kept.length} especificação(ões) sem correspondência na origem foram removidas.`,
    });
  content.specifications = kept;

  for (const h of content.highlights)
    if (h.kind === 'fact' && findUnsupportedClaims(h.text, corpus).length > 0) h.kind = 'marketing';

  const generatedText = [content.title, content.description, ...content.highlights.map((h) => h.text)].join('\n');
  for (const claim of findUnsupportedClaims(generatedText, corpus))
    warnings.push({
      field: 'claims',
      message: `"${claim.claim}" não aparece nos dados de origem. Confirme ou remova antes de publicar.`,
    });
  for (const msg of identityPreserved(content.title, input.product.brand, input.product.model))
    warnings.push({ field: 'title', message: msg });
  for (const issue of validateListingText(input.rules, content))
    warnings.push({ field: issue.field, message: issue.message });

  const known = new Set(content.missingInfo.map((m) => m.field.toLowerCase()));
  for (const m of deterministicMissing(input)) if (!known.has(m.field.toLowerCase())) content.missingInfo.push(m);

  return { content, warnings };
}

export async function generateListing(generator: ListingGenerator, input: GenerationInput): Promise<GenerationResult> {
  const raw = await generator.generate(input);
  return postProcess(input, raw);
}
