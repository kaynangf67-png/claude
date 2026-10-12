import { describe, expect, it } from 'vitest';
import { canApprove, hasConfirmedPrice, projectFieldErrors, publishChecks, slugError, slugify, toPublicMenu, whatsappDigits } from './rules';
import type { Category, Product, Project } from './types';

const project = (over: Partial<Project> = {}): Project => ({
  id: 'p1', ownerId: 'u1', restaurantName: 'Sabor da Casa', slug: 'sabor-da-casa', description: '', businessType: 'Restaurante',
  phone: '', whatsappNumber: '27999999999', showWhatsapp: false, address: '', openingHours: '', instagramUrl: '', googleMapsUrl: '',
  websiteUrl: '', logoUrl: null, coverUrl: null, primaryColor: '#1e3a5f', secondaryColor: '#c2410c', theme: 'claro', status: 'published',
  isDemo: false, publishedAt: null, createdAt: '', updatedAt: '', ...over,
});
const cat: Category = { id: 'c1', projectId: 'p1', name: 'Pratos', sortOrder: 0 };
const product = (over: Partial<Product> = {}): Product => ({
  id: 'x1', projectId: 'p1', categoryId: 'c1', name: 'Feijoada', description: '', price: 39.9, variations: [], imageUrl: null,
  available: true, sortOrder: 0, sourceReference: 'ia:foto.jpg', confidence: 0.9, reviewRequired: false, reviewNotes: ['nota interna'],
  createdAt: '', updatedAt: '', ...over,
});

describe('slug', () => {
  it('gera e valida', () => {
    expect(slugify('Sabor da Casa — Açaí!')).toBe('sabor-da-casa-acai');
    expect(slugError('sabor-da-casa')).toBeNull();
    expect(slugError('Sabor')).not.toBeNull();
    expect(slugError('ab')).not.toBeNull();
    expect(slugError('admin')).not.toBeNull();
  });
});

describe('preços', () => {
  it('variações precisam de todos os preços', () => {
    expect(hasConfirmedPrice({ price: null, variations: [{ label: 'P', price: 10 }, { label: 'G', price: null }] })).toBe(false);
    expect(hasConfirmedPrice({ price: null, variations: [{ label: 'P', price: 10 }] })).toBe(true);
    expect(hasConfirmedPrice({ price: null, variations: [] })).toBe(false);
  });
});

describe('publicação', () => {
  it('bloqueia com item em revisão ou sem preço', () => {
    const bundle = { project: project(), categories: [cat], products: [product(), product({ id: 'x2', reviewRequired: true })] };
    expect(canApprove(bundle)).toBe(false);
    expect(publishChecks(bundle).find((c) => c.id === 'review')!.ok).toBe(false);
  });
  it('libera quando tudo está revisado', () => {
    expect(canApprove({ project: project(), categories: [cat], products: [product()] })).toBe(true);
  });
});

describe('toPublicMenu', () => {
  it('não publica projeto não publicado', () => {
    expect(toPublicMenu({ project: project({ status: 'approved' }), categories: [cat], products: [product()] })).toBeNull();
  });
  it('remove itens pendentes e campos internos', () => {
    const menu = toPublicMenu({
      project: project(),
      categories: [cat, { ...cat, id: 'c2', name: 'Vazia' }],
      products: [product(), product({ id: 'x2', name: 'Pendente', reviewRequired: true }), product({ id: 'x3', name: 'Sem preço', price: null })],
    })!;
    expect(menu.categories).toHaveLength(1);
    expect(menu.categories[0].products.map((p) => p.name)).toEqual(['Feijoada']);
    const json = JSON.stringify(menu);
    for (const leak of ['ownerId', 'u1', 'sourceReference', 'confidence', 'nota interna', 'reviewNotes']) expect(json).not.toContain(leak);
  });
  it('WhatsApp só aparece quando autorizado', () => {
    const base = { categories: [cat], products: [product()] };
    expect(toPublicMenu({ ...base, project: project() })!.whatsappNumber).toBeNull();
    expect(toPublicMenu({ ...base, project: project({ showWhatsapp: true }) })!.whatsappNumber).toBe('27999999999');
  });
});

describe('validação de campos', () => {
  it('aponta erros', () => {
    const errors = projectFieldErrors({ ...project({ restaurantName: ' ', instagramUrl: 'instagram.com/x', primaryColor: 'azul', showWhatsapp: true, whatsappNumber: '123' }) });
    expect(Object.keys(errors).sort()).toEqual(['instagramUrl', 'primaryColor', 'restaurantName', 'whatsappNumber']);
  });
  it('normaliza WhatsApp', () => {
    expect(whatsappDigits('(27) 99999-9999')).toBe('5527999999999');
    expect(whatsappDigits('99999-9999')).toBeNull();
  });
});
