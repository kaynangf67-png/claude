import type {
  Asset,
  AssetPurpose,
  Category,
  ExtractionResult,
  Product,
  Project,
  ProjectBundle,
  ProjectStatus,
  ProjectSummary,
  PublicMenu,
} from '@/domain/types';

/** Campos editáveis do restaurante. */
export type ProjectInput = Pick<
  Project,
  | 'restaurantName'
  | 'description'
  | 'businessType'
  | 'phone'
  | 'whatsappNumber'
  | 'showWhatsapp'
  | 'address'
  | 'openingHours'
  | 'instagramUrl'
  | 'googleMapsUrl'
  | 'websiteUrl'
  | 'logoUrl'
  | 'coverUrl'
  | 'primaryColor'
  | 'secondaryColor'
  | 'theme'
>;

export type ProjectPatch = Partial<ProjectInput> & {
  slug?: string | null;
  status?: ProjectStatus;
  publishedAt?: string | null;
};

/**
 * Contrato único de dados. A UI nunca sabe se fala com o Supabase ou com o
 * armazenamento local do modo demonstração.
 */
export interface MenuRepository {
  readonly mode: 'demo' | 'supabase';
  listProjects(): Promise<ProjectSummary[]>;
  getBundle(projectId: string): Promise<ProjectBundle | null>;
  createProject(input: ProjectInput): Promise<Project>;
  updateProject(projectId: string, patch: ProjectPatch): Promise<Project>;
  duplicateProject(projectId: string): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;
  isSlugAvailable(slug: string, projectId: string): Promise<boolean>;
  /** Grava o cardápio inteiro (categorias + produtos), removendo o que saiu da lista. */
  saveMenu(projectId: string, categories: Category[], products: Product[]): Promise<void>;
  uploadAsset(projectId: string, file: Blob, meta: { purpose: AssetPurpose; originalFilename: string; sha256: string }): Promise<Asset>;
  deleteAsset(asset: Asset): Promise<void>;
  extractMenu(projectId: string, assetIds: string[], force?: boolean): Promise<ExtractionResult>;
  getPublicMenu(slug: string): Promise<PublicMenu | null>;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export const DEFAULT_PROJECT: ProjectInput = {
  restaurantName: '',
  description: '',
  businessType: '',
  phone: '',
  whatsappNumber: '',
  showWhatsapp: false,
  address: '',
  openingHours: '',
  instagramUrl: '',
  googleMapsUrl: '',
  websiteUrl: '',
  logoUrl: null,
  coverUrl: null,
  primaryColor: '#1e3a5f',
  secondaryColor: '#c2410c',
  theme: 'claro',
};
