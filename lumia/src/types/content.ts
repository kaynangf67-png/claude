/**
 * CONTENT CATALOG — modelo de dados.
 *
 * Este é o contrato que a CONTENT CATALOG API (ver services/catalogService.ts)
 * expõe. Ele já carrega tudo o que um catálogo licenciado precisa: direitos,
 * territórios, faixas de áudio, legendas WebVTT e — o diferencial da LUMIA —
 * disponibilidade de interpretação em cada língua de sinais.
 */
import type { PlanTier } from '@/business/plans';

/**
 * Línguas de sinais são línguas próprias, com gramática própria.
 * Libras NÃO é "português sinalizado", ASL não é "inglês sinalizado",
 * e ASL ≠ BSL mesmo que os dois países falem inglês.
 * O código combina região + sigla para que nunca sejam confundidas.
 */
export type SignLanguageCode =
  | 'pt-BR-LIBRAS'
  | 'en-US-ASL'
  | 'en-GB-BSL'
  | 'fr-FR-LSF'
  | 'es-ES-LSE'
  | 'pt-PT-LGP'
  | 'ja-JP-JSL'
  | 'ko-KR-KSL'
  | 'de-DE-DGS';

export const SIGN_LANGUAGES: Record<SignLanguageCode, { name: string; short: string; country: string }> = {
  'pt-BR-LIBRAS': { name: 'Língua Brasileira de Sinais', short: 'Libras', country: 'Brasil' },
  'en-US-ASL': { name: 'American Sign Language', short: 'ASL', country: 'Estados Unidos' },
  'en-GB-BSL': { name: 'British Sign Language', short: 'BSL', country: 'Reino Unido' },
  'fr-FR-LSF': { name: 'Langue des Signes Française', short: 'LSF', country: 'França' },
  'es-ES-LSE': { name: 'Lengua de Signos Española', short: 'LSE', country: 'Espanha' },
  'pt-PT-LGP': { name: 'Língua Gestual Portuguesa', short: 'LGP', country: 'Portugal' },
  'ja-JP-JSL': { name: '日本手話 (Japanese Sign Language)', short: 'JSL', country: 'Japão' },
  'ko-KR-KSL': { name: '한국수어 (Korean Sign Language)', short: 'KSL', country: 'Coreia do Sul' },
  'de-DE-DGS': { name: 'Deutsche Gebärdensprache', short: 'DGS', country: 'Alemanha' },
};

/** Ciclo de confiança de uma interpretação. Nada é "perfeito" por ser gerado por IA. */
export type InterpretationStatus = 'AI_GENERATED' | 'REVIEW_REQUIRED' | 'HUMAN_VERIFIED' | 'PUBLISHED';

export const STATUS_LABEL: Record<InterpretationStatus, string> = {
  AI_GENERATED: 'Gerado por IA',
  REVIEW_REQUIRED: 'Revisão necessária',
  HUMAN_VERIFIED: 'Verificado por humanos',
  PUBLISHED: 'Publicado',
};

export type ContentKind = 'movie' | 'series' | 'documentary' | 'short';

export type LicenseType =
  | 'LUMIA_ORIGINAL' // produzido pela própria empresa
  | 'PUBLIC_DOMAIN'
  | 'LICENSED' // contrato com estúdio/distribuidora
  | 'AUTHORIZED_TRAILER'
  | 'PARTNER_UPLOAD'
  | 'IN_NEGOTIATION' // título listado, sem direito de exibição ainda
  | 'FICTIONAL_DEMO'; // título fictício só para demonstrar o catálogo

export interface LicenseInfo {
  type: LicenseType;
  holder: string;
  territories: string[]; // ISO 3166-1 alpha-2 ou "WORLD"
  validUntil?: string;
  allowsSignLanguageOverlay: boolean; // o contrato permite sobrepor intérprete ao vídeo?
  notes?: string;
}

export interface VideoRendition {
  id: string;
  label: string; // "720p"
  height: number;
  src: string; // MP4 (H.264/AAC)
  /** Alternativa WebM (VP9/Opus) para navegadores sem H.264 (ex.: alguns Chromium/Linux). */
  webm?: string;
  bitrateKbps: number;
}

export interface TimedTextTrack {
  id: string;
  kind: 'captions' | 'subtitles' | 'sounds' | 'descriptions';
  lang: string;
  label: string;
  src: string;
  format: 'webvtt';
}

export interface AudioTrack {
  id: string;
  lang: string;
  label: string;
  kind: 'original' | 'dub' | 'audio-description';
  available: boolean;
}

export interface SignLanguageAvailability {
  language: SignLanguageCode;
  /** PLANNED/NOT_AVAILABLE: ainda não existe interpretação para este título. */
  status: InterpretationStatus | 'PLANNED' | 'NOT_AVAILABLE';
  source: 'pre-processed' | 'live' | 'none';
  interpretationId?: string;
}

export type Availability = 'AVAILABLE' | 'COMING_SOON' | 'LICENSING' | 'UNAVAILABLE';

export interface Episode {
  number: number;
  title: string;
  durationMin: number;
  synopsis: string;
}

export interface CatalogItem {
  id: string;
  slug: string;
  kind: ContentKind;
  title: string;
  originalTitle?: string;
  tagline: string;
  synopsis: string;
  year: number;
  durationMin: number;
  /** Classificação indicativa brasileira (ClassInd). */
  maturity: 'L' | '10' | '12' | '14' | '16' | '18';
  genres: string[];
  country: string; // ISO alpha-2
  originalLanguage: string; // BCP-47
  audioLanguages: string[];
  subtitleLanguages: string[];
  cast: string[];
  director: string;
  poster: string;
  backdrop: string;
  accent: string;
  /** Prévia: arquivo + Media Fragment (#t=início,fim). */
  trailer?: string;
  video?: {
    durationSec: number;
    renditions: VideoRendition[];
  };
  textTracks: TimedTextTrack[];
  audioTracks: AudioTrack[];
  signLanguages: SignLanguageAvailability[];
  availability: Availability;
  regions: string[];
  license: LicenseInfo;
  access: PlanTier;
  tags: Array<'new' | 'popular' | 'recommended' | 'original' | 'demo-flagship'>;
  seasons?: { number: number; episodes: Episode[] }[];
  /** Todo o catálogo de demonstração é fictício — a UI deixa isso visível. */
  fictional: boolean;
  /** Recursos de acessibilidade além da língua de sinais. */
  accessibility: {
    captions: boolean;
    soundDescriptions: boolean;
    emotionalContext: boolean;
    audioDescription: 'available' | 'planned' | 'none';
  };
  /** Identifica conteúdo cadastrado localmente pelo usuário via Estúdio. */
  userSubmitted?: boolean;
}

export const KIND_LABEL: Record<ContentKind, string> = {
  movie: 'Filme',
  series: 'Série',
  documentary: 'Documentário',
  short: 'Curta',
};

export const COUNTRY_LABEL: Record<string, string> = {
  BR: 'Brasil',
  US: 'Estados Unidos',
  GB: 'Reino Unido',
  FR: 'França',
  ES: 'Espanha',
  PT: 'Portugal',
  JP: 'Japão',
  KR: 'Coreia do Sul',
  DE: 'Alemanha',
  WORLD: 'Global',
};

export const LANGUAGE_LABEL: Record<string, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  ja: 'Japonês',
  ko: 'Coreano',
  'pt-PT': 'Português (Portugal)',
  de: 'Alemão',
};
