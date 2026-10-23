/**
 * Perfis de geração por marketplace.
 *
 * IMPORTANTE: os limites abaixo foram levantados em 23/10/2026. Apenas os itens
 * com `verified: true` vêm de documentação oficial. Os demais vêm de guias de
 * terceiros que divergem entre si — por isso usamos o valor mais conservador e
 * o usuário pode ajustar cada limite em Configurações (sobrescritas por conta).
 */

export const MARKETPLACE_IDS = ['mercado_livre', 'shopee', 'tiktok_shop'] as const;
export type MarketplaceId = (typeof MARKETPLACE_IDS)[number];

export interface RuleSource {
  label: string;
  url: string;
  /** true = documentação oficial da plataforma. */
  official: boolean;
}

export interface Limit<T> {
  value: T;
  verified: boolean;
  note?: string;
}

export interface MarketplaceProfile {
  id: MarketplaceId;
  name: string;
  title: {
    minLength: Limit<number>;
    maxLength: Limit<number>;
    guidance: string[];
  };
  description: {
    maxLength: Limit<number>;
    allowsHtml: boolean;
    allowsEmoji: boolean;
    guidance: string[];
  };
  keywords: { max: number };
  images: {
    minWidth: Limit<number>;
    minHeight: Limit<number>;
    recommendedSize: Limit<number>;
    maxSize: Limit<number | null>;
    aspectRatio: Limit<'1:1' | 'any'>;
    maxFileSizeMB: Limit<number>;
    formats: Array<'jpeg' | 'png' | 'webp'>;
    maxCount: Limit<number>;
    mainImageWhiteBackground: Limit<'required' | 'recommended'>;
  };
  /** Campos que o vendedor sempre precisa confirmar antes de publicar. */
  sellerMustConfirm: string[];
  sources: RuleSource[];
  lastReviewed: string;
}

export const MARKETPLACE_PROFILES: Record<MarketplaceId, MarketplaceProfile> = {
  mercado_livre: {
    id: 'mercado_livre',
    name: 'Mercado Livre',
    title: {
      minLength: { value: 10, verified: false, note: 'Mínimo prático para títulos descritivos.' },
      maxLength: {
        value: 60,
        verified: false,
        note: 'O limite real vem do campo max_title_length de cada categoria na API. 60 é o valor mais citado.',
      },
      guidance: [
        'Estrutura recomendada: produto + marca + modelo + especificação principal.',
        'Não usar termos como "promoção", "frete grátis", "oferta" ou símbolos no título.',
        'Não repetir palavras nem usar caixa alta em tudo.',
      ],
    },
    description: {
      maxLength: { value: 50000, verified: false },
      allowsHtml: false,
      allowsEmoji: false,
      guidance: [
        'A descrição é texto simples (sem HTML).',
        'Não incluir dados de contato, links externos ou preços.',
      ],
    },
    keywords: { max: 10 },
    images: {
      minWidth: { value: 500, verified: true },
      minHeight: { value: 500, verified: true },
      recommendedSize: { value: 1200, verified: true, note: 'Recomendado para permitir zoom.' },
      maxSize: { value: 1920, verified: true },
      aspectRatio: { value: '1:1', verified: false, note: 'Quadrada é a recomendação mais comum.' },
      maxFileSizeMB: { value: 10, verified: true },
      formats: ['jpeg', 'png'],
      maxCount: { value: 10, verified: false, note: 'Depende de max_pictures_per_item da categoria.' },
      mainImageWhiteBackground: {
        value: 'recommended',
        verified: false,
        note: 'Fundo branco puro na foto principal é exigido em várias categorias.',
      },
    },
    sellerMustConfirm: ['Categoria', 'Condição (novo/usado)', 'Estoque', 'Garantia', 'Ficha técnica obrigatória da categoria'],
    sources: [
      {
        label: 'Mercado Livre Developers — Trabalhar com imagens',
        url: 'https://developers.mercadolivre.com.br/en_us/working-with-pictures',
        official: true,
      },
      {
        label: 'Mercado Libre Developers — Global listing (max_title_length por categoria)',
        url: 'https://developers.mercadolibre.com.ar/devsite/global-listing',
        official: true,
      },
    ],
    lastReviewed: '2026-10-23',
  },
  shopee: {
    id: 'shopee',
    name: 'Shopee',
    title: {
      minLength: { value: 20, verified: false },
      maxLength: {
        value: 100,
        verified: false,
        note: 'Fontes divergem (100, 120 e 255). Usamos 100, o mais conservador. Confira no Seller Centre.',
      },
      guidance: [
        'Ordem sugerida: nome do produto, marca, especificações e modelo.',
        'Evitar emojis, símbolos e abreviações no nome do produto.',
      ],
    },
    description: {
      maxLength: { value: 3000, verified: false },
      allowsHtml: false,
      allowsEmoji: true,
      guidance: ['A descrição aceita apenas texto.', 'Não incluir contatos ou links externos.'],
    },
    keywords: { max: 10 },
    images: {
      minWidth: { value: 500, verified: false },
      minHeight: { value: 500, verified: false },
      recommendedSize: { value: 1024, verified: false },
      maxSize: { value: null, verified: false },
      aspectRatio: { value: '1:1', verified: false },
      maxFileSizeMB: { value: 2, verified: false },
      formats: ['jpeg', 'png'],
      maxCount: { value: 9, verified: false },
      mainImageWhiteBackground: { value: 'recommended', verified: false },
    },
    sellerMustConfirm: ['Categoria', 'Peso e dimensões do pacote', 'Estoque', 'Variações (cor/tamanho)'],
    sources: [
      {
        label: 'UpSeller — Criar e publicar anúncios na Shopee (terceiro)',
        url: 'https://upseller.com/pt/help-doc-article-697',
        official: false,
      },
    ],
    lastReviewed: '2026-10-23',
  },
  tiktok_shop: {
    id: 'tiktok_shop',
    name: 'TikTok Shop',
    title: {
      minLength: { value: 25, verified: false },
      maxLength: {
        value: 200,
        verified: false,
        note: 'Fontes citam entre 34 e 255 conforme o país. Confira no Seller Center do seu mercado.',
      },
      guidance: [
        'Sem emojis, símbolos decorativos, pontuação repetida ou CAIXA ALTA.',
        'Sem frases promocionais ("oferta por tempo limitado").',
      ],
    },
    description: {
      maxLength: { value: 10000, verified: false },
      allowsHtml: false,
      allowsEmoji: false,
      guidance: ['Descrever o produto real, sem promessas não comprovadas.'],
    },
    keywords: { max: 10 },
    images: {
      minWidth: { value: 600, verified: false },
      minHeight: { value: 600, verified: false },
      recommendedSize: { value: 1200, verified: false },
      maxSize: { value: null, verified: false },
      aspectRatio: { value: '1:1', verified: false },
      maxFileSizeMB: { value: 5, verified: false },
      formats: ['jpeg', 'png', 'webp'],
      maxCount: { value: 9, verified: false },
      mainImageWhiteBackground: {
        value: 'recommended',
        verified: false,
        note: 'Fundo não branco é citado como motivo de reprovação da imagem principal.',
      },
    },
    sellerMustConfirm: ['Categoria', 'Peso e dimensões do pacote', 'Estoque', 'Certificações exigidas pela categoria'],
    sources: [
      {
        label: 'Duoke — Guia de anúncios no TikTok Shop (terceiro)',
        url: 'https://www.duoke.com/en/blog/article/115-Avoiding-Listing-Failures-The-Ultimate-Guide-to-Successful-TikTok-Shop-Product-Listings',
        official: false,
      },
    ],
    lastReviewed: '2026-10-23',
  },
};

/** Ajustes que o usuário pode fazer nos limites de cada canal. */
export interface ProfileOverrides {
  titleMaxLength?: number;
  descriptionMaxLength?: number;
  imageMinSize?: number;
  imageRecommendedSize?: number;
  imageMaxFileSizeMB?: number;
}

export interface EffectiveRules {
  marketplace: MarketplaceId;
  titleMin: number;
  titleMax: number;
  descriptionMax: number;
  allowsEmoji: boolean;
  keywordsMax: number;
  imageMinSize: number;
  imageRecommendedSize: number;
  imageMaxSize: number | null;
  imageMaxFileSizeMB: number;
  imageFormats: Array<'jpeg' | 'png' | 'webp'>;
  imageMaxCount: number;
  squareImages: boolean;
}

export function effectiveRules(id: MarketplaceId, overrides: ProfileOverrides = {}): EffectiveRules {
  const p = MARKETPLACE_PROFILES[id];
  return {
    marketplace: id,
    titleMin: p.title.minLength.value,
    titleMax: overrides.titleMaxLength ?? p.title.maxLength.value,
    descriptionMax: overrides.descriptionMaxLength ?? p.description.maxLength.value,
    allowsEmoji: p.description.allowsEmoji,
    keywordsMax: p.keywords.max,
    imageMinSize: overrides.imageMinSize ?? Math.max(p.images.minWidth.value, p.images.minHeight.value),
    imageRecommendedSize: overrides.imageRecommendedSize ?? p.images.recommendedSize.value,
    imageMaxSize: p.images.maxSize.value,
    imageMaxFileSizeMB: overrides.imageMaxFileSizeMB ?? p.images.maxFileSizeMB.value,
    imageFormats: p.images.formats,
    imageMaxCount: p.images.maxCount.value,
    squareImages: p.images.aspectRatio.value === '1:1',
  };
}

export type IssueLevel = 'error' | 'warning';
export interface RuleIssue {
  field: 'title' | 'description' | 'keywords' | 'images' | 'image';
  level: IssueLevel;
  message: string;
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const PROMO_RE = /\b(promo(ção)?|oferta|frete gr[aá]tis|imperd[ií]vel|liquida(ção)?|desconto|tempo limitado)\b/i;

/** Valida textos contra as regras efetivas do canal. Não valida imagens (ver validateImage). */
export function validateListingText(
  rules: EffectiveRules,
  listing: { title: string; description: string; keywords: string[] },
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const title = listing.title.trim();
  if (!title) issues.push({ field: 'title', level: 'error', message: 'O título está vazio.' });
  if (title.length > rules.titleMax)
    issues.push({
      field: 'title',
      level: 'error',
      message: `O título tem ${title.length} caracteres; o limite configurado é ${rules.titleMax}.`,
    });
  if (title && title.length < rules.titleMin)
    issues.push({
      field: 'title',
      level: 'warning',
      message: `O título tem menos de ${rules.titleMin} caracteres e pode ficar pouco descritivo.`,
    });
  if (EMOJI_RE.test(title)) issues.push({ field: 'title', level: 'error', message: 'Remova emojis do título.' });
  if (PROMO_RE.test(title))
    issues.push({ field: 'title', level: 'warning', message: 'Evite termos promocionais no título.' });
  const letters = title.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 10 && letters === letters.toUpperCase())
    issues.push({ field: 'title', level: 'warning', message: 'Evite título inteiro em CAIXA ALTA.' });

  const description = listing.description.trim();
  if (!description) issues.push({ field: 'description', level: 'error', message: 'A descrição está vazia.' });
  if (description.length > rules.descriptionMax)
    issues.push({
      field: 'description',
      level: 'error',
      message: `A descrição tem ${description.length} caracteres; o limite configurado é ${rules.descriptionMax}.`,
    });
  if (!rules.allowsEmoji && EMOJI_RE.test(description))
    issues.push({ field: 'description', level: 'warning', message: 'Este canal não recomenda emojis na descrição.' });
  if (/<[a-z][\s\S]*>/i.test(description))
    issues.push({ field: 'description', level: 'error', message: 'A descrição deve ser texto simples, sem HTML.' });
  if (/(https?:\/\/|www\.)\S+/i.test(description) || /\b\d{2}\s?9?\d{4}-?\d{4}\b/.test(description))
    issues.push({
      field: 'description',
      level: 'error',
      message: 'Remova links externos e telefones da descrição.',
    });

  if (listing.keywords.length > rules.keywordsMax)
    issues.push({
      field: 'keywords',
      level: 'warning',
      message: `Use no máximo ${rules.keywordsMax} palavras-chave.`,
    });
  return issues;
}

export interface ImageMeta {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

export function validateImage(rules: EffectiveRules, img: ImageMeta): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const minSide = Math.min(img.width, img.height);
  if (minSide < rules.imageMinSize)
    issues.push({
      field: 'image',
      level: 'error',
      message: `Imagem com ${img.width}×${img.height}px; o mínimo é ${rules.imageMinSize}×${rules.imageMinSize}px.`,
    });
  else if (minSide < rules.imageRecommendedSize)
    issues.push({
      field: 'image',
      level: 'warning',
      message: `Abaixo do recomendado (${rules.imageRecommendedSize}px). Não ampliamos imagens: isso perde nitidez.`,
    });
  if (rules.imageMaxSize && Math.max(img.width, img.height) > rules.imageMaxSize)
    issues.push({
      field: 'image',
      level: 'warning',
      message: `Acima de ${rules.imageMaxSize}px; a plataforma reduzirá a imagem.`,
    });
  if (rules.squareImages && img.width !== img.height)
    issues.push({ field: 'image', level: 'warning', message: 'Este canal recomenda imagens quadradas (1:1).' });
  const fmt = img.format === 'jpg' ? 'jpeg' : img.format;
  if (!rules.imageFormats.includes(fmt as 'jpeg'))
    issues.push({
      field: 'image',
      level: 'error',
      message: `Formato ${img.format.toUpperCase()} não aceito. Use ${rules.imageFormats.join(', ').toUpperCase()}.`,
    });
  if (img.sizeBytes > rules.imageMaxFileSizeMB * 1024 * 1024)
    issues.push({
      field: 'image',
      level: 'error',
      message: `Arquivo maior que ${rules.imageMaxFileSizeMB} MB.`,
    });
  return issues;
}
