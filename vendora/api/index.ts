import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp, createContext } from '../server/src/app';
import { loadConfig } from '../server/src/config';

/**
 * Função serverless da Vercel: todas as rotas /api/* chegam aqui (ver vercel.json)
 * e são repassadas ao mesmo app Fastify usado fora da Vercel.
 * A instância é reaproveitada entre invocações enquanto o processo estiver quente.
 */
let ready: Promise<FastifyInstance> | null = null;

function boot() {
  ready ??= (async () => {
    const app = await buildApp(createContext(loadConfig()));
    await app.ready();
    return app;
  })();
  ready.catch(() => {
    ready = null;
  });
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  let app: FastifyInstance;
  try {
    app = await boot();
  } catch (err) {
    // Configuração incompleta (ex.: DATABASE_URL ausente): responde com os nomes das variáveis, nunca os valores.
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: { code: 'not_configured', message: 'Servidor sem configuração completa.', details: (err as Error).message },
      }),
    );
    return;
  }
  app.server.emit('request', req, res);
}
