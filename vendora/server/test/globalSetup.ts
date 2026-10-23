import { execSync } from 'node:child_process';
import { config } from 'dotenv';

/** Aplica as migrações no banco de testes (TEST_DATABASE_URL) antes da suíte. */
export default function setup() {
  config({ path: '../.env', quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Defina TEST_DATABASE_URL (banco PostgreSQL só para testes).');
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } });
}
