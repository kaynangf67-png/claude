/**
 * Tipos do template de cardápio digital da Web Company.
 * Reutilizáveis entre clientes: não coloque dados de restaurante aqui.
 */

/** Um preço do produto. `value: null` = PRECISA CONFIRMAR (produto não é publicado). */
export interface PriceOption {
  /** Rótulo da variação, ex.: 'Individual', 'Média', '500 ml'. Omitir quando há um único preço. */
  label?: string;
  /** Valor em reais, ex.: 32.9. */
  value: number | null;
}

export interface Category {
  /** Slug estável, usado na âncora #<id>. Ex.: 'pratos-executivos'. */
  id: string;
  name: string;
  description?: string;
}

export interface Product {
  /** ID estável. Não reutilizar IDs entre produtos diferentes. */
  id: string;
  name: string;
  /** Deve ser o `id` de uma categoria existente. */
  categoryId: string;
  /** Somente descrição verificada ou aprovada pelo dono. */
  description?: string;
  prices: PriceOption[];
  /** Caminho em public/, sem barra inicial. Ex.: 'images/products/parmegiana.webp'. */
  image?: string;
  /** Texto alternativo. Quando omitido, usa o nome do produto. */
  imageAlt?: string;
  /** false = aparece como "Indisponível". Omitir quando não confirmado. */
  available?: boolean;
  /** Selo promocional autorizado, ex.: 'Mais pedido'. */
  badge?: string;
  /**
   * true somente depois que nome, descrição e preço foram confirmados.
   * Produtos não verificados NÃO aparecem no build de produção.
   */
  verified: boolean;
  /** Origem da informação, para o relatório interno. Ex.: 'Lista enviada pelo dono em 10/10'. */
  source?: string;
  /** Observação interna (não aparece no site). */
  note?: string;
}

export interface OpeningHours {
  /** Ex.: 'Segunda a sexta' */
  days: string;
  /** Ex.: '11h às 15h' ou 'Fechado' */
  hours: string;
}

export interface Address {
  line1: string;
  line2?: string;
  neighborhood?: string;
  city: string;
  state: string;
  postalCode?: string;
  /** Link "Compartilhar" da ficha do Google Maps. */
  mapsUrl?: string;
}

export type FontPreset = 'classico' | 'elegante' | 'moderno' | 'rustico';

export interface Theme {
  /** Cor principal da marca (#rrggbb). Usada em preços, botões e destaques. */
  primary: string;
  /** Cor de apoio (#rrggbb). Usada em selos e detalhes. */
  accent: string;
  /** Fundo da página (#rrggbb). */
  background: string;
  /** Fundo dos cards (#rrggbb). */
  surface: string;
  /** Cor do texto principal (#rrggbb). */
  text: string;
  font: FontPreset;
}

export interface Restaurant {
  name: string;
  /** Tipo de estabelecimento, ex.: 'Restaurante self-service', 'Pizzaria'. */
  type?: string;
  /** Frase curta do hero. */
  tagline?: string;
  /** Parágrafos da seção "Sobre". */
  description?: string[];
  logo?: string;
  logoAlt?: string;
  heroImage?: string;
  heroImageAlt?: string;
  /** URL pública final do cardápio, sem barra no fim. Usada no QR Code e no compartilhamento. */
  publicUrl: string;
  phoneDisplay?: string;
  /** Somente dígitos, com DDI: 5511999999999. Usado no link tel:. */
  phoneDigits?: string;
  email?: string;
  address?: Address;
  openingHours?: OpeningHours[];
  social?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    website?: string;
  };
  /** Avisos exibidos no fim do cardápio, ex.: 'Preços sujeitos a alteração sem aviso prévio.' */
  menuNotes?: string[];
}

export interface MenuConfig {
  /** true = mostra faixa "dados de demonstração" e bloqueia `npm run check:publish`. */
  demo: boolean;
  restaurant: Restaurant;
  theme: Theme;
  categories: Category[];
  products: Product[];
}
