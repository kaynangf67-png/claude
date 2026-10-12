/**
 * Repositório do MODO DEMONSTRAÇÃO: tudo fica no IndexedDB deste navegador.
 * Não há IA nem servidor: extractMenu recusa com uma mensagem clara.
 * As regras (publicação, dados públicos) são as mesmas do Supabase, via domain/rules.
 */
import { toPublicMenu } from '@/domain/rules';
import type { Asset, Category, Product, Project, ProjectBundle, ProjectSummary, PublicMenu } from '@/domain/types';
import { DEMO_OWNER_ID, demoSeed } from './demoSeed';
import { type MenuRepository, type ProjectInput, type ProjectPatch, RepositoryError } from './repository';

interface DemoState {
  version: 1;
  seeded: boolean;
  projects: Project[];
  categories: Category[];
  products: Product[];
  assets: Omit<Asset, 'fileUrl'>[];
}

const DB_NAME = 'menu-builder-demo';
const STATE_KEY = 'state';
const LOCAL_ASSET = 'local-asset:';

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('kv');
      req.result.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

export class LocalRepository implements MenuRepository {
  readonly mode = 'demo' as const;
  private dbPromise: Promise<IDBDatabase>;
  private objectUrls = new Map<string, string>();

  constructor(dbName = DB_NAME) {
    this.dbPromise = openDb(dbName);
  }

  private async load(): Promise<DemoState> {
    const db = await this.dbPromise;
    const state = (await tx(db, 'kv', 'readonly', (s) => s.get(STATE_KEY))) as DemoState | undefined;
    if (state) return state;
    const fresh: DemoState = { version: 1, seeded: true, ...demoSeed(), assets: [] };
    await this.save(fresh);
    return fresh;
  }

  private async save(state: DemoState): Promise<void> {
    const db = await this.dbPromise;
    await tx(db, 'kv', 'readwrite', (s) => s.put(state, STATE_KEY));
  }

  /** Troca "local-asset:<id>" por uma URL de objeto do blob salvo. */
  private async resolveUrl(url: string | null): Promise<string | null> {
    if (!url?.startsWith(LOCAL_ASSET)) return url;
    const id = url.slice(LOCAL_ASSET.length);
    const cached = this.objectUrls.get(id);
    if (cached) return cached;
    const db = await this.dbPromise;
    const blob = (await tx(db, 'blobs', 'readonly', (s) => s.get(id))) as Blob | undefined;
    if (!blob) return null;
    const objectUrl = URL.createObjectURL(blob);
    this.objectUrls.set(id, objectUrl);
    return objectUrl;
  }

  private async withUrls<T extends { logoUrl?: string | null; coverUrl?: string | null; imageUrl?: string | null }>(item: T): Promise<T> {
    const out = { ...item };
    if ('logoUrl' in out) out.logoUrl = await this.resolveUrl(out.logoUrl ?? null);
    if ('coverUrl' in out) out.coverUrl = await this.resolveUrl(out.coverUrl ?? null);
    if ('imageUrl' in out) out.imageUrl = await this.resolveUrl(out.imageUrl ?? null);
    return out;
  }

  /** URLs de objeto voltam como referência estável "local-asset:<id>" antes de salvar. */
  private toStoredUrl(url: string | null): string | null {
    if (!url?.startsWith('blob:')) return url;
    for (const [id, objectUrl] of this.objectUrls) if (objectUrl === url) return LOCAL_ASSET + id;
    return null;
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const state = await this.load();
    const summaries = state.projects.map((p) => {
      const products = state.products.filter((x) => x.projectId === p.id);
      return { ...p, productCount: products.length, pendingReviewCount: products.filter((x) => x.reviewRequired).length };
    });
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return Promise.all(summaries.map((s) => this.withUrls(s)));
  }

  async getBundle(projectId: string): Promise<ProjectBundle | null> {
    const state = await this.load();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return null;
    return {
      project: await this.withUrls(project),
      categories: state.categories.filter((c) => c.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder),
      products: await Promise.all(
        state.products.filter((p) => p.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder).map((p) => this.withUrls(p)),
      ),
      assets: await Promise.all(
        state.assets
          .filter((a) => a.projectId === projectId)
          .map(async (a) => ({ ...a, fileUrl: (await this.resolveUrl(LOCAL_ASSET + a.id)) ?? '' })),
      ),
    };
  }

  async createProject(input: ProjectInput): Promise<Project> {
    const state = await this.load();
    const project: Project = {
      ...input,
      id: uuid(),
      ownerId: DEMO_OWNER_ID,
      slug: null,
      status: 'setup',
      isDemo: false,
      publishedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    state.projects.push(project);
    await this.save(state);
    return project;
  }

  async updateProject(projectId: string, patch: ProjectPatch): Promise<Project> {
    const state = await this.load();
    const index = state.projects.findIndex((p) => p.id === projectId);
    if (index < 0) throw new RepositoryError('Projeto não encontrado.', 'not_found');
    if (patch.slug && !(await this.isSlugAvailable(patch.slug, projectId))) throw new RepositoryError('Este endereço já está em uso.', 'slug_taken');
    const stored = { ...patch };
    if ('logoUrl' in stored) stored.logoUrl = this.toStoredUrl(stored.logoUrl ?? null);
    if ('coverUrl' in stored) stored.coverUrl = this.toStoredUrl(stored.coverUrl ?? null);
    state.projects[index] = { ...state.projects[index], ...stored, updatedAt: now() };
    await this.save(state);
    return this.withUrls(state.projects[index]);
  }

  async duplicateProject(projectId: string): Promise<Project> {
    const state = await this.load();
    const source = state.projects.find((p) => p.id === projectId);
    if (!source) throw new RepositoryError('Projeto não encontrado.', 'not_found');
    const copy: Project = {
      ...source,
      id: uuid(),
      restaurantName: `${source.restaurantName} (cópia)`,
      slug: null,
      status: 'setup',
      publishedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    const catMap = new Map<string, string>();
    for (const c of state.categories.filter((c) => c.projectId === projectId)) {
      const id = uuid();
      catMap.set(c.id, id);
      state.categories.push({ ...c, id, projectId: copy.id });
    }
    for (const p of state.products.filter((p) => p.projectId === projectId)) {
      state.products.push({ ...p, id: uuid(), projectId: copy.id, categoryId: catMap.get(p.categoryId)!, createdAt: now(), updatedAt: now() });
    }
    state.projects.push(copy);
    await this.save(state);
    return copy;
  }

  async deleteProject(projectId: string): Promise<void> {
    const state = await this.load();
    const db = await this.dbPromise;
    for (const a of state.assets.filter((a) => a.projectId === projectId)) await tx(db, 'blobs', 'readwrite', (s) => s.delete(a.id));
    state.projects = state.projects.filter((p) => p.id !== projectId);
    state.categories = state.categories.filter((c) => c.projectId !== projectId);
    state.products = state.products.filter((p) => p.projectId !== projectId);
    state.assets = state.assets.filter((a) => a.projectId !== projectId);
    await this.save(state);
  }

  async isSlugAvailable(slug: string, projectId: string): Promise<boolean> {
    const state = await this.load();
    return !state.projects.some((p) => p.slug === slug && p.id !== projectId);
  }

  async saveMenu(projectId: string, categories: Category[], products: Product[]): Promise<void> {
    const state = await this.load();
    const categoryIds = new Set(categories.map((c) => c.id));
    for (const p of products) {
      if (!categoryIds.has(p.categoryId)) throw new RepositoryError(`"${p.name}" está em uma categoria que não existe mais.`);
    }
    state.categories = [...state.categories.filter((c) => c.projectId !== projectId), ...categories];
    state.products = [
      ...state.products.filter((p) => p.projectId !== projectId),
      ...products.map((p) => ({ ...p, imageUrl: this.toStoredUrl(p.imageUrl), updatedAt: now() })),
    ];
    const project = state.projects.find((p) => p.id === projectId);
    if (project) project.updatedAt = now();
    await this.save(state);
  }

  async uploadAsset(projectId: string, file: Blob, meta: { purpose: Asset['purpose']; originalFilename: string; sha256: string }): Promise<Asset> {
    const state = await this.load();
    if (state.assets.some((a) => a.projectId === projectId && a.sha256 === meta.sha256)) {
      throw new RepositoryError(`"${meta.originalFilename}" já foi enviada neste projeto.`, 'duplicate');
    }
    const asset: Omit<Asset, 'fileUrl'> = {
      id: uuid(),
      projectId,
      fileType: file.type,
      sizeBytes: file.size,
      purpose: meta.purpose,
      originalFilename: meta.originalFilename,
      sha256: meta.sha256,
      analyzedAt: null,
      analysisError: null,
      createdAt: now(),
    };
    const db = await this.dbPromise;
    await tx(db, 'blobs', 'readwrite', (s) => s.put(file, asset.id));
    state.assets.push(asset);
    await this.save(state);
    return { ...asset, fileUrl: (await this.resolveUrl(LOCAL_ASSET + asset.id)) ?? '' };
  }

  async deleteAsset(asset: Asset): Promise<void> {
    const state = await this.load();
    const db = await this.dbPromise;
    await tx(db, 'blobs', 'readwrite', (s) => s.delete(asset.id));
    const ref = LOCAL_ASSET + asset.id;
    state.assets = state.assets.filter((a) => a.id !== asset.id);
    for (const p of state.products) if (p.imageUrl === ref) p.imageUrl = null;
    for (const p of state.projects) {
      if (p.logoUrl === ref) p.logoUrl = null;
      if (p.coverUrl === ref) p.coverUrl = null;
    }
    const objectUrl = this.objectUrls.get(asset.id);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    this.objectUrls.delete(asset.id);
    await this.save(state);
  }

  async extractMenu(): Promise<never> {
    throw new RepositoryError(
      'A extração por IA não está disponível no modo demonstração. Configure o Supabase e a chave da IA (veja Configurações) ou cadastre os itens manualmente no editor.',
      'ai_not_configured',
    );
  }

  async getPublicMenu(slug: string): Promise<PublicMenu | null> {
    const state = await this.load();
    const project = state.projects.find((p) => p.slug === slug);
    if (!project) return null;
    const menu = toPublicMenu({
      project,
      categories: state.categories.filter((c) => c.projectId === project.id),
      products: state.products.filter((p) => p.projectId === project.id),
    });
    if (!menu) return null;
    return {
      ...menu,
      logoUrl: await this.resolveUrl(menu.logoUrl),
      coverUrl: await this.resolveUrl(menu.coverUrl),
      categories: await Promise.all(
        menu.categories.map(async (c) => ({ ...c, products: await Promise.all(c.products.map((p) => this.withUrls(p))) })),
      ),
    };
  }
}
