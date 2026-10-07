/**
 * Contrato da integração com TikTok / TikTok Shop.
 *
 * Regras deste módulo:
 *  - Nenhuma senha do TikTok é pedida ou armazenada. Conexão só via OAuth oficial,
 *    com tokens guardados no servidor (tabela integration_secrets, sem acesso pelo browser).
 *  - Nada de scraping, automação de navegador ou endpoints não documentados.
 *  - Métodos sem API oficial pública retornam `unsupported` na implementação real,
 *    em vez de fingir que funcionam.
 */

export type Capability = 'authenticate' | 'getProducts' | 'publishVideo' | 'createLive' | 'scheduleLive' | 'getLiveStatus' | 'getAnalytics';

export interface CapabilityInfo {
  capability: Capability;
  /** disponível nesta implementação */
  available: boolean;
  /** observação mostrada ao usuário (ex.: "sem API oficial pública") */
  note: string;
}

export interface TikTokAccount {
  displayName: string;
  scopes: string[];
}

export interface TikTokProduct {
  externalId: string;
  title: string;
  price: number;
  imageUrl: string | null;
  url: string | null;
}

export interface LiveRequest {
  title: string;
  description: string;
  startsAt: string;
  durationMinutes: number;
  productExternalIds: string[];
}

export interface LiveHandle {
  externalId: string;
}

export interface PublishRequest {
  videoUrl: string;
  caption: string;
  /** Sem auditoria do app, a API oficial só permite SELF_ONLY (privado). */
  privacy: 'SELF_ONLY' | 'PUBLIC_TO_EVERYONE';
}

export type ExternalLiveStatus = 'scheduled' | 'running' | 'finished' | 'cancelled' | 'error';

export interface ExternalLiveState {
  status: ExternalLiveStatus;
  message?: string;
}

export interface ExternalAnalytics {
  date: string;
  views: number;
  clicks: number;
  orders: number;
  units: number;
  revenue: number;
  commission: number;
}

export class UnsupportedOperationError extends Error {
  constructor(op: Capability) {
    super(`A operação "${op}" não está disponível pela API oficial nesta integração.`);
    this.name = 'UnsupportedOperationError';
  }
}

export interface TikTokService {
  readonly mode: 'mock' | 'official';
  capabilities(): CapabilityInfo[];
  /** Inicia OAuth (redireciona) — nunca recebe senha. */
  authenticate(): Promise<TikTokAccount>;
  disconnect(): Promise<void>;
  getProducts(): Promise<TikTokProduct[]>;
  /**
   * Content Posting API (oficial). Limitações documentadas: app não auditado só publica
   * privado (SELF_ONLY) e para poucos usuários/dia; o link de produto (cestinha) é
   * adicionado no app do TikTok — não encontramos suporte a isso na API.
   */
  publishVideo(req: PublishRequest): Promise<{ publishId: string }>;
  createLive(req: LiveRequest): Promise<LiveHandle>;
  scheduleLive(req: LiveRequest): Promise<LiveHandle>;
  getLiveStatus(live: { externalId: string | null; startsAt: string; durationMinutes: number; status: string }): Promise<ExternalLiveState>;
  getAnalytics(range: { from: string; to: string }): Promise<ExternalAnalytics[]>;
}
