// Descoberta de produtos.
//
// Regras editoriais (verificadas em products.test.ts):
// - Nada de preço, alegação ou link inventado. Preço só com data e fonte da verificação.
// - Link que gera comissão precisa de affiliate: true — o app exibe o aviso de afiliado.
// - A lista começa VAZIA de propósito: cadastre só produtos conferidos por você.

export type ProductCategory = 'limpador' | 'hidratante' | 'protetor' | 'tratamento' | 'demaquilante' | 'kit';

export interface VerifiedPrice {
  minBRL: number;
  maxBRL: number;
  /** AAAA-MM-DD */
  verifiedAt: string;
  /** Onde o preço foi conferido (loja, site do fabricante) */
  source: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  purpose: string;
  /** Ingredientes de destaque, copiados do rótulo */
  keyIngredients: string[];
  price?: VerifiedPrice;
  url?: string;
  /** true quando o link gera comissão */
  affiliate: boolean;
  /** Para kits: perfis de pele que o fabricante indica. O teste público só sugere kits com este campo. */
  forSkin?: ('oleosa' | 'mista' | 'normal' | 'seca' | 'sensivel')[];
}

export const PRODUCTS: Product[] = [
  {
    id: 'lrp-anthelios-airlicium-fps80',
    name: 'Anthelios Airlicium+ FPS 80',
    brand: 'La Roche-Posay',
    category: 'protetor',
    purpose: 'Protetor facial com toque seco, pensado para pele oleosa. A fórmula tem fragrância: se sua pele é sensível, teste antes numa área pequena.',
    keyIngredients: ['dióxido de titânio', 'filtros UVA/UVB (bemotrizinol, avobenzona, octocrileno)', 'sílica', 'glicerina'],
    url: 'https://meli.la/2CiFLb3',
    affiliate: true,
  },
];

export interface CategoryGuide {
  id: ProductCategory;
  title: string;
  role: string;
  lookFor: string[];
  caution: string[];
}

export const CATEGORY_GUIDES: CategoryGuide[] = [
  {
    id: 'limpador',
    title: 'Limpador facial',
    role: 'Remove oleosidade, suor e resíduos sem agredir a barreira da pele.',
    lookFor: ['Textura em gel ou espuma leve para pele oleosa', '“Suave”, sem esfoliantes em grânulos', 'Sem fragrância, se a pele for sensível'],
    caution: ['Muito álcool no início da lista', 'Grânulos ásperos', 'Sensação de pele “repuxando” depois de lavar'],
  },
  {
    id: 'hidratante',
    title: 'Hidratante',
    role: 'Mantém a pele hidratada e ajuda a tolerar ativos que ressecam.',
    lookFor: ['“Oil free” e “não comedogênico”', 'Textura gel ou gel-creme', 'Glicerina, ácido hialurônico ou ceramidas'],
    caution: ['Óleos e manteigas muito pesados no rosto', 'Fragrância, em pele sensível'],
  },
  {
    id: 'protetor',
    title: 'Protetor solar',
    role: 'Protege contra radiação UV e evita que manchas de acne escureçam.',
    lookFor: ['FPS 30 ou mais', 'Amplo espectro / proteção UVA indicada', 'Não comedogênico, toque seco', 'Uma textura que você goste de usar todo dia'],
    caution: ['Quantidade pequena demais', 'Esquecer de reaplicar em exposição longa ou suor'],
  },
  {
    id: 'tratamento',
    title: 'Tratamento para acne',
    role: 'Atua nos processos da acne. Alguns são cosméticos; outros, medicamentos.',
    lookFor: ['Orientação profissional sobre qual ativo, quanto e quando', 'Concentração informada no rótulo'],
    caution: ['Vários ativos ao mesmo tempo', 'Medicamentos sem prescrição', 'Irritação forte: suspenda e procure orientação', 'Peróxido de benzoíla mancha tecidos'],
  },
  {
    id: 'kit',
    title: 'Kits de cuidados',
    role: 'Reúnem vários produtos de uma vez. Práticos, mas nem sempre combinam com a sua pele.',
    lookFor: ['Só o básico: limpador suave, hidratante e protetor solar', 'Itens que você usaria separadamente', 'Lista de ingredientes de cada item disponível antes de comprar'],
    caution: ['Kits com vários ácidos ou esfoliantes para usar juntos', 'Promessas de “tratamento completo” ou resultado em poucos dias', 'Pagar por itens que você não vai usar'],
  },
  {
    id: 'demaquilante',
    title: 'Demaquilante',
    role: 'Remove maquiagem e protetor resistente à água antes do limpador.',
    lookFor: ['Fórmula suave', 'Não comedogênico, se tiver óleo na composição', 'Enxágue completo depois'],
    caution: ['Esfregar com algodão', 'Dormir de maquiagem'],
  },
];

/** Retorna os problemas editoriais de um produto (lista vazia = ok). */
export function productIssues(p: Product): string[] {
  const issues: string[] = [];
  if (!p.name.trim() || !p.brand.trim()) issues.push('nome e marca são obrigatórios');
  if (p.keyIngredients.length === 0) issues.push('informe ao menos um ingrediente do rótulo');
  if (p.affiliate && !p.url) issues.push('produto afiliado precisa de link');
  if (p.url && !/^https:\/\//.test(p.url)) issues.push('link deve usar https');
  if (p.price) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.price.verifiedAt)) issues.push('preço sem data de verificação');
    if (!p.price.source.trim()) issues.push('preço sem fonte');
    if (p.price.minBRL <= 0 || p.price.maxBRL < p.price.minBRL) issues.push('faixa de preço inválida');
  }
  return issues;
}
