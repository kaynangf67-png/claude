import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export type Db = PrismaClient;

/**
 * Aceita `?schema=nome` na DATABASE_URL (mesma convenção do Prisma CLI), para o
 * Vendora poder ocupar um schema próprio num banco compartilhado.
 */
export function createDb(connectionString: string): Db {
  const url = new URL(connectionString);
  const schema = url.searchParams.get('schema') ?? undefined;
  url.searchParams.delete('schema');
  const serverless = Boolean(process.env.VERCEL);
  const adapter = new PrismaPg(
    // Em função serverless cada instância usa poucas conexões, para não esgotar o pooler.
    { connectionString: url.toString(), max: serverless ? 2 : 10 },
    schema ? { schema } : undefined,
  );
  return new PrismaClient({ adapter });
}
