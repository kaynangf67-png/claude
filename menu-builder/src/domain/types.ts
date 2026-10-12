/**
 * Modelo de domínio do Menu Builder. Espelha as tabelas do Supabase
 * (supabase/migrations) em camelCase. Toda a UI fala só com estes tipos.
 */

export const PROJECT_STATUSES = [
  'setup',
  'awaiting_analysis',
  'awaiting_review',
  'approved',
  'published',
  'unpublished',
  'archived',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  setup: 'Em configuração',
  awaiting_analysis: 'Aguardando análise',
  awaiting_review: 'Aguardando revisão',
  approved: 'Aprovado',
  published: 'Publicado',
  unpublished: 'Despublicado',
  archived: 'Arquivado',
};

export const MENU_THEMES = ['claro', 'noite'] as const;
export type MenuTheme = (typeof MENU_THEMES)[number];
export const THEME_LABEL: Record<MenuTheme, string> = {
  claro: 'Claro — fundo branco, foco nas fotos',
  noite: 'Noite — fundo escuro, ideal para bares e churrascarias',
};

export const ASSET_PURPOSES = ['menu_page', 'dish', 'ambiance', 'logo', 'cover', 'other'] as const;
export type AssetPurpose = (typeof ASSET_PURPOSES)[number];
export const PURPOSE_LABEL: Record<AssetPurpose, string> = {
  menu_page: 'Página do cardápio',
  dish: 'Foto de prato/produto',
  ambiance: 'Ambiente',
  logo: 'Logotipo',
  cover: 'Capa',
  other: 'Outra',
};
/** Páginas de cardápio são material de trabalho (privado); o resto pode ir para o cardápio público. */
export const PRIVATE_PURPOSES: AssetPurpose[] = ['menu_page', 'other'];

export interface Project {
  id: string;
  ownerId: string;
  restaurantName: string;
  slug: string | null;
  description: string;
  businessType: string;
  phone: string;
  whatsappNumber: string;
  showWhatsapp: boolean;
  address: string;
  openingHours: string;
  instagramUrl: string;
  googleMapsUrl: string;
  websiteUrl: string;
  logoUrl: string | null;
  coverUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  theme: MenuTheme;
  status: ProjectStatus;
  isDemo: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
}

export interface Variation {
  label: string;
  /** null = preço não identificado: precisa de confirmação. */
  price: number | null;
}

export interface Product {
  id: string;
  projectId: string;
  categoryId: string;
  name: string;
  description: string;
  /** null = sem preço confirmado. Produtos com variações podem não ter preço base. */
  price: number | null;
  variations: Variation[];
  imageUrl: string | null;
  available: boolean;
  sortOrder: number;
  /** De onde veio o dado: "manual", "ia:<nome do arquivo>" etc. */
  sourceReference: string;
  /** 0–1. null para itens digitados à mão. */
  confidence: number | null;
  reviewRequired: boolean;
  reviewNotes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  projectId: string;
  fileUrl: string;
  fileType: string;
  sizeBytes: number;
  purpose: AssetPurpose;
  originalFilename: string;
  sha256: string;
  analyzedAt: string | null;
  analysisError: string | null;
  createdAt: string;
}

export interface ProjectBundle {
  project: Project;
  categories: Category[];
  products: Product[];
  assets: Asset[];
}

export interface ProjectSummary extends Project {
  productCount: number;
  pendingReviewCount: number;
}

/** O que a página pública recebe. Nada interno (origem, confiança, notas, dono). */
export interface PublicMenu {
  slug: string;
  restaurantName: string;
  description: string;
  businessType: string;
  phone: string;
  whatsappNumber: string | null;
  address: string;
  openingHours: string;
  instagramUrl: string;
  googleMapsUrl: string;
  websiteUrl: string;
  logoUrl: string | null;
  coverUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  theme: MenuTheme;
  categories: {
    id: string;
    name: string;
    products: {
      id: string;
      name: string;
      description: string;
      price: number | null;
      variations: Variation[];
      imageUrl: string | null;
      available: boolean;
    }[];
  }[];
}

export interface ExtractionResult {
  createdProducts: number;
  reviewRequired: number;
  analyzedAssets: number;
  skippedAssets: number;
  warnings: string[];
}
