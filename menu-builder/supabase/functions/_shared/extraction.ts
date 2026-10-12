/**
 * Núcleo da extração de cardápio por IA — módulo PURO (sem dependências),
 * importado pela Edge Function (Deno) e pelos testes (Vitest).
 *
 * O modelo devolve JSON no esquema EXTRACTION_SCHEMA. Nada do que ele diz é
 * aceito às cegas: `postProcess` revalida tudo e marca para revisão humana
 * qualquer item duvidoso, sem nunca preencher dado que o modelo não leu.
 */

export const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pages', 'items', 'warnings'],
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['image_index', 'legibility', 'notes'],
        properties: {
          image_index: { type: 'integer' },
          legibility: { type: 'string', enum: ['legivel', 'parcial', 'ilegivel', 'nao_e_cardapio'] },
          notes: { type: 'string' },
        },
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'category', 'description', 'price_text', 'price', 'variations', 'confidence', 'needs_review', 'review_reason', 'image_index'],
        properties: {
          name: { type: 'string' },
          category: { type: 'string' },
          description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          price_text: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          price: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          variations: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'price_text', 'price'],
              properties: {
                label: { type: 'string' },
                price_text: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                price: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              },
            },
          },
          confidence: { type: 'number' },
          needs_review: { type: 'boolean' },
          review_reason: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          image_index: { type: 'integer' },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const;

export const EXTRACTION_SYSTEM_PROMPT = `Você transcreve cardápios de restaurantes brasileiros a partir de fotos.
Sua saída alimenta um sistema em que uma pessoa revisa tudo antes de publicar. Um campo vazio
marcado para revisão é útil; um valor plausível inventado é um erro grave, porque pode ir ao ar.

Regras:
- Transcreva somente o que está escrito nas imagens. Não invente preços, ingredientes, alergênicos,
  tamanhos, gramaturas, opções ou complementos. Não complete descrições com o que "costuma" ter.
- price_text: copie o preço exatamente como impresso (ex.: "R$ 32,90"). price: o mesmo valor como número
  (32.9). Se o preço estiver ilegível, cortado, borrado ou ambíguo, use price null, price_text com o que
  dá para ler (ou null) e needs_review true, explicando em review_reason.
- Um preço que aparece uma vez para um grupo de itens (ex.: "Caldos ... R$ 19,90") só deve ser atribuído a
  cada item se o cardápio deixar isso claro; se não deixar, deixe price null e marque para revisão.
- Variações (tamanhos, porções, "P/M/G", "meia/inteira") vão em variations, cada uma com seu preço.
  Quando houver variações, price do item é null.
- Preserve a grafia original dos nomes; corrija só erros evidentes de OCR e diga isso em review_reason.
- category: use o título de seção do cardápio. Sem título visível, use "Sem categoria".
- description: texto descritivo impresso junto ao item, ou null.
- confidence: de 0 a 1, quanto você confia na leitura completa do item (nome e preço).
- image_index: índice (começando em 0) da imagem de onde o item foi lido.
- pages: uma entrada por imagem, dizendo se está legível, parcialmente legível, ilegível, ou se não é uma
  página de cardápio (ex.: foto de prato). Em notes, diga o que está cortado ou ilegível.
- Não use fotos de pratos como fonte de itens: só texto de cardápio.
- warnings: avisos gerais (ex.: "a página parece continuar em outra foto", "preços aparentam ser antigos").`;

export interface RawVariation {
  label: string;
  price_text: string | null;
  price: number | null;
}

export interface RawItem {
  name: string;
  category: string;
  description: string | null;
  price_text: string | null;
  price: number | null;
  variations: RawVariation[];
  confidence: number;
  needs_review: boolean;
  review_reason: string | null;
  image_index: number;
}

export interface RawPage {
  image_index: number;
  legibility: 'legivel' | 'parcial' | 'ilegivel' | 'nao_e_cardapio';
  notes: string;
}

export interface RawExtraction {
  pages: RawPage[];
  items: RawItem[];
  warnings: string[];
}

export interface CleanItem {
  name: string;
  category: string;
  description: string;
  price: number | null;
  variations: { label: string; price: number | null }[];
  confidence: number;
  reviewRequired: boolean;
  reviewNotes: string[];
  imageIndex: number;
}

export const REVIEW_CONFIDENCE_THRESHOLD = 0.85;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrOrNull = (v: unknown) => v === null || typeof v === 'string';
const isNumOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));

/** Valida a forma do JSON do modelo. Lança erro com o caminho do problema. */
export function parseExtraction(input: unknown): RawExtraction {
  if (!isObj(input)) throw new Error('resposta não é um objeto');
  const { pages, items, warnings } = input;
  if (!Array.isArray(pages) || !Array.isArray(items) || !Array.isArray(warnings)) throw new Error('faltam pages/items/warnings');
  pages.forEach((p, i) => {
    if (!isObj(p) || !Number.isInteger(p.image_index) || typeof p.legibility !== 'string' || typeof p.notes !== 'string')
      throw new Error(`pages[${i}] inválido`);
  });
  items.forEach((it, i) => {
    if (!isObj(it)) throw new Error(`items[${i}] não é objeto`);
    if (typeof it.name !== 'string' || typeof it.category !== 'string') throw new Error(`items[${i}].name/category`);
    if (!isStrOrNull(it.description) || !isStrOrNull(it.price_text) || !isNumOrNull(it.price)) throw new Error(`items[${i}] campos de texto/preço`);
    if (!Array.isArray(it.variations)) throw new Error(`items[${i}].variations`);
    it.variations.forEach((v, j) => {
      if (!isObj(v) || typeof v.label !== 'string' || !isStrOrNull(v.price_text) || !isNumOrNull(v.price))
        throw new Error(`items[${i}].variations[${j}]`);
    });
    if (typeof it.confidence !== 'number' || typeof it.needs_review !== 'boolean' || !isStrOrNull(it.review_reason) || !Number.isInteger(it.image_index))
      throw new Error(`items[${i}] confidence/needs_review/image_index`);
  });
  if (!warnings.every((w) => typeof w === 'string')) throw new Error('warnings deve ser lista de textos');
  return input as unknown as RawExtraction;
}

/** "R$ 1.234,50" → 1234.5 ; texto sem número reconhecível → null. */
export function parseBRL(text: string | null): number | null {
  if (!text) return null;
  const match = text.replace(/\s/g, '').match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/);
  if (!match) return null;
  const integer = match[1].replace(/\./g, '');
  const cents = (match[2] ?? '0').padEnd(2, '0');
  return Number(`${integer}.${cents}`);
}

export function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const samePrice = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) < 0.005;

function checkPrice(value: number | null, text: string | null, what: string, notes: string[]): number | null {
  if (value === null) {
    notes.push(`${what}: não identificado na imagem.`);
    return null;
  }
  if (value < 0 || value > 100000) {
    notes.push(`${what}: valor fora do esperado (${value}).`);
    return null;
  }
  const fromText = parseBRL(text);
  if (fromText === null) {
    notes.push(`${what}: sem o texto original para conferir.`);
  } else if (!samePrice(fromText, value)) {
    // Texto e número divergem: não escolhemos um dos dois, pedimos revisão.
    notes.push(`${what}: leitura divergente ("${text}" vs ${value}).`);
    return null;
  }
  return Math.round(value * 100) / 100;
}

/**
 * Converte a resposta do modelo em itens prontos para gravar, marcando revisão quando:
 * confiança baixa, preço ausente/divergente, item duplicado no lote com preços diferentes,
 * ou item que já existe no projeto.
 */
export function postProcess(raw: RawExtraction, imageCount: number, existingNames: string[] = []): { items: CleanItem[]; warnings: string[] } {
  const warnings = [...raw.warnings];
  for (const page of raw.pages) {
    if (page.legibility === 'ilegivel') warnings.push(`Imagem ${page.image_index + 1} ilegível: ${page.notes || 'envie uma foto mais nítida.'}`);
    if (page.legibility === 'parcial') warnings.push(`Imagem ${page.image_index + 1} parcialmente legível: ${page.notes}`);
    if (page.legibility === 'nao_e_cardapio') warnings.push(`Imagem ${page.image_index + 1} não parece ser uma página de cardápio.`);
  }

  const existing = new Set(existingNames.map(normalizeKey));
  const items: CleanItem[] = [];
  const byKey = new Map<string, CleanItem>();

  for (const r of raw.items) {
    const name = r.name.trim();
    if (!name) continue;
    const notes: string[] = [];
    if (r.needs_review && r.review_reason) notes.push(r.review_reason.trim());
    else if (r.needs_review) notes.push('A IA marcou este item para revisão.');

    const confidence = Math.min(1, Math.max(0, r.confidence));
    if (confidence < REVIEW_CONFIDENCE_THRESHOLD) notes.push(`Confiança baixa na leitura (${Math.round(confidence * 100)}%).`);

    const variations = r.variations
      .filter((v) => v.label.trim())
      .map((v) => ({ label: v.label.trim(), price: checkPrice(v.price, v.price_text, `Preço "${v.label.trim()}"`, notes) }));
    const price = variations.length ? null : checkPrice(r.price, r.price_text, 'Preço', notes);

    const imageIndex = Number.isInteger(r.image_index) && r.image_index >= 0 && r.image_index < imageCount ? r.image_index : 0;
    const category = r.category.trim() || 'Sem categoria';
    const key = `${normalizeKey(category)}|${normalizeKey(name)}`;

    if (existing.has(normalizeKey(name))) notes.push('Possível duplicidade: já existe um item com este nome no projeto.');

    const previous = byKey.get(key);
    if (previous) {
      const conflict = previous.price !== null || price !== null ? !samePrice(previous.price, price) : false;
      if (conflict) {
        previous.reviewRequired = true;
        previous.reviewNotes.push(`Preço conflitante entre imagens (${price ?? 'sem preço'} na imagem ${imageIndex + 1}).`);
      } else {
        previous.reviewNotes.push(`Item repetido na imagem ${imageIndex + 1} (mesmo preço).`);
      }
      continue;
    }

    const item: CleanItem = {
      name,
      category,
      description: (r.description ?? '').trim(),
      price,
      variations,
      confidence,
      reviewRequired: notes.length > 0,
      reviewNotes: notes,
      imageIndex,
    };
    byKey.set(key, item);
    items.push(item);
  }
  return { items, warnings };
}

/** Preço por milhão de tokens (US$) para estimar custo no registro de uso. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = MODEL_PRICING[model];
  if (!p) return null;
  return Math.round(((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * 10000) / 10000;
}
