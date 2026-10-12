import type { Category, Product, Project, ProjectBundle, PublicMenu } from './types';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 60;
const RESERVED_SLUGS = new Set(['admin', 'api', 'login', 'm', 'novo', 'projetos', 'configuracoes', 'previa']);

/** "Sabor da Casa!" → "sabor-da-casa" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

/** Mensagem de erro em português, ou null se o slug é válido. */
export function slugError(slug: string): string | null {
  if (!slug) return 'Informe o endereço do cardápio.';
  if (slug.length < 3) return 'Use pelo menos 3 caracteres.';
  if (slug.length > SLUG_MAX) return `Use no máximo ${SLUG_MAX} caracteres.`;
  if (!SLUG_PATTERN.test(slug)) return 'Use só letras minúsculas, números e hífens (ex.: sabor-da-casa).';
  if (RESERVED_SLUGS.has(slug)) return 'Este endereço é reservado. Escolha outro.';
  return null;
}

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Produto tem preço utilizável: preço base ou todas as variações com preço. */
export function hasConfirmedPrice(p: Pick<Product, 'price' | 'variations'>): boolean {
  if (p.variations.length > 0) {
    return p.variations.every((v) => typeof v.price === 'number' && v.price >= 0 && v.label.trim() !== '');
  }
  return typeof p.price === 'number' && p.price >= 0;
}

/** Item que pode aparecer no cardápio público. */
export function isPublicReady(p: Product): boolean {
  return !p.reviewRequired && p.name.trim() !== '' && hasConfirmedPrice(p);
}

export interface Check {
  id: string;
  ok: boolean;
  label: string;
  detail?: string;
}

/** Tudo que precisa estar certo antes de aprovar/publicar. */
export function publishChecks(bundle: Pick<ProjectBundle, 'project' | 'products' | 'categories'>): Check[] {
  const { project, products } = bundle;
  const pending = products.filter((p) => p.reviewRequired);
  const noPrice = products.filter((p) => !p.reviewRequired && !hasConfirmedPrice(p));
  const ready = products.filter(isPublicReady);
  return [
    { id: 'name', ok: project.restaurantName.trim() !== '', label: 'Nome do restaurante preenchido' },
    {
      id: 'slug',
      ok: project.slug !== null && slugError(project.slug) === null,
      label: 'Endereço público (slug) definido',
      detail: project.slug ? (slugError(project.slug) ?? undefined) : 'Defina o endereço na etapa Publicação.',
    },
    {
      id: 'products',
      ok: ready.length > 0,
      label: 'Pelo menos um produto revisado e com preço',
      detail: ready.length === 0 ? 'Adicione ou revise produtos no editor.' : `${ready.length} produto(s) prontos.`,
    },
    {
      id: 'review',
      ok: pending.length === 0,
      label: 'Nenhum item aguardando revisão',
      detail: pending.length ? `${pending.length} item(ns) marcados para revisão no editor.` : undefined,
    },
    {
      id: 'prices',
      ok: noPrice.length === 0,
      label: 'Todos os preços confirmados',
      detail: noPrice.length ? `${noPrice.length} item(ns) sem preço: ${noPrice.slice(0, 3).map((p) => p.name).join(', ')}` : undefined,
    },
    {
      id: 'colors',
      ok: HEX_COLOR.test(project.primaryColor) && HEX_COLOR.test(project.secondaryColor),
      label: 'Cores válidas',
    },
  ];
}

export const canApprove = (bundle: Parameters<typeof publishChecks>[0]) => publishChecks(bundle).every((c) => c.ok);

/** Monta o cardápio público a partir do projeto: só itens revisados, sem dados internos. */
export function toPublicMenu(bundle: Pick<ProjectBundle, 'project' | 'categories' | 'products'>): PublicMenu | null {
  const { project } = bundle;
  if (project.status !== 'published' || !project.slug) return null;
  const categories = [...bundle.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c: Category) => ({
      id: c.id,
      name: c.name,
      products: bundle.products
        .filter((p) => p.categoryId === c.id && isPublicReady(p))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.variations.length ? null : p.price,
          variations: p.variations,
          imageUrl: p.imageUrl,
          available: p.available,
        })),
    }))
    .filter((c) => c.products.length > 0);
  return publicFields(project, categories);
}

/** Prévia privada: mesmo formato público, mas com tudo que já está pronto (independente do status). */
export function toPreviewMenu(bundle: Pick<ProjectBundle, 'project' | 'categories' | 'products'>): PublicMenu {
  const published = { ...bundle.project, status: 'published' as const, slug: bundle.project.slug ?? 'previa' };
  return toPublicMenu({ ...bundle, project: published })!;
}

function publicFields(project: Project, categories: PublicMenu['categories']): PublicMenu {
  return {
    slug: project.slug!,
    restaurantName: project.restaurantName,
    description: project.description,
    businessType: project.businessType,
    phone: project.phone,
    whatsappNumber: project.showWhatsapp && project.whatsappNumber ? project.whatsappNumber : null,
    address: project.address,
    openingHours: project.openingHours,
    instagramUrl: project.instagramUrl,
    googleMapsUrl: project.googleMapsUrl,
    websiteUrl: project.websiteUrl,
    logoUrl: project.logoUrl,
    coverUrl: project.coverUrl,
    primaryColor: project.primaryColor,
    secondaryColor: project.secondaryColor,
    theme: project.theme,
    categories,
  };
}

/** Telefone para link do WhatsApp: só dígitos, com DDI 55. */
export function whatsappDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return null;
}

export function isHttpsUrl(value: string): boolean {
  if (!value) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Erros de validação dos dados do restaurante (campo → mensagem). */
export function projectFieldErrors(p: Pick<Project, 'restaurantName' | 'instagramUrl' | 'googleMapsUrl' | 'websiteUrl' | 'primaryColor' | 'secondaryColor' | 'whatsappNumber' | 'showWhatsapp'>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!p.restaurantName.trim()) errors.restaurantName = 'Informe o nome do restaurante.';
  if (p.restaurantName.length > 120) errors.restaurantName = 'Use no máximo 120 caracteres.';
  for (const key of ['instagramUrl', 'googleMapsUrl', 'websiteUrl'] as const) {
    if (!isHttpsUrl(p[key])) errors[key] = 'Use um link completo começando com https://';
  }
  if (!HEX_COLOR.test(p.primaryColor)) errors.primaryColor = 'Cor inválida (use #rrggbb).';
  if (!HEX_COLOR.test(p.secondaryColor)) errors.secondaryColor = 'Cor inválida (use #rrggbb).';
  if (p.showWhatsapp && !whatsappDigits(p.whatsappNumber)) errors.whatsappNumber = 'Informe DDD + número (ex.: 27 99999-9999).';
  return errors;
}
