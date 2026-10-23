import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppContext } from '../context';
import { sha256 } from './crypto';
import { AppError } from './errors';

export const SESSION_COOKIE = 'vendora_session';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

export function sessionCookieOptions(ctx: AppContext) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: ctx.config.COOKIE_SECURE || ctx.config.NODE_ENV === 'production',
    maxAge: ctx.config.SESSION_TTL_DAYS * 24 * 3600,
  };
}

/** preHandler: exige sessão válida. Cada rota filtra os dados por request.userId. */
export function requireAuth(ctx: AppContext) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) throw new AppError(401, 'unauthenticated', 'Entre na sua conta para continuar.');
    const session = await ctx.db.session.findUnique({ where: { tokenHash: sha256(token) } });
    if (!session || session.expiresAt < new Date()) {
      if (session) await ctx.db.session.delete({ where: { id: session.id } }).catch(() => {});
      throw new AppError(401, 'session_expired', 'Sua sessão expirou. Entre novamente.');
    }
    request.userId = session.userId;
  };
}

export const uid = (request: FastifyRequest) => {
  if (!request.userId) throw new AppError(401, 'unauthenticated', 'Entre na sua conta para continuar.');
  return request.userId;
};
