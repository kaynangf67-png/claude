/**
 * Verificação determinística de "fatos inventados".
 *
 * A IA é instruída a não inventar dados, mas instrução não é garantia. Aqui
 * procuramos no texto gerado afirmações verificáveis (medidas, pesos,
 * capacidades, garantias, certificações, percentuais) e conferimos se elas
 * aparecem nos dados de origem. O que não aparecer vira alerta para o vendedor.
 */

const UNIT =
  '(?:mm|cm|m|km|pol(?:egadas?)?|"|polegadas?|g|kg|mg|ml|l|litros?|w|kw|v|mah|ah|hz|khz|ghz|gb|tb|mb|mp|fps|db|bar|psi|rpm|°c|btu|lumens?|lm|mts?|metros?|gramas?|quilos?|watts?|volts?)';

const MEASURE_RE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s?${UNIT}(?![\\p{L}])`, 'giu');
const PERCENT_RE = /(\d+(?:[.,]\d+)?)\s?%/g;
const WARRANTY_RE = /garantia\s+(?:de\s+)?(\d+)\s*(dias?|m[eê]s(?:es)?|anos?)/giu;
const CERT_WORDS = [
  'anvisa',
  'inmetro',
  'anatel',
  'iso',
  'fda',
  'bpa free',
  'livre de bpa',
  'hipoalergênico',
  'hipoalergenico',
  'dermatologicamente testado',
  'à prova d\'água',
  'a prova d\'agua',
  'à prova dágua',
  'ip67',
  'ip68',
  'ipx7',
  'ipx4',
  'original',
  'garantia vitalícia',
  'orgânico',
  'vegano',
  'cruelty free',
];

export interface UnsupportedClaim {
  claim: string;
  kind: 'measure' | 'percent' | 'warranty' | 'certification';
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ');

const compact = (s: string) => normalize(s).replace(/\s/g, '');

export function findUnsupportedClaims(generated: string, sourceCorpus: string): UnsupportedClaim[] {
  const src = normalize(sourceCorpus);
  const srcCompact = compact(sourceCorpus);
  const found = new Map<string, UnsupportedClaim>();

  for (const m of generated.matchAll(MEASURE_RE)) {
    const claim = m[0].trim();
    if (!srcCompact.includes(compact(claim))) {
      // Aceita o número isolado presente na fonte com a mesma unidade normalizada (ex.: "2 L" vs "2l").
      found.set(`m:${compact(claim)}`, { claim, kind: 'measure' });
    }
  }
  for (const m of generated.matchAll(PERCENT_RE)) {
    const claim = m[0].trim();
    if (!srcCompact.includes(compact(claim))) found.set(`p:${compact(claim)}`, { claim, kind: 'percent' });
  }
  for (const m of generated.matchAll(WARRANTY_RE)) {
    const claim = m[0].trim();
    const num = m[1] ?? '';
    if (!(src.includes('garantia') && src.includes(num))) found.set(`w:${compact(claim)}`, { claim, kind: 'warranty' });
  }
  const gen = normalize(generated);
  for (const word of CERT_WORDS) {
    const w = normalize(word);
    const re = new RegExp(`(^|[^\\p{L}\\d])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\d])`, 'u');
    if (re.test(gen) && !re.test(src)) found.set(`c:${w}`, { claim: word, kind: 'certification' });
  }
  return [...found.values()];
}

/** Brand/model citados no título gerado precisam existir na fonte. */
export function identityPreserved(title: string, brand: string | null, model: string | null): string[] {
  const problems: string[] = [];
  const t = normalize(title);
  if (brand && !t.includes(normalize(brand))) problems.push(`A marca "${brand}" não aparece no título.`);
  if (model && model.length <= 40 && !compact(title).includes(compact(model)))
    problems.push(`O modelo "${model}" não aparece no título.`);
  return problems;
}
