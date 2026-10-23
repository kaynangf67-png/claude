import type { AppContext } from '../../context';
import { decrypt, encrypt } from '../../lib/crypto';

/** Token do Mercado Livre do usuário, renovado automaticamente se estiver perto de expirar. */
export async function mercadoLivreAccessToken(ctx: AppContext, userId: string): Promise<string | null> {
  const conn = await ctx.db.marketplaceConnection.findUnique({
    where: { userId_marketplace: { userId, marketplace: 'mercado_livre' } },
  });
  if (!conn || conn.status !== 'connected') return null;
  const key = ctx.config.TOKEN_ENCRYPTION_KEY;
  if (conn.expiresAt.getTime() - Date.now() > 60_000) return decrypt(conn.accessTokenEnc, key);

  const adapter = ctx.adapters.mercado_livre;
  if (!conn.refreshTokenEnc || !adapter.refresh) {
    await ctx.db.marketplaceConnection.update({ where: { id: conn.id }, data: { status: 'expired' } });
    return null;
  }
  try {
    const t = await adapter.refresh(decrypt(conn.refreshTokenEnc, key));
    await ctx.db.marketplaceConnection.update({
      where: { id: conn.id },
      data: {
        accessTokenEnc: encrypt(t.accessToken, key),
        refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken, key) : conn.refreshTokenEnc,
        expiresAt: t.expiresAt,
        status: 'connected',
      },
    });
    return t.accessToken;
  } catch {
    await ctx.db.marketplaceConnection.update({ where: { id: conn.id }, data: { status: 'expired' } });
    return null;
  }
}
