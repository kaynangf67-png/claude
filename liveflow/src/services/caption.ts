import { formatCurrency } from '@/lib/format';
import type { PostFormat } from '@/types/domain';

const MAX_CAPTION = 2200;

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}

const CATEGORY_TAGS: Record<string, string[]> = {
  'Eletrônicos': ['tecnologia', 'gadgets'],
  Casa: ['casa', 'organizacao'],
  Beleza: ['beleza', 'skincare'],
  Moda: ['moda', 'look'],
  Criadores: ['criadordeconteudo', 'setup'],
  Fitness: ['fitness', 'treino'],
  Infantil: ['maternidade', 'infantil'],
  Pet: ['pet', 'cachorro'],
};

/** Normaliza hashtags: sem '#', sem acento/espaço, minúsculas, únicas, no máx. 8. */
export function normalizeHashtags(raw: string[] | string): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/[\s,]+/);
  const out: string[] = [];
  for (const item of list) {
    const tag = item
      .replace(/^#+/, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .toLowerCase()
      .slice(0, 40);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 8);
}

const OPENERS: Record<PostFormat, string> = {
  maos: 'Olha como isso funciona na prática 👇',
  unboxing: 'Abrindo pela primeira vez — vale a pena?',
  antes_depois: 'O antes e depois fala por si.',
  comparativo: 'Testei lado a lado pra você não errar na compra.',
  pov_texto: 'POV: você finalmente achou o que resolve isso.',
  narracao: 'Deixa eu te mostrar por que todo mundo tá levando esse.',
};

export function buildCaption(input: { productName: string; price?: number | null; category?: string; format: PostFormat }): { caption: string; hashtags: string[] } {
  const price = input.price && input.price > 0 ? ` por ${formatCurrency(input.price)}` : '';
  const caption = `${OPENERS[input.format]}\n\n${input.productName}${price} — link no carrinho 🛒`.slice(0, MAX_CAPTION);
  const hashtags = normalizeHashtags(['tiktokshop', 'achadinhos', slug(input.productName), ...(CATEGORY_TAGS[input.category ?? ''] ?? ['oferta']), 'comprinhas']);
  return { caption, hashtags };
}

/** Texto final para colar no TikTok: legenda + hashtags. */
export function composeCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags.map((h) => `#${h}`).join(' ');
  return [caption.trim(), tags].filter(Boolean).join('\n\n').slice(0, MAX_CAPTION);
}
