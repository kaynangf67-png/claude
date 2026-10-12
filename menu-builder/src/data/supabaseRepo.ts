/**
 * Repositório real: Supabase (Postgres + Storage + Edge Function).
 * O RLS do banco é a barreira de segurança; aqui só mapeamos linhas <-> domínio.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PRIVATE_PURPOSES, type Asset, type Category, type ExtractionResult, type Product, type Project, type ProjectBundle, type ProjectSummary, type PublicMenu } from '@/domain/types';
import { extensionFor } from '@/lib/images';
import { getSupabase } from '@/lib/supabase';
import { type MenuRepository, type ProjectInput, type ProjectPatch, RepositoryError } from './repository';

// Linhas do banco chegam sem tipo; o mapeamento abaixo é o único lugar que as lê.
type Row = Record<string, any>;

const PROJECT_FIELDS: Record<keyof ProjectInput | 'slug' | 'status' | 'publishedAt', string> = {
  restaurantName: 'restaurant_name',
  description: 'description',
  businessType: 'business_type',
  phone: 'phone',
  whatsappNumber: 'whatsapp_number',
  showWhatsapp: 'show_whatsapp',
  address: 'address',
  openingHours: 'opening_hours',
  instagramUrl: 'instagram_url',
  googleMapsUrl: 'google_maps_url',
  websiteUrl: 'website_url',
  logoUrl: 'logo_url',
  coverUrl: 'cover_url',
  primaryColor: 'primary_color',
  secondaryColor: 'secondary_color',
  theme: 'theme',
  slug: 'slug',
  status: 'status',
  publishedAt: 'published_at',
};

function toRow(patch: ProjectPatch): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = PROJECT_FIELDS[key as keyof typeof PROJECT_FIELDS];
    if (column) row[column] = value;
  }
  return row;
}

const toProject = (r: Row): Project => ({
  id: r.id,
  ownerId: r.owner_id,
  restaurantName: r.restaurant_name,
  slug: r.slug,
  description: r.description,
  businessType: r.business_type,
  phone: r.phone,
  whatsappNumber: r.whatsapp_number,
  showWhatsapp: r.show_whatsapp,
  address: r.address,
  openingHours: r.opening_hours,
  instagramUrl: r.instagram_url,
  googleMapsUrl: r.google_maps_url,
  websiteUrl: r.website_url,
  logoUrl: r.logo_url,
  coverUrl: r.cover_url,
  primaryColor: r.primary_color,
  secondaryColor: r.secondary_color,
  theme: r.theme,
  status: r.status,
  isDemo: false,
  publishedAt: r.published_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toCategory = (r: Row): Category => ({ id: r.id, projectId: r.project_id, name: r.name, sortOrder: r.sort_order });

const toProduct = (r: Row): Product => ({
  id: r.id,
  projectId: r.project_id,
  categoryId: r.category_id,
  name: r.name,
  description: r.description,
  price: r.price === null ? null : Number(r.price),
  variations: (r.variations ?? []).map((v: Row) => ({ label: String(v.label ?? ''), price: typeof v.price === 'number' ? v.price : null })),
  imageUrl: r.image_url,
  available: r.available,
  sortOrder: r.sort_order,
  sourceReference: r.source_reference,
  confidence: r.confidence === null ? null : Number(r.confidence),
  reviewRequired: r.review_required,
  reviewNotes: r.review_notes ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const fromProduct = (p: Product): Row => ({
  id: p.id,
  project_id: p.projectId,
  category_id: p.categoryId,
  name: p.name,
  description: p.description,
  price: p.variations.length ? null : p.price,
  variations: p.variations,
  image_url: p.imageUrl,
  available: p.available,
  sort_order: p.sortOrder,
  source_reference: p.sourceReference,
  confidence: p.confidence,
  review_required: p.reviewRequired,
  review_notes: p.reviewNotes,
});

function fail(error: { message: string; code?: string } | null, message: string): void {
  if (!error) return;
  if (error.code === '23505') throw new RepositoryError('Este endereço já está em uso por outro cardápio.', 'slug_taken');
  throw new RepositoryError(`${message} (${error.message})`, error.code);
}

export class SupabaseRepository implements MenuRepository {
  readonly mode = 'supabase' as const;
  private get db(): SupabaseClient {
    return getSupabase();
  }

  private async signedUrls(assets: Row[]): Promise<Map<string, string>> {
    const privateAssets = assets.filter((a) => a.bucket === 'menu-sources');
    if (!privateAssets.length) return new Map();
    const { data } = await this.db.storage.from('menu-sources').createSignedUrls(privateAssets.map((a) => a.storage_path), 60 * 60);
    return new Map((data ?? []).map((d, i) => [privateAssets[i].id, d.signedUrl ?? '']));
  }

  private async log(projectId: string, action: string, details: Row = {}) {
    await this.db.from('activity_log').insert({ project_id: projectId, action, details });
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const { data, error } = await this.db
      .from('restaurant_projects')
      .select('*, menu_products(review_required)')
      .order('updated_at', { ascending: false });
    fail(error, 'Não foi possível carregar os projetos');
    return (data ?? []).map((r) => ({
      ...toProject(r),
      productCount: r.menu_products.length,
      pendingReviewCount: r.menu_products.filter((p: Row) => p.review_required).length,
    }));
  }

  async getBundle(projectId: string): Promise<ProjectBundle | null> {
    const [project, categories, products, assets] = await Promise.all([
      this.db.from('restaurant_projects').select('*').eq('id', projectId).maybeSingle(),
      this.db.from('menu_categories').select('*').eq('project_id', projectId).order('sort_order'),
      this.db.from('menu_products').select('*').eq('project_id', projectId).order('sort_order'),
      this.db.from('project_assets').select('*').eq('project_id', projectId).order('created_at'),
    ]);
    fail(project.error ?? categories.error ?? products.error ?? assets.error, 'Não foi possível carregar o projeto');
    if (!project.data) return null;
    const signed = await this.signedUrls(assets.data ?? []);
    return {
      project: toProject(project.data),
      categories: (categories.data ?? []).map(toCategory),
      products: (products.data ?? []).map(toProduct),
      assets: (assets.data ?? []).map(
        (a): Asset => ({
          id: a.id,
          projectId: a.project_id,
          fileUrl: a.file_url ?? signed.get(a.id) ?? '',
          fileType: a.file_type,
          sizeBytes: a.size_bytes,
          purpose: a.purpose,
          originalFilename: a.original_filename,
          sha256: a.sha256,
          analyzedAt: a.analyzed_at,
          analysisError: a.analysis_error,
          createdAt: a.created_at,
        }),
      ),
    };
  }

  async createProject(input: ProjectInput): Promise<Project> {
    const { data, error } = await this.db.from('restaurant_projects').insert(toRow(input)).select('*').single();
    fail(error, 'Não foi possível criar o projeto');
    await this.log(data!.id, 'project_created');
    return toProject(data!);
  }

  async updateProject(projectId: string, patch: ProjectPatch): Promise<Project> {
    const { data, error } = await this.db.from('restaurant_projects').update(toRow(patch)).eq('id', projectId).select('*').single();
    fail(error, 'Não foi possível salvar o projeto');
    if (patch.status) await this.log(projectId, 'status_changed', { status: patch.status });
    return toProject(data!);
  }

  async duplicateProject(projectId: string): Promise<Project> {
    const bundle = await this.getBundle(projectId);
    if (!bundle) throw new RepositoryError('Projeto não encontrado.', 'not_found');
    const { project } = bundle;
    const copy = await this.createProject({ ...project, restaurantName: `${project.restaurantName} (cópia)`.slice(0, 120) });
    const catMap = new Map(bundle.categories.map((c) => [c.id, crypto.randomUUID()]));
    await this.saveMenu(
      copy.id,
      bundle.categories.map((c) => ({ ...c, id: catMap.get(c.id)!, projectId: copy.id })),
      bundle.products.map((p) => ({ ...p, id: crypto.randomUUID(), projectId: copy.id, categoryId: catMap.get(p.categoryId)! })),
    );
    return copy;
  }

  async deleteProject(projectId: string): Promise<void> {
    const { data: assets } = await this.db.from('project_assets').select('bucket, storage_path').eq('project_id', projectId);
    for (const bucket of ['menu-sources', 'menu-media']) {
      const paths = (assets ?? []).filter((a) => a.bucket === bucket).map((a) => a.storage_path);
      if (paths.length) await this.db.storage.from(bucket).remove(paths);
    }
    const { error } = await this.db.from('restaurant_projects').delete().eq('id', projectId);
    fail(error, 'Não foi possível excluir o projeto');
  }

  async isSlugAvailable(slug: string, projectId: string): Promise<boolean> {
    const { data, error } = await this.db.rpc('is_slug_available', { p_slug: slug, p_project_id: projectId });
    fail(error, 'Não foi possível verificar o endereço');
    return Boolean(data);
  }

  async saveMenu(projectId: string, categories: Category[], products: Product[]): Promise<void> {
    const [{ data: currentCats }, { data: currentProducts }] = await Promise.all([
      this.db.from('menu_categories').select('id').eq('project_id', projectId),
      this.db.from('menu_products').select('id').eq('project_id', projectId),
    ]);
    const keepProducts = new Set(products.map((p) => p.id));
    const keepCats = new Set(categories.map((c) => c.id));
    const removedProducts = (currentProducts ?? []).map((p) => p.id).filter((id) => !keepProducts.has(id));
    const removedCats = (currentCats ?? []).map((c) => c.id).filter((id) => !keepCats.has(id));

    if (removedProducts.length) fail((await this.db.from('menu_products').delete().in('id', removedProducts)).error, 'Falha ao remover produtos');
    if (categories.length) {
      const rows = categories.map((c) => ({ id: c.id, project_id: projectId, name: c.name, sort_order: c.sortOrder }));
      fail((await this.db.from('menu_categories').upsert(rows)).error, 'Falha ao salvar categorias');
    }
    if (products.length) fail((await this.db.from('menu_products').upsert(products.map(fromProduct))).error, 'Falha ao salvar produtos');
    if (removedCats.length) fail((await this.db.from('menu_categories').delete().in('id', removedCats)).error, 'Falha ao remover categorias');
    // Atualiza updated_at do projeto para ordenar o painel.
    await this.db.from('restaurant_projects').update({ updated_at: new Date().toISOString() }).eq('id', projectId);
  }

  async uploadAsset(projectId: string, file: Blob, meta: { purpose: Asset['purpose']; originalFilename: string; sha256: string }): Promise<Asset> {
    const { data: userData } = await this.db.auth.getUser();
    if (!userData.user) throw new RepositoryError('Sessão expirada. Entre novamente.', 'unauthorized');
    const isPrivate = PRIVATE_PURPOSES.includes(meta.purpose);
    const bucket = isPrivate ? 'menu-sources' : 'menu-media';
    const path = `${userData.user.id}/${projectId}/${meta.purpose}/${crypto.randomUUID()}.${extensionFor(file.type)}`;

    const { data: existing } = await this.db.from('project_assets').select('id').eq('project_id', projectId).eq('sha256', meta.sha256).maybeSingle();
    if (existing) throw new RepositoryError(`"${meta.originalFilename}" já foi enviada neste projeto.`, 'duplicate');

    const upload = await this.db.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    fail(upload.error, `Falha ao enviar "${meta.originalFilename}"`);
    const fileUrl = isPrivate ? null : this.db.storage.from(bucket).getPublicUrl(path).data.publicUrl;

    const { data, error } = await this.db
      .from('project_assets')
      .insert({
        project_id: projectId,
        bucket,
        storage_path: path,
        file_url: fileUrl,
        file_type: file.type,
        size_bytes: file.size,
        purpose: meta.purpose,
        original_filename: meta.originalFilename.slice(0, 200),
        sha256: meta.sha256,
      })
      .select('*')
      .single();
    if (error) {
      await this.db.storage.from(bucket).remove([path]);
      fail(error, 'Falha ao registrar o arquivo');
    }
    const signed = isPrivate ? await this.signedUrls([data!]) : new Map();
    return {
      id: data!.id,
      projectId,
      fileUrl: fileUrl ?? signed.get(data!.id) ?? '',
      fileType: data!.file_type,
      sizeBytes: data!.size_bytes,
      purpose: data!.purpose,
      originalFilename: data!.original_filename,
      sha256: data!.sha256,
      analyzedAt: null,
      analysisError: null,
      createdAt: data!.created_at,
    };
  }

  async deleteAsset(asset: Asset): Promise<void> {
    const { data } = await this.db.from('project_assets').select('bucket, storage_path, file_url').eq('id', asset.id).maybeSingle();
    if (data) {
      await this.db.storage.from(data.bucket).remove([data.storage_path]);
      if (data.file_url) {
        // Desvincula a imagem de produtos, logo e capa que a usavam.
        await this.db.from('menu_products').update({ image_url: null }).eq('project_id', asset.projectId).eq('image_url', data.file_url);
        await this.db.from('restaurant_projects').update({ logo_url: null }).eq('id', asset.projectId).eq('logo_url', data.file_url);
        await this.db.from('restaurant_projects').update({ cover_url: null }).eq('id', asset.projectId).eq('cover_url', data.file_url);
      }
    }
    fail((await this.db.from('project_assets').delete().eq('id', asset.id)).error, 'Falha ao excluir o arquivo');
  }

  async extractMenu(projectId: string, assetIds: string[], force = false): Promise<ExtractionResult> {
    const { data, error } = await this.db.functions.invoke('extract-menu', { body: { projectId, assetIds, force } });
    if (error) {
      // A função devolve { error, message } com status de erro; o cliente expõe a resposta em error.context.
      let message = 'Não foi possível concluir a análise.';
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        const body = await context.json().catch(() => null);
        if (body?.message) message = body.message;
        if (body?.error === 'ai_not_configured') message = 'A IA ainda não foi configurada no servidor (ANTHROPIC_API_KEY).';
      } else if (/Failed to send|FunctionsFetchError/i.test(error.message)) {
        message = 'A função de extração não está publicada no Supabase (supabase functions deploy extract-menu).';
      }
      throw new RepositoryError(message, 'extraction_failed');
    }
    return data as ExtractionResult;
  }

  async getPublicMenu(slug: string): Promise<PublicMenu | null> {
    const { data, error } = await this.db.rpc('get_public_menu', { p_slug: slug });
    fail(error, 'Não foi possível carregar o cardápio');
    return (data as PublicMenu | null) ?? null;
  }
}
