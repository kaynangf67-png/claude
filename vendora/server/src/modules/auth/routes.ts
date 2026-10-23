import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../../context';
import { requireAuth, SESSION_COOKIE, sessionCookieOptions, uid } from '../../lib/auth';
import { hashPassword, randomToken, sha256, verifyPassword } from '../../lib/crypto';
import { AppError } from '../../lib/errors';

const Register = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10, 'A senha precisa ter pelo menos 10 caracteres.').max(200),
});
const Login = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

// Hash fixo para gastar o mesmo tempo quando o e-mail não existe (evita enumerar contas pelo tempo de resposta).
let dummyHash: Promise<string> | null = null;

export function authRoutes(app: FastifyInstance, ctx: AppContext) {
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  async function startSession(userId: string) {
    const token = randomToken();
    await ctx.db.session.create({
      data: {
        userId,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + ctx.config.SESSION_TTL_DAYS * 24 * 3600 * 1000),
      },
    });
    return token;
  }

  app.post('/api/auth/register', authLimit, async (request, reply) => {
    const body = Register.parse(request.body);
    const exists = await ctx.db.user.findUnique({ where: { email: body.email } });
    if (exists) throw new AppError(409, 'email_taken', 'Já existe uma conta com este e-mail.');
    const user = await ctx.db.user.create({
      data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password) },
    });
    reply.setCookie(SESSION_COOKIE, await startSession(user.id), sessionCookieOptions(ctx));
    return reply.code(201).send({ user: { id: user.id, name: user.name, email: user.email } });
  });

  app.post('/api/auth/login', authLimit, async (request, reply) => {
    const body = Login.parse(request.body);
    const user = await ctx.db.user.findUnique({ where: { email: body.email } });
    dummyHash ??= hashPassword('dummy-password-for-timing');
    const ok = await verifyPassword(body.password, user?.passwordHash ?? (await dummyHash));
    if (!user || !ok) throw new AppError(401, 'invalid_credentials', 'E-mail ou senha incorretos.');
    reply.setCookie(SESSION_COOKIE, await startSession(user.id), sessionCookieOptions(ctx));
    return { user: { id: user.id, name: user.name, email: user.email } };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await ctx.db.session.deleteMany({ where: { tokenHash: sha256(token) } });
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireAuth(ctx) }, async (request) => {
    const user = await ctx.db.user.findUniqueOrThrow({
      where: { id: uid(request) },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    return { user };
  });

  app.delete('/api/account', { preHandler: requireAuth(ctx) }, async (request, reply) => {
    const userId = uid(request);
    const assets = await ctx.db.asset.findMany({ where: { userId }, select: { storageKey: true } });
    await Promise.allSettled(assets.map((a) => ctx.storage.delete(a.storageKey)));
    await ctx.db.user.delete({ where: { id: userId } }); // cascata remove sessões, produtos, anúncios, conexões
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
}
