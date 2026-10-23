import { createHash } from 'node:crypto';
import { MARKETPLACE_PROFILES, type MarketplaceId } from '@vendora/shared';
import type { Config } from '../../config';
import { AppError } from '../../lib/errors';

/** Estado honesto de cada capacidade, exibido na tela de integrações. */
export type CapabilityState = 'implemented_untested' | 'needs_credentials' | 'not_implemented';

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  externalUserId: string;
  scopes: string | null;
}

/**
 * Separação de responsabilidades por canal:
 * - geração de conteúdo: módulo ai (independe do canal, recebe as regras)
 * - validação de regras: @vendora/shared (validateListingText / validateImage)
 * - autorização da conta: authorizationUrl / exchangeCode / refresh
 * - envio do anúncio: publish
 * - consulta de status: publicationStatus
 */
export interface MarketplaceAdapter {
  readonly id: MarketplaceId;
  readonly name: string;
  capabilities(): { authorization: CapabilityState; publish: CapabilityState; status: CapabilityState };
  authorizationUrl?(state: string, codeVerifier: string): string;
  exchangeCode?(code: string, codeVerifier: string): Promise<TokenSet>;
  refresh?(refreshToken: string): Promise<TokenSet>;
  publish(): Promise<never>;
  publicationStatus(): Promise<never>;
}

const notImplemented = (name: string, what: string) =>
  new AppError(
    501,
    'not_implemented',
    `${what} no ${name} ainda não está implementado. Exporte o anúncio e publique manualmente pelo painel do vendedor.`,
  );

export const pkceChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/**
 * Mercado Livre — OAuth 2.0 (authorization code + PKCE), conforme
 * https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao.
 * Implementado mas não testado contra a API real: requer um app criado no DevCenter.
 */
export class MercadoLivreAdapter implements MarketplaceAdapter {
  readonly id = 'mercado_livre' as const;
  readonly name = MARKETPLACE_PROFILES.mercado_livre.name;
  constructor(
    private readonly config: Config,
    private readonly http: typeof fetch = fetch,
  ) {}

  private get configured() {
    return Boolean(this.config.ML_CLIENT_ID && this.config.ML_CLIENT_SECRET);
  }
  private get redirectUri() {
    return `${this.config.APP_URL}/api/integrations/mercado_livre/callback`;
  }

  capabilities() {
    return {
      authorization: this.configured ? ('implemented_untested' as const) : ('needs_credentials' as const),
      publish: 'not_implemented' as const,
      status: 'not_implemented' as const,
    };
  }

  authorizationUrl(state: string, codeVerifier: string) {
    if (!this.configured) throw new AppError(503, 'not_configured', 'Configure ML_CLIENT_ID e ML_CLIENT_SECRET no servidor.');
    const u = new URL(this.config.ML_AUTH_URL);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('client_id', this.config.ML_CLIENT_ID!);
    u.searchParams.set('redirect_uri', this.redirectUri);
    u.searchParams.set('state', state);
    u.searchParams.set('code_challenge', pkceChallenge(codeVerifier));
    u.searchParams.set('code_challenge_method', 'S256');
    return u.toString();
  }

  private async token(params: Record<string, string>): Promise<TokenSet> {
    const res = await this.http(`${this.config.ML_API_URL}/oauth/token`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.ML_CLIENT_ID!,
        client_secret: this.config.ML_CLIENT_SECRET!,
        ...params,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new AppError(502, 'oauth_failed', 'O Mercado Livre não aceitou a autorização. Tente conectar de novo.');
    const body = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      user_id: number | string;
      scope?: string;
    };
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
      externalUserId: String(body.user_id),
      scopes: body.scope ?? null,
    };
  }

  exchangeCode(code: string, codeVerifier: string) {
    return this.token({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri, code_verifier: codeVerifier });
  }

  refresh(refreshToken: string) {
    return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  async publish(): Promise<never> {
    throw notImplemented(this.name, 'A publicação automática');
  }
  async publicationStatus(): Promise<never> {
    throw notImplemented(this.name, 'A consulta de status de publicação');
  }
}

/**
 * Shopee Open Platform e TikTok Shop Partner Center exigem cadastro e aprovação
 * como parceiro antes de liberar credenciais. Até lá, só exportação manual.
 */
class PendingPartnerAdapter implements MarketplaceAdapter {
  constructor(
    readonly id: MarketplaceId,
    readonly name: string,
  ) {}
  capabilities() {
    return { authorization: 'not_implemented' as const, publish: 'not_implemented' as const, status: 'not_implemented' as const };
  }
  async publish(): Promise<never> {
    throw notImplemented(this.name, 'A publicação automática');
  }
  async publicationStatus(): Promise<never> {
    throw notImplemented(this.name, 'A consulta de status de publicação');
  }
}

export function createAdapters(config: Config): Record<MarketplaceId, MarketplaceAdapter> {
  return {
    mercado_livre: new MercadoLivreAdapter(config),
    shopee: new PendingPartnerAdapter('shopee', MARKETPLACE_PROFILES.shopee.name),
    tiktok_shop: new PendingPartnerAdapter('tiktok_shop', MARKETPLACE_PROFILES.tiktok_shop.name),
  };
}
