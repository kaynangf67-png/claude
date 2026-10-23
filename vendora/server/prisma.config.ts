import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` não precisa de banco; migrate/deploy exigem DATABASE_URL.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
