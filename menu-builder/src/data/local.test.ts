import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LocalRepository } from './local';
import { DEFAULT_PROJECT } from './repository';

let n = 0;
/** Cada teste usa um banco novo. */
const newRepo = () => new LocalRepository(`teste-${++n}`);

describe('LocalRepository (modo demonstração)', () => {
  it('começa com o projeto fictício identificado', async () => {
    const repo = newRepo();
    const projects = await repo.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].isDemo).toBe(true);
    expect(projects[0].restaurantName).toMatch(/fictícia/);
  });

  it('não finge que a IA funciona', async () => {
    await expect(newRepo().extractMenu()).rejects.toThrow(/não está disponível no modo demonstração/);
  });

  it('cria, edita cardápio, publica e só expõe itens revisados', async () => {
    const repo = newRepo();
    const project = await repo.createProject({ ...DEFAULT_PROJECT, restaurantName: 'Teste' });
    const categoryId = crypto.randomUUID();
    const base = { projectId: project.id, categoryId, description: '', variations: [], imageUrl: null, available: true, sourceReference: 'manual', confidence: null, reviewNotes: [], createdAt: '', updatedAt: '' };
    await repo.saveMenu(project.id, [{ id: categoryId, projectId: project.id, name: 'Pratos', sortOrder: 0 }], [
      { ...base, id: crypto.randomUUID(), name: 'Pronto', price: 10, sortOrder: 0, reviewRequired: false },
      { ...base, id: crypto.randomUUID(), name: 'Pendente', price: 12, sortOrder: 1, reviewRequired: true },
    ]);
    expect(await repo.getPublicMenu('teste')).toBeNull();
    await repo.updateProject(project.id, { slug: 'teste', status: 'published' });
    const menu = await repo.getPublicMenu('teste');
    expect(menu!.categories[0].products.map((p) => p.name)).toEqual(['Pronto']);
  });

  it('impede slug duplicado', async () => {
    const repo = newRepo();
    const a = await repo.createProject({ ...DEFAULT_PROJECT, restaurantName: 'A' });
    await repo.updateProject(a.id, { slug: 'cantina-exemplo' }).catch((e) => expect(e.code).toBe('slug_taken'));
    expect(await repo.isSlugAvailable('cantina-exemplo', a.id)).toBe(false);
  });

  it('duplica projeto com categorias e produtos, sem slug', async () => {
    const repo = newRepo();
    const [demo] = await repo.listProjects();
    const copy = await repo.duplicateProject(demo.id);
    const bundle = (await repo.getBundle(copy.id))!;
    expect(copy.slug).toBeNull();
    expect(copy.status).toBe('setup');
    expect(bundle.products.length).toBe(demo.productCount);
    expect(new Set(bundle.products.map((p) => p.categoryId))).toEqual(new Set(bundle.categories.map((c) => c.id)));
  });
});
