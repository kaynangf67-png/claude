/**
 * CONTENT CATALOG API
 *
 * Interface única para o catálogo. Hoje existe um provedor local
 * (dados de demonstração + títulos cadastrados no Estúdio, salvos no navegador).
 *
 * TODO: FUTURE BACKEND INTEGRATION
 *   Implementar HttpCatalogProvider contra a API própria da LUMIA
 *   (VITE_CATALOG_API_URL). Contrato REST proposto (ainda não existe servidor):
 *     GET    /v1/titles?kind=&genre=&country=&signLanguage=&q=
 *     GET    /v1/titles/:slug
 *     POST   /v1/titles                (parceiros: cadastro com licença)
 *     PATCH  /v1/titles/:slug
 *     GET    /v1/titles/:slug/interpretations/:signLanguage
 *   Integrações de terceiros (catálogos licenciados, APIs oficiais de
 *   distribuidoras) entram como provedores adicionais atrás desta interface.
 */
import type { CatalogItem, ContentKind, LicenseType, SignLanguageCode } from '@/types/content';
import { MOVIES } from '@/data/movies';
import { loadRaw, save } from './storage';

export interface CatalogQuery {
  kind?: ContentKind | ContentKind[];
  genre?: string;
  country?: string;
  signLanguage?: SignLanguageCode;
  tag?: CatalogItem['tags'][number];
  q?: string;
  playableOnly?: boolean;
}

export interface CatalogProvider {
  list(query?: CatalogQuery): Promise<CatalogItem[]>;
  get(slug: string): Promise<CatalogItem | undefined>;
  create(input: NewTitleInput): Promise<CatalogItem>;
}

export interface NewTitleInput {
  title: string;
  synopsis: string;
  kind: ContentKind;
  year: number;
  durationMin: number;
  maturity: CatalogItem['maturity'];
  genres: string[];
  country: string;
  originalLanguage: string;
  poster?: string;
  videoUrl?: string;
  licenseType: LicenseType;
  licenseHolder: string;
  territories: string[];
  allowsSignLanguageOverlay: boolean;
  signLanguages: SignLanguageCode[];
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function matches(item: CatalogItem, q: CatalogQuery): boolean {
  if (q.kind) {
    const kinds = Array.isArray(q.kind) ? q.kind : [q.kind];
    if (!kinds.includes(item.kind)) return false;
  }
  if (q.genre && !item.genres.some((g) => norm(g) === norm(q.genre!))) return false;
  if (q.country && item.country !== q.country) return false;
  if (q.tag && !item.tags.includes(q.tag)) return false;
  if (q.signLanguage && !item.signLanguages.some((s) => s.language === q.signLanguage && s.status !== 'PLANNED' && s.status !== 'NOT_AVAILABLE')) return false;
  if (q.playableOnly && !item.video) return false;
  if (q.q) {
    const hay = norm([item.title, item.originalTitle, item.synopsis, item.genres.join(' '), item.cast.join(' '), item.director].join(' '));
    if (!norm(q.q).split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

/** Direitos: o que pode entrar no catálogo como título exibível. */
export function validateRights(input: NewTitleInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('Informe o título.');
  if (!input.licenseHolder.trim()) errors.push('Informe o titular dos direitos.');
  if (input.licenseType === 'FICTIONAL_DEMO') errors.push('Títulos fictícios são reservados ao catálogo de demonstração.');
  if (input.videoUrl && input.licenseType === 'IN_NEGOTIATION') errors.push('Conteúdo em negociação não pode ter vídeo publicado.');
  if (input.videoUrl && !/^(https:\/\/|\/)/.test(input.videoUrl)) errors.push('O vídeo deve ser uma URL https ou um caminho do próprio site.');
  if (!input.allowsSignLanguageOverlay && input.signLanguages.length) errors.push('O contrato não permite sobrepor intérprete — remova as línguas de sinais ou revise a licença.');
  if (!input.territories.length) errors.push('Informe ao menos um território licenciado.');
  return errors;
}

class LocalCatalogProvider implements CatalogProvider {
  private userItems(): CatalogItem[] {
    return loadRaw<CatalogItem[]>('catalog:user', []);
  }
  private all(): CatalogItem[] {
    return [...MOVIES, ...this.userItems()];
  }
  async list(query: CatalogQuery = {}) {
    return this.all().filter((i) => matches(i, query));
  }
  async get(slug: string) {
    return this.all().find((i) => i.slug === slug);
  }
  async create(input: NewTitleInput): Promise<CatalogItem> {
    const errors = validateRights(input);
    if (errors.length) throw new Error(errors.join(' '));
    const base = norm(input.title).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'titulo';
    let slug = base;
    let n = 2;
    while (this.all().some((i) => i.slug === slug)) slug = `${base}-${n++}`;
    const item: CatalogItem = {
      id: slug,
      slug,
      kind: input.kind,
      title: input.title.trim(),
      tagline: '',
      synopsis: input.synopsis.trim(),
      year: input.year,
      durationMin: input.durationMin,
      maturity: input.maturity,
      genres: input.genres,
      country: input.country,
      originalLanguage: input.originalLanguage,
      audioLanguages: [input.originalLanguage],
      subtitleLanguages: [],
      cast: [],
      director: '—',
      poster: input.poster || '/posters/noite-de-estreia.webp',
      backdrop: input.poster || '/posters/noite-de-estreia-backdrop.webp',
      accent: '#ffb86b',
      video: input.videoUrl ? { durationSec: input.durationMin * 60, renditions: [{ id: 'src', label: 'Original', height: 720, src: input.videoUrl, bitrateKbps: 0 }] } : undefined,
      textTracks: [],
      audioTracks: [{ id: 'orig', lang: input.originalLanguage, label: 'Original', kind: 'original', available: Boolean(input.videoUrl) }],
      signLanguages: input.signLanguages.map((language) => ({ language, status: 'PLANNED', source: 'none' })),
      availability: input.videoUrl ? 'AVAILABLE' : 'COMING_SOON',
      regions: input.territories,
      license: { type: input.licenseType, holder: input.licenseHolder, territories: input.territories, allowsSignLanguageOverlay: input.allowsSignLanguageOverlay },
      access: 'FREE',
      tags: ['new'],
      fictional: false,
      userSubmitted: true,
      accessibility: { captions: false, soundDescriptions: false, emotionalContext: false, audioDescription: 'none' },
    };
    save('catalog:user', [...this.userItems(), item]);
    return item;
  }
}

export const catalog: CatalogProvider = new LocalCatalogProvider();

export function genresOf(items: CatalogItem[]): string[] {
  return [...new Set(items.flatMap((i) => i.genres))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function hasInterpretation(item: CatalogItem, lang: SignLanguageCode = 'pt-BR-LIBRAS') {
  return item.signLanguages.some((s) => s.language === lang && s.source !== 'none');
}

export function isPlayable(item: CatalogItem) {
  return Boolean(item.video) && item.availability === 'AVAILABLE';
}
