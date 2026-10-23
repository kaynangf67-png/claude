import type { ListingContent } from '@vendora/shared';
import type { GenerationInput, ListingGenerator } from './types';

const STOPWORDS = new Set(
  'a o e de da do das dos em para com sem por um uma uns umas no na nos nas ao à às the and for with of kit novo nova'.split(' '),
);

/** Corta no último espaço antes do limite, sem deixar a frase pela metade com pontuação solta. */
export function truncateAtWord(text: string, max: number): string {
  // Preserva quebras de linha (parágrafos e listas da descrição); só normaliza espaços.
  const t = text
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const lastSpace = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('\n'));
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : t.slice(0, max)).replace(/[\s,;:\-–|/]+$/, '');
}

const includesCI = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

/**
 * Gerador sem IA: só reorganiza os dados de origem. Não reescreve, não cria
 * benefícios e não sugere categoria. Serve quando nenhum provedor de IA está
 * configurado — e deixa isso explícito na interface.
 */
export class BasicGenerator implements ListingGenerator {
  readonly id = 'basic' as const;
  readonly model = null;

  async generate(input: GenerationInput): Promise<ListingContent> {
    const p = input.product;
    let title = p.title ?? '';
    if (p.brand && !includesCI(title, p.brand)) title = `${title} ${p.brand}`;
    if (p.model && !includesCI(title, p.model)) title = `${title} ${p.model}`;
    title = truncateAtWord(title, input.rules.titleMax);

    const parts: string[] = [];
    if (p.description) parts.push(p.description.trim());
    if (p.features.length) parts.push(`Características:\n${p.features.map((f) => `- ${f}`).join('\n')}`);
    if (p.specifications.length)
      parts.push(`Especificações:\n${p.specifications.map((s) => `- ${s.name}: ${s.value}`).join('\n')}`);
    const description = truncateAtWord(parts.join('\n\n'), input.rules.descriptionMax);

    const words = (p.title ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\d\s-]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
    const keywords = [...new Set(words)].slice(0, input.rules.keywordsMax);

    const generated: ListingContent = {
      title,
      description,
      highlights: p.features.map((f) => ({ text: f, kind: 'fact' as const, basis: 'features' })),
      specifications: p.specifications,
      keywords,
      category: null,
      missingInfo: [],
    };
    if (input.current && input.part === 'title') return { ...input.current, title };
    if (input.current && input.part === 'description') return { ...input.current, description };
    return generated;
  }
}
