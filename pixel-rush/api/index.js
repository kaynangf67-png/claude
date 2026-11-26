// Função serverless (Vercel): toda rota /api/* cai aqui.
// As telas (public/) e o código compartilhado (shared/) são servidos como arquivos estáticos.
import { createServer } from '../server/index.js';

let appPromise = null;

export default async function handler(req, res) {
  if (!appPromise) appPromise = createServer({ serverless: true }).catch((e) => { appPromise = null; throw e; });
  try {
    const app = await appPromise;
    await app.handle(req, res);
  } catch (e) {
    console.error('falha ao iniciar', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Servidor indisponível, tente novamente em instantes' }));
  }
}
