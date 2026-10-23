import { buildApp, createContext } from './app';
import { loadConfig } from './config';
import { runRetention } from './jobs/retention';

const config = loadConfig();
const ctx = createContext(config);
const app = await buildApp(ctx);

app.log.info(
  { ai: ctx.generator.id, model: ctx.generator.model, storage: ctx.storage.driver, backgroundRemoval: Boolean(ctx.bgRemover) },
  'Vendora AI iniciando',
);
if (ctx.generator.id === 'basic')
  app.log.warn('ANTHROPIC_API_KEY ausente: usando o gerador básico (sem IA), que só reorganiza os dados de origem.');

// Retenção: roda na subida e a cada 6 horas.
const retention = () =>
  runRetention(ctx)
    .then((r) => app.log.info(r, 'retenção executada'))
    .catch((err) => app.log.error({ err: { message: (err as Error).message } }, 'falha na retenção'));
void retention();
setInterval(retention, 6 * 3600_000).unref();

await app.listen({ port: config.PORT, host: config.HOST });

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    await app.close();
    await ctx.db.$disconnect();
    process.exit(0);
  });
