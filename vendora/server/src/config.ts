import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  /**
   * URL pública da aplicação. Front-end e API ficam na mesma origem
   * (em dev o Vite faz proxy de /api), então o callback do OAuth é APP_URL/api/...
   */
  APP_URL: z.string().url().default('http://localhost:5173'),
  /** Pasta com o build do front-end para servir em produção (vazio = não servir). */
  WEB_DIST_DIR: z.string().default(''),
  DATABASE_URL: z.string().min(1),
  /** 32 bytes em hex. Cifra os tokens dos marketplaces. */
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'TOKEN_ENCRYPTION_KEY deve ter 64 caracteres hex'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  COOKIE_SECURE: bool,

  // IA
  AI_PROVIDER: z.enum(['anthropic', 'none']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-opus-5-5'),
  AI_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),

  // Extração
  FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  FETCH_MAX_BYTES: z.coerce.number().int().positive().default(3 * 1024 * 1024),
  FETCH_USER_AGENT: z.string().default('VendoraBot/0.1 (+https://vendora.ai/bot)'),
  /** Respeitar robots.txt das lojas. Desligar só se tiver autorização do site. */
  RESPECT_ROBOTS_TXT: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // Imagens / armazenamento
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  IMAGE_MAX_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  ASSET_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  REMOVE_BG_API_KEY: z.string().optional(),

  // Marketplaces
  ML_CLIENT_ID: z.string().optional(),
  ML_CLIENT_SECRET: z.string().optional(),
  ML_AUTH_URL: z.string().url().default('https://auth.mercadolivre.com.br/authorization'),
  ML_API_URL: z.string().url().default('https://api.mercadolibre.com'),

  // Limites
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  ANALYZE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(60),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Mostra só os nomes das variáveis com problema — nunca os valores.
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Configuração inválida:\n  ${problems}`);
  }
  return parsed.data;
}
